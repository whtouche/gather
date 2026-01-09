import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("Express App", () => {
  describe("Health check", () => {
    it("should respond to GET /api/health", async () => {
      const response = await request(app).get("/api/health");
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "healthy");
      expect(response.body).toHaveProperty("timestamp");
    });
  });

  describe("404 handling", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await request(app).get("/api/unknown-route");
      expect(response.status).toBe(404);
    });
  });

  describe("CORS headers", () => {
    it("should include CORS headers in response", async () => {
      const response = await request(app)
        .get("/api/health")
        .set("Origin", "http://localhost:5173");
      expect(response.headers["access-control-allow-origin"]).toBeDefined();
    });
  });

  describe("Content-Type handling", () => {
    it("should accept JSON content", async () => {
      const response = await request(app)
        .post("/api/auth/login/start")
        .set("Content-Type", "application/json")
        .send({ email: "test@example.com" });
      // Should not be a 415 Unsupported Media Type
      expect(response.status).not.toBe(415);
    });
  });
});

describe("Auth routes input validation", () => {
  describe("POST /api/auth/login/start", () => {
    it("should require email or phone", async () => {
      const response = await request(app)
        .post("/api/auth/login/start")
        .send({});
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message");
    });

    it("should validate email format", async () => {
      const response = await request(app)
        .post("/api/auth/login/start")
        .send({ email: "invalid-email" });
      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/auth/register/start", () => {
    it("should require displayName", async () => {
      const response = await request(app)
        .post("/api/auth/register/start")
        .send({ email: "test@example.com" });
      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Display name");
    });

    it("should require email or phone", async () => {
      const response = await request(app)
        .post("/api/auth/register/start")
        .send({ displayName: "Test User" });
      expect(response.status).toBe(400);
    });
  });
});

describe("Protected routes", () => {
  describe("GET /api/dashboard", () => {
    it("should require authentication", async () => {
      const response = await request(app).get("/api/dashboard");
      expect(response.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const response = await request(app)
        .get("/api/dashboard")
        .set("Authorization", "Bearer invalid-token");
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/events", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/events")
        .send({
          title: "Test Event",
          description: "Test description",
          dateTime: new Date().toISOString(),
          location: "Test Location",
        });
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/notifications", () => {
    it("should require authentication", async () => {
      const response = await request(app).get("/api/notifications");
      expect(response.status).toBe(401);
    });
  });
});
