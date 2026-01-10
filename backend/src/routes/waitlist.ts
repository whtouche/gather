import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { createApiError } from "../types/index.js";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";
import { computeEventState } from "../utils/eventState.js";

const router = Router();

// =============================================================================
// Constants
// =============================================================================

const WAITLIST_EXPIRY_HOURS = 24;

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Get the count of confirmed (YES) RSVPs for an event
 */
async function getYesRsvpCount(eventId: string): Promise<number> {
  return prisma.rSVP.count({
    where: {
      eventId,
      response: "YES",
    },
  });
}

/**
 * Get the current waitlist position for a user
 * Returns null if user is not on waitlist
 */
async function getWaitlistPosition(
  eventId: string,
  userId: string
): Promise<number | null> {
  const userEntry = await prisma.waitlist.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { createdAt: true },
  });

  if (!userEntry) return null;

  // Count how many people are ahead (signed up before this user)
  const aheadCount = await prisma.waitlist.count({
    where: {
      eventId,
      createdAt: { lt: userEntry.createdAt },
    },
  });

  return aheadCount + 1; // 1-indexed position
}

/**
 * Notify the next person on the waitlist when a spot opens
 */
async function notifyNextOnWaitlist(eventId: string): Promise<void> {
  // Find the next eligible person on waitlist (not already notified or expired)
  const now = new Date();
  const nextEntry = await prisma.waitlist.findFirst({
    where: {
      eventId,
      OR: [
        { notifiedAt: null }, // Never notified
        { expiresAt: { lt: now } }, // Previous notification expired
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, displayName: true } },
      event: { select: { title: true } },
    },
  });

  if (!nextEntry) return;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + WAITLIST_EXPIRY_HOURS);

  await prisma.$transaction([
    // Update waitlist entry with notification time and expiry
    prisma.waitlist.update({
      where: { id: nextEntry.id },
      data: {
        notifiedAt: now,
        expiresAt,
      },
    }),
    // Create notification for the user
    prisma.notification.create({
      data: {
        userId: nextEntry.userId,
        eventId,
        type: "WAITLIST_SPOT_AVAILABLE",
        message: `A spot has opened up for "${nextEntry.event.title}"! You have 24 hours to confirm your attendance.`,
      },
    }),
  ]);

  console.log(
    `[Waitlist] Notified ${nextEntry.user.displayName} about spot opening for event ${eventId}`
  );
}

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /api/events/:id/waitlist
 * Join the waitlist for an event at capacity
 */
