import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import type { EventAuthenticatedRequest } from "../middleware/eventAuth.js";
import { createApiError } from "../types/index.js";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireEventOrganizer } from "../middleware/eventAuth.js";
import { computeEventState, canBeCancelled, getStateLabel } from "../utils/eventState.js";

const router = Router();

// =============================================================================
// Validation helpers
// =============================================================================

interface CreateEventInput {
  title: string;
  description: string;
  dateTime: string;
  endDateTime?: string;
  timezone?: string;
  location: string;
  imageUrl?: string;
  capacity?: number;
  rsvpDeadline?: string;
  category?: string;
  dressCode?: string;
  notes?: string;
  attendeeListVisibility?: "ATTENDEES_ONLY" | "ORGANIZERS_ONLY";
  allowInviteSharing?: boolean;
}

interface UpdateEventInput {
  title?: string;
  description?: string;
  dateTime?: string;
  endDateTime?: string | null;
  timezone?: string;
  location?: string;
  imageUrl?: string | null;
  capacity?: number | null;
  rsvpDeadline?: string | null;
  category?: string | null;
  dressCode?: string | null;
  notes?: string | null;
  attendeeListVisibility?: "ATTENDEES_ONLY" | "ORGANIZERS_ONLY";
  allowInviteSharing?: boolean;
}

function validateCreateEventInput(input: unknown): CreateEventInput {
  if (!input || typeof input !== "object") {
    throw createApiError("Invalid request body", 400, "INVALID_INPUT");
  }

  const data = input as Record<string, unknown>;

  // Required fields
  if (!data.title || typeof data.title !== "string" || data.title.trim() === "") {
    throw createApiError("Title is required", 400, "MISSING_TITLE");
  }

  if (!data.description || typeof data.description !== "string") {
    throw createApiError("Description is required", 400, "MISSING_DESCRIPTION");
  }

  if (!data.dateTime || typeof data.dateTime !== "string") {
    throw createApiError("Date and time is required", 400, "MISSING_DATETIME");
  }

  // Validate dateTime is a valid date
  const dateTime = new Date(data.dateTime);
  if (isNaN(dateTime.getTime())) {
    throw createApiError("Invalid date and time format", 400, "INVALID_DATETIME");
  }

  if (!data.location || typeof data.location !== "string" || data.location.trim() === "") {
    throw createApiError("Location is required", 400, "MISSING_LOCATION");
  }

  // Validate title length
  if (data.title.length > 200) {
    throw createApiError("Title must be 200 characters or less", 400, "TITLE_TOO_LONG");
  }

  // Validate description length
  if (data.description.length > 5000) {
    throw createApiError("Description must be 5000 characters or less", 400, "DESCRIPTION_TOO_LONG");
  }

  // Validate optional fields
  if (data.endDateTime !== undefined && data.endDateTime !== null) {
    if (typeof data.endDateTime !== "string") {
      throw createApiError("Invalid end date and time format", 400, "INVALID_END_DATETIME");
    }
    const endDateTime = new Date(data.endDateTime);
    if (isNaN(endDateTime.getTime())) {
      throw createApiError("Invalid end date and time format", 400, "INVALID_END_DATETIME");
    }
    if (endDateTime <= dateTime) {
      throw createApiError("End time must be after start time", 400, "INVALID_END_DATETIME");
    }
  }

  if (data.capacity !== undefined && data.capacity !== null) {
    if (typeof data.capacity !== "number" || data.capacity < 1 || !Number.isInteger(data.capacity)) {
      throw createApiError("Capacity must be a positive integer", 400, "INVALID_CAPACITY");
    }
  }

  if (data.rsvpDeadline !== undefined && data.rsvpDeadline !== null) {
    if (typeof data.rsvpDeadline !== "string") {
      throw createApiError("Invalid RSVP deadline format", 400, "INVALID_RSVP_DEADLINE");
    }
    const rsvpDeadline = new Date(data.rsvpDeadline);
    if (isNaN(rsvpDeadline.getTime())) {
      throw createApiError("Invalid RSVP deadline format", 400, "INVALID_RSVP_DEADLINE");
    }
  }

  if (data.attendeeListVisibility !== undefined) {
    if (!["ATTENDEES_ONLY", "ORGANIZERS_ONLY"].includes(data.attendeeListVisibility as string)) {
      throw createApiError("Invalid attendee list visibility", 400, "INVALID_VISIBILITY");
    }
  }

  return {
    title: data.title.trim(),
    description: data.description.trim(),
    dateTime: data.dateTime,
    endDateTime: data.endDateTime as string | undefined,
    timezone: typeof data.timezone === "string" ? data.timezone : undefined,
    location: data.location.trim(),
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    capacity: typeof data.capacity === "number" ? data.capacity : undefined,
    rsvpDeadline: typeof data.rsvpDeadline === "string" ? data.rsvpDeadline : undefined,
    category: typeof data.category === "string" ? data.category.trim() : undefined,
    dressCode: typeof data.dressCode === "string" ? data.dressCode.trim() : undefined,
    notes: typeof data.notes === "string" ? data.notes.trim() : undefined,
    attendeeListVisibility: data.attendeeListVisibility as "ATTENDEES_ONLY" | "ORGANIZERS_ONLY" | undefined,
    allowInviteSharing: typeof data.allowInviteSharing === "boolean" ? data.allowInviteSharing : undefined,
  };
}

