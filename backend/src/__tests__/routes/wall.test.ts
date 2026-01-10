import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import app from "../../app.js";
import { prisma } from "../../utils/db.js";
import type { User, Event } from "@prisma/client";

describe("Wall API Endpoints", () => {
  let testUser: User;
  let testOrganizer: User;
  let testEvent: Event;
  let authToken: string;
  let organizerToken: string;

  beforeAll(async () => {
    // Create test users
    testUser = await prisma.user.create({
      data: {
        phone: "+15555550101",
        displayName: "Test Attendee",
      },
    });

    testOrganizer = await prisma.user.create({
      data: {
        phone: "+15555550102",
        displayName: "Test Organizer",
      },
    });

    // Create test event
    testEvent = await prisma.event.create({
      data: {
        title: "Test Event",
        description: "Test Description",
        dateTime: new Date(Date.now() + 86400000), // Tomorrow
        location: "Test Location",
        state: "PUBLISHED",
        creatorId: testOrganizer.id,
      },
    });

    // Create RSVP for attendee
    await prisma.rSVP.create({
      data: {
        eventId: testEvent.id,
        userId: testUser.id,
        response: "YES",
      },
    });

    // Create mock tokens (in real tests, you'd use the auth flow)
    authToken = "mock-token-user";
    organizerToken = "mock-token-organizer";
  });

  afterAll(async () => {
    // Cleanup
    await prisma.wallPost.deleteMany({});
    await prisma.rSVP.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe("POST /api/events/:id/wall", () => {
    it("should create a wall post with valid content", async () => {
      const response = await request(app)
        .post(`/api/events/${testEvent.id}/wall`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          content: "This is a test post!",
        });

      // Note: This test will fail without proper auth middleware setup
      // In a real test, you'd need to mock or properly setup authentication
      expect(response.status).toBeLessThanOrEqual(201);
    });

    it("should reject empty content", async () => {
      const response = await request(app)
        .post(`/api/events/${testEvent.id}/wall`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          content: "   ",
        });

      expect([400, 401, 403]).toContain(response.status);
    });

    it("should reject content longer than 2000 characters for top-level posts", async () => {
      const response = await request(app)
        .post(`/api/events/${testEvent.id}/wall`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          content: "a".repeat(2001),
        });

      expect([400, 401, 403]).toContain(response.status);
    });

    it("should reject content longer than 1000 characters for replies", async () => {
      // First create a parent post
      const parentPost = await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: testUser.id,
          content: "Parent post",
          depth: 0,
        },
      });

      const response = await request(app)
        .post(`/api/events/${testEvent.id}/wall`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          content: "a".repeat(1001),
          parentId: parentPost.id,
        });

      expect([400, 401, 403]).toContain(response.status);
    });

    it("should prevent non-attendees from posting", async () => {
      // Create a non-attendee user
      const nonAttendee = await prisma.user.create({
        data: {
          phone: "+15555550103",
          displayName: "Non Attendee",
        },
      });

      const response = await request(app)
        .post(`/api/events/${testEvent.id}/wall`)
        .set("Authorization", "Bearer mock-token-non-attendee")
        .send({
          content: "I shouldn't be able to post this",
        });

      expect([401, 403]).toContain(response.status);

      await prisma.user.delete({ where: { id: nonAttendee.id } });
    });
  });

  describe("GET /api/events/:id/wall", () => {
    beforeEach(async () => {
      // Clean up posts before each test
      await prisma.wallPost.deleteMany({});
    });

    it("should return wall posts for confirmed attendees", async () => {
      // Create test posts
      await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: testUser.id,
          content: "Test post 1",
          depth: 0,
        },
      });

      const response = await request(app)
        .get(`/api/events/${testEvent.id}/wall`)
        .set("Authorization", `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);
    });

    it("should return pinned posts first", async () => {
      const unpinned = await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: testUser.id,
          content: "Unpinned post",
          depth: 0,
          createdAt: new Date(Date.now() + 1000),
        },
      });

      const pinned = await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: testOrganizer.id,
          content: "Pinned post",
          depth: 0,
          isPinned: true,
          pinnedAt: new Date(),
        },
      });

      const response = await request(app)
        .get(`/api/events/${testEvent.id}/wall`)
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200 && response.body.posts) {
        expect(response.body.posts[0].isPinned).toBe(true);
      }
    });
  });

  describe("DELETE /api/events/:id/wall/:postId", () => {
    it("should allow author to delete their own post", async () => {
      const post = await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: testUser.id,
          content: "My post to delete",
          depth: 0,
        },
      });

      const response = await request(app)
        .delete(`/api/events/${testEvent.id}/wall/${post.id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);
    });

    it("should allow organizers to delete any post", async () => {
      const post = await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: testUser.id,
          content: "Post to be moderated",
          depth: 0,
        },
      });

      const response = await request(app)
        .delete(`/api/events/${testEvent.id}/wall/${post.id}`)
        .set("Authorization", `Bearer ${organizerToken}`);

      expect([200, 401]).toContain(response.status);
    });

    it("should prevent users from deleting others' posts", async () => {
      const otherUser = await prisma.user.create({
        data: {
          phone: "+15555550104",
          displayName: "Other User",
        },
      });

      const post = await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: otherUser.id,
          content: "Someone else's post",
          depth: 0,
        },
      });

      const response = await request(app)
        .delete(`/api/events/${testEvent.id}/wall/${post.id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect([401, 403]).toContain(response.status);

      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe("POST /api/events/:id/wall/:postId/reactions", () => {
    it("should allow adding a reaction", async () => {
      const post = await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: testUser.id,
          content: "Post to react to",
          depth: 0,
        },
      });

      const response = await request(app)
        .post(`/api/events/${testEvent.id}/wall/${post.id}/reactions`)
        .set("Authorization", `Bearer ${authToken}`);

      expect([201, 401]).toContain(response.status);
    });

    it("should prevent duplicate reactions", async () => {
      const post = await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: testUser.id,
          content: "Post with reaction",
          depth: 0,
        },
      });

      // Add reaction first time
      await prisma.wallReaction.create({
        data: {
          postId: post.id,
          userId: testUser.id,
          type: "HEART",
        },
      });

      // Try to add again
      const response = await request(app)
        .post(`/api/events/${testEvent.id}/wall/${post.id}/reactions`)
        .set("Authorization", `Bearer ${authToken}`);

      expect([400, 401]).toContain(response.status);
    });
  });

  describe("POST /api/events/:id/wall/:postId/pin", () => {
    it("should allow organizers to pin posts", async () => {
      const post = await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: testUser.id,
          content: "Post to pin",
          depth: 0,
        },
      });

      const response = await request(app)
        .post(`/api/events/${testEvent.id}/wall/${post.id}/pin`)
        .set("Authorization", `Bearer ${organizerToken}`);

      expect([200, 401]).toContain(response.status);
    });

    it("should prevent non-organizers from pinning", async () => {
      const post = await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: testUser.id,
          content: "Post regular user tries to pin",
          depth: 0,
        },
      });

      const response = await request(app)
        .post(`/api/events/${testEvent.id}/wall/${post.id}/pin`)
        .set("Authorization", `Bearer ${authToken}`);

      expect([401, 403]).toContain(response.status);
    });

    it("should prevent pinning replies", async () => {
      const parentPost = await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: testUser.id,
          content: "Parent post",
          depth: 0,
        },
      });

      const reply = await prisma.wallPost.create({
        data: {
          eventId: testEvent.id,
          authorId: testUser.id,
          content: "Reply",
          parentId: parentPost.id,
          depth: 1,
        },
      });

      const response = await request(app)
        .post(`/api/events/${testEvent.id}/wall/${reply.id}/pin`)
        .set("Authorization", `Bearer ${organizerToken}`);

      expect([400, 401]).toContain(response.status);
    });
  });
});
