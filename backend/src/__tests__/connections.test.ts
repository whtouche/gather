import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock user and session data
const mockUser = {
  id: "user-123",
  phone: "+1234567890",
  email: null,
  displayName: "Test User",
  photoUrl: null,
  bio: null,
  location: null,
  photoVisibility: "CONNECTIONS" as const,
  bioVisibility: "CONNECTIONS" as const,
  locationVisibility: "CONNECTIONS" as const,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockSession = {
  id: "session-123",
  userId: "user-123",
  token: "valid-token",
  expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
  deviceInfo: null,
  createdAt: new Date(),
  lastActiveAt: new Date(),
};

const mockConnection1 = {
  id: "user-456",
  displayName: "Alice Smith",
  photoUrl: "https://example.com/alice.jpg",
};

const mockConnection2 = {
  id: "user-789",
  displayName: "Bob Johnson",
  photoUrl: null,
};

const mockEvent1 = {
  id: "event-1",
  title: "Summer BBQ",
  dateTime: new Date("2024-06-15"),
};

const mockEvent2 = {
  id: "event-2",
  title: "Winter Party",
  dateTime: new Date("2024-12-20"),
};

// Mock email and SMS utilities
vi.mock("../utils/email.js", () => ({
  createAndSendEmailInvitation: vi.fn(),
  maskEmail: vi.fn((email: string) => `***@${email.split("@")[1]}`),
}));

vi.mock("../utils/sms.js", () => ({
  createAndSendSmsInvitation: vi.fn(),
  maskPhone: vi.fn((phone: string) => `***${phone.slice(-4)}`),
}));

// Mock the database module before importing app
vi.mock("../utils/db.js", () => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    rSVP: {
      findMany: vi.fn(),
    },
    eventRole: {
      count: vi.fn(),
    },
    event: {
      findUnique: vi.fn(),
    },
    privateNote: {
      findMany: vi.fn(),
    },
    emailInvitation: {
      findMany: vi.fn(),
    },
    smsInvitation: {
      findMany: vi.fn(),
    },
  },
}));

import app from "../app.js";
import { prisma } from "../utils/db.js";
import { createAndSendEmailInvitation } from "../utils/email.js";
import { createAndSendSmsInvitation } from "../utils/sms.js";

