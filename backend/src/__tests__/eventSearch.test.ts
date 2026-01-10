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

const mockSession1 = {
  id: "session-1",
  userId: "user-1",
  token: "valid-token-1",
  expiresAt: new Date(Date.now() + 86400000),
  deviceInfo: null,
  createdAt: new Date(),
  lastActiveAt: new Date(),
};

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

// Mock events
const mockEvent1 = {
  id: "event-1",
  title: "Summer Party",
  description: "A fun summer event",
  dateTime: tomorrow,
  endDateTime: null,
  timezone: "America/New_York",
  location: "Park",
  state: "PUBLISHED" as const,
  imageUrl: null,
  category: "Party",
  capacity: null,
  rsvpDeadline: null,
  dressCode: null,
  waitlistEnabled: false,
  notes: null,
  attendeeListVisibility: "PUBLIC" as const,
  allowInviteSharing: true,
  creatorId: "user-2",
  createdAt: new Date(),
  updatedAt: new Date(),
  eventRoles: [{ role: "ORGANIZER" as const }],
  rsvps: [],
};

const mockEvent2 = {
  id: "event-2",
  title: "Winter Ball",
  description: "A formal winter event",
  dateTime: nextWeek,
  endDateTime: null,
  timezone: "America/New_York",
  location: "Ballroom",
  state: "PUBLISHED" as const,
  imageUrl: null,
  category: "Formal",
  capacity: null,
  rsvpDeadline: null,
  dressCode: null,
  waitlistEnabled: false,
  notes: null,
  attendeeListVisibility: "PUBLIC" as const,
  allowInviteSharing: true,
  creatorId: "user-2",
  createdAt: new Date(),
  updatedAt: new Date(),
  eventRoles: [],
  rsvps: [{ response: "YES" as const, userId: "user-1" }],
};

const mockEvent3 = {
  id: "event-3",
  title: "Spring Festival",
  description: "Celebrate spring",
  dateTime: nextWeek,
  endDateTime: null,
  timezone: "America/New_York",
  location: "Garden",
  state: "PUBLISHED" as const,
  imageUrl: null,
  category: "Festival",
  capacity: null,
  rsvpDeadline: null,
  dressCode: null,
  waitlistEnabled: false,
  notes: null,
  attendeeListVisibility: "PUBLIC" as const,
  allowInviteSharing: true,
  creatorId: "user-2",
  createdAt: new Date(),
  updatedAt: new Date(),
  eventRoles: [],
  rsvps: [{ response: "MAYBE" as const, userId: "user-1" }],
};

const mockEvent4 = {
  id: "event-4",
  title: "Autumn Gala",
  description: "Past event",
  dateTime: lastWeek,
  endDateTime: null,
  timezone: "America/New_York",
  location: "Hall",
  state: "COMPLETED" as const,
  imageUrl: null,
  category: "Gala",
  capacity: null,
  rsvpDeadline: null,
  dressCode: null,
  waitlistEnabled: false,
  notes: null,
  attendeeListVisibility: "PUBLIC" as const,
  allowInviteSharing: true,
  creatorId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  eventRoles: [{ role: "ORGANIZER" as const }],
  rsvps: [],
};

