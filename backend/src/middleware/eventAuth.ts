import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { createApiError } from "../types/index.js";
import { prisma } from "../utils/db.js";

/**
 * Extended request interface that includes event information
 */
export interface EventAuthenticatedRequest extends AuthenticatedRequest {
  eventId?: string;
  isOrganizer?: boolean;
}

/**
 * Middleware to check if the authenticated user is an organizer of the event.
 * Requires the event ID to be present in req.params.id
 * Must be used after requireAuth middleware.
 */
export async function requireEventOrganizer(
  req: EventAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const eventId = req.params.id;
    const userId = req.user?.id;

    if (!eventId) {
      throw createApiError("Event ID is required", 400, "MISSING_EVENT_ID");
    }

    if (!userId) {
      throw createApiError("Authentication required", 401, "UNAUTHORIZED");
    }

    // Check if the event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
    }

    // Check if user is the creator
    if (event.creatorId === userId) {
      req.eventId = eventId;
      req.isOrganizer = true;
      return next();
    }

    // Check if user has an organizer role for this event
    const eventRole = await prisma.eventRole.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!eventRole || eventRole.role !== "ORGANIZER") {
      throw createApiError(
        "Only event organizers can perform this action",
        403,
        "FORBIDDEN"
      );
    }

    req.eventId = eventId;
    req.isOrganizer = true;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Helper function to check if a user is an organizer of an event.
 * Can be used in route handlers for more granular control.
 */
export async function isEventOrganizer(
  eventId: string,
  userId: string
): Promise<boolean> {
  // Check if user is the creator
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { creatorId: true },
  });

  if (!event) {
    return false;
  }

  if (event.creatorId === userId) {
    return true;
  }

  // Check for organizer role
  const eventRole = await prisma.eventRole.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
  });

  return eventRole?.role === "ORGANIZER";
}

/**
 * Extended request interface that includes attendee and sharing information
 */
export interface InviteSharingRequest extends AuthenticatedRequest {
  eventId?: string;
  isOrganizer?: boolean;
  isAttendee?: boolean;
  canShareInvite?: boolean;
}

/**
 * Middleware to check if the user can share an invite link.
 * Allows:
 * - Organizers (always)
 * - Confirmed attendees (RSVP YES) if allowInviteSharing is true
 * Must be used after requireAuth middleware.
 */
export async function requireCanShareInvite(
  req: InviteSharingRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const eventId = req.params.id;
    const userId = req.user?.id;

    if (!eventId) {
      throw createApiError("Event ID is required", 400, "MISSING_EVENT_ID");
    }

    if (!userId) {
      throw createApiError("Authentication required", 401, "UNAUTHORIZED");
    }

    // Get event with sharing settings
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        creatorId: true,
        allowInviteSharing: true,
        state: true,
      },
    });

    if (!event) {
      throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
    }

    // Check if user is the creator
    if (event.creatorId === userId) {
      req.eventId = eventId;
      req.isOrganizer = true;
      req.isAttendee = false;
      req.canShareInvite = true;
      return next();
    }

    // Check for organizer role
    const eventRole = await prisma.eventRole.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (eventRole?.role === "ORGANIZER") {
      req.eventId = eventId;
      req.isOrganizer = true;
      req.isAttendee = false;
      req.canShareInvite = true;
      return next();
    }

    // Not an organizer - check if they are an attendee and sharing is allowed
    if (!event.allowInviteSharing) {
      throw createApiError(
        "Invite sharing is not allowed for this event",
        403,
        "INVITE_SHARING_DISABLED"
      );
    }

    // Check if user has RSVP'd YES
    const rsvp = await prisma.rSVP.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
      select: { response: true },
    });

    if (!rsvp || rsvp.response !== "YES") {
      throw createApiError(
        "Only confirmed attendees can share invite links",
        403,
        "NOT_CONFIRMED_ATTENDEE"
      );
    }

    req.eventId = eventId;
    req.isOrganizer = false;
    req.isAttendee = true;
    req.canShareInvite = true;
    next();
  } catch (error) {
    next(error);
  }
}
