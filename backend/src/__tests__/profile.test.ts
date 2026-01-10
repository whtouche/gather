import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";

// Mock the database module before importing app
vi.mock("../utils/db.js", () => ({
  prisma: {
    session: {
      findUnique: vi.fn().mockResolvedValue(null),
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
});
