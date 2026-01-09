import { describe, it, expect } from "vitest";
import {
  computeEventState,
  canAcceptRsvps,
  canBeCancelled,
  getStateLabel,
  getStateToStore,
} from "../utils/eventState.js";
import type { EventState } from "@prisma/client";

describe("eventState utilities", () => {
  describe("computeEventState", () => {
    it("should return DRAFT for draft events", () => {
      const event = {
        state: "DRAFT" as EventState,
        dateTime: new Date(Date.now() + 86400000), // Tomorrow
        endDateTime: null,
        rsvpDeadline: null,
      };
      expect(computeEventState(event)).toBe("DRAFT");
    });

    it("should return CANCELLED for cancelled events", () => {
      const event = {
        state: "CANCELLED" as EventState,
        dateTime: new Date(Date.now() + 86400000),
        endDateTime: null,
        rsvpDeadline: null,
      };
      expect(computeEventState(event)).toBe("CANCELLED");
    });

    it("should return COMPLETED if event has ended", () => {
      const event = {
        state: "PUBLISHED" as EventState,
        dateTime: new Date(Date.now() - 86400000), // Yesterday
        endDateTime: new Date(Date.now() - 3600000), // 1 hour ago
        rsvpDeadline: null,
      };
      expect(computeEventState(event)).toBe("COMPLETED");
    });

    it("should return ONGOING if event has started but not ended", () => {
      const event = {
        state: "PUBLISHED" as EventState,
        dateTime: new Date(Date.now() - 3600000), // 1 hour ago
        endDateTime: new Date(Date.now() + 3600000), // 1 hour from now
        rsvpDeadline: null,
      };
      expect(computeEventState(event)).toBe("ONGOING");
    });

    it("should return CLOSED if RSVP deadline has passed", () => {
      const event = {
        state: "PUBLISHED" as EventState,
        dateTime: new Date(Date.now() + 86400000), // Tomorrow
        endDateTime: null,
        rsvpDeadline: new Date(Date.now() - 3600000), // 1 hour ago
      };
      expect(computeEventState(event)).toBe("CLOSED");
    });

    it("should return PUBLISHED if event is upcoming and accepting RSVPs", () => {
      const event = {
        state: "PUBLISHED" as EventState,
        dateTime: new Date(Date.now() + 86400000), // Tomorrow
        endDateTime: null,
        rsvpDeadline: new Date(Date.now() + 43200000), // 12 hours from now
      };
      expect(computeEventState(event)).toBe("PUBLISHED");
    });

    it("should use default 3-hour duration if no end time specified", () => {
      // Event started 2 hours ago, no end time (defaults to 3 hours)
      const event = {
        state: "PUBLISHED" as EventState,
        dateTime: new Date(Date.now() - 2 * 3600000), // 2 hours ago
        endDateTime: null,
        rsvpDeadline: null,
      };
      expect(computeEventState(event)).toBe("ONGOING");

      // Event started 4 hours ago, no end time (defaults to 3 hours, so completed)
      const event2 = {
        state: "PUBLISHED" as EventState,
        dateTime: new Date(Date.now() - 4 * 3600000), // 4 hours ago
        endDateTime: null,
        rsvpDeadline: null,
      };
      expect(computeEventState(event2)).toBe("COMPLETED");
    });
  });

  describe("canAcceptRsvps", () => {
    it("should return true for published events", () => {
      const event = {
        state: "PUBLISHED" as EventState,
        dateTime: new Date(Date.now() + 86400000),
        endDateTime: null,
        rsvpDeadline: null,
      };
      expect(canAcceptRsvps(event)).toBe(true);
    });

    it("should return false for draft events", () => {
      const event = {
        state: "DRAFT" as EventState,
        dateTime: new Date(Date.now() + 86400000),
        endDateTime: null,
        rsvpDeadline: null,
      };
      expect(canAcceptRsvps(event)).toBe(false);
    });

    it("should return false for cancelled events", () => {
      const event = {
        state: "CANCELLED" as EventState,
        dateTime: new Date(Date.now() + 86400000),
        endDateTime: null,
        rsvpDeadline: null,
      };
      expect(canAcceptRsvps(event)).toBe(false);
    });

    it("should return false for completed events", () => {
      const event = {
        state: "PUBLISHED" as EventState,
        dateTime: new Date(Date.now() - 86400000),
        endDateTime: new Date(Date.now() - 3600000),
        rsvpDeadline: null,
      };
      expect(canAcceptRsvps(event)).toBe(false);
    });
  });

  describe("canBeCancelled", () => {
    it("should return true for draft events", () => {
      const event = {
        state: "DRAFT" as EventState,
        dateTime: new Date(Date.now() + 86400000),
        endDateTime: null,
        rsvpDeadline: null,
      };
      expect(canBeCancelled(event)).toBe(true);
    });

    it("should return true for published events", () => {
      const event = {
        state: "PUBLISHED" as EventState,
        dateTime: new Date(Date.now() + 86400000),
        endDateTime: null,
        rsvpDeadline: null,
      };
      expect(canBeCancelled(event)).toBe(true);
    });

    it("should return false for cancelled events", () => {
      const event = {
        state: "CANCELLED" as EventState,
        dateTime: new Date(Date.now() + 86400000),
        endDateTime: null,
        rsvpDeadline: null,
      };
      expect(canBeCancelled(event)).toBe(false);
    });

    it("should return false for completed events", () => {
      const event = {
        state: "PUBLISHED" as EventState,
        dateTime: new Date(Date.now() - 86400000),
        endDateTime: new Date(Date.now() - 3600000),
        rsvpDeadline: null,
      };
      expect(canBeCancelled(event)).toBe(false);
    });
  });

  describe("getStateLabel", () => {
    it("should return correct labels for all states", () => {
      expect(getStateLabel("DRAFT")).toBe("Draft");
      expect(getStateLabel("PUBLISHED")).toBe("Published");
      expect(getStateLabel("CLOSED")).toBe("RSVPs Closed");
      expect(getStateLabel("ONGOING")).toBe("In Progress");
      expect(getStateLabel("COMPLETED")).toBe("Completed");
      expect(getStateLabel("CANCELLED")).toBe("Cancelled");
    });
  });

  describe("getStateToStore", () => {
    it("should return COMPLETED for events that have ended", () => {
      const event = {
        state: "PUBLISHED" as EventState,
        dateTime: new Date(Date.now() - 86400000),
        endDateTime: new Date(Date.now() - 3600000),
        rsvpDeadline: null,
      };
      expect(getStateToStore(event)).toBe("COMPLETED");
    });

    it("should return null for events already marked completed", () => {
      const event = {
        state: "COMPLETED" as EventState,
        dateTime: new Date(Date.now() - 86400000),
        endDateTime: new Date(Date.now() - 3600000),
        rsvpDeadline: null,
      };
      expect(getStateToStore(event)).toBeNull();
    });

    it("should return null for ongoing events", () => {
      const event = {
        state: "PUBLISHED" as EventState,
        dateTime: new Date(Date.now() - 3600000),
        endDateTime: new Date(Date.now() + 3600000),
        rsvpDeadline: null,
      };
      expect(getStateToStore(event)).toBeNull();
    });
  });
});
