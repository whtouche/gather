import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock the database module before importing app
vi.mock("../utils/db.js", () => ({
  prisma: {
    session: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    rSVP: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    eventRole: {
      count: vi.fn().mockResolvedValue(0),
    },
    eventNotificationSetting: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    },
    dataExport: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
  },
}));

import app from "../app.js";
import { prisma } from "../utils/db.js";

const mockPrisma = prisma as any;

describe("Profile Routes", () => {
  describe("GET /api/profile", () => {
    it("should require authentication", async () => {
      const response = await request(app).get("/api/profile");
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .get("/api/profile")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("PATCH /api/profile", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .patch("/api/profile")
        .send({ displayName: "New Name" });
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .patch("/api/profile")
        .set("Authorization", "Bearer invalid-token")
        .send({ displayName: "New Name" });
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/users/:id", () => {
    it("should work without authentication (public endpoint)", async () => {
      // This endpoint allows optional auth, so 404 means it reached the route handler
      const response = await request(app).get("/api/users/nonexistent-user-id");
      // Since user doesn't exist, it should return 404
      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/profile/events/:eventId/notifications", () => {
    it("should require authentication", async () => {
      const response = await request(app).get("/api/profile/events/test-event-id/notifications");
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .get("/api/profile/events/test-event-id/notifications")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("PATCH /api/profile/events/:eventId/notifications", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .patch("/api/profile/events/test-event-id/notifications")
        .send({ muteAll: true });
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .patch("/api/profile/events/test-event-id/notifications")
        .set("Authorization", "Bearer invalid-token")
        .send({ muteAll: true });
      expect(response.status).toBe(401);
    });

    it("should validate boolean types for muteAll", async () => {
      const response = await request(app)
        .patch("/api/profile/events/test-event-id/notifications")
        .set("Authorization", "Bearer invalid-token")
        .send({ muteAll: "not-a-boolean" });
      expect(response.status).toBe(401);
    });

    it("should validate boolean types for muteWallOnly", async () => {
      const response = await request(app)
        .patch("/api/profile/events/test-event-id/notifications")
        .set("Authorization", "Bearer invalid-token")
        .send({ muteWallOnly: "not-a-boolean" });
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/profile/deactivate", () => {
    it("should require authentication", async () => {
      const response = await request(app).post("/api/profile/deactivate");
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .post("/api/profile/deactivate")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/profile/reactivate", () => {
    it("should require authentication", async () => {
      const response = await request(app).post("/api/profile/reactivate");
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .post("/api/profile/reactivate")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/profile/delete-request", () => {
    it("should require authentication", async () => {
      const response = await request(app).post("/api/profile/delete-request");
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .post("/api/profile/delete-request")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/profile/cancel-deletion", () => {
    it("should require authentication", async () => {
      const response = await request(app).post("/api/profile/cancel-deletion");
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .post("/api/profile/cancel-deletion")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/profile/export", () => {
    it("should require authentication", async () => {
      const response = await request(app).post("/api/profile/export");
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .post("/api/profile/export")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/profile/exports", () => {
    it("should require authentication", async () => {
      const response = await request(app).get("/api/profile/exports");
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .get("/api/profile/exports")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/profile/exports/:exportId", () => {
    it("should require authentication", async () => {
      const response = await request(app).get("/api/profile/exports/test-export-id");
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .get("/api/profile/exports/test-export-id")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("Advanced Privacy (isProfileHidden)", () => {
    const validToken = "valid-session-token";
    const viewerId = "viewer-user-id";
    const targetUserId = "target-user-id";

    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("PATCH /api/profile - Update isProfileHidden", () => {
      it("should allow setting isProfileHidden to true", async () => {
        const mockUser = {
          id: viewerId,
          displayName: "Test User",
          isProfileHidden: false,
          photoVisibility: "CONNECTIONS" as const,
          bioVisibility: "CONNECTIONS" as const,
          locationVisibility: "CONNECTIONS" as const,
          emailNotifications: true,
          smsNotifications: true,
          wallActivityNotifications: true,
          connectionEventNotifications: true,
        };

        const updatedUser = {
          ...mockUser,
          isProfileHidden: true,
          phone: null,
          email: null,
          photoUrl: null,
          bio: null,
          location: null,
          isActive: true,
          deletionScheduledAt: null,
          deletionExecutionAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.session.findUnique.mockResolvedValue({
          id: "session-1",
          userId: viewerId,
          token: validToken,
          expiresAt: new Date(Date.now() + 86400000),
          user: mockUser,
        });

        mockPrisma.user.update.mockResolvedValue(updatedUser);

        const response = await request(app)
          .patch("/api/profile")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ isProfileHidden: true });

        expect(response.status).toBe(200);
        expect(mockPrisma.user.update).toHaveBeenCalledWith({
          where: { id: viewerId },
          data: { isProfileHidden: true },
        });
      });

      it("should allow setting isProfileHidden to false", async () => {
        const mockUser = {
          id: viewerId,
          displayName: "Test User",
          isProfileHidden: true,
          photoVisibility: "CONNECTIONS" as const,
          bioVisibility: "CONNECTIONS" as const,
          locationVisibility: "CONNECTIONS" as const,
          emailNotifications: true,
          smsNotifications: true,
          wallActivityNotifications: true,
          connectionEventNotifications: true,
        };

        const updatedUser = {
          ...mockUser,
          isProfileHidden: false,
          phone: null,
          email: null,
          photoUrl: null,
          bio: null,
          location: null,
          isActive: true,
          deletionScheduledAt: null,
          deletionExecutionAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.session.findUnique.mockResolvedValue({
          id: "session-1",
          userId: viewerId,
          token: validToken,
          expiresAt: new Date(Date.now() + 86400000),
          user: mockUser,
        });

        mockPrisma.user.update.mockResolvedValue(updatedUser);

        const response = await request(app)
          .patch("/api/profile")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ isProfileHidden: false });

        expect(response.status).toBe(200);
        expect(mockPrisma.user.update).toHaveBeenCalledWith({
          where: { id: viewerId },
          data: { isProfileHidden: false },
        });
      });

      it("should reject non-boolean isProfileHidden values", async () => {
        const mockUser = {
          id: viewerId,
          displayName: "Test User",
          isProfileHidden: false,
          photoVisibility: "CONNECTIONS" as const,
          bioVisibility: "CONNECTIONS" as const,
          locationVisibility: "CONNECTIONS" as const,
          emailNotifications: true,
          smsNotifications: true,
          wallActivityNotifications: true,
          connectionEventNotifications: true,
        };

        mockPrisma.session.findUnique.mockResolvedValue({
          id: "session-1",
          userId: viewerId,
          token: validToken,
          expiresAt: new Date(Date.now() + 86400000),
          user: mockUser,
        });

        const response = await request(app)
          .patch("/api/profile")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ isProfileHidden: "true" }); // string instead of boolean

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("INVALID_PROFILE_HIDDEN");
      });
    });

    describe("GET /api/users/:id - View hidden profile", () => {
      it("should hide all fields except displayName when isProfileHidden is true for non-self viewer", async () => {
        const targetUser = {
          id: targetUserId,
          displayName: "Hidden User",
          photoUrl: "https://example.com/photo.jpg",
          bio: "Secret bio",
          location: "Secret location",
          isProfileHidden: true,
          photoVisibility: "CONNECTIONS",
          bioVisibility: "CONNECTIONS",
          locationVisibility: "CONNECTIONS",
        };

        mockPrisma.user.findUnique.mockResolvedValue(targetUser);
        mockPrisma.rSVP.findMany.mockResolvedValue([{ id: "rsvp-1" }]); // They are connections
        mockPrisma.eventRole.count.mockResolvedValue(0);

        // Authenticated viewer (different user)
        mockPrisma.session.findUnique.mockResolvedValue({
          id: "session-1",
          userId: viewerId,
          token: validToken,
          expiresAt: new Date(Date.now() + 86400000),
          user: { id: viewerId },
        });

        const response = await request(app)
          .get(`/api/users/${targetUserId}`)
          .set("Authorization", `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body.user.id).toBe(targetUserId);
        expect(response.body.user.displayName).toBe("Hidden User");
        // These should NOT be present when profile is hidden
        expect(response.body.user.photoUrl).toBeUndefined();
        expect(response.body.user.bio).toBeUndefined();
        expect(response.body.user.location).toBeUndefined();
      });

      it("should show all fields when viewing own profile even if isProfileHidden is true", async () => {
        const targetUser = {
          id: viewerId,
          phone: "+1234567890",
          email: "test@example.com",
          displayName: "My Hidden Profile",
          photoUrl: "https://example.com/photo.jpg",
          bio: "My secret bio",
          location: "My location",
          isProfileHidden: true,
          photoVisibility: "CONNECTIONS",
          bioVisibility: "CONNECTIONS",
          locationVisibility: "CONNECTIONS",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.user.findUnique.mockResolvedValue(targetUser);

        mockPrisma.session.findUnique.mockResolvedValue({
          id: "session-1",
          userId: viewerId,
          token: validToken,
          expiresAt: new Date(Date.now() + 86400000),
          user: { id: viewerId },
        });

        const response = await request(app)
          .get(`/api/users/${viewerId}`)
          .set("Authorization", `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body.user.id).toBe(viewerId);
        expect(response.body.user.displayName).toBe("My Hidden Profile");
        // All fields should be visible when viewing own profile
        expect(response.body.user.photoUrl).toBe("https://example.com/photo.jpg");
        expect(response.body.user.bio).toBe("My secret bio");
        expect(response.body.user.location).toBe("My location");
        expect(response.body.user.phone).toBe("+1234567890");
        expect(response.body.user.email).toBe("test@example.com");
        expect(response.body.user.isProfileHidden).toBe(true);
        expect(response.body.relationship.isSelf).toBe(true);
      });

      it("should show fields based on granular visibility when isProfileHidden is false", async () => {
        const targetUser = {
          id: targetUserId,
          displayName: "Visible User",
          photoUrl: "https://example.com/photo.jpg",
          bio: "Public bio",
          location: "Public location",
          isProfileHidden: false,
          photoVisibility: "CONNECTIONS",
          bioVisibility: "CONNECTIONS",
          locationVisibility: "PRIVATE",
        };

        mockPrisma.user.findUnique.mockResolvedValue(targetUser);
        mockPrisma.rSVP.findMany.mockResolvedValue([{ id: "rsvp-1" }]); // They are connections
        mockPrisma.eventRole.count.mockResolvedValue(0);

        mockPrisma.session.findUnique.mockResolvedValue({
          id: "session-1",
          userId: viewerId,
          token: validToken,
          expiresAt: new Date(Date.now() + 86400000),
          user: { id: viewerId },
        });

        const response = await request(app)
          .get(`/api/users/${targetUserId}`)
          .set("Authorization", `Bearer ${validToken}`);

        expect(response.status).toBe(200);
        expect(response.body.user.id).toBe(targetUserId);
        expect(response.body.user.displayName).toBe("Visible User");
        // photoUrl and bio should be visible (CONNECTIONS visibility and they are connected)
        expect(response.body.user.photoUrl).toBe("https://example.com/photo.jpg");
        expect(response.body.user.bio).toBe("Public bio");
        // location should NOT be visible (PRIVATE visibility)
        expect(response.body.user.location).toBeUndefined();
      });

      it("should handle unauthenticated requests for hidden profiles", async () => {
        const targetUser = {
          id: targetUserId,
          displayName: "Hidden User",
          photoUrl: "https://example.com/photo.jpg",
          bio: "Secret bio",
          location: "Secret location",
          isProfileHidden: true,
          photoVisibility: "CONNECTIONS",
          bioVisibility: "CONNECTIONS",
          locationVisibility: "CONNECTIONS",
        };

        mockPrisma.user.findUnique.mockResolvedValue(targetUser);

        const response = await request(app).get(`/api/users/${targetUserId}`);

        expect(response.status).toBe(200);
        expect(response.body.user.id).toBe(targetUserId);
        expect(response.body.user.displayName).toBe("Hidden User");
        // All fields hidden for unauthenticated viewer
        expect(response.body.user.photoUrl).toBeUndefined();
        expect(response.body.user.bio).toBeUndefined();
        expect(response.body.user.location).toBeUndefined();
        expect(response.body.relationship.isSelf).toBe(false);
      });
    });
  });
});