function validateUpdateEventInput(input: unknown): UpdateEventInput {
  if (!input || typeof input !== "object") {
    throw createApiError("Invalid request body", 400, "INVALID_INPUT");
  }

  const data = input as Record<string, unknown>;
  const result: UpdateEventInput = {};

  // Validate each field if provided
  if (data.title !== undefined) {
    if (typeof data.title !== "string" || data.title.trim() === "") {
      throw createApiError("Title cannot be empty", 400, "INVALID_TITLE");
    }
    if (data.title.length > 200) {
      throw createApiError("Title must be 200 characters or less", 400, "TITLE_TOO_LONG");
    }
    result.title = data.title.trim();
  }

  if (data.description !== undefined) {
    if (typeof data.description !== "string") {
      throw createApiError("Description must be a string", 400, "INVALID_DESCRIPTION");
    }
    if (data.description.length > 5000) {
      throw createApiError("Description must be 5000 characters or less", 400, "DESCRIPTION_TOO_LONG");
    }
    result.description = data.description.trim();
  }

  if (data.dateTime !== undefined) {
    if (typeof data.dateTime !== "string") {
      throw createApiError("Invalid date and time format", 400, "INVALID_DATETIME");
    }
    const dateTime = new Date(data.dateTime);
    if (isNaN(dateTime.getTime())) {
      throw createApiError("Invalid date and time format", 400, "INVALID_DATETIME");
    }
    result.dateTime = data.dateTime;
  }

  if (data.endDateTime !== undefined) {
    if (data.endDateTime === null) {
      result.endDateTime = null;
    } else if (typeof data.endDateTime === "string") {
      const endDateTime = new Date(data.endDateTime);
      if (isNaN(endDateTime.getTime())) {
        throw createApiError("Invalid end date and time format", 400, "INVALID_END_DATETIME");
      }
      result.endDateTime = data.endDateTime;
    } else {
      throw createApiError("Invalid end date and time format", 400, "INVALID_END_DATETIME");
    }
  }

  if (data.timezone !== undefined) {
    if (typeof data.timezone !== "string") {
      throw createApiError("Invalid timezone", 400, "INVALID_TIMEZONE");
    }
    result.timezone = data.timezone;
  }

  if (data.location !== undefined) {
    if (typeof data.location !== "string" || data.location.trim() === "") {
      throw createApiError("Location cannot be empty", 400, "INVALID_LOCATION");
    }
    result.location = data.location.trim();
  }

  if (data.imageUrl !== undefined) {
    result.imageUrl = data.imageUrl === null ? null : (typeof data.imageUrl === "string" ? data.imageUrl : undefined);
  }

  if (data.capacity !== undefined) {
    if (data.capacity === null) {
      result.capacity = null;
    } else if (typeof data.capacity === "number" && data.capacity >= 1 && Number.isInteger(data.capacity)) {
      result.capacity = data.capacity;
    } else {
      throw createApiError("Capacity must be a positive integer", 400, "INVALID_CAPACITY");
    }
  }

  if (data.rsvpDeadline !== undefined) {
    if (data.rsvpDeadline === null) {
      result.rsvpDeadline = null;
    } else if (typeof data.rsvpDeadline === "string") {
      const rsvpDeadline = new Date(data.rsvpDeadline);
      if (isNaN(rsvpDeadline.getTime())) {
        throw createApiError("Invalid RSVP deadline format", 400, "INVALID_RSVP_DEADLINE");
      }
      result.rsvpDeadline = data.rsvpDeadline;
    } else {
      throw createApiError("Invalid RSVP deadline format", 400, "INVALID_RSVP_DEADLINE");
    }
  }

  if (data.category !== undefined) {
    result.category = data.category === null ? null : (typeof data.category === "string" ? data.category.trim() : undefined);
  }

  if (data.dressCode !== undefined) {
    result.dressCode = data.dressCode === null ? null : (typeof data.dressCode === "string" ? data.dressCode.trim() : undefined);
  }

  if (data.notes !== undefined) {
    result.notes = data.notes === null ? null : (typeof data.notes === "string" ? data.notes.trim() : undefined);
  }

  if (data.attendeeListVisibility !== undefined) {
    if (!["ATTENDEES_ONLY", "ORGANIZERS_ONLY"].includes(data.attendeeListVisibility as string)) {
      throw createApiError("Invalid attendee list visibility", 400, "INVALID_VISIBILITY");
    }
    result.attendeeListVisibility = data.attendeeListVisibility as "ATTENDEES_ONLY" | "ORGANIZERS_ONLY";
  }

  if (data.allowInviteSharing !== undefined) {
    if (typeof data.allowInviteSharing !== "boolean") {
      throw createApiError("Allow invite sharing must be a boolean", 400, "INVALID_INVITE_SHARING");
    }
    result.allowInviteSharing = data.allowInviteSharing;
  }

  return result;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /api/events
 * Create a new event (requires authentication)
 */
router.post(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const input = validateCreateEventInput(req.body);

      // Create the event and assign organizer role in a transaction
      const event = await prisma.$transaction(async (tx) => {
        // Create the event
        const newEvent = await tx.event.create({
          data: {
            title: input.title,
            description: input.description,
            dateTime: new Date(input.dateTime),
            endDateTime: input.endDateTime ? new Date(input.endDateTime) : null,
            timezone: input.timezone || "UTC",
            location: input.location,
            imageUrl: input.imageUrl,
            capacity: input.capacity,
            rsvpDeadline: input.rsvpDeadline ? new Date(input.rsvpDeadline) : null,
            category: input.category,
            dressCode: input.dressCode,
            notes: input.notes,
            attendeeListVisibility: input.attendeeListVisibility || "ATTENDEES_ONLY",
            allowInviteSharing: input.allowInviteSharing ?? true,
            state: "DRAFT",
            creatorId: userId,
          },
        });

        // Automatically assign the creator as an organizer
        await tx.eventRole.create({
          data: {
            eventId: newEvent.id,
            userId: userId,
            role: "ORGANIZER",
          },
        });

        return newEvent;
      });

      res.status(201).json({
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          dateTime: event.dateTime.toISOString(),
          endDateTime: event.endDateTime?.toISOString() || null,
          timezone: event.timezone,
          location: event.location,
          imageUrl: event.imageUrl,
          capacity: event.capacity,
          rsvpDeadline: event.rsvpDeadline?.toISOString() || null,
          category: event.category,
          dressCode: event.dressCode,
          notes: event.notes,
          state: event.state,
          attendeeListVisibility: event.attendeeListVisibility,
          allowInviteSharing: event.allowInviteSharing,
          creatorId: event.creatorId,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id
 * Get event details
 * - Public events are viewable by anyone
 * - Draft events are only viewable by organizers
 */
router.get(
  "/:id",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;

      // Try to get authenticated user (optional)
      let userId: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const session = await prisma.session.findUnique({
          where: { token },
          select: { userId: true, expiresAt: true },
        });
        if (session && session.expiresAt > new Date()) {
          userId = session.userId;
        }
      }

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          creator: {
            select: {
              id: true,
              displayName: true,
              photoUrl: true,
            },
          },
          eventRoles: {
            where: { role: "ORGANIZER" },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  photoUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              rsvps: true,
            },
          },
        },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Check if user can view this event
      const isOrganizer = userId
        ? event.creatorId === userId || event.eventRoles.some((role) => role.userId === userId)
        : false;

      // Draft events can only be viewed by organizers
      if (event.state === "DRAFT" && !isOrganizer) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Get RSVP counts if user is authorized to see them
      let rsvpCounts: { yes: number; no: number; maybe: number } | undefined;
      if (isOrganizer || event.attendeeListVisibility === "ATTENDEES_ONLY") {
        const counts = await prisma.rSVP.groupBy({
          by: ["response"],
          where: { eventId },
          _count: true,
        });
        rsvpCounts = {
          yes: counts.find((c: { response: string; _count: number }) => c.response === "YES")?._count || 0,
          no: counts.find((c: { response: string; _count: number }) => c.response === "NO")?._count || 0,
          maybe: counts.find((c: { response: string; _count: number }) => c.response === "MAYBE")?._count || 0,
        };
      }

      // Get user's RSVP if authenticated
      let userRsvp: string | null = null;
      let needsReconfirmation = false;
      if (userId) {
        const rsvp = await prisma.rSVP.findUnique({
          where: {
            eventId_userId: {
              eventId,
              userId,
            },
          },
          select: { response: true, needsReconfirmation: true },
        });
        userRsvp = rsvp?.response || null;
        needsReconfirmation = rsvp?.needsReconfirmation || false;
      }

      // Compute the effective state based on current time
      const computedState = computeEventState({
        state: event.state,
        dateTime: event.dateTime,
        endDateTime: event.endDateTime,
        rsvpDeadline: event.rsvpDeadline,
      });

      res.json({
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          dateTime: event.dateTime.toISOString(),
          endDateTime: event.endDateTime?.toISOString() || null,
          timezone: event.timezone,
          location: event.location,
          imageUrl: event.imageUrl,
          capacity: event.capacity,
          rsvpDeadline: event.rsvpDeadline?.toISOString() || null,
          category: event.category,
          dressCode: event.dressCode,
          notes: event.notes,
          state: computedState,
          storedState: event.state,
          attendeeListVisibility: event.attendeeListVisibility,
          allowInviteSharing: event.allowInviteSharing,
          creator: event.creator,
          organizers: event.eventRoles.map((role) => role.user),
          rsvpCounts,
          userRsvp,
          needsReconfirmation,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.updatedAt.toISOString(),
        },
        isOrganizer,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/events/:id
 * Update event details (organizers only)
 */
router.patch(
  "/:id",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const input = validateUpdateEventInput(req.body);

      // Check if there are any fields to update
      if (Object.keys(input).length === 0) {
        throw createApiError("No fields to update", 400, "NO_FIELDS_TO_UPDATE");
      }

      // Get the current event to check for significant changes
      const currentEvent = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          dateTime: true,
          location: true,
          state: true,
        },
      });

      if (!currentEvent) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Build the update data object
      const updateData: Record<string, unknown> = {};

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.dateTime !== undefined) updateData.dateTime = new Date(input.dateTime);
      if (input.endDateTime !== undefined) {
        updateData.endDateTime = input.endDateTime ? new Date(input.endDateTime) : null;
      }
      if (input.timezone !== undefined) updateData.timezone = input.timezone;
      if (input.location !== undefined) updateData.location = input.location;
      if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl;
      if (input.capacity !== undefined) updateData.capacity = input.capacity;
      if (input.rsvpDeadline !== undefined) {
        updateData.rsvpDeadline = input.rsvpDeadline ? new Date(input.rsvpDeadline) : null;
      }
      if (input.category !== undefined) updateData.category = input.category;
      if (input.dressCode !== undefined) updateData.dressCode = input.dressCode;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.attendeeListVisibility !== undefined) {
        updateData.attendeeListVisibility = input.attendeeListVisibility;
      }
      if (input.allowInviteSharing !== undefined) {
        updateData.allowInviteSharing = input.allowInviteSharing;
      }

      // Validate end time is after start time if both are being updated
      if (updateData.dateTime && updateData.endDateTime) {
        if ((updateData.endDateTime as Date) <= (updateData.dateTime as Date)) {
          throw createApiError("End time must be after start time", 400, "INVALID_END_DATETIME");
        }
      }

      // Detect significant changes (date/time or location)
      const dateTimeChanged =
        input.dateTime !== undefined &&
        new Date(input.dateTime).getTime() !== currentEvent.dateTime.getTime();
      const locationChanged =
        input.location !== undefined && input.location !== currentEvent.location;

      const hasSignificantChange = dateTimeChanged || locationChanged;

      // Use a transaction to update the event and create notifications if needed
      const event = await prisma.$transaction(async (tx) => {
        const updatedEvent = await tx.event.update({
          where: { id: eventId },
          data: updateData,
        });

        // Only create notifications for significant changes on published events
        if (hasSignificantChange && currentEvent.state === "PUBLISHED") {
          // Get all users who have RSVP'd (yes, no, or maybe)
          const rsvps = await tx.rSVP.findMany({
            where: { eventId },
            select: { userId: true },
          });

          // Build notification message
          const changes: string[] = [];
          if (dateTimeChanged) changes.push("date/time");
          if (locationChanged) changes.push("location");
          const changeText = changes.join(" and ");
          const message = `The ${changeText} for "${currentEvent.title}" has been updated. Please review the changes.`;

          // Create notifications for all RSVP'd users
          if (rsvps.length > 0) {
            await tx.notification.createMany({
              data: rsvps.map((rsvp) => ({
                userId: rsvp.userId,
                eventId,
                type: "EVENT_UPDATED" as const,
                message,
              })),
            });

            // Mark all RSVPs as needing reconfirmation
            await tx.rSVP.updateMany({
              where: { eventId },
              data: { needsReconfirmation: true },
            });
          }
        }

        return updatedEvent;
      });

      res.json({
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          dateTime: event.dateTime.toISOString(),
          endDateTime: event.endDateTime?.toISOString() || null,
          timezone: event.timezone,
          location: event.location,
          imageUrl: event.imageUrl,
          capacity: event.capacity,
          rsvpDeadline: event.rsvpDeadline?.toISOString() || null,
          category: event.category,
          dressCode: event.dressCode,
          notes: event.notes,
          state: event.state,
          attendeeListVisibility: event.attendeeListVisibility,
          allowInviteSharing: event.allowInviteSharing,
          creatorId: event.creatorId,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/attendees/public
 * Get public attendee information based on permissions
 * - If user RSVP'd "yes" AND attendeeListVisibility is ATTENDEES_ONLY: full attendee list
 * - If user is an organizer: full attendee list
 * - Otherwise: only aggregate count
 */
router.get(
  "/:id/attendees/public",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;

      // Try to get authenticated user (optional)
      let userId: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const session = await prisma.session.findUnique({
          where: { token },
          select: { userId: true, expiresAt: true },
        });
        if (session && session.expiresAt > new Date()) {
          userId = session.userId;
        }
      }

      // Get the event with visibility settings and organizer info
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          state: true,
          attendeeListVisibility: true,
          creatorId: true,
          eventRoles: {
            where: { role: "ORGANIZER" },
            select: { userId: true },
          },
        },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Draft events are not accessible to non-organizers
      const isOrganizer = userId
        ? event.creatorId === userId || event.eventRoles.some((role) => role.userId === userId)
        : false;

      if (event.state === "DRAFT" && !isOrganizer) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Get count of attendees (users who RSVP'd YES)
      const attendeeCount = await prisma.rSVP.count({
        where: {
          eventId,
          response: "YES",
        },
      });

      // Check if user can see the full attendee list
      let canViewAttendees = false;
      let userRsvp: string | null = null;

      if (userId) {
        // Get user's RSVP
        const rsvp = await prisma.rSVP.findUnique({
          where: {
            eventId_userId: {
              eventId,
              userId,
            },
          },
          select: { response: true },
        });
        userRsvp = rsvp?.response || null;

        // User can view attendees if:
        // 1. They are an organizer, OR
        // 2. They RSVP'd YES AND visibility is ATTENDEES_ONLY
        if (isOrganizer) {
          canViewAttendees = true;
        } else if (userRsvp === "YES" && event.attendeeListVisibility === "ATTENDEES_ONLY") {
          canViewAttendees = true;
        }
      }

      if (!canViewAttendees) {
        // Return only aggregate count for non-attendees
        res.json({
          attendeeCount,
          canViewAttendees: false,
          attendees: null,
        });
        return;
      }

      // Get full attendee list with display names and organizer badges
      const attendeesWithRsvp = await prisma.rSVP.findMany({
        where: {
          eventId,
          response: "YES",
        },
        select: {
          user: {
            select: {
              id: true,
              displayName: true,
              photoUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      // Get organizer IDs for badge display
      const organizerIds = new Set([
        event.creatorId,
        ...event.eventRoles.map((role) => role.userId),
      ]);

      // Format attendee list with organizer badges
      const attendees = attendeesWithRsvp.map((rsvp) => ({
        id: rsvp.user.id,
        displayName: rsvp.user.displayName,
        photoUrl: rsvp.user.photoUrl,
        isOrganizer: organizerIds.has(rsvp.user.id),
      }));

      res.json({
        attendeeCount,
        canViewAttendees: true,
        attendees,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/publish
 * Publish a draft event (organizers only)
 */
router.post(
  "/:id/publish",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;

      // Get the current event state
      const currentEvent = await prisma.event.findUnique({
        where: { id: eventId },
        select: { state: true },
      });

      if (!currentEvent) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Only draft events can be published
      if (currentEvent.state !== "DRAFT") {
        throw createApiError(
          `Cannot publish event with state: ${currentEvent.state}`,
          400,
          "INVALID_STATE_TRANSITION"
        );
      }

      const event = await prisma.event.update({
        where: { id: eventId },
        data: { state: "PUBLISHED" },
      });

      res.json({
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          dateTime: event.dateTime.toISOString(),
          endDateTime: event.endDateTime?.toISOString() || null,
          timezone: event.timezone,
          location: event.location,
          imageUrl: event.imageUrl,
          capacity: event.capacity,
          rsvpDeadline: event.rsvpDeadline?.toISOString() || null,
          category: event.category,
          dressCode: event.dressCode,
          notes: event.notes,
          state: event.state,
          attendeeListVisibility: event.attendeeListVisibility,
          allowInviteSharing: event.allowInviteSharing,
          creatorId: event.creatorId,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.updatedAt.toISOString(),
        },
        message: "Event published successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/cancel
 * Cancel an event (organizers only)
 * Notifies all invited/RSVPd users
 */
router.post(
  "/:id/cancel",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const { message: cancellationMessage } = req.body as { message?: string };

      // Get the current event with necessary data
      const currentEvent = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          state: true,
          dateTime: true,
          endDateTime: true,
          rsvpDeadline: true,
          rsvps: {
            select: {
              userId: true,
              user: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
          inviteLinks: {
            select: { id: true },
          },
        },
      });

      if (!currentEvent) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Check if event can be cancelled
      const canCancel = canBeCancelled({
        state: currentEvent.state,
        dateTime: currentEvent.dateTime,
        endDateTime: currentEvent.endDateTime,
        rsvpDeadline: currentEvent.rsvpDeadline,
      });

      if (!canCancel) {
        const currentState = computeEventState({
          state: currentEvent.state,
          dateTime: currentEvent.dateTime,
          endDateTime: currentEvent.endDateTime,
          rsvpDeadline: currentEvent.rsvpDeadline,
        });
        throw createApiError(
          `Cannot cancel event with state: ${getStateLabel(currentState)}`,
          400,
          "INVALID_STATE_TRANSITION"
        );
      }

      // Update event state to CANCELLED
      const event = await prisma.event.update({
        where: { id: eventId },
        data: { state: "CANCELLED" },
      });

      // Deactivate all invite links for this event
      await prisma.inviteLink.updateMany({
        where: { eventId },
        data: { isActive: false },
      });

      // Create notifications for all users who RSVPd
      const notifiedUsers = currentEvent.rsvps.map((rsvp) => rsvp.user.displayName);

      if (currentEvent.rsvps.length > 0) {
        const notificationMessage = cancellationMessage
          ? `"${currentEvent.title}" has been cancelled. ${cancellationMessage}`
          : `"${currentEvent.title}" has been cancelled.`;

        await prisma.notification.createMany({
          data: currentEvent.rsvps.map((rsvp) => ({
            userId: rsvp.userId,
            eventId,
            type: "EVENT_CANCELLED" as const,
            message: notificationMessage,
          })),
        });
      }

      console.log(
        `[Event Cancelled] Event "${currentEvent.title}" (${eventId}) was cancelled.`,
        `\nCancellation message: ${cancellationMessage || "(none)"}`,
        `\nNotified ${notifiedUsers.length} users: ${notifiedUsers.join(", ")}`
      );

      res.json({
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          dateTime: event.dateTime.toISOString(),
          endDateTime: event.endDateTime?.toISOString() || null,
          timezone: event.timezone,
          location: event.location,
          imageUrl: event.imageUrl,
          capacity: event.capacity,
          rsvpDeadline: event.rsvpDeadline?.toISOString() || null,
          category: event.category,
          dressCode: event.dressCode,
          notes: event.notes,
          state: event.state,
          attendeeListVisibility: event.attendeeListVisibility,
          allowInviteSharing: event.allowInviteSharing,
          creatorId: event.creatorId,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.updatedAt.toISOString(),
        },
        message: "Event cancelled successfully",
        notifiedCount: notifiedUsers.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/state
 * Get the computed state of an event based on current time
 * This is useful for clients to check state without fetching full event details
 */
router.get(
  "/:id/state",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;

      // Get event with state-relevant fields
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          state: true,
          dateTime: true,
          endDateTime: true,
          rsvpDeadline: true,
          creatorId: true,
          eventRoles: {
            where: { role: "ORGANIZER" },
            select: { userId: true },
          },
        },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Check if user can view this event (draft check)
      let userId: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const session = await prisma.session.findUnique({
          where: { token },
          select: { userId: true, expiresAt: true },
        });
        if (session && session.expiresAt > new Date()) {
          userId = session.userId;
        }
      }

      const isOrganizer = userId
        ? event.creatorId === userId || event.eventRoles.some((role) => role.userId === userId)
        : false;

      // Draft events can only be viewed by organizers
      if (event.state === "DRAFT" && !isOrganizer) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Compute state
      const now = new Date();
      const computedState = computeEventState(
        {
          state: event.state,
          dateTime: event.dateTime,
          endDateTime: event.endDateTime,
          rsvpDeadline: event.rsvpDeadline,
        },
        now
      );

      // Check RSVP deadline status
      const rsvpDeadlinePassed = event.rsvpDeadline ? now >= event.rsvpDeadline : false;

      res.json({
        eventId: event.id,
        state: computedState,
        storedState: event.state,
        stateLabel: getStateLabel(computedState),
        canAcceptRsvps: computedState === "PUBLISHED",
        rsvpDeadlinePassed,
        rsvpDeadline: event.rsvpDeadline?.toISOString() || null,
        dateTime: event.dateTime.toISOString(),
        endDateTime: event.endDateTime?.toISOString() || null,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/attendees
 * Get full attendee list for an event (organizers only)
 * Returns all users who have RSVPed with their RSVP status and role
 */
router.get(
  "/:id/attendees",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;

      // Get all RSVPs with user info
      const rsvps = await prisma.rSVP.findMany({
        where: { eventId },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              photoUrl: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Get event to check creator
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { creatorId: true },
      });

      // Get all organizer roles for this event
      const organizerRoles = await prisma.eventRole.findMany({
        where: { eventId, role: "ORGANIZER" },
        select: { userId: true },
      });
      const organizerIds = new Set(organizerRoles.map((r) => r.userId));

      // Format attendees with role info
      const attendees = rsvps.map((rsvp) => ({
        id: rsvp.user.id,
        displayName: rsvp.user.displayName,
        photoUrl: rsvp.user.photoUrl,
        email: rsvp.user.email,
        phone: rsvp.user.phone,
        rsvpStatus: rsvp.response,
        rsvpDate: rsvp.createdAt.toISOString(),
        isOrganizer: organizerIds.has(rsvp.user.id),
        isCreator: event?.creatorId === rsvp.user.id,
      }));

      res.json({
        attendees,
        total: attendees.length,
        counts: {
          yes: attendees.filter((a) => a.rsvpStatus === "YES").length,
          no: attendees.filter((a) => a.rsvpStatus === "NO").length,
          maybe: attendees.filter((a) => a.rsvpStatus === "MAYBE").length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/organizers
 * Promote a user to organizer role (organizers only)
 * Request body: { userId: string }
 */
router.post(
  "/:id/organizers",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const { userId } = req.body;

      if (!userId || typeof userId !== "string") {
        throw createApiError("User ID is required", 400, "MISSING_USER_ID");
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, photoUrl: true },
      });

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      // Check if user has RSVPed to this event (must be an attendee)
      const rsvp = await prisma.rSVP.findUnique({
        where: {
          eventId_userId: { eventId, userId },
        },
      });

      if (!rsvp) {
        throw createApiError(
          "User must be an attendee of this event to be promoted",
          400,
          "NOT_AN_ATTENDEE"
        );
      }

      // Check if user is already an organizer
      const existingRole = await prisma.eventRole.findUnique({
        where: {
          eventId_userId: { eventId, userId },
        },
      });

      if (existingRole) {
        throw createApiError("User is already an organizer", 400, "ALREADY_ORGANIZER");
      }

      // Create organizer role
      await prisma.eventRole.create({
        data: {
          eventId,
          userId,
          role: "ORGANIZER",
        },
      });

      res.status(201).json({
        message: "User promoted to organizer",
        organizer: {
          id: user.id,
          displayName: user.displayName,
          photoUrl: user.photoUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/events/:id/organizers/:userId
 * Demote an organizer (remove organizer role)
 * Cannot demote the original creator
 */
router.delete(
  "/:id/organizers/:userId",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.params.userId;

      if (!userId) {
        throw createApiError("User ID is required", 400, "MISSING_USER_ID");
      }

      // Get event to check creator
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { creatorId: true },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Cannot demote the original creator
      if (event.creatorId === userId) {
        throw createApiError(
          "Cannot demote the original event creator",
          403,
          "CANNOT_DEMOTE_CREATOR"
        );
      }

      // Check if user has an organizer role
      const eventRole = await prisma.eventRole.findUnique({
        where: {
          eventId_userId: { eventId, userId },
        },
      });

      if (!eventRole) {
        throw createApiError("User is not an organizer", 400, "NOT_AN_ORGANIZER");
      }

      // Delete the organizer role
      await prisma.eventRole.delete({
        where: {
          eventId_userId: { eventId, userId },
        },
      });

      res.json({
        message: "Organizer demoted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
