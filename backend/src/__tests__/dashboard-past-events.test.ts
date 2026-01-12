/**
 * Test for dashboard past events functionality
 * Tests that past events organized by the user are correctly returned
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../utils/db";

describe("Dashboard Past Events", () => {
  let authToken: string;
  let userId: string;
  let organizingEventId: string;
  let attendingEventId: string;
  let otherUserId: string;
  const testPhone = `+1555${Date.now().toString().slice(-7)}`;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.user.deleteMany({
      where: { phone: testPhone },
    });

    // Create test user
    const registerResponse = await request(app)
      .post("/api/auth/request-code")
      .send({ phone: testPhone })
      .expect(200);

    const code = await prisma.verificationCode.findFirst({
      where: { phone: testPhone, usedAt: null },
      orderBy: { createdAt: "desc" },
    });

    const verifyResponse = await request(app)
      .post("/api/auth/verify")
      .send({
        phone: testPhone,
        code: code!.code,
        displayName: "Dashboard Test User",
      })
      .expect(200);

    authToken = verifyResponse.body.token;
    userId = verifyResponse.body.user.id;

    // Create another user
    const otherPhone = `+1555${(Date.now() + 1).toString().slice(-7)}`;
    await request(app).post("/api/auth/request-code").send({ phone: otherPhone });

    const otherCode = await prisma.verificationCode.findFirst({
      where: { phone: otherPhone, usedAt: null },
      orderBy: { createdAt: "desc" },
    });

    const otherVerifyResponse = await request(app)
      .post("/api/auth/verify")
      .send({
        phone: otherPhone,
        code: otherCode!.code,
        displayName: "Other User",
      })
      .expect(200);

    otherUserId = otherVerifyResponse.body.user.id;

    // Create a past event organized by test user
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30); // 30 days ago

    const eventResponse = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Past Test Event",
        description: "An event that happened in the past",
        dateTime: pastDate.toISOString(),
        timezone: "America/New_York",
        location: "Test Location",
        state: "DRAFT",
      })
      .expect(201);

    organizingEventId = eventResponse.body.event.id;

    // Mark it as completed
    await prisma.event.update({
      where: { id: organizingEventId },
      data: { state: "COMPLETED" },
    });

    // Verify that EventRole was created
    const eventRole = await prisma.eventRole.findFirst({
      where: {
        eventId: organizingEventId,
        userId: userId,
        role: "ORGANIZER",
      },
    });

    expect(eventRole).toBeTruthy();

    // Create another past event organized by other user that test user attended
    const attendingEvent = await prisma.event.create({
      data: {
        title: "Other User's Past Event",
        description: "An event organized by another user",
        dateTime: pastDate,
        timezone: "America/New_York",
        location: "Test Location 2",
        state: "COMPLETED",
        creatorId: otherUserId,
      },
    });

    attendingEventId = attendingEvent.id;

    // Create organizer role for other user
    await prisma.eventRole.create({
      data: {
        eventId: attendingEventId,
        userId: otherUserId,
        role: "ORGANIZER",
      },
    });

    // Test user RSVPs YES to this event
    await prisma.rSVP.create({
      data: {
        eventId: attendingEventId,
        userId: userId,
        response: "YES",
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (organizingEventId) {
      await prisma.event.deleteMany({
        where: { id: { in: [organizingEventId, attendingEventId] } },
      });
    }
    if (userId) {
      await prisma.user.deleteMany({
        where: { id: { in: [userId, otherUserId] } },
      });
    }
  });

  it("should return past events organized by the user", async () => {
    const response = await request(app)
      .get("/api/dashboard/past")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty("pastOrganizing");
    expect(response.body).toHaveProperty("pastAttending");

    // Should have 1 event in pastOrganizing
    expect(response.body.pastOrganizing).toHaveLength(1);
    expect(response.body.pastOrganizing[0].id).toBe(organizingEventId);
    expect(response.body.pastOrganizing[0].title).toBe("Past Test Event");
    expect(response.body.pastOrganizing[0].state).toBe("COMPLETED");

    // Should have RSVP counts
    expect(response.body.pastOrganizing[0]).toHaveProperty("rsvpCounts");
    expect(response.body.pastOrganizing[0].rsvpCounts).toHaveProperty("yes");
    expect(response.body.pastOrganizing[0].rsvpCounts).toHaveProperty("no");
    expect(response.body.pastOrganizing[0].rsvpCounts).toHaveProperty("maybe");
  });

  it("should return past events attended by the user (excluding organized ones)", async () => {
    const response = await request(app)
      .get("/api/dashboard/past")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    // Should have 1 event in pastAttending (excluding the one they organized)
    expect(response.body.pastAttending).toHaveLength(1);
    expect(response.body.pastAttending[0].id).toBe(attendingEventId);
    expect(response.body.pastAttending[0].title).toBe("Other User's Past Event");
    expect(response.body.pastAttending[0].rsvpStatus).toBe("YES");
    expect(response.body.pastAttending[0].isOrganizer).toBe(false);
  });

  it("should verify EventRole entries exist for all created events", async () => {
    // This is a critical test to ensure the bug doesn't happen again
    // When an event is created, an EventRole entry MUST be created

    // Check organizing event
    const organizingRole = await prisma.eventRole.findFirst({
      where: {
        eventId: organizingEventId,
        userId: userId,
        role: "ORGANIZER",
      },
    });

    expect(organizingRole).toBeTruthy();
    expect(organizingRole!.role).toBe("ORGANIZER");

    // Check attending event (organized by other user)
    const attendingRole = await prisma.eventRole.findFirst({
      where: {
        eventId: attendingEventId,
        userId: otherUserId,
        role: "ORGANIZER",
      },
    });

    expect(attendingRole).toBeTruthy();
    expect(attendingRole!.role).toBe("ORGANIZER");
  });

  it("should not return future events in past endpoint", async () => {
    // Create a future event
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const futureEventResponse = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Future Test Event",
        description: "An event in the future",
        dateTime: futureDate.toISOString(),
        timezone: "America/New_York",
        location: "Test Location",
        state: "PUBLISHED",
      })
      .expect(201);

    const futureEventId = futureEventResponse.body.event.id;

    // Get past events
    const response = await request(app)
      .get("/api/dashboard/past")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    // Should not include the future event
    const futureEventInPast = response.body.pastOrganizing.find(
      (e: any) => e.id === futureEventId
    );
    expect(futureEventInPast).toBeUndefined();

    // Clean up
    await prisma.event.delete({ where: { id: futureEventId } });
  });
});
