import request from "supertest";
import { app } from "../index.js";
import { prisma } from "../utils/db.js";
import { generateSessionToken } from "../utils/verification.js";

describe("Session Management API", () => {
  let authToken: string;
  let userId: string;
  let sessionId: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.session.deleteMany({
      where: { user: { phone: "+15555551234" } },
    });
    await prisma.user.deleteMany({
      where: { phone: "+15555551234" },
    });

    // Create a test user
    const user = await prisma.user.create({
      data: {
        phone: "+15555551234",
        displayName: "Test User",
      },
    });
    userId = user.id;

    // Create a session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: generateSessionToken(),
        deviceType: "desktop",
        deviceName: "Chrome on macOS",
        ipAddress: "127.0.0.1",
        location: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    authToken = session.token;
    sessionId = session.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.session.deleteMany({
      where: { userId },
    });
    await prisma.user.deleteMany({
      where: { id: userId },
    });
    await prisma.$disconnect();
  });

  describe("GET /api/auth/sessions", () => {
    it("should return all active sessions for the authenticated user", async () => {
      const response = await request(app)
        .get("/api/auth/sessions")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.sessions).toBeDefined();
      expect(Array.isArray(response.body.sessions)).toBe(true);
      expect(response.body.sessions.length).toBeGreaterThan(0);

      const currentSession = response.body.sessions.find(
        (s: { isCurrent: boolean }) => s.isCurrent
      );
      expect(currentSession).toBeDefined();
      expect(currentSession.deviceType).toBe("desktop");
      expect(currentSession.deviceName).toBe("Chrome on macOS");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/auth/sessions");

      expect(response.status).toBe(401);
    });

    it("should mark the current session correctly", async () => {
      // Create a second session
      const session2 = await prisma.session.create({
        data: {
          userId,
          token: generateSessionToken(),
          deviceType: "mobile",
          deviceName: "iPhone",
          ipAddress: "192.168.1.1",
          location: null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app)
        .get("/api/auth/sessions")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.sessions.length).toBeGreaterThanOrEqual(2);

      const currentSessions = response.body.sessions.filter(
        (s: { isCurrent: boolean }) => s.isCurrent
      );
      expect(currentSessions.length).toBe(1);
      expect(currentSessions[0].id).toBe(sessionId);

      // Clean up
      await prisma.session.delete({ where: { id: session2.id } });
    });
  });

  describe("DELETE /api/auth/sessions/:sessionId", () => {
    it("should revoke a specific session", async () => {
      // Create a session to revoke
      const sessionToRevoke = await prisma.session.create({
        data: {
          userId,
          token: generateSessionToken(),
          deviceType: "tablet",
          deviceName: "iPad",
          ipAddress: "10.0.0.1",
          location: null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app)
        .delete(`/api/auth/sessions/${sessionToRevoke.id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Session revoked successfully");

      // Verify the session was deleted
      const deletedSession = await prisma.session.findUnique({
        where: { id: sessionToRevoke.id },
      });
      expect(deletedSession).toBeNull();
    });

    it("should require authentication", async () => {
      const response = await request(app).delete(
        `/api/auth/sessions/${sessionId}`
      );

      expect(response.status).toBe(401);
    });

    it("should not allow revoking another user's session", async () => {
      // Create another user and session
      const otherUser = await prisma.user.create({
        data: {
          phone: "+15555559999",
          displayName: "Other User",
        },
      });

      const otherSession = await prisma.session.create({
        data: {
          userId: otherUser.id,
          token: generateSessionToken(),
          deviceType: "desktop",
          deviceName: "Firefox on Windows",
          ipAddress: "172.16.0.1",
          location: null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app)
        .delete(`/api/auth/sessions/${otherSession.id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(403);

      // Clean up
      await prisma.session.delete({ where: { id: otherSession.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it("should return 404 for non-existent session", async () => {
      const response = await request(app)
        .delete("/api/auth/sessions/non-existent-id")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it("should allow revoking the current session (logout)", async () => {
      // Create a temporary session for this test
      const tempSession = await prisma.session.create({
        data: {
          userId,
          token: generateSessionToken(),
          deviceType: "mobile",
          deviceName: "Android Phone",
          ipAddress: "192.168.0.100",
          location: null,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app)
        .delete(`/api/auth/sessions/${tempSession.id}`)
        .set("Authorization", `Bearer ${tempSession.token}`);

      expect(response.status).toBe(200);

      // Verify the session was deleted
      const deletedSession = await prisma.session.findUnique({
        where: { id: tempSession.id },
      });
      expect(deletedSession).toBeNull();
    });
  });

  describe("Device information tracking", () => {
    it("should capture device info during login", async () => {
      // Create verification code for login
      const code = "123456";
      await prisma.verificationCode.create({
        data: {
          userId,
          phone: "+15555551234",
          code,
          type: "LOGIN",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const response = await request(app)
        .post("/api/auth/login/verify")
        .set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)")
        .send({
          phone: "+15555551234",
          code,
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();

      // Verify device info was captured
      const sessions = await prisma.session.findMany({
        where: { userId, token: response.body.token },
      });

      expect(sessions.length).toBe(1);
      expect(sessions[0].deviceType).toBe("mobile");
      expect(sessions[0].deviceName).toBe("iPhone");

      // Clean up the session
      await prisma.session.delete({ where: { id: sessions[0].id } });
    });
  });

  describe("Session expiration", () => {
    it("should not return expired sessions", async () => {
      // Create an expired session
      const expiredSession = await prisma.session.create({
        data: {
          userId,
          token: generateSessionToken(),
          deviceType: "desktop",
          deviceName: "Chrome on Linux",
          ipAddress: "203.0.113.1",
          location: null,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const response = await request(app)
        .get("/api/auth/sessions")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      const expiredInList = response.body.sessions.find(
        (s: { id: string }) => s.id === expiredSession.id
      );
      expect(expiredInList).toBeUndefined();

      // Clean up
      await prisma.session.delete({ where: { id: expiredSession.id } });
    });
  });
});
