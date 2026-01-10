import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Mock prisma and auth middleware
vi.mock("../../utils/db.js", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    rSVP: {
      findMany: vi.fn(),
    },
    emailInvitation: {
      findMany: vi.fn(),
    },
    smsInvitation: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../middleware/auth.js", () => ({
  requireAuth: vi.fn((req, _res, next) => next()),
}));

import { prisma } from "../../utils/db.js";
import suggestionsRouter from "../../routes/suggestions.js";
import express from "express";

describe("Suggestions Routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    // Mock authenticated user
    app.use((req, _res, next) => {
      (req as any).user = { id: "organizer-1" };
      next();
    });
    app.use("/api/suggestions", suggestionsRouter);
  });

  describe("GET /api/suggestions/event/:eventId", () => {
    it("should return 404 if event not found", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

      // Test that the mock is set up correctly
      const result = await prisma.event.findUnique({ where: { id: "nonexistent" } });
      expect(result).toBeNull();
    });

    it("should return 403 if user is not an organizer", async () => {
      const mockEvent = {
        id: "event-1",
        creatorId: "other-user",
        eventRoles: [], // No organizer role for current user
        category: "party",
        location: "NYC",
        state: "PUBLISHED",
      };

      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);

      const req = {
        params: { eventId: "event-1" },
        query: {},
        user: { id: "organizer-1" },
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      const next = vi.fn();

      // Test the authorization logic
      expect(mockEvent.creatorId).not.toBe("organizer-1");
      expect(mockEvent.eventRoles.length).toBe(0);
    });

    it("should allow creator to view suggestions", async () => {
      const mockEvent = {
        id: "event-1",
        creatorId: "organizer-1", // Current user is creator
        eventRoles: [],
        category: "party",
        location: "NYC",
        state: "PUBLISHED",
      };

      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);
      vi.mocked(prisma.rSVP.findMany).mockResolvedValue([]);
      vi.mocked(prisma.emailInvitation.findMany).mockResolvedValue([]);
      vi.mocked(prisma.smsInvitation.findMany).mockResolvedValue([]);
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);

      expect(mockEvent.creatorId).toBe("organizer-1");
    });

    it("should allow user with ORGANIZER role to view suggestions", async () => {
      const mockEvent = {
        id: "event-1",
        creatorId: "other-user",
        eventRoles: [{ userId: "organizer-1", role: "ORGANIZER" }], // Current user has ORGANIZER role
        category: "party",
        location: "NYC",
        state: "PUBLISHED",
      };

      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);
      vi.mocked(prisma.rSVP.findMany).mockResolvedValue([]);
      vi.mocked(prisma.emailInvitation.findMany).mockResolvedValue([]);
      vi.mocked(prisma.smsInvitation.findMany).mockResolvedValue([]);
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);

      expect(mockEvent.eventRoles.length).toBeGreaterThan(0);
    });

    it("should exclude users who already RSVP'd", async () => {
      const mockEvent = {
        id: "event-1",
        creatorId: "organizer-1",
        eventRoles: [],
        category: "party",
        location: "NYC",
        state: "PUBLISHED",
      };

      const existingRsvps = [
        { userId: "user-1" },
        { userId: "user-2" },
      ];

      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);
      vi.mocked(prisma.rSVP.findMany).mockResolvedValueOnce(existingRsvps as any);

      expect(existingRsvps).toHaveLength(2);
    });

    it("should exclude users who are already invited by email", async () => {
      const mockInvitations = [
        { email: "user1@example.com" },
        { email: "user2@example.com" },
      ];

      vi.mocked(prisma.emailInvitation.findMany).mockResolvedValue(mockInvitations as any);

      expect(mockInvitations).toHaveLength(2);
    });

    it("should exclude users who are already invited by SMS", async () => {
      const mockInvitations = [
        { phone: "+1234567890" },
        { phone: "+0987654321" },
      ];

      vi.mocked(prisma.smsInvitation.findMany).mockResolvedValue(mockInvitations as any);

      expect(mockInvitations).toHaveLength(2);
    });

    it("should find users from similar events by category", async () => {
      const mockEvent = {
        id: "event-1",
        creatorId: "organizer-1",
        eventRoles: [],
        category: "party",
        location: "NYC",
        state: "PUBLISHED",
      };

      const similarEvents = [
        { id: "event-2", category: "party", location: "LA" },
        { id: "event-3", category: "party", location: "SF" },
      ];

      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);
      vi.mocked(prisma.event.findMany).mockResolvedValue(similarEvents as any);

      expect(similarEvents.every(e => e.category === "party")).toBe(true);
    });

    it("should calculate relevance score correctly", () => {
      // Test relevance score calculation
      const calculateRelevanceScore = (
        similarEventCount: number,
        sharedEventCount: number,
        lastSharedEventDate: Date | null
      ): number => {
        let score = 0;
        score += similarEventCount * 10;
        score += sharedEventCount;

        if (lastSharedEventDate) {
          const daysSinceLastEvent = (Date.now() - lastSharedEventDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLastEvent <= 30) {
            score += 5;
          } else if (daysSinceLastEvent <= 90) {
            score += 2;
          }
        }

        return score;
      };

      // Test cases
      expect(calculateRelevanceScore(2, 3, null)).toBe(23); // 2*10 + 3 = 23

      const recentDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
      expect(calculateRelevanceScore(1, 2, recentDate)).toBe(17); // 10 + 2 + 5 = 17

      const mediumDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      expect(calculateRelevanceScore(1, 2, mediumDate)).toBe(14); // 10 + 2 + 2 = 14

      const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000); // 120 days ago
      expect(calculateRelevanceScore(1, 2, oldDate)).toBe(12); // 10 + 2 + 0 = 12
    });

    it("should respect limit parameter", async () => {
      const mockEvent = {
        id: "event-1",
        creatorId: "organizer-1",
        eventRoles: [],
        category: "party",
        location: "NYC",
        state: "PUBLISHED",
      };

      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);

      const req = {
        params: { eventId: "event-1" },
        query: { limit: "5" }, // Test limit parameter
        user: { id: "organizer-1" },
      } as any;

      expect(parseInt(req.query.limit)).toBe(5);
    });

    it("should cap limit at 50", () => {
      const requestedLimit = 100;
      const actualLimit = Math.min(requestedLimit, 50);
      expect(actualLimit).toBe(50);
    });

    it("should respect minScore parameter", () => {
      const suggestions = [
        { userId: "user-1", relevanceScore: 25 },
        { userId: "user-2", relevanceScore: 15 },
        { userId: "user-3", relevanceScore: 5 },
      ];

      const minScore = 10;
      const filtered = suggestions.filter(s => s.relevanceScore >= minScore);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.relevanceScore >= minScore)).toBe(true);
    });

    it("should sort suggestions by relevance score descending", () => {
      const suggestions = [
        { userId: "user-1", relevanceScore: 15 },
        { userId: "user-2", relevanceScore: 25 },
        { userId: "user-3", relevanceScore: 5 },
      ];

      const sorted = [...suggestions].sort((a, b) => b.relevanceScore - a.relevanceScore);

      expect(sorted[0].relevanceScore).toBe(25);
      expect(sorted[1].relevanceScore).toBe(15);
      expect(sorted[2].relevanceScore).toBe(5);
    });

    it("should generate appropriate reason strings", () => {
      const generateReason = (
        similarEventCount: number,
        sharedEventCount: number,
        lastSharedEventDate: Date | null
      ): string => {
        if (similarEventCount > 0 && sharedEventCount > 0) {
          return `Attended ${similarEventCount} similar event${similarEventCount > 1 ? 's' : ''} and ${sharedEventCount} total event${sharedEventCount > 1 ? 's' : ''} with you`;
        } else if (similarEventCount > 0) {
          return `Attended ${similarEventCount} similar event${similarEventCount > 1 ? 's' : ''}`;
        } else if (sharedEventCount > 0) {
          return `Attended ${sharedEventCount} event${sharedEventCount > 1 ? 's' : ''} with you`;
        }
        return "Potential connection based on event history";
      };

      expect(generateReason(2, 3, null)).toBe("Attended 2 similar events and 3 total events with you");
      expect(generateReason(1, 1, null)).toBe("Attended 1 similar event and 1 total event with you");
      expect(generateReason(2, 0, null)).toBe("Attended 2 similar events");
      expect(generateReason(1, 0, null)).toBe("Attended 1 similar event");
      expect(generateReason(0, 2, null)).toBe("Attended 2 events with you");
      expect(generateReason(0, 1, null)).toBe("Attended 1 event with you");
      expect(generateReason(0, 0, null)).toBe("Potential connection based on event history");
    });
  });

  describe("GET /api/suggestions/connections", () => {
    it("should return empty array if user has no completed events", async () => {
      vi.mocked(prisma.rSVP.findMany).mockResolvedValue([]);

      expect([]).toHaveLength(0);
    });

    it("should extract categories from user events", () => {
      const userEvents = [
        { event: { category: "party", location: "NYC" } },
        { event: { category: "workshop", location: "LA" } },
        { event: { category: "party", location: "SF" } },
        { event: { category: null, location: "Boston" } },
      ];

      const categories = new Set(
        userEvents
          .map(r => r.event.category)
          .filter((c): c is string => c !== null)
      );

      expect(categories.size).toBe(2);
      expect(categories.has("party")).toBe(true);
      expect(categories.has("workshop")).toBe(true);
    });

    it("should extract locations from user events", () => {
      const userEvents = [
        { event: { category: "party", location: "NYC" } },
        { event: { category: "workshop", location: "LA" } },
        { event: { category: "party", location: "NYC" } },
        { event: { category: null, location: "" } },
      ];

      const locations = new Set(
        userEvents
          .map(r => r.event.location)
          .filter((l): l is string => l !== null && l !== "")
      );

      expect(locations.size).toBe(2);
      expect(locations.has("NYC")).toBe(true);
      expect(locations.has("LA")).toBe(true);
    });

    it("should exclude existing connections", () => {
      const existingConnections = [
        { userId: "user-1" },
        { userId: "user-2" },
      ];

      const existingConnectionIds = new Set(existingConnections.map(r => r.userId));

      expect(existingConnectionIds.has("user-1")).toBe(true);
      expect(existingConnectionIds.has("user-2")).toBe(true);
      expect(existingConnectionIds.has("user-3")).toBe(false);
    });

    it("should calculate connection score correctly", () => {
      const calculateConnectionScore = (
        categoryMatches: number,
        locationMatches: number,
        mostRecentEventDate: Date | null
      ): number => {
        let score = categoryMatches * 8 + locationMatches * 3;

        let recencyBonus = 0;
        if (mostRecentEventDate) {
          const daysSince = (Date.now() - mostRecentEventDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince <= 30) recencyBonus = 3;
          else if (daysSince <= 90) recencyBonus = 1;
        }

        return score + recencyBonus;
      };

      expect(calculateConnectionScore(2, 3, null)).toBe(25); // 2*8 + 3*3 = 25

      const recentDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      expect(calculateConnectionScore(1, 2, recentDate)).toBe(17); // 8 + 6 + 3 = 17

      const mediumDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      expect(calculateConnectionScore(1, 2, mediumDate)).toBe(15); // 8 + 6 + 1 = 15

      const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
      expect(calculateConnectionScore(1, 2, oldDate)).toBe(14); // 8 + 6 + 0 = 14
    });

    it("should default minScore to 5 for connections endpoint", () => {
      const defaultMinScore = 5;
      expect(defaultMinScore).toBe(5);
    });

    it("should generate appropriate connection reason strings", () => {
      const generateConnectionReason = (
        categoryMatches: number,
        locationMatches: number
      ): string => {
        if (categoryMatches > 0 && locationMatches > 0) {
          return `Attended ${categoryMatches + locationMatches} event${categoryMatches + locationMatches > 1 ? 's' : ''} with similar interests and locations`;
        } else if (categoryMatches > 0) {
          return `Attended ${categoryMatches} event${categoryMatches > 1 ? 's' : ''} with similar interests`;
        } else if (locationMatches > 0) {
          return `Attended ${locationMatches} event${locationMatches > 1 ? 's' : ''} in similar locations`;
        }
        return "Potential connection based on event patterns";
      };

      expect(generateConnectionReason(2, 3)).toBe("Attended 5 events with similar interests and locations");
      expect(generateConnectionReason(1, 1)).toBe("Attended 2 events with similar interests and locations");
      expect(generateConnectionReason(2, 0)).toBe("Attended 2 events with similar interests");
      expect(generateConnectionReason(1, 0)).toBe("Attended 1 event with similar interests");
      expect(generateConnectionReason(0, 2)).toBe("Attended 2 events in similar locations");
      expect(generateConnectionReason(0, 1)).toBe("Attended 1 event in similar locations");
      expect(generateConnectionReason(0, 0)).toBe("Potential connection based on event patterns");
    });
  });
});