describe("Connections Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/connections", () => {
    it("should require authentication", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

      const response = await request(app).get("/api/connections");
      expect(response.status).toBe(401);
      // Error response structure includes error object
      expect(response.body).toHaveProperty("error");
    });

    it("should reject invalid tokens", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get("/api/connections")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });

    it("should return empty array when user has no completed events", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      // No completed events with YES RSVP
      vi.mocked(prisma.rSVP.findMany).mockResolvedValue([]);

      const response = await request(app)
        .get("/api/connections")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ connections: [] });
    });

    it("should return connections with shared events", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      // Mock user's completed events
      const userCompletedEvents = [
        {
          eventId: "event-1",
          event: mockEvent1,
        },
        {
          eventId: "event-2",
          event: mockEvent2,
        },
      ];

      // Mock other attendees at the same events
      const otherAttendees = [
        {
          userId: "user-456",
          eventId: "event-1",
          response: "YES",
          user: mockConnection1,
          event: mockEvent1,
        },
        {
          userId: "user-456",
          eventId: "event-2",
          response: "YES",
          user: mockConnection1,
          event: mockEvent2,
        },
        {
          userId: "user-789",
          eventId: "event-1",
          response: "YES",
          user: mockConnection2,
          event: mockEvent1,
        },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(userCompletedEvents as any)
        .mockResolvedValueOnce(otherAttendees as any);

      const response = await request(app)
        .get("/api/connections")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("connections");
      expect(response.body.connections).toHaveLength(2);

      // Alice should be first (most recent event is Winter Party)
      const alice = response.body.connections[0];
      expect(alice.userId).toBe("user-456");
      expect(alice.displayName).toBe("Alice Smith");
      expect(alice.photoUrl).toBe("https://example.com/alice.jpg");
      expect(alice.sharedEventCount).toBe(2);
      expect(alice.mostRecentEvent.eventTitle).toBe("Winter Party");

      // Bob should be second
      const bob = response.body.connections[1];
      expect(bob.userId).toBe("user-789");
      expect(bob.displayName).toBe("Bob Johnson");
      expect(bob.photoUrl).toBeNull();
      expect(bob.sharedEventCount).toBe(1);
      expect(bob.mostRecentEvent.eventTitle).toBe("Summer BBQ");
    });

    it("should exclude the current user from connections", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const userCompletedEvents = [
        {
          eventId: "event-1",
          event: mockEvent1,
        },
      ];

      // Only the current user attended (should not appear in connections)
      const otherAttendees: any[] = [];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(userCompletedEvents as any)
        .mockResolvedValueOnce(otherAttendees);

      const response = await request(app)
        .get("/api/connections")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.connections).toHaveLength(0);
    });

    it("should only include users who RSVP'd YES", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const userCompletedEvents = [
        {
          eventId: "event-1",
          event: mockEvent1,
        },
      ];

      // Bob said NO, should not be included
      const otherAttendees = [
        {
          userId: "user-456",
          eventId: "event-1",
          response: "YES",
          user: mockConnection1,
          event: mockEvent1,
        },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(userCompletedEvents as any)
        .mockResolvedValueOnce(otherAttendees as any);

      const response = await request(app)
        .get("/api/connections")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.connections).toHaveLength(1);
      expect(response.body.connections[0].userId).toBe("user-456");
    });

    it("should sort connections by most recent event date", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const oldEvent = {
        id: "event-old",
        title: "Old Event",
        dateTime: new Date("2023-01-01"),
      };

      const recentEvent = {
        id: "event-recent",
        title: "Recent Event",
        dateTime: new Date("2024-12-01"),
      };

      const userCompletedEvents = [
        { eventId: "event-old", event: oldEvent },
        { eventId: "event-recent", event: recentEvent },
      ];

      const otherAttendees = [
        {
          userId: "user-456",
          eventId: "event-old",
          response: "YES",
          user: mockConnection1,
          event: oldEvent,
        },
        {
          userId: "user-789",
          eventId: "event-recent",
          response: "YES",
          user: mockConnection2,
          event: recentEvent,
        },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(userCompletedEvents as any)
        .mockResolvedValueOnce(otherAttendees as any);

      const response = await request(app)
        .get("/api/connections")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.connections).toHaveLength(2);
      // Bob (recent event) should be first
      expect(response.body.connections[0].userId).toBe("user-789");
      expect(response.body.connections[0].mostRecentEvent.eventTitle).toBe("Recent Event");
      // Alice (old event) should be second
      expect(response.body.connections[1].userId).toBe("user-456");
      expect(response.body.connections[1].mostRecentEvent.eventTitle).toBe("Old Event");
    });

    it("should handle database errors gracefully", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.rSVP.findMany).mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .get("/api/connections")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(500);
    });

    it("should filter connections by name", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const userCompletedEvents = [{ eventId: "event-1", event: mockEvent1 }];
      const otherAttendees = [
        {
          userId: "user-456",
          eventId: "event-1",
          response: "YES",
          user: mockConnection1,
          event: mockEvent1,
        },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(userCompletedEvents as any)
        .mockResolvedValueOnce(otherAttendees as any);

      const response = await request(app)
        .get("/api/connections?name=Alice")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.connections).toHaveLength(1);
      expect(response.body.connections[0].displayName).toBe("Alice Smith");
    });

    it("should sort connections alphabetically", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const userCompletedEvents = [{ eventId: "event-1", event: mockEvent1 }];
      const otherAttendees = [
        {
          userId: "user-789",
          eventId: "event-1",
          response: "YES",
          user: mockConnection2,
          event: mockEvent1,
        },
        {
          userId: "user-456",
          eventId: "event-1",
          response: "YES",
          user: mockConnection1,
          event: mockEvent1,
        },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(userCompletedEvents as any)
        .mockResolvedValueOnce(otherAttendees as any);

      const response = await request(app)
        .get("/api/connections?sort=alphabetical")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.connections).toHaveLength(2);
      expect(response.body.connections[0].displayName).toBe("Alice Smith");
      expect(response.body.connections[1].displayName).toBe("Bob Johnson");
    });

    it("should sort connections by frequency", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const userCompletedEvents = [
        { eventId: "event-1", event: mockEvent1 },
        { eventId: "event-2", event: mockEvent2 },
      ];

      const otherAttendees = [
        {
          userId: "user-456",
          eventId: "event-1",
          response: "YES",
          user: mockConnection1,
          event: mockEvent1,
        },
        {
          userId: "user-456",
          eventId: "event-2",
          response: "YES",
          user: mockConnection1,
          event: mockEvent2,
        },
        {
          userId: "user-789",
          eventId: "event-1",
          response: "YES",
          user: mockConnection2,
          event: mockEvent1,
        },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(userCompletedEvents as any)
        .mockResolvedValueOnce(otherAttendees as any);

      const response = await request(app)
        .get("/api/connections?sort=frequency")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.connections).toHaveLength(2);
      // Alice has 2 shared events
      expect(response.body.connections[0].userId).toBe("user-456");
      expect(response.body.connections[0].sharedEventCount).toBe(2);
      // Bob has 1 shared event
      expect(response.body.connections[1].userId).toBe("user-789");
      expect(response.body.connections[1].sharedEventCount).toBe(1);
    });

    it("should validate date parameters", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const response = await request(app)
        .get("/api/connections?startDate=invalid-date")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Invalid startDate");
    });
  });

  describe("GET /api/connections/:userId", () => {
    const mockTargetUser = {
      id: "user-456",
      displayName: "Alice Smith",
      photoUrl: "https://example.com/alice.jpg",
      bio: "Software engineer",
      location: "San Francisco",
      photoVisibility: "CONNECTIONS" as const,
      bioVisibility: "CONNECTIONS" as const,
      locationVisibility: "CONNECTIONS" as const,
    };

    beforeEach(() => {
      // Mock the eventRole count query for the detail endpoint
      vi.mocked(prisma.eventRole).count = vi.fn().mockResolvedValue(0);
    });

    it("should require authentication", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

      const response = await request(app).get("/api/connections/user-456");
      expect(response.status).toBe(401);
    });

    it("should return 404 if target user does not exist", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get("/api/connections/user-999")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found");
    });

    it("should return 404 if users have no shared events", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as any);
      // Current user has no completed events
      vi.mocked(prisma.rSVP.findMany).mockResolvedValue([]);

      const response = await request(app)
        .get("/api/connections/user-456")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("No connection found");
    });

    it("should return connection detail with shared events", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as any);

      const currentUserEvents = [{ eventId: "event-1" }];
      const sharedEventRSVPs = [
        {
          event: {
            id: "event-1",
            title: "Summer BBQ",
            dateTime: new Date("2024-06-15"),
            location: "Central Park",
            creatorId: "user-999",
            eventRoles: [],
          },
        },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(currentUserEvents as any)
        .mockResolvedValueOnce(sharedEventRSVPs as any);

      const response = await request(app)
        .get("/api/connections/user-456")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.connection).toBeDefined();
      expect(response.body.connection.userId).toBe("user-456");
      expect(response.body.connection.displayName).toBe("Alice Smith");
      expect(response.body.connection.photoUrl).toBe("https://example.com/alice.jpg");
      expect(response.body.connection.bio).toBe("Software engineer");
      expect(response.body.connection.location).toBe("San Francisco");
      expect(response.body.connection.sharedEvents).toHaveLength(1);
      expect(response.body.connection.totalSharedEvents).toBe(1);
      expect(response.body.connection.sharedEvents[0].eventTitle).toBe("Summer BBQ");
      expect(response.body.connection.sharedEvents[0].userRole).toBe("ATTENDEE");
    });

    it("should identify organizer role correctly", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as any);

      const currentUserEvents = [{ eventId: "event-1" }];
      const sharedEventRSVPs = [
        {
          event: {
            id: "event-1",
            title: "Summer BBQ",
            dateTime: new Date("2024-06-15"),
            location: "Central Park",
            creatorId: "user-456", // Alice is the creator
            eventRoles: [],
          },
        },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(currentUserEvents as any)
        .mockResolvedValueOnce(sharedEventRSVPs as any);

      const response = await request(app)
        .get("/api/connections/user-456")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.connection.sharedEvents[0].userRole).toBe("ORGANIZER");
    });

    it("should respect privacy settings for PRIVATE visibility", async () => {
      const privateUser = {
        ...mockTargetUser,
        photoVisibility: "PRIVATE" as const,
        bioVisibility: "PRIVATE" as const,
        locationVisibility: "PRIVATE" as const,
      };

      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(privateUser as any);

      const currentUserEvents = [{ eventId: "event-1" }];
      const sharedEventRSVPs = [
        {
          event: {
            id: "event-1",
            title: "Summer BBQ",
            dateTime: new Date("2024-06-15"),
            location: "Central Park",
            creatorId: "user-999",
            eventRoles: [],
          },
        },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(currentUserEvents as any)
        .mockResolvedValueOnce(sharedEventRSVPs as any);

      const response = await request(app)
        .get("/api/connections/user-456")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      // Privacy fields should be null
      expect(response.body.connection.photoUrl).toBeNull();
      expect(response.body.connection.bio).toBeNull();
      expect(response.body.connection.location).toBeNull();
      // Display name should still be visible
      expect(response.body.connection.displayName).toBe("Alice Smith");
    });

    it("should validate date parameters", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as any);

      // Mock current user has events
      const currentUserEvents = [{ eventId: "event-1" }];
      vi.mocked(prisma.rSVP.findMany).mockResolvedValueOnce(currentUserEvents as any);

      const response = await request(app)
        .get("/api/connections/user-456?startDate=invalid-date")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Invalid startDate");
    });

    it("should sort shared events by date descending", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as any);

      const currentUserEvents = [{ eventId: "event-1" }, { eventId: "event-2" }];
      const sharedEventRSVPs = [
        {
          event: {
            id: "event-1",
            title: "Old Event",
            dateTime: new Date("2024-01-15"),
            location: "Location 1",
            creatorId: "user-999",
            eventRoles: [],
          },
        },
        {
          event: {
            id: "event-2",
            title: "Recent Event",
            dateTime: new Date("2024-12-15"),
            location: "Location 2",
            creatorId: "user-999",
            eventRoles: [],
          },
        },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(currentUserEvents as any)
        .mockResolvedValueOnce(sharedEventRSVPs as any);

      const response = await request(app)
        .get("/api/connections/user-456")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.connection.sharedEvents).toHaveLength(2);
      // Most recent event should be first
      expect(response.body.connection.sharedEvents[0].eventTitle).toBe("Recent Event");
      expect(response.body.connection.sharedEvents[1].eventTitle).toBe("Old Event");
    });
  });

  describe("GET /api/connections - noteContent filter", () => {
    it("should filter connections by note content", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const userCompletedEvents = [{ eventId: "event-1", event: mockEvent1 }];
      const otherAttendees = [
        {
          userId: "user-456",
          eventId: "event-1",
          response: "YES",
          user: mockConnection1,
          event: mockEvent1,
        },
        {
          userId: "user-789",
          eventId: "event-1",
          response: "YES",
          user: mockConnection2,
          event: mockEvent1,
        },
      ];

      // Mock notes - only Alice has a note with "important"
      const notes = [
        { targetUserId: "user-456" },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(userCompletedEvents as any)
        .mockResolvedValueOnce(otherAttendees as any);
      vi.mocked(prisma.privateNote.findMany).mockResolvedValue(notes as any);

      const response = await request(app)
        .get("/api/connections?noteContent=important")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.connections).toHaveLength(1);
      expect(response.body.connections[0].userId).toBe("user-456");
      expect(prisma.privateNote.findMany).toHaveBeenCalledWith({
        where: {
          creatorId: "user-123",
          content: {
            contains: "important",
            mode: "insensitive",
          },
        },
        select: {
          targetUserId: true,
        },
      });
    });

    it("should reject note content search term that is too long", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const userCompletedEvents = [{ eventId: "event-1", event: mockEvent1 }];
      const otherAttendees = [
        {
          userId: "user-456",
          eventId: "event-1",
          response: "YES",
          user: mockConnection1,
          event: mockEvent1,
        },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(userCompletedEvents as any)
        .mockResolvedValueOnce(otherAttendees as any);

      const longString = "a".repeat(201);
      const response = await request(app)
        .get(`/api/connections?noteContent=${longString}`)
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Note content search term too long");
    });

    it("should return empty array when no notes match", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const userCompletedEvents = [{ eventId: "event-1", event: mockEvent1 }];
      const otherAttendees = [
        {
          userId: "user-456",
          eventId: "event-1",
          response: "YES",
          user: mockConnection1,
          event: mockEvent1,
        },
      ];

      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce(userCompletedEvents as any)
        .mockResolvedValueOnce(otherAttendees as any);
      vi.mocked(prisma.privateNote.findMany).mockResolvedValue([]);

      const response = await request(app)
        .get("/api/connections?noteContent=nonexistent")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.connections).toHaveLength(0);
    });
  });

  describe("POST /api/connections/invite", () => {
    const mockEvent = {
      id: "event-123",
      state: "PUBLISHED",
      title: "Test Event",
      creatorId: "user-123",
      eventRoles: [],
    };

    it("should require authentication", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post("/api/connections/invite")
        .send({ eventId: "event-123", userIds: ["user-456"] });

      expect(response.status).toBe(401);
    });

    it("should validate eventId is provided", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ userIds: ["user-456"] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_INPUT");
    });

    it("should validate userIds is a non-empty array", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-123", userIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_INPUT");
    });

    it("should reject more than 50 recipients", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const userIds = Array.from({ length: 51 }, (_, i) => `user-${i}`);
      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-123", userIds });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("TOO_MANY_RECIPIENTS");
    });

    it("should validate all userIds are non-empty strings", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-123", userIds: ["user-456", "", "user-789"] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_INPUT");
      expect(response.body.error.message).toContain("non-empty strings");
    });

    it("should return 404 if event does not exist", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-999", userIds: ["user-456"] });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return 403 if user is not an organizer", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        creatorId: "other-user",
        eventRoles: [],
      } as any);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-123", userIds: ["user-456"] });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should reject invitations for draft events", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        state: "DRAFT",
      } as any);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-123", userIds: ["user-456"] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_EVENT_STATE");
    });

    it("should reject if selected users are not connections", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);

      // User has completed events
      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce([{ eventId: "event-1" }] as any)
        // But target user didn't attend those events
        .mockResolvedValueOnce([]);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-123", userIds: ["user-456"] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_CONNECTIONS");
    });

    it("should successfully send email invitations", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);

      // Mock connections
      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce([{ eventId: "event-1" }] as any)
        .mockResolvedValueOnce([{ userId: "user-456" }] as any)
        .mockResolvedValueOnce([]); // No existing RSVPs

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: "user-456",
          displayName: "Alice Smith",
          email: "alice@example.com",
          phone: null,
        },
      ] as any);

      vi.mocked(prisma.emailInvitation.findMany).mockResolvedValue([]);
      vi.mocked(prisma.smsInvitation.findMany).mockResolvedValue([]);

      vi.mocked(createAndSendEmailInvitation).mockResolvedValue({
        success: true,
      } as any);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-123", userIds: ["user-456"] });

      expect(response.status).toBe(201);
      expect(response.body.sent).toBe(1);
      expect(response.body.failed).toBe(0);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].success).toBe(true);
      expect(response.body.results[0].contactMethod).toBe("email");
      expect(createAndSendEmailInvitation).toHaveBeenCalledWith(
        "event-123",
        "alice@example.com",
        "Alice Smith",
        expect.any(String)
      );
    });

    it("should successfully send SMS invitations when no email", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);

      // Mock connections
      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce([{ eventId: "event-1" }] as any)
        .mockResolvedValueOnce([{ userId: "user-456" }] as any)
        .mockResolvedValueOnce([]); // No existing RSVPs

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: "user-456",
          displayName: "Bob Johnson",
          email: null,
          phone: "+1234567890",
        },
      ] as any);

      vi.mocked(prisma.emailInvitation.findMany).mockResolvedValue([]);
      vi.mocked(prisma.smsInvitation.findMany).mockResolvedValue([]);

      vi.mocked(createAndSendSmsInvitation).mockResolvedValue({
        success: true,
      } as any);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-123", userIds: ["user-456"] });

      expect(response.status).toBe(201);
      expect(response.body.sent).toBe(1);
      expect(response.body.results[0].contactMethod).toBe("sms");
      expect(createAndSendSmsInvitation).toHaveBeenCalled();
    });

    it("should skip users who already have an RSVP", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);

      // Mock connections
      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce([{ eventId: "event-1" }] as any)
        .mockResolvedValueOnce([{ userId: "user-456" }] as any)
        .mockResolvedValueOnce([{ userId: "user-456" }] as any); // Already has RSVP

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: "user-456",
          displayName: "Alice Smith",
          email: "alice@example.com",
          phone: null,
        },
      ] as any);

      vi.mocked(prisma.emailInvitation.findMany).mockResolvedValue([]);
      vi.mocked(prisma.smsInvitation.findMany).mockResolvedValue([]);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-123", userIds: ["user-456"] });

      expect(response.status).toBe(201);
      expect(response.body.sent).toBe(0);
      expect(response.body.alreadyRsvpd).toBe(1);
      expect(response.body.results[0].alreadyRsvpd).toBe(true);
    });

    it("should skip users who are already invited", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);

      // Mock connections
      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce([{ eventId: "event-1" }] as any)
        .mockResolvedValueOnce([{ userId: "user-456" }] as any)
        .mockResolvedValueOnce([]); // No existing RSVPs

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: "user-456",
          displayName: "Alice Smith",
          email: "alice@example.com",
          phone: null,
        },
      ] as any);

      vi.mocked(prisma.emailInvitation.findMany).mockResolvedValue([
        { email: "alice@example.com" },
      ] as any);
      vi.mocked(prisma.smsInvitation.findMany).mockResolvedValue([]);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-123", userIds: ["user-456"] });

      expect(response.status).toBe(201);
      expect(response.body.sent).toBe(0);
      expect(response.body.alreadyInvited).toBe(1);
      expect(response.body.results[0].alreadyInvited).toBe(true);
    });

    it("should handle users with no contact method", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);

      // Mock connections
      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce([{ eventId: "event-1" }] as any)
        .mockResolvedValueOnce([{ userId: "user-456" }] as any)
        .mockResolvedValueOnce([]);

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: "user-456",
          displayName: "Charlie Brown",
          email: null,
          phone: null,
        },
      ] as any);

      vi.mocked(prisma.emailInvitation.findMany).mockResolvedValue([]);
      vi.mocked(prisma.smsInvitation.findMany).mockResolvedValue([]);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-123", userIds: ["user-456"] });

      expect(response.status).toBe(201);
      expect(response.body.sent).toBe(0);
      expect(response.body.failed).toBe(1);
      expect(response.body.results[0].error).toContain("No contact method");
    });

    it("should handle mixed success and failure results", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        user: mockUser,
      } as any);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);

      // Mock connections
      vi.mocked(prisma.rSVP.findMany)
        .mockResolvedValueOnce([{ eventId: "event-1" }] as any)
        .mockResolvedValueOnce([
          { userId: "user-456" },
          { userId: "user-789" },
        ] as any)
        .mockResolvedValueOnce([]);

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: "user-456",
          displayName: "Alice Smith",
          email: "alice@example.com",
          phone: null,
        },
        {
          id: "user-789",
          displayName: "Bob Johnson",
          email: "bob@example.com",
          phone: null,
        },
      ] as any);

      vi.mocked(prisma.emailInvitation.findMany).mockResolvedValue([]);
      vi.mocked(prisma.smsInvitation.findMany).mockResolvedValue([]);

      vi.mocked(createAndSendEmailInvitation)
        .mockResolvedValueOnce({ success: true } as any)
        .mockResolvedValueOnce({ success: false, error: "Email service error" } as any);

      const response = await request(app)
        .post("/api/connections/invite")
        .set("Authorization", "Bearer valid-token")
        .send({ eventId: "event-123", userIds: ["user-456", "user-789"] });

      expect(response.status).toBe(201);
      expect(response.body.sent).toBe(1);
      expect(response.body.failed).toBe(1);
      expect(response.body.results).toHaveLength(2);
    });
  });
});
