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

// Mock the database module before importing app
vi.mock("../utils/db.js", () => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    rSVP: {
      findMany: vi.fn(),
    },
    eventRole: {
      count: vi.fn(),
    },
  },
}));

import app from "../app.js";
import { prisma } from "../utils/db.js";

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
  });
});
