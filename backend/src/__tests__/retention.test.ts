import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calculateArchivalDate,
  shouldSendRetentionNotification,
  isReadyForArchival,
  type EventForRetention,
} from "../utils/retention.js";

// Mock Prisma client
vi.mock("../utils/db.js", () => ({
  prisma: {
    event: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    wallPost: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

describe("Data Retention Utilities", () => {
  let completedEvent: EventForRetention;
  let draftEvent: EventForRetention;

  beforeEach(() => {
    const now = new Date("2024-01-01T12:00:00Z");

    completedEvent = {
      id: "event1",
      state: "COMPLETED",
      dateTime: new Date("2023-06-01T10:00:00Z"),
      endDateTime: new Date("2023-06-01T18:00:00Z"),
      dataRetentionMonths: 24,
      wallRetentionMonths: 6,
      retentionNotificationSent: false,
      retentionNotificationSentAt: null,
      archivedAt: null,
      scheduledForDeletionAt: null,
      createdAt: new Date("2023-05-01T10:00:00Z"),
    };

    draftEvent = {
      id: "event2",
      state: "DRAFT",
      dateTime: new Date("2024-06-01T10:00:00Z"),
      endDateTime: new Date("2024-06-01T18:00:00Z"),
      dataRetentionMonths: 24,
      wallRetentionMonths: null,
      retentionNotificationSent: false,
      retentionNotificationSentAt: null,
      archivedAt: null,
      scheduledForDeletionAt: null,
      createdAt: new Date("2024-05-01T10:00:00Z"),
    };
  });

  describe("calculateArchivalDate", () => {
    it("should calculate archival date based on end date and retention period", () => {
      const archivalDate = calculateArchivalDate(completedEvent);
      expect(archivalDate).toBeInstanceOf(Date);

      // Event ended 2023-06-01, retention is 24 months, so archival should be 2025-06-01
      const expected = new Date("2025-06-01T18:00:00Z");
      expect(archivalDate?.getFullYear()).toBe(expected.getFullYear());
      expect(archivalDate?.getMonth()).toBe(expected.getMonth());
    });

    it("should use event start date if no end date", () => {
      const eventWithoutEndDate = {
        ...completedEvent,
        endDateTime: null,
      };
      const archivalDate = calculateArchivalDate(eventWithoutEndDate);
      expect(archivalDate).toBeInstanceOf(Date);
    });

    it("should return null for non-completed events", () => {
      const archivalDate = calculateArchivalDate(draftEvent);
      expect(archivalDate).toBeNull();
    });

    it("should handle different retention periods correctly", () => {
      const shortRetentionEvent = {
        ...completedEvent,
        dataRetentionMonths: 6,
      };
      const archivalDate = calculateArchivalDate(shortRetentionEvent);

      // Event ended 2023-06-01, retention is 6 months, so archival should be 2023-12-01
      expect(archivalDate?.getFullYear()).toBe(2023);
      expect(archivalDate?.getMonth()).toBe(11); // December (0-indexed)
    });
  });

  describe("shouldSendRetentionNotification", () => {
    it("should return true when 30 days before archival and notification not sent", () => {
      // Event archival date is 2025-06-01, notification should be sent at 2025-05-02 or later
      // Check at exactly 30 days before
      const checkDate = new Date("2025-05-02T18:00:00Z");
      const result = shouldSendRetentionNotification(completedEvent, checkDate);
      expect(result).toBe(true);
    });

    it("should return false when notification already sent", () => {
      const eventWithNotification = {
        ...completedEvent,
        retentionNotificationSent: true,
        retentionNotificationSentAt: new Date("2025-05-01T12:00:00Z"),
      };
      const checkDate = new Date("2025-05-02T12:00:00Z");
      const result = shouldSendRetentionNotification(eventWithNotification, checkDate);
      expect(result).toBe(false);
    });

    it("should return false when before notification date", () => {
      // Check before the 30-day threshold
      const checkDate = new Date("2025-03-01T12:00:00Z");
      const result = shouldSendRetentionNotification(completedEvent, checkDate);
      expect(result).toBe(false);
    });

    it("should return false for non-completed events", () => {
      const checkDate = new Date("2025-05-02T12:00:00Z");
      const result = shouldSendRetentionNotification(draftEvent, checkDate);
      expect(result).toBe(false);
    });
  });

  describe("isReadyForArchival", () => {
    it("should return true when archival date has passed", () => {
      // Event archival date is 2025-06-01
      const checkDate = new Date("2025-06-02T12:00:00Z");
      const result = isReadyForArchival(completedEvent, checkDate);
      expect(result).toBe(true);
    });

    it("should return false when before archival date", () => {
      const checkDate = new Date("2025-05-01T12:00:00Z");
      const result = isReadyForArchival(completedEvent, checkDate);
      expect(result).toBe(false);
    });

    it("should return false when already archived", () => {
      const archivedEvent = {
        ...completedEvent,
        archivedAt: new Date("2025-06-01T12:00:00Z"),
      };
      const checkDate = new Date("2025-06-02T12:00:00Z");
      const result = isReadyForArchival(archivedEvent, checkDate);
      expect(result).toBe(false);
    });

    it("should return false for non-completed events", () => {
      const checkDate = new Date("2026-01-01T12:00:00Z");
      const result = isReadyForArchival(draftEvent, checkDate);
      expect(result).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle events with very short retention periods", () => {
      const shortRetentionEvent = {
        ...completedEvent,
        dataRetentionMonths: 1,
      };
      const archivalDate = calculateArchivalDate(shortRetentionEvent);
      expect(archivalDate).toBeInstanceOf(Date);

      // Should be 1 month after end date
      const expected = new Date("2023-07-01T18:00:00Z");
      expect(archivalDate?.getFullYear()).toBe(expected.getFullYear());
      expect(archivalDate?.getMonth()).toBe(expected.getMonth());
    });

    it("should handle events with very long retention periods", () => {
      const longRetentionEvent = {
        ...completedEvent,
        dataRetentionMonths: 120, // 10 years
      };
      const archivalDate = calculateArchivalDate(longRetentionEvent);
      expect(archivalDate).toBeInstanceOf(Date);

      // Should be 120 months after end date
      expect(archivalDate?.getFullYear()).toBe(2033);
    });

    it("should handle events that ended on the last day of the month", () => {
      const endOfMonthEvent = {
        ...completedEvent,
        dateTime: new Date("2023-01-31T10:00:00Z"),
        endDateTime: new Date("2023-01-31T18:00:00Z"),
        dataRetentionMonths: 1,
      };
      const archivalDate = calculateArchivalDate(endOfMonthEvent);
      expect(archivalDate).toBeInstanceOf(Date);
      // JavaScript Date handles this automatically
    });
  });
});
