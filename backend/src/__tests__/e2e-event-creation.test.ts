/**
 * End-to-end test for event creation workflow
 * Tests the complete flow from user registration to event creation and viewing
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../utils/db";

describe("E2E: Event Creation Workflow", () => {
  let authToken: string;
  let userId: string;
  let eventId: string;
  const testPhone = `+1555${Date.now().toString().slice(-7)}`;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.user.deleteMany({
      where: { phone: testPhone },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (eventId) {
      await prisma.event.deleteMany({
        where: { id: eventId },
      });
    }
    if (userId) {
      await prisma.user.deleteMany({
        where: { id: userId },
      });
    }
  });

  describe("1. User Registration", () => {
    let verificationCode: string;

    it("should request verification code", async () => {
      const response = await request(app)
        .post("/api/auth/request-code")
        .send({ phone: testPhone })
        .expect(200);

      expect(response.body).toHaveProperty("message");

      // Get the verification code from database (in real app, would be sent via SMS)
      const code = await prisma.verificationCode.findFirst({
        where: { phone: testPhone, usedAt: null },
        orderBy: { createdAt: "desc" },
      });

      expect(code).toBeTruthy();
      verificationCode = code!.code;
    });

    it("should verify code and create user", async () => {
      const response = await request(app)
        .post("/api/auth/verify")
        .send({
          phone: testPhone,
          code: verificationCode,
          displayName: "Test User E2E",
        })
        .expect(200);

      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user.displayName).toBe("Test User E2E");

      authToken = response.body.token;
      userId = response.body.user.id;
    });
  });

  describe("2. Event Creation", () => {
    it("should create a draft event", async () => {
      const eventData = {
        title: "E2E Test Party",
        description: "Testing event creation workflow",
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        timezone: "America/New_York",
        location: "123 Test Street",
        capacity: 50,
        waitlistEnabled: true,
        state: "DRAFT",
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData)
        .expect(201);

      expect(response.body).toHaveProperty("event");
      expect(response.body.event.title).toBe(eventData.title);
      expect(response.body.event.state).toBe("DRAFT");
      expect(response.body.event.creatorId).toBe(userId);

      eventId = response.body.event.id;
    });

    it("should publish the event", async () => {
      const response = await request(app)
        .patch(`/api/events/${eventId}/publish`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.event.state).toBe("PUBLISHED");
    });
  });

  describe("3. Event Viewing", () => {
    it("should get event details", async () => {
      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.event).toBeDefined();
      expect(response.body.event.id).toBe(eventId);
      expect(response.body.event.title).toBe("E2E Test Party");
      expect(response.body.isOrganizer).toBe(true);
    });

    it("should get attendee list (empty initially)", async () => {
      const response = await request(app)
        .get(`/api/events/${eventId}/attendees/public`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.attendeeCount).toBe(0);
      // Organizers can see attendee list even without RSVP
      expect(response.body.canViewAttendees).toBe(true);
      expect(response.body.attendees).toEqual([]);
    });

    it("should handle event wall access (requires RSVP)", async () => {
      // Organizer without RSVP should get 403 on wall
      const response = await request(app)
        .get(`/api/events/${eventId}/wall`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.code).toBe("NOT_ATTENDEE");
    });
  });

  describe("4. RSVP as Organizer", () => {
    it("should allow organizer to RSVP", async () => {
      const response = await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ response: "YES" })
        .expect(200);

      expect(response.body.rsvp.response).toBe("YES");
    });

    it("should now show organizer in attendee list", async () => {
      const response = await request(app)
        .get(`/api/events/${eventId}/attendees/public`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.attendeeCount).toBe(1);
      expect(response.body.attendees).toHaveLength(1);
      expect(response.body.attendees[0].displayName).toBe("Test User E2E");
      expect(response.body.attendees[0].isOrganizer).toBe(true);
    });

    it("should now allow wall access", async () => {
      const response = await request(app)
        .get(`/api/events/${eventId}/wall`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.posts).toEqual([]);
    });
  });

  describe("5. Event Wall", () => {
    let postId: string;

    it("should allow posting to wall", async () => {
      const response = await request(app)
        .post(`/api/events/${eventId}/wall`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ content: "First post!" })
        .expect(201);

      expect(response.body.post.content).toBe("First post!");
      postId = response.body.post.id;
    });

    it("should retrieve wall posts", async () => {
      const response = await request(app)
        .get(`/api/events/${eventId}/wall`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].content).toBe("First post!");
    });

    it("should allow reactions to posts", async () => {
      const response = await request(app)
        .post(`/api/events/${eventId}/wall/${postId}/reactions`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.message).toContain("added");
    });
  });

  describe("6. Invitations", () => {
    let inviteLink: string;

    it("should generate invite link", async () => {
      const response = await request(app)
        .post(`/api/events/${eventId}/invitations`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.inviteLink).toBeDefined();
      expect(response.body.inviteLink.token).toBeDefined();
      inviteLink = response.body.inviteLink.token;
    });

    it("should get event preview from invite link", async () => {
      const response = await request(app)
        .get(`/api/invites/${inviteLink}`)
        .expect(200);

      expect(response.body.event).toBeDefined();
      expect(response.body.event.title).toBe("E2E Test Party");
      // Personal info should not be exposed
      expect(response.body.event).not.toHaveProperty("creatorId");
    });
  });

  describe("7. Error Handling", () => {
    it("should handle invalid event ID gracefully", async () => {
      const response = await request(app)
        .get("/api/events/invalid-id-12345")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.code).toBe("EVENT_NOT_FOUND");
    });

    it("should return valid JSON for all error responses", async () => {
      // Test various error scenarios
      const scenarios = [
        { path: "/api/events/nonexistent", expectedStatus: 404 },
        { path: `/api/events/${eventId}/rsvp`, method: "post", body: { response: "INVALID" }, expectedStatus: 400 },
      ];

      for (const scenario of scenarios) {
        const req = scenario.method === "post"
          ? request(app).post(scenario.path).send(scenario.body || {})
          : request(app).get(scenario.path);

        const response = await req
          .set("Authorization", `Bearer ${authToken}`)
          .expect(scenario.expectedStatus);

        // Should be valid JSON
        expect(response.body).toBeDefined();
        expect(typeof response.body).toBe("object");
        // Should have error structure
        expect(response.body).toHaveProperty("message");
      }
    });
  });
});