// Mock the database module before importing app
vi.mock("../utils/db.js", () => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    event: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import app from "../app.js";
import { prisma } from "../utils/db.js";

describe("Event Search API - GET /api/dashboard/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated user
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession1);
    vi.mocked(prisma.session.update).mockResolvedValue(mockSession1);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser1);
  });

  it("should require authentication", async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

    const response = await request(app).get("/api/dashboard/search");

    expect(response.status).toBe(401);
  });

  it("should return all user's events without filters", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(4);
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      mockEvent1 as any,
      mockEvent2 as any,
      mockEvent3 as any,
      mockEvent4 as any,
    ]);

    const response = await request(app)
      .get("/api/dashboard/search")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("events");
    expect(response.body).toHaveProperty("pagination");
    expect(response.body.events).toBeInstanceOf(Array);
    expect(response.body.events.length).toBe(4);

    // Verify pagination structure
    expect(response.body.pagination).toHaveProperty("page", 1);
    expect(response.body.pagination).toHaveProperty("limit", 20);
    expect(response.body.pagination).toHaveProperty("total", 4);
    expect(response.body.pagination).toHaveProperty("totalPages", 1);
  });

  it("should filter by title (case-insensitive)", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(1);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent1 as any]);

    const response = await request(app)
      .get("/api/dashboard/search?title=summer")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    expect(response.body.events.length).toBe(1);
    expect(response.body.events[0].title).toBe("Summer Party");

    // Verify the prisma call included title filter with case-insensitive mode
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              title: {
                contains: "summer",
                mode: "insensitive",
              },
            }),
          ]),
        }),
      })
    );
  });

  it("should filter by state=upcoming", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(3);
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      mockEvent1 as any,
      mockEvent2 as any,
      mockEvent3 as any,
    ]);

    const response = await request(app)
      .get("/api/dashboard/search?state=upcoming")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    expect(response.body.events.every((e: any) => e.state !== "COMPLETED")).toBe(true);

    // Verify the filter includes upcoming states
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              state: {
                in: expect.arrayContaining(["PUBLISHED"]),
              },
            }),
          ]),
        }),
      })
    );
  });

  it("should filter by state=past", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(1);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent4 as any]);

    const response = await request(app)
      .get("/api/dashboard/search?state=past")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    expect(response.body.events.length).toBe(1);
    expect(response.body.events[0].state).toBe("COMPLETED");
  });

  it("should filter by role=organizer", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(2);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent1 as any, mockEvent4 as any]);

    const response = await request(app)
      .get("/api/dashboard/search?role=organizer")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    expect(response.body.events.every((e: any) => e.isOrganizer === true)).toBe(true);

    // Verify the filter includes eventRoles
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              eventRoles: {
                some: {
                  userId: "user-1",
                  role: "ORGANIZER",
                },
              },
            }),
          ]),
        }),
      })
    );
  });

  it("should filter by role=attendee", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(1);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent2 as any]);

    const response = await request(app)
      .get("/api/dashboard/search?role=attendee")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    expect(response.body.events.every((e: any) => e.rsvpStatus === "YES")).toBe(true);

    // Verify the filter includes rsvps with YES response
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              rsvps: {
                some: {
                  userId: "user-1",
                  response: "YES",
                },
              },
            }),
          ]),
        }),
      })
    );
  });

  it("should handle pagination", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(4);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent1 as any, mockEvent2 as any]);

    const response = await request(app)
      .get("/api/dashboard/search?limit=2&page=1")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    expect(response.body.events.length).toBe(2);
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(2);
    expect(response.body.pagination.total).toBe(4);
    expect(response.body.pagination.totalPages).toBe(2);

    // Verify skip and take are used correctly
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 2,
      })
    );
  });

  it("should handle invalid page numbers gracefully", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(4);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent1 as any, mockEvent2 as any]);

    const response = await request(app)
      .get("/api/dashboard/search?page=abc")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination.page).toBe(1); // Should default to 1
  });

  it("should handle invalid limit gracefully", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(4);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent1 as any, mockEvent2 as any]);

    const response = await request(app)
      .get("/api/dashboard/search?limit=xyz")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination.limit).toBe(20); // Should default to 20
  });

  it("should cap limit at 100", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(4);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent1 as any]);

    const response = await request(app)
      .get("/api/dashboard/search?limit=500")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination.limit).toBe(100);

    // Verify take is capped at 100
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      })
    );
  });

  it("should handle invalid date formats gracefully", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(4);
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      mockEvent1,
      mockEvent2,
      mockEvent3,
      mockEvent4,
    ]);

    const response = await request(app)
      .get("/api/dashboard/search?startDate=invalid-date")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    // Should not filter by date if invalid - just return results
    expect(response.body.events.length).toBeGreaterThan(0);
  });

  it("should filter by date range", async () => {
    const startDate = tomorrow.toISOString();
    const endDate = nextWeek.toISOString();

    vi.mocked(prisma.event.count).mockResolvedValue(2);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent1 as any, mockEvent2 as any]);

    const response = await request(app)
      .get(`/api/dashboard/search?startDate=${startDate}&endDate=${endDate}`)
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);

    // Verify date filters are applied
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              dateTime: { gte: expect.any(Date) },
            }),
            expect.objectContaining({
              dateTime: { lte: expect.any(Date) },
            }),
          ]),
        }),
      })
    );
  });

  it("should ignore invalid role values", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(4);
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      mockEvent1,
      mockEvent2,
      mockEvent3,
      mockEvent4,
    ]);

    const response = await request(app)
      .get("/api/dashboard/search?role=invalid")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    // Should return all events (ignoring invalid role)
    expect(response.body.events.length).toBe(4);
  });

  it("should ignore invalid state values", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(4);
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      mockEvent1,
      mockEvent2,
      mockEvent3,
      mockEvent4,
    ]);

    const response = await request(app)
      .get("/api/dashboard/search?state=invalid")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    // Should return all events (ignoring invalid state)
    expect(response.body.events.length).toBe(4);
  });

  it("should include RSVP counts for organizer events", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(2);
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      {
        ...mockEvent1,
        rsvps: [
          { response: "YES" as const, userId: "user-2" },
          { response: "YES" as const, userId: "user-3" },
          { response: "NO" as const, userId: "user-4" },
          { response: "MAYBE" as const, userId: "user-5" },
        ],
      },
      mockEvent4,
    ]);

    const response = await request(app)
      .get("/api/dashboard/search?role=organizer")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    const organizerEvent = response.body.events.find((e: any) => e.id === "event-1");
    expect(organizerEvent).toBeDefined();
    expect(organizerEvent.isOrganizer).toBe(true);
    expect(organizerEvent.rsvpCounts).toEqual({
      yes: 2,
      no: 1,
      maybe: 1,
    });
  });

  it("should not include RSVP counts for attendee events", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(1);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent2 as any]);

    const response = await request(app)
      .get("/api/dashboard/search?role=attendee")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    const attendeeEvent = response.body.events[0];
    expect(attendeeEvent.isOrganizer).toBe(false);
    expect(attendeeEvent.rsvpCounts).toBeUndefined();
  });

  it("should return empty array when no events match", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(0);
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);

    const response = await request(app)
      .get("/api/dashboard/search?title=NonExistentEventTitle12345")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);
    expect(response.body.events).toEqual([]);
    expect(response.body.pagination.total).toBe(0);
    expect(response.body.pagination.totalPages).toBe(0);
  });

  it("should combine multiple filters", async () => {
    vi.mocked(prisma.event.count).mockResolvedValue(1);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent1 as any]);

    const response = await request(app)
      .get("/api/dashboard/search?state=upcoming&role=organizer&title=summer")
      .set("Authorization", `Bearer ${mockSession1.token}`);

    expect(response.status).toBe(200);

    // Verify all filters are combined
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              eventRoles: {
                some: {
                  userId: "user-1",
                  role: "ORGANIZER",
                },
              },
            }),
            expect.objectContaining({
              title: {
                contains: "summer",
                mode: "insensitive",
              },
            }),
            expect.objectContaining({
              state: {
                in: expect.arrayContaining(["PUBLISHED"]),
              },
            }),
          ]),
        }),
      })
    );
  });
});
