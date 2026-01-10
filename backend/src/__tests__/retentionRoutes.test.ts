import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import eventsRouter from "../routes/events.js";
import { prisma } from "../utils/db.js";

// Mock the database
vi.mock("../utils/db.js", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
    eventRole: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock the retention utilities
vi.mock("../utils/retention.js", () => ({
  updateEventRetentionSettings: vi.fn(),
  calculateArchivalDate: vi.fn(),
  archiveEvent: vi.fn(),
  scheduleEventForDeletion: vi.fn(),
  deleteExpiredWallPosts: vi.fn(),
}));

describe("Data Retention Routes", () => {
  let app: express.Application;
  const mockEventId = "event123";
  const mockUserId = "user123";
  const mockToken = "valid-token";

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/events", eventsRouter);

    // Setup default mocks
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: "session123",
      userId: mockUserId,
      token: mockToken,
      deviceInfo: null,
      deviceType: null,
      deviceName: null,
      ipAddress: null,
      location: null,
      expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
      createdAt: new Date(),
      lastActiveAt: new Date(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/events/:id/retention", () => {
    it("should return retention settings for organizers", async () => {
      const mockEvent = {
        id: mockEventId,
        dataRetentionMonths: 24,
        wallRetentionMonths: 6,
        retentionNotificationSent: false,
        retentionNotificationSentAt: null,
        archivedAt: null,
        scheduledForDeletionAt: null,
        state: "COMPLETED",
        dateTime: new Date("2023-06-01T10:00:00Z"),
        endDateTime: new Date("2023-06-01T18:00:00Z"),
        createdAt: new Date("2023-05-01T10:00:00Z"),
      };

      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        title: "Test Event",
        description: "Test",
        timezone: "UTC",
        location: "Test Location",
        imageUrl: null,
        capacity: null,
        waitlistEnabled: false,
        rsvpDeadline: null,
        category: null,
        dressCode: null,
        notes: null,
        attendeeListVisibility: "ATTENDEES_ONLY",
        allowInviteSharing: true,
        creatorId: mockUserId,
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue({
        id: "role123",
        eventId: mockEventId,
        userId: mockUserId,
        role: "ORGANIZER",
        createdAt: new Date(),
      });

      const response = await request(app)
        .get(`/api/events/${mockEventId}/retention`)
        .set("Authorization", `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("dataRetentionMonths", 24);
      expect(response.body).toHaveProperty("wallRetentionMonths", 6);
    });

    it("should return 401 for unauthenticated requests", async () => {
      const response = await request(app).get(`/api/events/${mockEventId}/retention`);

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /api/events/:id/retention", () => {
    beforeEach(() => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: mockEventId,
        title: "Test Event",
        description: "Test",
        dateTime: new Date(),
        endDateTime: null,
        timezone: "UTC",
        location: "Test Location",
        imageUrl: null,
        capacity: null,
        waitlistEnabled: false,
        rsvpDeadline: null,
        category: null,
        dressCode: null,
        notes: null,
        state: "COMPLETED",
        attendeeListVisibility: "ATTENDEES_ONLY",
        allowInviteSharing: true,
        dataRetentionMonths: 24,
        wallRetentionMonths: null,
        retentionNotificationSent: false,
        retentionNotificationSentAt: null,
        archivedAt: null,
        scheduledForDeletionAt: null,
        creatorId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue({
        id: "role123",
        eventId: mockEventId,
        userId: mockUserId,
        role: "ORGANIZER",
        createdAt: new Date(),
      });
    });

    it("should update retention settings with valid data", async () => {
      const updateData = {
        dataRetentionMonths: 12,
        wallRetentionMonths: 3,
      };

      const response = await request(app)
        .put(`/api/events/${mockEventId}/retention`)
        .set("Authorization", `Bearer ${mockToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
    });

    it("should reject invalid data retention months (too low)", async () => {
      const updateData = {
        dataRetentionMonths: 0,
      };

      const response = await request(app)
        .put(`/api/events/${mockEventId}/retention`)
        .set("Authorization", `Bearer ${mockToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
    });

    it("should reject invalid data retention months (too high)", async () => {
      const updateData = {
        dataRetentionMonths: 121,
      };

      const response = await request(app)
        .put(`/api/events/${mockEventId}/retention`)
        .set("Authorization", `Bearer ${mockToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
    });

    it("should reject invalid wall retention months", async () => {
      const updateData = {
        wallRetentionMonths: 150,
      };

      const response = await request(app)
        .put(`/api/events/${mockEventId}/retention`)
        .set("Authorization", `Bearer ${mockToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
    });

    it("should allow null wall retention months", async () => {
      const updateData = {
        wallRetentionMonths: null,
      };

      const response = await request(app)
        .put(`/api/events/${mockEventId}/retention`)
        .set("Authorization", `Bearer ${mockToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
    });
  });

  describe("POST /api/events/:id/archive", () => {
    it("should archive an event for organizers", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: mockEventId,
        state: "COMPLETED",
        archivedAt: null,
        title: "Test Event",
        description: "Test",
        dateTime: new Date(),
        endDateTime: null,
        timezone: "UTC",
        location: "Test Location",
        imageUrl: null,
        capacity: null,
        waitlistEnabled: false,
        rsvpDeadline: null,
        category: null,
        dressCode: null,
        notes: null,
        attendeeListVisibility: "ATTENDEES_ONLY",
        allowInviteSharing: true,
        dataRetentionMonths: 24,
        wallRetentionMonths: null,
        retentionNotificationSent: false,
        retentionNotificationSentAt: null,
        scheduledForDeletionAt: null,
        creatorId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue({
        id: "role123",
        eventId: mockEventId,
        userId: mockUserId,
        role: "ORGANIZER",
        createdAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/events/${mockEventId}/archive`)
        .set("Authorization", `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
    });

    it("should reject archiving already archived event", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: mockEventId,
        state: "COMPLETED",
        archivedAt: new Date(),
        title: "Test Event",
        description: "Test",
        dateTime: new Date(),
        endDateTime: null,
        timezone: "UTC",
        location: "Test Location",
        imageUrl: null,
        capacity: null,
        waitlistEnabled: false,
        rsvpDeadline: null,
        category: null,
        dressCode: null,
        notes: null,
        attendeeListVisibility: "ATTENDEES_ONLY",
        allowInviteSharing: true,
        dataRetentionMonths: 24,
        wallRetentionMonths: null,
        retentionNotificationSent: false,
        retentionNotificationSentAt: null,
        scheduledForDeletionAt: null,
        creatorId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue({
        id: "role123",
        eventId: mockEventId,
        userId: mockUserId,
        role: "ORGANIZER",
        createdAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/events/${mockEventId}/archive`)
        .set("Authorization", `Bearer ${mockToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/events/:id/schedule-deletion", () => {
    it("should schedule event for deletion with valid grace period", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: mockEventId,
        scheduledForDeletionAt: null,
        title: "Test Event",
        description: "Test",
        dateTime: new Date(),
        endDateTime: null,
        timezone: "UTC",
        location: "Test Location",
        imageUrl: null,
        capacity: null,
        waitlistEnabled: false,
        rsvpDeadline: null,
        category: null,
        dressCode: null,
        notes: null,
        state: "COMPLETED",
        attendeeListVisibility: "ATTENDEES_ONLY",
        allowInviteSharing: true,
        dataRetentionMonths: 24,
        wallRetentionMonths: null,
        retentionNotificationSent: false,
        retentionNotificationSentAt: null,
        archivedAt: null,
        creatorId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue({
        id: "role123",
        eventId: mockEventId,
        userId: mockUserId,
        role: "ORGANIZER",
        createdAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/events/${mockEventId}/schedule-deletion`)
        .set("Authorization", `Bearer ${mockToken}`)
        .send({ gracePeriodDays: 30 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("gracePeriodDays", 30);
    });

    it("should reject invalid grace period (too low)", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: mockEventId,
        scheduledForDeletionAt: null,
        title: "Test Event",
        description: "Test",
        dateTime: new Date(),
        endDateTime: null,
        timezone: "UTC",
        location: "Test Location",
        imageUrl: null,
        capacity: null,
        waitlistEnabled: false,
        rsvpDeadline: null,
        category: null,
        dressCode: null,
        notes: null,
        state: "COMPLETED",
        attendeeListVisibility: "ATTENDEES_ONLY",
        allowInviteSharing: true,
        dataRetentionMonths: 24,
        wallRetentionMonths: null,
        retentionNotificationSent: false,
        retentionNotificationSentAt: null,
        archivedAt: null,
        creatorId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue({
        id: "role123",
        eventId: mockEventId,
        userId: mockUserId,
        role: "ORGANIZER",
        createdAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/events/${mockEventId}/schedule-deletion`)
        .set("Authorization", `Bearer ${mockToken}`)
        .send({ gracePeriodDays: 0 });

      expect(response.status).toBe(400);
    });

    it("should reject invalid grace period (too high)", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: mockEventId,
        scheduledForDeletionAt: null,
        title: "Test Event",
        description: "Test",
        dateTime: new Date(),
        endDateTime: null,
        timezone: "UTC",
        location: "Test Location",
        imageUrl: null,
        capacity: null,
        waitlistEnabled: false,
        rsvpDeadline: null,
        category: null,
        dressCode: null,
        notes: null,
        state: "COMPLETED",
        attendeeListVisibility: "ATTENDEES_ONLY",
        allowInviteSharing: true,
        dataRetentionMonths: 24,
        wallRetentionMonths: null,
        retentionNotificationSent: false,
        retentionNotificationSentAt: null,
        archivedAt: null,
        creatorId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue({
        id: "role123",
        eventId: mockEventId,
        userId: mockUserId,
        role: "ORGANIZER",
        createdAt: new Date(),
      });

      const response = await request(app)
        .post(`/api/events/${mockEventId}/schedule-deletion`)
        .set("Authorization", `Bearer ${mockToken}`)
        .send({ gracePeriodDays: 400 });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/events/:id/schedule-deletion", () => {
    it("should cancel scheduled deletion", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: mockEventId,
        scheduledForDeletionAt: new Date(Date.now() + 86400000 * 30),
        title: "Test Event",
        description: "Test",
        dateTime: new Date(),
        endDateTime: null,
        timezone: "UTC",
        location: "Test Location",
        imageUrl: null,
        capacity: null,
        waitlistEnabled: false,
        rsvpDeadline: null,
        category: null,
        dressCode: null,
        notes: null,
        state: "COMPLETED",
        attendeeListVisibility: "ATTENDEES_ONLY",
        allowInviteSharing: true,
        dataRetentionMonths: 24,
        wallRetentionMonths: null,
        retentionNotificationSent: false,
        retentionNotificationSentAt: null,
        archivedAt: null,
        creatorId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue({
        id: "role123",
        eventId: mockEventId,
        userId: mockUserId,
        role: "ORGANIZER",
        createdAt: new Date(),
      });

      vi.mocked(prisma.event.update).mockResolvedValue({} as any);

      const response = await request(app)
        .delete(`/api/events/${mockEventId}/schedule-deletion`)
        .set("Authorization", `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
    });

    it("should reject when event is not scheduled for deletion", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: mockEventId,
        scheduledForDeletionAt: null,
        title: "Test Event",
        description: "Test",
        dateTime: new Date(),
        endDateTime: null,
        timezone: "UTC",
        location: "Test Location",
        imageUrl: null,
        capacity: null,
        waitlistEnabled: false,
        rsvpDeadline: null,
        category: null,
        dressCode: null,
        notes: null,
        state: "COMPLETED",
        attendeeListVisibility: "ATTENDEES_ONLY",
        allowInviteSharing: true,
        dataRetentionMonths: 24,
        wallRetentionMonths: null,
        retentionNotificationSent: false,
        retentionNotificationSentAt: null,
        archivedAt: null,
        creatorId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue({
        id: "role123",
        eventId: mockEventId,
        userId: mockUserId,
        role: "ORGANIZER",
        createdAt: new Date(),
      });

      const response = await request(app)
        .delete(`/api/events/${mockEventId}/schedule-deletion`)
        .set("Authorization", `Bearer ${mockToken}`);

      expect(response.status).toBe(400);
    });
  });
});
