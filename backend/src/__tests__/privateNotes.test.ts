import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock user and session data
const mockUser1 = {
  id: "user-1",
  phone: "+1234567890",
  email: "user1@example.com",
  displayName: "User One",
  photoUrl: null,
  bio: null,
  location: null,
  photoVisibility: "CONNECTIONS" as const,
  bioVisibility: "CONNECTIONS" as const,
  locationVisibility: "CONNECTIONS" as const,
  emailNotifications: true,
  smsNotifications: true,
  wallActivityNotifications: true,
  connectionEventNotifications: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockUser2 = {
  id: "user-2",
  phone: "+1987654321",
  email: "user2@example.com",
  displayName: "User Two",
  photoUrl: "https://example.com/photo.jpg",
  bio: "Hello world",
  location: "New York",
  photoVisibility: "CONNECTIONS" as const,
  bioVisibility: "CONNECTIONS" as const,
  locationVisibility: "CONNECTIONS" as const,
  emailNotifications: true,
  smsNotifications: true,
  wallActivityNotifications: true,
  connectionEventNotifications: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockUser3 = {
  id: "user-3",
  phone: "+1555555555",
  email: "user3@example.com",
  displayName: "User Three",
  photoUrl: null,
  bio: null,
  location: null,
  photoVisibility: "CONNECTIONS" as const,
  bioVisibility: "CONNECTIONS" as const,
  locationVisibility: "CONNECTIONS" as const,
  emailNotifications: true,
  smsNotifications: true,
  wallActivityNotifications: true,
  connectionEventNotifications: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockSession1 = {
  id: "session-1",
  userId: "user-1",
  token: "valid-token-1",
  expiresAt: new Date(Date.now() + 86400000),
  deviceInfo: null,
  deviceType: null,
  deviceName: null,
  ipAddress: null,
  location: null,
  createdAt: new Date(),
  lastActiveAt: new Date(),
};

// Mock events - completed events for connection
const mockCompletedEvent = {
  id: "event-completed",
  title: "Past Event",
  description: "A completed event",
  dateTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  endDateTime: null,
  timezone: "America/New_York",
  location: "Park",
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
  creatorId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock RSVPs for completed event
const mockRsvp1 = {
  id: "rsvp-1",
  eventId: "event-completed",
  userId: "user-1",
  response: "YES",
  needsReconfirmation: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRsvp2 = {
  id: "rsvp-2",
  eventId: "event-completed",
  userId: "user-2",
  response: "YES",
  needsReconfirmation: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock private note
const mockPrivateNote = {
  id: "note-1",
  creatorId: "user-1",
  targetUserId: "user-2",
  content: "Great person to work with!",
  tags: JSON.stringify(["colleague", "reliable"]),
  createdAt: new Date("2024-01-10"),
  updatedAt: new Date("2024-01-10"),
  targetUser: mockUser2,
};

// Mock prisma
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
      findFirst: vi.fn(),
    },
    privateNote: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import app from "../app.js";
import { prisma } from "../utils/db.js";

describe("Private Notes API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default auth behavior
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      ...mockSession1,
      user: mockUser1,
    } as any);
    vi.mocked(prisma.session.update).mockResolvedValue(mockSession1 as any);
  });

  describe("GET /api/private-notes", () => {
    it("should return all private notes for authenticated user", async () => {
      vi.mocked(prisma.privateNote.findMany).mockResolvedValue([mockPrivateNote]);

      const response = await request(app)
        .get("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1");

      expect(response.status).toBe(200);
      expect(response.body.notes).toHaveLength(1);
      expect(response.body.notes[0]).toMatchObject({
        id: "note-1",
        targetUserId: "user-2",
        targetUserDisplayName: "User Two",
        content: "Great person to work with!",
        tags: ["colleague", "reliable"],
      });
    });

    it("should filter by target user ID", async () => {
      vi.mocked(prisma.privateNote.findMany).mockResolvedValue([mockPrivateNote]);

      const response = await request(app)
        .get("/api/private-notes?targetUserId=user-2")
        .set("Authorization", "Bearer valid-token-1");

      expect(response.status).toBe(200);
      expect(prisma.privateNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetUserId: "user-2",
          }),
        })
      );
    });

    it("should search in content and tags", async () => {
      vi.mocked(prisma.privateNote.findMany).mockResolvedValue([mockPrivateNote]);

      const response = await request(app)
        .get("/api/private-notes?search=reliable")
        .set("Authorization", "Bearer valid-token-1");

      expect(response.status).toBe(200);
      expect(prisma.privateNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { content: { contains: "reliable", mode: "insensitive" } },
              { tags: { contains: "reliable", mode: "insensitive" } },
            ]),
          }),
        })
      );
    });

    it("should sort by recent (default)", async () => {
      vi.mocked(prisma.privateNote.findMany).mockResolvedValue([]);

      await request(app)
        .get("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1");

      expect(prisma.privateNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { updatedAt: "desc" },
        })
      );
    });

    it("should sort by oldest", async () => {
      vi.mocked(prisma.privateNote.findMany).mockResolvedValue([]);

      await request(app)
        .get("/api/private-notes?sort=oldest")
        .set("Authorization", "Bearer valid-token-1");

      expect(prisma.privateNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "asc" },
        })
      );
    });

    it("should sort alphabetically by target user", async () => {
      vi.mocked(prisma.privateNote.findMany).mockResolvedValue([]);

      await request(app)
        .get("/api/private-notes?sort=alphabetical")
        .set("Authorization", "Bearer valid-token-1");

      expect(prisma.privateNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { targetUser: { displayName: "asc" } },
        })
      );
    });

    it("should handle malformed tags JSON gracefully", async () => {
      const noteWithBadTags = {
        ...mockPrivateNote,
        tags: "invalid-json",
      };
      vi.mocked(prisma.privateNote.findMany).mockResolvedValue([noteWithBadTags]);

      const response = await request(app)
        .get("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1");

      expect(response.status).toBe(200);
      expect(response.body.notes[0].tags).toEqual([]);
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/private-notes");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/private-notes/:targetUserId", () => {
    it("should return private note for specific user", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser2);
      vi.mocked(prisma.privateNote.findUnique).mockResolvedValue(mockPrivateNote);

      const response = await request(app)
        .get("/api/private-notes/user-2")
        .set("Authorization", "Bearer valid-token-1");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: "note-1",
        targetUserId: "user-2",
        content: "Great person to work with!",
        tags: ["colleague", "reliable"],
      });
    });

    it("should return 404 if target user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get("/api/private-notes/invalid-user")
        .set("Authorization", "Bearer valid-token-1");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found");
    });

    it("should return 404 if note does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser2);
      vi.mocked(prisma.privateNote.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get("/api/private-notes/user-2")
        .set("Authorization", "Bearer valid-token-1");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("No note found for this user");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/private-notes/user-2");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/private-notes", () => {
    beforeEach(() => {
      // Setup connection between users (both attended completed event)
      vi.mocked(prisma.rSVP.findMany).mockResolvedValue([mockRsvp1]);
      vi.mocked(prisma.rSVP.findFirst).mockResolvedValue(mockRsvp2);
    });

    it("should create a new private note", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser2);
      vi.mocked(prisma.privateNote.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.privateNote.create).mockResolvedValue(mockPrivateNote);

      const response = await request(app)
        .post("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          targetUserId: "user-2",
          content: "Great person to work with!",
          tags: ["colleague", "reliable"],
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        targetUserId: "user-2",
        content: "Great person to work with!",
        tags: ["colleague", "reliable"],
      });

      expect(prisma.privateNote.create).toHaveBeenCalledWith({
        data: {
          creatorId: "user-1",
          targetUserId: "user-2",
          content: "Great person to work with!",
          tags: JSON.stringify(["colleague", "reliable"]),
        },
      });
    });

    it("should create note without tags", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser2);
      vi.mocked(prisma.privateNote.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.privateNote.create).mockResolvedValue({
        ...mockPrivateNote,
        tags: null,
      });

      const response = await request(app)
        .post("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          targetUserId: "user-2",
          content: "Great person to work with!",
        });

      expect(response.status).toBe(201);
      expect(prisma.privateNote.create).toHaveBeenCalledWith({
        data: {
          creatorId: "user-1",
          targetUserId: "user-2",
          content: "Great person to work with!",
          tags: null,
        },
      });
    });

    it("should return 400 if targetUserId is missing", async () => {
      const response = await request(app)
        .post("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          content: "Great person to work with!",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("targetUserId is required");
    });

    it("should return 400 if content is empty", async () => {
      const response = await request(app)
        .post("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          targetUserId: "user-2",
          content: "   ",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Content is required");
    });

    it("should return 400 if content exceeds 5000 characters", async () => {
      const longContent = "a".repeat(5001);

      const response = await request(app)
        .post("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          targetUserId: "user-2",
          content: longContent,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Content must not exceed 5000 characters");
    });

    it("should return 400 if more than 5 tags", async () => {
      const response = await request(app)
        .post("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          targetUserId: "user-2",
          content: "Great person!",
          tags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Maximum 5 tags allowed");
    });

    it("should return 400 if tag exceeds 30 characters", async () => {
      const response = await request(app)
        .post("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          targetUserId: "user-2",
          content: "Great person!",
          tags: ["a".repeat(31)],
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Each tag must not exceed 30 characters");
    });

    it("should return 400 if tags is not an array", async () => {
      const response = await request(app)
        .post("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          targetUserId: "user-2",
          content: "Great person!",
          tags: "not-an-array",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Tags must be an array");
    });

    it("should return 400 if trying to create note about yourself", async () => {
      const response = await request(app)
        .post("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          targetUserId: "user-1",
          content: "Note about myself",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Cannot create a note about yourself");
    });

    it("should return 404 if target user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          targetUserId: "invalid-user",
          content: "Great person!",
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Target user not found");
    });

    it("should return 403 if users are not connected", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser3);
      vi.mocked(prisma.rSVP.findMany).mockResolvedValue([]);

      const response = await request(app)
        .post("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          targetUserId: "user-3",
          content: "Great person!",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("shared completed events");
    });

    it("should return 400 if note already exists", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser2);
      vi.mocked(prisma.privateNote.findUnique).mockResolvedValue(mockPrivateNote);

      const response = await request(app)
        .post("/api/private-notes")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          targetUserId: "user-2",
          content: "Another note",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("already exists");
    });

    it("should require authentication", async () => {
      const response = await request(app).post("/api/private-notes").send({
        targetUserId: "user-2",
        content: "Great person!",
      });

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /api/private-notes/:targetUserId", () => {
    it("should update an existing note", async () => {
      vi.mocked(prisma.privateNote.findUnique).mockResolvedValue(mockPrivateNote);
      const updatedNote = {
        ...mockPrivateNote,
        content: "Updated content",
        tags: JSON.stringify(["new-tag"]),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.privateNote.update).mockResolvedValue(updatedNote);

      const response = await request(app)
        .put("/api/private-notes/user-2")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          content: "Updated content",
          tags: ["new-tag"],
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        content: "Updated content",
        tags: ["new-tag"],
      });

      expect(prisma.privateNote.update).toHaveBeenCalledWith({
        where: {
          creatorId_targetUserId: {
            creatorId: "user-1",
            targetUserId: "user-2",
          },
        },
        data: {
          content: "Updated content",
          tags: JSON.stringify(["new-tag"]),
        },
        include: {
          targetUser: {
            select: {
              id: true,
              displayName: true,
              photoUrl: true,
            },
          },
        },
      });
    });

    it("should return 404 if note does not exist", async () => {
      vi.mocked(prisma.privateNote.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .put("/api/private-notes/user-2")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          content: "Updated content",
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Note not found");
    });

    it("should validate content on update", async () => {
      vi.mocked(prisma.privateNote.findUnique).mockResolvedValue(mockPrivateNote);

      const response = await request(app)
        .put("/api/private-notes/user-2")
        .set("Authorization", "Bearer valid-token-1")
        .send({
          content: "",
        });

      expect(response.status).toBe(400);
    });

    it("should require authentication", async () => {
      const response = await request(app).put("/api/private-notes/user-2").send({
        content: "Updated content",
      });

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /api/private-notes/:targetUserId", () => {
    it("should delete a note", async () => {
      vi.mocked(prisma.privateNote.findUnique).mockResolvedValue(mockPrivateNote);
      vi.mocked(prisma.privateNote.delete).mockResolvedValue(mockPrivateNote);

      const response = await request(app)
        .delete("/api/private-notes/user-2")
        .set("Authorization", "Bearer valid-token-1");

      expect(response.status).toBe(204);

      expect(prisma.privateNote.delete).toHaveBeenCalledWith({
        where: {
          creatorId_targetUserId: {
            creatorId: "user-1",
            targetUserId: "user-2",
          },
        },
      });
    });

    it("should return 404 if note does not exist", async () => {
      vi.mocked(prisma.privateNote.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/private-notes/user-2")
        .set("Authorization", "Bearer valid-token-1");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Note not found");
    });

    it("should require authentication", async () => {
      const response = await request(app).delete("/api/private-notes/user-2");

      expect(response.status).toBe(401);
    });
  });
});
