import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import type { EventState, RSVPResponse } from "@prisma/client";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// =============================================================================
// Types
// =============================================================================

interface DashboardEvent {
  id: string;
  title: string;
  dateTime: string;
  endDateTime: string | null;
  timezone: string;
  location: string;
  state: string;
  imageUrl: string | null;
  category: string | null;
}

interface OrganizingEvent extends DashboardEvent {
  rsvpCounts: {
    yes: number;
    no: number;
    maybe: number;
  };
}

interface AttendingEvent extends DashboardEvent {
  rsvpStatus: string;
  isOrganizer: boolean;
}

interface PendingEvent extends DashboardEvent {
  rsvpStatus: string | null;
  isOrganizer: boolean;
}

interface DashboardResponse {
  organizing: OrganizingEvent[];
  attending: AttendingEvent[];
  pending: PendingEvent[];
}

interface PastDashboardResponse {
  pastOrganizing: OrganizingEvent[];
  pastAttending: AttendingEvent[];
}

// =============================================================================
// Constants
// =============================================================================

// States that indicate upcoming/active events
const UPCOMING_STATES: EventState[] = ["DRAFT", "PUBLISHED", "CLOSED", "ONGOING"];

// States that indicate past/completed events
const PAST_STATES: EventState[] = ["COMPLETED", "CANCELLED"];

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/dashboard
 * Get all dashboard data for the authenticated user
 * Returns events organized into three categories:
 * - organizing: Events where user is an organizer
 * - attending: Events where user RSVP'd YES
 * - pending: Events user was invited to but hasn't responded or said MAYBE
 */
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const now = new Date();

      // Get events where user is an organizer
      const organizingEvents = await prisma.event.findMany({
        where: {
          eventRoles: {
            some: {
              userId,
              role: "ORGANIZER",
            },
          },
          dateTime: { gte: now },
          state: { in: UPCOMING_STATES },
        },
        orderBy: { dateTime: "asc" },
        include: {
          rsvps: {
            select: {
              response: true,
            },
          },
        },
      });

      // Get events where user RSVP'd YES (excluding ones they're organizing)
      const attendingRsvps = await prisma.rSVP.findMany({
        where: {
          userId,
          response: "YES" as RSVPResponse,
          event: {
            dateTime: { gte: now },
            state: { in: UPCOMING_STATES },
          },
        },
        include: {
          event: {
            include: {
              eventRoles: {
                where: { userId },
                select: { role: true },
              },
            },
          },
        },
        orderBy: {
          event: {
            dateTime: "asc",
          },
        },
      });

      // Get events where user RSVP'd MAYBE
      const maybeRsvps = await prisma.rSVP.findMany({
        where: {
          userId,
          response: "MAYBE" as RSVPResponse,
          event: {
            dateTime: { gte: now },
            state: { in: UPCOMING_STATES },
          },
        },
        include: {
          event: {
            include: {
              eventRoles: {
                where: { userId },
                select: { role: true },
              },
            },
          },
        },
        orderBy: {
          event: {
            dateTime: "asc",
          },
        },
      });

      // Transform organizing events
      const organizing: OrganizingEvent[] = organizingEvents.map((event) => {
        const yesCounts = event.rsvps.filter((r) => r.response === "YES").length;
        const noCounts = event.rsvps.filter((r) => r.response === "NO").length;
        const maybeCounts = event.rsvps.filter((r) => r.response === "MAYBE").length;

        return {
          id: event.id,
          title: event.title,
          dateTime: event.dateTime.toISOString(),
          endDateTime: event.endDateTime?.toISOString() || null,
          timezone: event.timezone,
          location: event.location,
          state: event.state,
          imageUrl: event.imageUrl,
          category: event.category,
          rsvpCounts: {
            yes: yesCounts,
            no: noCounts,
            maybe: maybeCounts,
          },
        };
      });

      // Get the set of organizing event IDs to exclude from attending list
      const organizingEventIds = new Set(organizing.map((e) => e.id));

      // Transform attending events (exclude ones where user is organizer)
      const attending: AttendingEvent[] = attendingRsvps
        .filter((rsvp) => !organizingEventIds.has(rsvp.event.id))
        .map((rsvp) => ({
          id: rsvp.event.id,
          title: rsvp.event.title,
          dateTime: rsvp.event.dateTime.toISOString(),
          endDateTime: rsvp.event.endDateTime?.toISOString() || null,
          timezone: rsvp.event.timezone,
          location: rsvp.event.location,
          state: rsvp.event.state,
          imageUrl: rsvp.event.imageUrl,
          category: rsvp.event.category,
          rsvpStatus: "YES",
          isOrganizer: rsvp.event.eventRoles.length > 0,
        }));

      // Transform pending events (MAYBE responses, excluding organizer events)
      const pending: PendingEvent[] = maybeRsvps
        .filter((rsvp) => !organizingEventIds.has(rsvp.event.id))
        .map((rsvp) => ({
          id: rsvp.event.id,
          title: rsvp.event.title,
          dateTime: rsvp.event.dateTime.toISOString(),
          endDateTime: rsvp.event.endDateTime?.toISOString() || null,
          timezone: rsvp.event.timezone,
          location: rsvp.event.location,
          state: rsvp.event.state,
          imageUrl: rsvp.event.imageUrl,
          category: rsvp.event.category,
          rsvpStatus: "MAYBE",
          isOrganizer: rsvp.event.eventRoles.length > 0,
        }));

      const response: DashboardResponse = {
        organizing,
        attending,
        pending,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/dashboard/organizing
 * Get events where user is an organizer
 */
router.get(
  "/organizing",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const now = new Date();

      const events = await prisma.event.findMany({
        where: {
          eventRoles: {
            some: {
              userId,
              role: "ORGANIZER",
            },
          },
          dateTime: { gte: now },
          state: { in: UPCOMING_STATES },
        },
        orderBy: { dateTime: "asc" },
        include: {
          rsvps: {
            select: {
              response: true,
            },
          },
        },
      });

      const organizing: OrganizingEvent[] = events.map((event) => ({
        id: event.id,
        title: event.title,
        dateTime: event.dateTime.toISOString(),
        endDateTime: event.endDateTime?.toISOString() || null,
        timezone: event.timezone,
        location: event.location,
        state: event.state,
        imageUrl: event.imageUrl,
        category: event.category,
        rsvpCounts: {
          yes: event.rsvps.filter((r) => r.response === "YES").length,
          no: event.rsvps.filter((r) => r.response === "NO").length,
          maybe: event.rsvps.filter((r) => r.response === "MAYBE").length,
        },
      }));

      res.json({ events: organizing });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/dashboard/attending
 * Get events where user RSVP'd YES
 */
router.get(
  "/attending",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const now = new Date();

      const rsvps = await prisma.rSVP.findMany({
        where: {
          userId,
          response: "YES" as RSVPResponse,
          event: {
            dateTime: { gte: now },
            state: { in: UPCOMING_STATES },
          },
        },
        include: {
          event: {
            include: {
              eventRoles: {
                where: { userId },
                select: { role: true },
              },
            },
          },
        },
        orderBy: {
          event: {
            dateTime: "asc",
          },
        },
      });

      const attending: AttendingEvent[] = rsvps.map((rsvp) => ({
        id: rsvp.event.id,
        title: rsvp.event.title,
        dateTime: rsvp.event.dateTime.toISOString(),
        endDateTime: rsvp.event.endDateTime?.toISOString() || null,
        timezone: rsvp.event.timezone,
        location: rsvp.event.location,
        state: rsvp.event.state,
        imageUrl: rsvp.event.imageUrl,
        category: rsvp.event.category,
        rsvpStatus: "YES",
        isOrganizer: rsvp.event.eventRoles.length > 0,
      }));

      res.json({ events: attending });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/dashboard/pending
 * Get events where user RSVP'd MAYBE or has no response
 */
router.get(
  "/pending",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const now = new Date();

      const rsvps = await prisma.rSVP.findMany({
        where: {
          userId,
          response: "MAYBE" as RSVPResponse,
          event: {
            dateTime: { gte: now },
            state: { in: UPCOMING_STATES },
          },
        },
        include: {
          event: {
            include: {
              eventRoles: {
                where: { userId },
                select: { role: true },
              },
            },
          },
        },
        orderBy: {
          event: {
            dateTime: "asc",
          },
        },
      });

      const pending: PendingEvent[] = rsvps.map((rsvp) => ({
        id: rsvp.event.id,
        title: rsvp.event.title,
        dateTime: rsvp.event.dateTime.toISOString(),
        endDateTime: rsvp.event.endDateTime?.toISOString() || null,
        timezone: rsvp.event.timezone,
        location: rsvp.event.location,
        state: rsvp.event.state,
        imageUrl: rsvp.event.imageUrl,
        category: rsvp.event.category,
        rsvpStatus: "MAYBE",
        isOrganizer: rsvp.event.eventRoles.length > 0,
      }));

      res.json({ events: pending });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/dashboard/past
 * Get past events for the authenticated user
 * Returns:
 * - pastOrganizing: Events user organized that are COMPLETED or CANCELLED
 * - pastAttending: Events user RSVP'd YES that are COMPLETED
 * Both sorted by dateTime descending
 */
router.get(
  "/past",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      // Get past events where user is an organizer (COMPLETED or CANCELLED)
      const pastOrganizingEvents = await prisma.event.findMany({
        where: {
          eventRoles: {
            some: {
              userId,
              role: "ORGANIZER",
            },
          },
          state: { in: PAST_STATES },
        },
        orderBy: { dateTime: "desc" },
        include: {
          rsvps: {
            select: {
              response: true,
            },
          },
        },
      });

      // Get past events where user RSVP'd YES (only COMPLETED events)
      const pastAttendingRsvps = await prisma.rSVP.findMany({
        where: {
          userId,
          response: "YES" as RSVPResponse,
          event: {
            state: "COMPLETED",
          },
        },
        include: {
          event: {
            include: {
              eventRoles: {
                where: { userId },
                select: { role: true },
              },
            },
          },
        },
        orderBy: {
          event: {
            dateTime: "desc",
          },
        },
      });

      // Transform past organizing events
      const pastOrganizing: OrganizingEvent[] = pastOrganizingEvents.map((event) => ({
        id: event.id,
        title: event.title,
        dateTime: event.dateTime.toISOString(),
        endDateTime: event.endDateTime?.toISOString() || null,
        timezone: event.timezone,
        location: event.location,
        state: event.state,
        imageUrl: event.imageUrl,
        category: event.category,
        rsvpCounts: {
          yes: event.rsvps.filter((r) => r.response === "YES").length,
          no: event.rsvps.filter((r) => r.response === "NO").length,
          maybe: event.rsvps.filter((r) => r.response === "MAYBE").length,
        },
      }));

      // Get the set of organizing event IDs to exclude from attending list
      const organizingEventIds = new Set(pastOrganizing.map((e) => e.id));

      // Transform past attending events (exclude ones where user is organizer)
      const pastAttending: AttendingEvent[] = pastAttendingRsvps
        .filter((rsvp) => !organizingEventIds.has(rsvp.event.id))
        .map((rsvp) => ({
          id: rsvp.event.id,
          title: rsvp.event.title,
          dateTime: rsvp.event.dateTime.toISOString(),
          endDateTime: rsvp.event.endDateTime?.toISOString() || null,
          timezone: rsvp.event.timezone,
          location: rsvp.event.location,
          state: rsvp.event.state,
          imageUrl: rsvp.event.imageUrl,
          category: rsvp.event.category,
          rsvpStatus: "YES",
          isOrganizer: rsvp.event.eventRoles.length > 0,
        }));

      const response: PastDashboardResponse = {
        pastOrganizing,
        pastAttending,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/dashboard/search
 * Search and filter events for the authenticated user
 * Query parameters:
 * - title: string (optional) - Search by event title (case-insensitive, partial match)
 * - startDate: ISO date string (optional) - Filter events starting on or after this date
 * - endDate: ISO date string (optional) - Filter events starting on or before this date
 * - state: upcoming | past | cancelled (optional) - Filter by event state category
 * - role: organizer | attendee (optional) - Filter by user's role in the event
 * - page: number (optional, default 1) - Page number for pagination
 * - limit: number (optional, default 20) - Number of results per page
 *
 * Returns:
 * - events: Array of matching events
 * - pagination: Object with page, limit, total, totalPages
 */
router.get(
  "/search",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      // Parse query parameters
      const {
        title,
        startDate,
        endDate,
        state: stateCategory,
        role,
        page = "1",
        limit = "20",
      } = req.query;

      // Validate and parse pagination parameters
      const parsedPage = parseInt(page as string, 10);
      const parsedLimit = parseInt(limit as string, 10);
      const pageNum = isNaN(parsedPage) ? 1 : Math.max(1, parsedPage);
      const limitNum = isNaN(parsedLimit) ? 20 : Math.min(100, Math.max(1, parsedLimit));
      const skip = (pageNum - 1) * limitNum;

      // Build where clause for events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const andConditions: any[] = [];

      // Add base condition: user must be connected to the event
      // This will be overridden if a role filter is specified
      const validRoles = ["organizer", "attendee"];
      const roleFilter = typeof role === "string" && validRoles.includes(role) ? role : null;

      if (!roleFilter) {
        andConditions.push({
          OR: [
            {
              eventRoles: {
                some: {
                  userId,
                  role: "ORGANIZER" as const,
                },
              },
            },
            {
              rsvps: {
                some: {
                  userId,
                  response: { in: ["YES", "MAYBE"] as RSVPResponse[] },
                },
              },
            },
          ],
        });
      } else if (roleFilter === "organizer") {
        andConditions.push({
          eventRoles: {
            some: {
              userId,
              role: "ORGANIZER" as const,
            },
          },
        });
      } else if (roleFilter === "attendee") {
        andConditions.push({
          rsvps: {
            some: {
              userId,
              response: "YES" as RSVPResponse,
            },
          },
        });
      }

      // Add title search
      if (title && typeof title === "string") {
        andConditions.push({
          title: {
            contains: title,
            mode: "insensitive" as const,
          },
        });
      }

      // Add date range filters
      if (startDate && typeof startDate === "string") {
        const startDateTime = new Date(startDate);
        if (!isNaN(startDateTime.getTime())) {
          andConditions.push({
            dateTime: { gte: startDateTime },
          });
        }
      }
      if (endDate && typeof endDate === "string") {
        const endDateTime = new Date(endDate);
        if (!isNaN(endDateTime.getTime())) {
          andConditions.push({
            dateTime: { lte: endDateTime },
          });
        }
      }

      // Add state category filter
      if (stateCategory && typeof stateCategory === "string") {
        const validStates = ["upcoming", "past", "cancelled"];
        if (validStates.includes(stateCategory)) {
          if (stateCategory === "upcoming") {
            andConditions.push({ state: { in: UPCOMING_STATES } });
          } else if (stateCategory === "past") {
            andConditions.push({ state: { in: ["COMPLETED" as EventState] } });
          } else if (stateCategory === "cancelled") {
            andConditions.push({ state: { in: ["CANCELLED" as EventState] } });
          }
        }
      }

      const where = {
        AND: andConditions,
      };

      // Get total count for pagination
      const total = await prisma.event.count({ where });

      // Get events with pagination
      const events = await prisma.event.findMany({
        where,
        orderBy: { dateTime: "desc" },
        skip,
        take: limitNum,
        include: {
          eventRoles: {
            where: { userId },
            select: { role: true },
          },
          rsvps: {
            select: {
              response: true,
              userId: true,
            },
          },
        },
      });

      // Transform events to include role and RSVP information
      const transformedEvents = events.map((event) => {
        const isOrganizer = event.eventRoles.length > 0;
        const userRsvp = event.rsvps.find((r) => r.userId === userId);
        const rsvpStatus = userRsvp?.response || null;

        return {
          id: event.id,
          title: event.title,
          dateTime: event.dateTime.toISOString(),
          endDateTime: event.endDateTime?.toISOString() || null,
          timezone: event.timezone,
          location: event.location,
          state: event.state,
          imageUrl: event.imageUrl,
          category: event.category,
          isOrganizer,
          rsvpStatus,
          rsvpCounts: isOrganizer
            ? {
                yes: event.rsvps.filter((r) => r.response === "YES").length,
                no: event.rsvps.filter((r) => r.response === "NO").length,
                maybe: event.rsvps.filter((r) => r.response === "MAYBE").length,
              }
            : undefined,
        };
      });

      res.json({
        events: transformedEvents,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
