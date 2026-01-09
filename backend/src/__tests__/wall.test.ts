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
      update: vi.fn(),
    },
    wallReaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    moderationLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
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
  depth: 0,
  parentId: null,
  isPinned: false,
  pinnedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  author: {
    id: "user-1",
    displayName: "Test User",
    photoUrl: null,
  },
  reactions: [],
  replies: [],
  _count: {
    replies: 0,
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

    it("should return 403 when non-organizer deletes another user's post", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      // User is not the event creator
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        creatorId: "other-user",
      } as never);
      // User is not an organizer role
      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);
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

    it("should allow organizer to delete another user's post", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      // User is the event creator (organizer)
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        title: "Test Event",
      } as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue({
        ...mockWallPost,
        authorId: "other-user",
        content: "A post by another user",
      } as never);
      vi.mocked(prisma.wallPost.delete).mockResolvedValue(mockWallPost as never);
      vi.mocked(prisma.moderationLog.create).mockResolvedValue({} as never);
      vi.mocked(prisma.notification.create).mockResolvedValue({} as never);

      const response = await request(app)
        .delete("/api/events/event-1/wall/post-1")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Post deleted successfully");
      expect(response.body.moderatorDeleted).toBe(true);
      expect(prisma.moderationLog.create).toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalled();
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

  describe("POST /api/events/:id/wall/:postId/reactions", () => {
    it("should require authentication", async () => {
      const response = await request(app).post("/api/events/event-1/wall/post-1/reactions");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent event", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post("/api/events/nonexistent/wall/post-1/reactions")
        .set("Authorization", "Bearer valid-token");
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return 403 for non-attendees", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        creatorId: "other-user",
      } as never);
      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.rSVP.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post("/api/events/event-1/wall/post-1/reactions")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("NOT_ATTENDEE");
    });

    it("should return 404 for non-existent post", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post("/api/events/event-1/wall/nonexistent/reactions")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("POST_NOT_FOUND");
    });

    it("should return 400 when user already reacted", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue(mockWallPost as never);
      vi.mocked(prisma.wallReaction.findUnique).mockResolvedValue({
        id: "reaction-1",
        postId: "post-1",
        userId: "user-1",
        type: "HEART",
        createdAt: new Date(),
      } as never);

      const response = await request(app)
        .post("/api/events/event-1/wall/post-1/reactions")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("ALREADY_REACTED");
    });

    it("should create a reaction for confirmed attendees", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue(mockWallPost as never);
      vi.mocked(prisma.wallReaction.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.wallReaction.create).mockResolvedValue({
        id: "reaction-1",
        postId: "post-1",
        userId: "user-1",
        type: "HEART",
        createdAt: new Date(),
      } as never);
      vi.mocked(prisma.wallReaction.count).mockResolvedValue(1);

      const response = await request(app)
        .post("/api/events/event-1/wall/post-1/reactions")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(201);
      expect(response.body.reaction).toBeDefined();
      expect(response.body.reactionCount).toBe(1);
      expect(response.body.userHasReacted).toBe(true);
    });
  });

  describe("DELETE /api/events/:id/wall/:postId/reactions", () => {
    it("should require authentication", async () => {
      const response = await request(app).delete("/api/events/event-1/wall/post-1/reactions");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent event", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/events/nonexistent/wall/post-1/reactions")
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
        .delete("/api/events/event-1/wall/nonexistent/reactions")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("POST_NOT_FOUND");
    });

    it("should return 404 when user has not reacted", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue(mockWallPost as never);
      vi.mocked(prisma.wallReaction.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/events/event-1/wall/post-1/reactions")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("REACTION_NOT_FOUND");
    });

    it("should delete user reaction successfully", async () => {
      const mockReaction = {
        id: "reaction-1",
        postId: "post-1",
        userId: "user-1",
        type: "HEART",
        createdAt: new Date(),
      };

      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue(mockWallPost as never);
      vi.mocked(prisma.wallReaction.findUnique).mockResolvedValue(mockReaction as never);
      vi.mocked(prisma.wallReaction.delete).mockResolvedValue(mockReaction as never);
      vi.mocked(prisma.wallReaction.count).mockResolvedValue(0);

      const response = await request(app)
        .delete("/api/events/event-1/wall/post-1/reactions")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Reaction removed");
      expect(response.body.reactionCount).toBe(0);
      expect(response.body.userHasReacted).toBe(false);
    });
  });

  describe("POST /api/events/:id/wall/:postId/pin", () => {
    it("should require authentication", async () => {
      const response = await request(app).post("/api/events/event-1/wall/post-1/pin");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent event", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post("/api/events/nonexistent/wall/post-1/pin")
        .set("Authorization", "Bearer valid-token");
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return 403 for non-organizers", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        creatorId: "other-user",
      } as never);
      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post("/api/events/event-1/wall/post-1/pin")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should return 404 for non-existent post", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post("/api/events/event-1/wall/nonexistent/pin")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("POST_NOT_FOUND");
    });

    it("should return 400 when trying to pin a reply", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue({
        ...mockWallPost,
        depth: 1, // This is a reply
      } as never);

      const response = await request(app)
        .post("/api/events/event-1/wall/post-1/pin")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("CANNOT_PIN_REPLY");
    });

    it("should return 400 when post is already pinned", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue({
        ...mockWallPost,
        isPinned: true,
      } as never);

      const response = await request(app)
        .post("/api/events/event-1/wall/post-1/pin")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("ALREADY_PINNED");
    });

    it("should pin a post successfully", async () => {
      const pinnedAt = new Date();
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue(mockWallPost as never);
      vi.mocked(prisma.wallPost.update).mockResolvedValue({
        ...mockWallPost,
        isPinned: true,
        pinnedAt,
      } as never);
      vi.mocked(prisma.moderationLog.create).mockResolvedValue({} as never);

      const response = await request(app)
        .post("/api/events/event-1/wall/post-1/pin")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Post pinned successfully");
      expect(response.body.isPinned).toBe(true);
      expect(response.body.pinnedAt).toBeDefined();
      expect(prisma.moderationLog.create).toHaveBeenCalled();
    });
  });

  describe("DELETE /api/events/:id/wall/:postId/pin", () => {
    it("should require authentication", async () => {
      const response = await request(app).delete("/api/events/event-1/wall/post-1/pin");
      expect(response.status).toBe(401);
    });

    it("should return 403 for non-organizers", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        creatorId: "other-user",
      } as never);
      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/events/event-1/wall/post-1/pin")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should return 400 when post is not pinned", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue({
        ...mockWallPost,
        isPinned: false,
      } as never);

      const response = await request(app)
        .delete("/api/events/event-1/wall/post-1/pin")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("NOT_PINNED");
    });

    it("should unpin a post successfully", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.wallPost.findUnique).mockResolvedValue({
        ...mockWallPost,
        isPinned: true,
        pinnedAt: new Date(),
      } as never);
      vi.mocked(prisma.wallPost.update).mockResolvedValue({
        ...mockWallPost,
        isPinned: false,
        pinnedAt: null,
      } as never);
      vi.mocked(prisma.moderationLog.create).mockResolvedValue({} as never);

      const response = await request(app)
        .delete("/api/events/event-1/wall/post-1/pin")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Post unpinned successfully");
      expect(response.body.isPinned).toBe(false);
      expect(response.body.pinnedAt).toBeNull();
      expect(prisma.moderationLog.create).toHaveBeenCalled();
    });
  });

  describe("GET /api/events/:id/wall/moderation-log", () => {
    it("should require authentication", async () => {
      const response = await request(app).get("/api/events/event-1/wall/moderation-log");
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent event", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get("/api/events/nonexistent/wall/moderation-log")
        .set("Authorization", "Bearer valid-token");
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return 403 for non-organizers", async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        ...mockEvent,
        creatorId: "other-user",
      } as never);
      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get("/api/events/event-1/wall/moderation-log")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("should return moderation logs for organizers", async () => {
      const mockLogs = [
        {
          id: "log-1",
          eventId: "event-1",
          moderatorId: "user-1",
          action: "DELETE",
          targetPostId: "post-1",
          postContent: "Deleted content",
          postAuthorId: "user-2",
          createdAt: new Date(),
        },
        {
          id: "log-2",
          eventId: "event-1",
          moderatorId: "user-1",
          action: "PIN",
          targetPostId: "post-2",
          postContent: null,
          postAuthorId: null,
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.update).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
      vi.mocked(prisma.moderationLog.findMany).mockResolvedValue(mockLogs as never);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-1", displayName: "Test User" },
        { id: "user-2", displayName: "Other User" },
      ] as never);

      const response = await request(app)
        .get("/api/events/event-1/wall/moderation-log")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(2);
      expect(response.body.logs[0].action).toBe("DELETE");
      expect(response.body.logs[0].moderator.displayName).toBe("Test User");
      expect(response.body.logs[0].postAuthor.displayName).toBe("Other User");
      expect(response.body.logs[1].action).toBe("PIN");
    });
  });
});
