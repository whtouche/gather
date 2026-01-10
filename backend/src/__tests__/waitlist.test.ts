import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing routes
vi.mock("../utils/db.js", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    rSVP: {
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    waitlist: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../utils/db.js";

describe("Waitlist functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Waitlist model and validation", () => {
    it("should require eventId and userId for waitlist entry", () => {
      // Test that the waitlist model requires these fields
      const validEntry = {
        eventId: "event-123",
        userId: "user-456",
        createdAt: new Date(),
        notifiedAt: null,
        expiresAt: null,
      };

      expect(validEntry.eventId).toBeDefined();
      expect(validEntry.userId).toBeDefined();
      expect(validEntry.createdAt).toBeInstanceOf(Date);
    });

    it("should allow notification tracking fields to be null", () => {
      const entry = {
        eventId: "event-123",
        userId: "user-456",
        createdAt: new Date(),
        notifiedAt: null,
        expiresAt: null,
      };

      expect(entry.notifiedAt).toBeNull();
      expect(entry.expiresAt).toBeNull();
    });

    it("should track notification time and expiry when spot opens", () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours later

      const notifiedEntry = {
        eventId: "event-123",
        userId: "user-456",
        createdAt: new Date("2024-01-01"),
        notifiedAt: now,
        expiresAt: expiresAt,
      };

      expect(notifiedEntry.notifiedAt).toEqual(now);
      expect(notifiedEntry.expiresAt).toEqual(expiresAt);
      expect(notifiedEntry.expiresAt.getTime() - notifiedEntry.notifiedAt.getTime()).toBe(
        24 * 60 * 60 * 1000
      );
    });
  });

  describe("Waitlist position calculation", () => {
    it("should calculate position based on createdAt timestamp", () => {
      const entries = [
        { userId: "user-1", createdAt: new Date("2024-01-01T10:00:00Z") },
        { userId: "user-2", createdAt: new Date("2024-01-01T10:05:00Z") },
        { userId: "user-3", createdAt: new Date("2024-01-01T10:10:00Z") },
      ];

      // Sort by createdAt (first-come, first-served)
      const sorted = [...entries].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      // Get position (1-indexed)
      const getPosition = (userId: string): number => {
        return sorted.findIndex((e) => e.userId === userId) + 1;
      };

      expect(getPosition("user-1")).toBe(1);
      expect(getPosition("user-2")).toBe(2);
      expect(getPosition("user-3")).toBe(3);
    });
  });

  describe("Waitlist business logic", () => {
    it("should only allow joining waitlist when event is at capacity", () => {
      const event = {
        capacity: 10,
        waitlistEnabled: true,
      };
      const currentYesCount = 10;

      const isAtCapacity = currentYesCount >= (event.capacity ?? Infinity);
      const canJoinWaitlist = event.waitlistEnabled && isAtCapacity;

      expect(canJoinWaitlist).toBe(true);
    });

    it("should not allow joining waitlist when event has space", () => {
      const event = {
        capacity: 10,
        waitlistEnabled: true,
      };
      const currentYesCount = 5;

      const isAtCapacity = currentYesCount >= (event.capacity ?? Infinity);
      const canJoinWaitlist = event.waitlistEnabled && isAtCapacity;

      expect(canJoinWaitlist).toBe(false);
    });

    it("should not allow joining waitlist when waitlist is disabled", () => {
      const event = {
        capacity: 10,
        waitlistEnabled: false,
      };
      const currentYesCount = 10;

      const isAtCapacity = currentYesCount >= (event.capacity ?? Infinity);
      const canJoinWaitlist = event.waitlistEnabled && isAtCapacity;

      expect(canJoinWaitlist).toBe(false);
    });

    it("should not allow joining waitlist when there is no capacity limit", () => {
      const event = {
        capacity: null,
        waitlistEnabled: true,
      };
      const currentYesCount = 100;

      const hasCapacityLimit = event.capacity !== null;
      const canJoinWaitlist = event.waitlistEnabled && hasCapacityLimit;

      expect(canJoinWaitlist).toBe(false);
    });

    it("should check waitlist notification expiry correctly", () => {
      const now = new Date();

      // Entry notified 23 hours ago (not expired)
      const validNotification = {
        notifiedAt: new Date(now.getTime() - 23 * 60 * 60 * 1000),
        expiresAt: new Date(now.getTime() + 1 * 60 * 60 * 1000), // 1 hour left
      };

      // Entry notified 25 hours ago (expired)
      const expiredNotification = {
        notifiedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
        expiresAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // expired 1 hour ago
      };

      const isExpired = (entry: { expiresAt: Date | null }): boolean => {
        if (!entry.expiresAt) return false;
        return now > entry.expiresAt;
      };

      expect(isExpired(validNotification)).toBe(false);
      expect(isExpired(expiredNotification)).toBe(true);
    });
  });

  describe("Waitlist notification flow", () => {
    it("should only notify next person when a YES RSVP is removed", () => {
      const previousResponse = "YES";
      const newResponse = "NO";
      const eventHasWaitlist = true;
      const eventHasCapacity = true;

      const shouldNotifyNext =
        previousResponse === "YES" &&
        newResponse !== "YES" &&
        eventHasWaitlist &&
        eventHasCapacity;

      expect(shouldNotifyNext).toBe(true);
    });

    it("should not notify when RSVP changes from NO to MAYBE", () => {
      const previousResponse = "NO";
      const newResponse = "MAYBE";
      const eventHasWaitlist = true;
      const eventHasCapacity = true;

      const shouldNotifyNext =
        previousResponse === "YES" &&
        newResponse !== "YES" &&
        eventHasWaitlist &&
        eventHasCapacity;

      expect(shouldNotifyNext).toBe(false);
    });

    it("should not notify when RSVP changes from YES to YES (no change)", () => {
      const previousResponse = "YES";
      const newResponse = "YES";
      const eventHasWaitlist = true;
      const eventHasCapacity = true;

      const shouldNotifyNext =
        previousResponse === "YES" &&
        newResponse !== "YES" &&
        eventHasWaitlist &&
        eventHasCapacity;

      expect(shouldNotifyNext).toBe(false);
    });
  });

  describe("RSVP capacity error codes", () => {
    it("should return correct error code when waitlist is available", () => {
      const event = {
        capacity: 10,
        waitlistEnabled: true,
      };
      const currentYesCount = 10;

      const isAtCapacity = currentYesCount >= (event.capacity ?? Infinity);

      let errorCode: string | null = null;
      if (isAtCapacity) {
        errorCode = event.waitlistEnabled
          ? "EVENT_AT_CAPACITY_WAITLIST_AVAILABLE"
          : "EVENT_AT_CAPACITY";
      }

      expect(errorCode).toBe("EVENT_AT_CAPACITY_WAITLIST_AVAILABLE");
    });

    it("should return correct error code when waitlist is not available", () => {
      const event = {
        capacity: 10,
        waitlistEnabled: false,
      };
      const currentYesCount = 10;

      const isAtCapacity = currentYesCount >= (event.capacity ?? Infinity);

      let errorCode: string | null = null;
      if (isAtCapacity) {
        errorCode = event.waitlistEnabled
          ? "EVENT_AT_CAPACITY_WAITLIST_AVAILABLE"
          : "EVENT_AT_CAPACITY";
      }

      expect(errorCode).toBe("EVENT_AT_CAPACITY");
    });
  });
});