router.post(
  "/:id/waitlist",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;

      // Get event with capacity info
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          capacity: true,
          waitlistEnabled: true,
          state: true,
          dateTime: true,
          endDateTime: true,
          rsvpDeadline: true,
        },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Check event state
      const computedState = computeEventState({
        state: event.state,
        dateTime: event.dateTime,
        endDateTime: event.endDateTime,
        rsvpDeadline: event.rsvpDeadline,
      });

      if (computedState !== "PUBLISHED") {
        throw createApiError(
          "Cannot join waitlist for this event",
          400,
          "EVENT_NOT_ACCEPTING_RSVPS"
        );
      }

      // Check if waitlist is enabled
      if (!event.waitlistEnabled) {
        throw createApiError(
          "Waitlist is not enabled for this event",
          400,
          "WAITLIST_NOT_ENABLED"
        );
      }

      // Check if event has capacity limit
      if (!event.capacity) {
        throw createApiError(
          "Event does not have a capacity limit",
          400,
          "NO_CAPACITY_LIMIT"
        );
      }

      // Check if user already has an RSVP
      const existingRsvp = await prisma.rSVP.findUnique({
        where: { eventId_userId: { eventId, userId } },
        select: { response: true },
      });

      if (existingRsvp?.response === "YES") {
        throw createApiError(
          "You are already confirmed for this event",
          400,
          "ALREADY_RSVPD"
        );
      }

      // Check if user is already on waitlist
      const existingWaitlist = await prisma.waitlist.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });

      if (existingWaitlist) {
        throw createApiError(
          "You are already on the waitlist",
          400,
          "ALREADY_ON_WAITLIST"
        );
      }

      // Check if event is actually at capacity
      const yesCount = await getYesRsvpCount(eventId);
      if (yesCount < event.capacity) {
        throw createApiError(
          "Event is not at capacity. You can RSVP directly.",
          400,
          "EVENT_NOT_AT_CAPACITY"
        );
      }

      // Add to waitlist
      const waitlistEntry = await prisma.waitlist.create({
        data: {
          eventId,
          userId,
        },
      });

      // Get position
      const position = await getWaitlistPosition(eventId, userId);

      res.status(201).json({
        message: "You have been added to the waitlist",
        waitlist: {
          id: waitlistEntry.id,
          position,
          createdAt: waitlistEntry.createdAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/waitlist
 * Get user's waitlist status for an event
 */
router.get(
  "/:id/waitlist",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;

      // Check if event exists
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          capacity: true,
          waitlistEnabled: true,
        },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Get user's waitlist entry
      const waitlistEntry = await prisma.waitlist.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });

      if (!waitlistEntry) {
        res.json({
          onWaitlist: false,
          waitlist: null,
          waitlistEnabled: event.waitlistEnabled,
          capacity: event.capacity,
        });
        return;
      }

      const position = await getWaitlistPosition(eventId, userId);

      // Get total waitlist count
      const totalWaitlist = await prisma.waitlist.count({
        where: { eventId },
      });

      res.json({
        onWaitlist: true,
        waitlist: {
          id: waitlistEntry.id,
          position,
          totalWaitlist,
          createdAt: waitlistEntry.createdAt.toISOString(),
          notifiedAt: waitlistEntry.notifiedAt?.toISOString() || null,
          expiresAt: waitlistEntry.expiresAt?.toISOString() || null,
        },
        waitlistEnabled: event.waitlistEnabled,
        capacity: event.capacity,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/events/:id/waitlist
 * Leave the waitlist for an event
 */
router.delete(
  "/:id/waitlist",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;

      // Check if user is on waitlist
      const waitlistEntry = await prisma.waitlist.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });

      if (!waitlistEntry) {
        throw createApiError("You are not on the waitlist", 404, "NOT_ON_WAITLIST");
      }

      // Remove from waitlist
      await prisma.waitlist.delete({
        where: { id: waitlistEntry.id },
      });

      res.json({
        message: "You have been removed from the waitlist",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/waitlist/confirm
 * Confirm attendance when notified of available spot
 * This will create a YES RSVP and remove from waitlist
 */
router.post(
  "/:id/waitlist/confirm",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;

      // Get event with capacity info
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          capacity: true,
          state: true,
          dateTime: true,
          endDateTime: true,
          rsvpDeadline: true,
        },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Check event state
      const computedState = computeEventState({
        state: event.state,
        dateTime: event.dateTime,
        endDateTime: event.endDateTime,
        rsvpDeadline: event.rsvpDeadline,
      });

      if (computedState !== "PUBLISHED") {
        throw createApiError(
          "Event is no longer accepting RSVPs",
          400,
          "EVENT_NOT_ACCEPTING_RSVPS"
        );
      }

      // Get user's waitlist entry
      const waitlistEntry = await prisma.waitlist.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });

      if (!waitlistEntry) {
        throw createApiError("You are not on the waitlist", 404, "NOT_ON_WAITLIST");
      }

      // Check if user was notified and notification hasn't expired
      const now = new Date();
      if (!waitlistEntry.notifiedAt) {
        throw createApiError(
          "You have not been notified of an available spot yet",
          400,
          "NOT_NOTIFIED"
        );
      }

      if (waitlistEntry.expiresAt && waitlistEntry.expiresAt < now) {
        // Notification expired, remove them and notify next person
        await prisma.waitlist.delete({
          where: { id: waitlistEntry.id },
        });

        // Notify next person
        await notifyNextOnWaitlist(eventId);

        throw createApiError(
          "Your spot confirmation has expired. You have been moved to the back of the waitlist.",
          400,
          "CONFIRMATION_EXPIRED"
        );
      }

      // Double-check there's actually a spot available
      if (event.capacity) {
        const yesCount = await getYesRsvpCount(eventId);
        if (yesCount >= event.capacity) {
          throw createApiError(
            "Sorry, the spot has already been filled",
            400,
            "SPOT_FILLED"
          );
        }
      }

      // Create RSVP and remove from waitlist in a transaction
      await prisma.$transaction([
        prisma.rSVP.upsert({
          where: { eventId_userId: { eventId, userId } },
          create: {
            eventId,
            userId,
            response: "YES",
          },
          update: {
            response: "YES",
          },
        }),
        prisma.waitlist.delete({
          where: { id: waitlistEntry.id },
        }),
      ]);

      res.json({
        message: "Your attendance has been confirmed!",
        rsvp: {
          eventId,
          userId,
          response: "YES",
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Export the notify function for use in RSVP routes
export { notifyNextOnWaitlist };

export default router;
