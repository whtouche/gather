import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response, NextFunction } from "express";
import type { InviteSharingRequest } from "../middleware/eventAuth.js";

// Mock the database module
vi.mock("../utils/db.js", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    eventRole: {
      findUnique: vi.fn(),
    },
    rSVP: {
      findUnique: vi.fn(),
    },
  },
}));

import { requireCanShareInvite, isEventOrganizer } from "../middleware/eventAuth.js";
import { prisma } from "../utils/db.js";

describe("eventAuth middleware", () => {
  let mockReq: Partial<InviteSharingRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      params: { id: "event-123" },
      user: { id: "user-123" } as InviteSharingRequest["user"],
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  describe("requireCanShareInvite", () => {
    it("should return 400 if event ID is missing", async () => {
      mockReq.params = {};

      await requireCanShareInvite(
        mockReq as InviteSharingRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Event ID is required",
          statusCode: 400,
          code: "MISSING_EVENT_ID",
        })
      );
    });

    it("should return 401 if user is not authenticated", async () => {
      mockReq.user = undefined;

      await requireCanShareInvite(
        mockReq as InviteSharingRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Authentication required",
          statusCode: 401,
          code: "UNAUTHORIZED",
        })
      );
    });

    it("should return 404 if event is not found", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

      await requireCanShareInvite(
        mockReq as InviteSharingRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Event not found",
          statusCode: 404,
          code: "EVENT_NOT_FOUND",
        })
      );
    });

    it("should allow event creator to share invite", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: "event-123",
        creatorId: "user-123",
        allowInviteSharing: false,
        state: "PUBLISHED",
      } as never);

      await requireCanShareInvite(
        mockReq as InviteSharingRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.isOrganizer).toBe(true);
      expect(mockReq.canShareInvite).toBe(true);
      expect(mockReq.eventId).toBe("event-123");
    });

    it("should allow organizer role to share invite", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: "event-123",
        creatorId: "other-user",
        allowInviteSharing: false,
        state: "PUBLISHED",
      } as never);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue({
        role: "ORGANIZER",
      } as never);

      await requireCanShareInvite(
        mockReq as InviteSharingRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.isOrganizer).toBe(true);
      expect(mockReq.canShareInvite).toBe(true);
    });

    it("should return 403 if non-organizer and invite sharing is disabled", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: "event-123",
        creatorId: "other-user",
        allowInviteSharing: false,
        state: "PUBLISHED",
      } as never);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);

      await requireCanShareInvite(
        mockReq as InviteSharingRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invite sharing is not allowed for this event",
          statusCode: 403,
          code: "INVITE_SHARING_DISABLED",
        })
      );
    });

    it("should return 403 if user has not RSVP'd YES", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: "event-123",
        creatorId: "other-user",
        allowInviteSharing: true,
        state: "PUBLISHED",
      } as never);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.rSVP.findUnique).mockResolvedValue({
        response: "MAYBE",
      } as never);

      await requireCanShareInvite(
        mockReq as InviteSharingRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Only confirmed attendees can share invite links",
          statusCode: 403,
          code: "NOT_CONFIRMED_ATTENDEE",
        })
      );
    });

    it("should return 403 if user has no RSVP", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: "event-123",
        creatorId: "other-user",
        allowInviteSharing: true,
        state: "PUBLISHED",
      } as never);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.rSVP.findUnique).mockResolvedValue(null);

      await requireCanShareInvite(
        mockReq as InviteSharingRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Only confirmed attendees can share invite links",
          statusCode: 403,
          code: "NOT_CONFIRMED_ATTENDEE",
        })
      );
    });

    it("should allow confirmed attendee to share when invite sharing is enabled", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: "event-123",
        creatorId: "other-user",
        allowInviteSharing: true,
        state: "PUBLISHED",
      } as never);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.rSVP.findUnique).mockResolvedValue({
        response: "YES",
      } as never);

      await requireCanShareInvite(
        mockReq as InviteSharingRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.isOrganizer).toBe(false);
      expect(mockReq.isAttendee).toBe(true);
      expect(mockReq.canShareInvite).toBe(true);
    });
  });

  describe("isEventOrganizer", () => {
    it("should return false if event does not exist", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

      const result = await isEventOrganizer("event-123", "user-123");

      expect(result).toBe(false);
    });

    it("should return true if user is the event creator", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        creatorId: "user-123",
      } as never);

      const result = await isEventOrganizer("event-123", "user-123");

      expect(result).toBe(true);
    });

    it("should return true if user has organizer role", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        creatorId: "other-user",
      } as never);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue({
        role: "ORGANIZER",
      } as never);

      const result = await isEventOrganizer("event-123", "user-123");

      expect(result).toBe(true);
    });

    it("should return false if user has no organizer role", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        creatorId: "other-user",
      } as never);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue(null);

      const result = await isEventOrganizer("event-123", "user-123");

      expect(result).toBe(false);
    });

    it("should return false if user has a different role", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        creatorId: "other-user",
      } as never);

      vi.mocked(prisma.eventRole.findUnique).mockResolvedValue({
        role: "ATTENDEE",
      } as never);

      const result = await isEventOrganizer("event-123", "user-123");

      expect(result).toBe(false);
    });
  });
});
