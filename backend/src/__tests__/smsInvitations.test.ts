import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";

// Mock the database module before importing app
vi.mock("../utils/db.js", () => ({
  prisma: {
    session: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    event: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    eventRole: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    smsInvitation: {
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
    },
    smsQuota: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    inviteLink: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import app from "../app.js";

describe("SMS Invitation Routes", () => {
  describe("POST /api/events/:id/invitations/sms", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/events/test-event-id/invitations/sms")
        .send({
          recipients: [{ phone: "+15551234567" }],
        });
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .post("/api/events/test-event-id/invitations/sms")
        .set("Authorization", "Bearer invalid-token")
        .send({
          recipients: [{ phone: "+15551234567" }],
        });
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/events/:id/invitations/sms", () => {
    it("should require authentication", async () => {
      const response = await request(app).get(
        "/api/events/test-event-id/invitations/sms"
      );
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .get("/api/events/test-event-id/invitations/sms")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/events/:id/invitations/sms/quota", () => {
    it("should require authentication", async () => {
      const response = await request(app).get(
        "/api/events/test-event-id/invitations/sms/quota"
      );
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .get("/api/events/test-event-id/invitations/sms/quota")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });
});
