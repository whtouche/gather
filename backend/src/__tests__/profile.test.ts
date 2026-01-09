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
    },
    eventRole: {
      count: vi.fn().mockResolvedValue(0),
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
});
