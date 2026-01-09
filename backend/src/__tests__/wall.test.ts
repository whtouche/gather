import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock the database module before importing app
vi.mock("../utils/db.js", () => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    event: {
      findUnique: vi.fn(),
    },
    rSVP: {
      findUnique: vi.fn(),
    },
    eventRole: {
      findUnique: vi.fn(),
    },
    wallPost: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import app from "../app.js";
import { prisma } from "../utils/db.js";

const mockUser = {
  id: "user-1",
  phone: "+1234567890",
  email: null,
  displayName: "Test User",
  createdAt: new Date(),
  updatedAt: new Date(),
  photoUrl: null,
  bio: null,
  location: null,
  photoVisibility: "CONNECTIONS",
  bioVisibility: "CONNECTIONS",
  locationVisibility: "CONNECTIONS",
};

const mockSession = {
  id: "session-1",
  userId: "user-1",
  token: "valid-token",
  expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
  createdAt: new Date(),
  lastActiveAt: new Date(),
  deviceInfo: null,
  user: mockUser,
};

const mockEvent = {
  id: "event-1",
  title: "Test Event",
  creatorId: "user-1",
  state: "PUBLISHED",
  eventRoles: [],
};

const mockWallPost = {
  id: "post-1",
  eventId: "event-1",
  authorId: "user-1",
  content: "Hello, world!",
  createdAt: new Date(),
  updatedAt: new Date(),
  author: {
    id: "user-1",
    displayName: "Test User",
    photoUrl: null,
  },
};

describe("Wall Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/events/:id/wall", () => {
    it("should require authentication", async () => {
      const response = await request(app).get("/api/events/event-1/wall");
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get("/api/events/event-1/wall")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent event", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get("/api/events/nonexistent/wall")
        .set("Authorization", "Bearer valid-token");
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return canAccessWall: false for non-attendees", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        creatorId: "other-user",
      } as never);
      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.rSVP.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get("/api/events/event-1/wall")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.canAccessWall).toBe(false);
      expect(response.body.posts).toBeNull();
    });

    it("should return posts for confirmed attendees", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        creatorId: "other-user",
      } as never);
      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.rSVP.findUnique).mockResolvedValue({
        id: "rsvp-1",
        eventId: "event-1",
        userId: "user-1",
        response: "YES",
        needsReconfirmation: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      vi.mocked(prisma.wallPost.findMany).mockResolvedValue([mockWallPost] as never);

      const response = await request(app)
        .get("/api/events/event-1/wall")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.canAccessWall).toBe(true);
      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].content).toBe("Hello, world!");
    });

    it("should return posts for organizers", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findMany).mockResolvedValue([mockWallPost] as never);

      const response = await request(app)
        .get("/api/events/event-1/wall")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.canAccessWall).toBe(true);
    });
  });

  describe("POST /api/events/:id/wall", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/events/event-1/wall")
        .send({ content: "Test post" });
      expect(response.status).toBe(401);
    });

    it("should reject empty content", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);

      const response = await request(app)
        .post("/api/events/event-1/wall")
        .set("Authorization", "Bearer valid-token")
        .send({ content: "" });

      // Empty string is falsy, so it triggers MISSING_CONTENT first
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("MISSING_CONTENT");
    });

    it("should reject whitespace-only content", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);

      const response = await request(app)
        .post("/api/events/event-1/wall")
        .set("Authorization", "Bearer valid-token")
        .send({ content: "   " });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("EMPTY_CONTENT");
    });

    it("should reject missing content", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);

      const response = await request(app)
        .post("/api/events/event-1/wall")
        .set("Authorization", "Bearer valid-token")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("MISSING_CONTENT");
    });

    it("should reject content over 2000 characters", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);

      const longContent = "a".repeat(2001);
      const response = await request(app)
        .post("/api/events/event-1/wall")
        .set("Authorization", "Bearer valid-token")
        .send({ content: longContent });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("CONTENT_TOO_LONG");
    });

    it("should reject non-attendees from posting", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        creatorId: "other-user",
      } as never);
      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.rSVP.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post("/api/events/event-1/wall")
        .set("Authorization", "Bearer valid-token")
        .send({ content: "Test post" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("NOT_ATTENDEE");
    });

    it("should create a post for confirmed attendees", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        creatorId: "other-user",
      } as never);
      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.rSVP.findUnique).mockResolvedValue({
        id: "rsvp-1",
        eventId: "event-1",
        userId: "user-1",
        response: "YES",
        needsReconfirmation: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      vi.mocked(prisma.wallPost.create).mockResolvedValue(mockWallPost as never);

      const response = await request(app)
        .post("/api/events/event-1/wall")
        .set("Authorization", "Bearer valid-token")
        .send({ content: "Test post" });

      expect(response.status).toBe(201);
      expect(response.body.post).toBeDefined();
      expect(prisma.wallPost.create).toHaveBeenCalled();
    });

    it("should create a post for organizers", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.create).mockResolvedValue(mockWallPost as never);

      const response = await request(app)
        .post("/api/events/event-1/wall")
        .set("Authorization", "Bearer valid-token")
        .send({ content: "Test post" });

      expect(response.status).toBe(201);
      expect(response.body.post).toBeDefined();
    });
  });

  describe("DELETE /api/events/:id/wall/:postId", () => {
    it("should require authentication", async () => {
      const response = await request(app).delete("/api/events/event-1/wall/post-1");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent event", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/events/nonexistent/wall/post-1")
        .set("Authorization", "Bearer valid-token");
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return 404 for non-existent post", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/events/event-1/wall/nonexistent")
        .set("Authorization", "Bearer valid-token");
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("POST_NOT_FOUND");
    });

    it("should return 403 when deleting another user's post", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue({
        ...mockWallPost,
        authorId: "other-user",
      } as never);

      const response = await request(app)
        .delete("/api/events/event-1/wall/post-1")
        .set("Authorization", "Bearer valid-token");
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should delete the user's own post", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue(mockWallPost as never);
      vi.mocked(prisma.wallPost.delete).mockResolvedValue(mockWallPost as never);

      const response = await request(app)
        .delete("/api/events/event-1/wall/post-1")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Post deleted successfully");
      expect(prisma.wallPost.delete).toHaveBeenCalledWith({
        where: { id: "post-1" },
      });
    });

    it("should return 404 when post belongs to different event", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue({
        ...mockWallPost,
        eventId: "different-event",
      } as never);

      const response = await request(app)
        .delete("/api/events/event-1/wall/post-1")
        .set("Authorization", "Bearer valid-token");
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("POST_NOT_FOUND");
    });
  });
});
