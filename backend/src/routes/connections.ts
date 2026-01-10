import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// =============================================================================
// Types
// =============================================================================

interface Connection {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  sharedEventCount: number;
  mostRecentEvent: {
    eventId: string;
    eventTitle: string;
    eventDate: string;
  } | null;
}

interface ConnectionsResponse {
  connections: Connection[];
}

interface SharedEvent {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  userRole: "ORGANIZER" | "ATTENDEE";
}

interface ConnectionDetail {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  bio: string | null;
  location: string | null;
  sharedEvents: SharedEvent[];
  totalSharedEvents: number;
}

interface ConnectionDetailResponse {
  connection: ConnectionDetail;
}

type SortOption = "recent" | "frequency" | "alphabetical";

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/connections
 * Get all connections for the authenticated user
 *
 * A connection is a user who has attended at least one completed event
 * with the authenticated user (both users RSVP'd YES).
 *
 * Query parameters:
 * - name: Filter by display name (case-insensitive partial match)
 * - eventId: Filter by specific shared event
 * - startDate: Filter connections with events after this date (ISO string)
 * - endDate: Filter connections with events before this date (ISO string)
 * - sort: Sort order - "recent" (default), "frequency", "alphabetical"
 *
 * Returns:
 * - List of connections with:
 *   - User's display name
 *   - Profile photo (if set)
 *   - Number of shared events
 *   - Most recent shared event name and date
 * - Sorted by specified sort order (default: most recent event together)
 */
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { name, eventId, startDate, endDate, sort } = req.query;
      const sortOption = (sort as SortOption) || "recent";

      // Build where clause for user's completed events
      const userEventsWhere: {
        userId: string;
        response: "YES";
        event: {
          state: "COMPLETED";
          id?: string;
          dateTime?: {
            gte?: Date;
            lte?: Date;
          };
        };
      } = {
        userId,
        response: "YES",
        event: {
          state: "COMPLETED",
        },
      };

      // Apply event filter if provided
      if (eventId && typeof eventId === "string") {
        userEventsWhere.event.id = eventId;
      }

      // Apply date filters if provided
      if (startDate || endDate) {
        userEventsWhere.event.dateTime = {};
        if (startDate && typeof startDate === "string") {
          const startDateObj = new Date(startDate);
          if (isNaN(startDateObj.getTime())) {
            res.status(400).json({ message: "Invalid startDate format" });
            return;
          }
          userEventsWhere.event.dateTime.gte = startDateObj;
        }
        if (endDate && typeof endDate === "string") {
          const endDateObj = new Date(endDate);
          if (isNaN(endDateObj.getTime())) {
            res.status(400).json({ message: "Invalid endDate format" });
            return;
          }
          userEventsWhere.event.dateTime.lte = endDateObj;
        }
      }

      // Find all completed events where the user RSVP'd YES
      const userCompletedEvents = await prisma.rSVP.findMany({
        where: userEventsWhere,
        select: {
          eventId: true,
          event: {
            select: {
              id: true,
              title: true,
              dateTime: true,
            },
          },
        },
      });

      const userEventIds = userCompletedEvents.map((rsvp) => rsvp.eventId);

      if (userEventIds.length === 0) {
        res.json({ connections: [] });
        return;
      }

      // Build where clause for other attendees
      const otherAttendeesWhere: {
        eventId: { in: string[] };
        response: "YES";
        userId: { not: string };
        user?: {
          displayName?: {
            contains: string;
            mode: "insensitive";
          };
        };
      } = {
        eventId: { in: userEventIds },
        response: "YES",
        userId: { not: userId }, // Exclude current user
      };

      // Apply name filter if provided
      if (name && typeof name === "string") {
        otherAttendeesWhere.user = {
          displayName: {
            contains: name,
            mode: "insensitive",
          },
        };
      }

      // Find all other users who RSVP'd YES to the same events
      const otherAttendees = await prisma.rSVP.findMany({
        where: otherAttendeesWhere,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              photoUrl: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              dateTime: true,
            },
          },
        },
        orderBy: {
          event: {
            dateTime: "desc",
          },
        },
      });

      // Group by user to calculate connections
      const connectionMap = new Map<string, {
        user: { id: string; displayName: string; photoUrl: string | null };
        events: Array<{ id: string; title: string; dateTime: Date }>;
      }>();

      for (const rsvp of otherAttendees) {
        const existingConnection = connectionMap.get(rsvp.userId);

        if (existingConnection) {
          existingConnection.events.push({
            id: rsvp.event.id,
            title: rsvp.event.title,
            dateTime: rsvp.event.dateTime,
          });
        } else {
          connectionMap.set(rsvp.userId, {
            user: rsvp.user,
            events: [{
              id: rsvp.event.id,
              title: rsvp.event.title,
              dateTime: rsvp.event.dateTime,
            }],
          });
        }
      }

      // Transform to response format
      const connections: Connection[] = Array.from(connectionMap.values()).map((connection) => {
        // Sort events by date descending to get most recent
        const sortedEvents = connection.events.sort((a, b) =>
          b.dateTime.getTime() - a.dateTime.getTime()
        );
        const mostRecent = sortedEvents[0];

        return {
          userId: connection.user.id,
          displayName: connection.user.displayName,
          photoUrl: connection.user.photoUrl,
          sharedEventCount: connection.events.length,
          mostRecentEvent: mostRecent ? {
            eventId: mostRecent.id,
            eventTitle: mostRecent.title,
            eventDate: mostRecent.dateTime.toISOString(),
          } : null,
        };
      });

      // Apply sorting based on sort parameter
      if (sortOption === "alphabetical") {
        connections.sort((a, b) => a.displayName.localeCompare(b.displayName));
      } else if (sortOption === "frequency") {
        connections.sort((a, b) => b.sharedEventCount - a.sharedEventCount);
      } else {
        // Default: sort by most recent event date
        connections.sort((a, b) => {
          if (!a.mostRecentEvent) return 1;
          if (!b.mostRecentEvent) return -1;
          return new Date(b.mostRecentEvent.eventDate).getTime() -
                 new Date(a.mostRecentEvent.eventDate).getTime();
        });
      }

      const response: ConnectionsResponse = {
        connections,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/connections/:userId
 * Get detailed information about a specific connection
 *
 * Query parameters:
 * - eventId: Filter by specific event (optional)
 * - startDate: Filter events after this date (optional, ISO string)
 * - endDate: Filter events before this date (optional, ISO string)
 * - sort: Sort order - "recent" (default), "frequency", or "alphabetical"
 *
 * Returns:
 * - Connection's public profile info (display name, photo, bio, location based on privacy)
 * - List of all shared events (both users RSVP'd YES and event is COMPLETED)
 * - User's role in each event (ORGANIZER or ATTENDEE)
 * - Total count of shared events
 */
router.get(
  "/:userId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUserId = req.user!.id;
      const targetUserId = req.params.userId;
      const { eventId, startDate, endDate } = req.query;

      // Validate that target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          displayName: true,
          photoUrl: true,
          bio: true,
          location: true,
          photoVisibility: true,
          bioVisibility: true,
          locationVisibility: true,
        },
      });

      if (!targetUser) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Find all completed events where both users RSVP'd YES
      const currentUserEvents = await prisma.rSVP.findMany({
        where: {
          userId: currentUserId,
          response: "YES",
          event: {
            state: "COMPLETED",
          },
        },
        select: {
          eventId: true,
        },
      });

      const currentUserEventIds = currentUserEvents.map((rsvp) => rsvp.eventId);

      if (currentUserEventIds.length === 0) {
        res.status(404).json({ message: "No connection found with this user" });
        return;
      }

      // Build where clause for shared events query
      const sharedEventsWhere: {
        eventId: { in: string[] };
        userId: string;
        response: "YES";
        event?: {
          id?: string;
          dateTime?: {
            gte?: Date;
            lte?: Date;
          };
        };
      } = {
        eventId: { in: currentUserEventIds },
        userId: targetUserId,
        response: "YES",
      };

      // Apply filters if provided
      if (eventId || startDate || endDate) {
        sharedEventsWhere.event = {};

        if (eventId && typeof eventId === "string") {
          sharedEventsWhere.event.id = eventId;
        }

        if (startDate || endDate) {
          sharedEventsWhere.event.dateTime = {};
          if (startDate && typeof startDate === "string") {
            const startDateObj = new Date(startDate);
            if (isNaN(startDateObj.getTime())) {
              res.status(400).json({ message: "Invalid startDate format" });
              return;
            }
            sharedEventsWhere.event.dateTime.gte = startDateObj;
          }
          if (endDate && typeof endDate === "string") {
            const endDateObj = new Date(endDate);
            if (isNaN(endDateObj.getTime())) {
              res.status(400).json({ message: "Invalid endDate format" });
              return;
            }
            sharedEventsWhere.event.dateTime.lte = endDateObj;
          }
        }
      }

      // Get all shared events
      const sharedEventRSVPs = await prisma.rSVP.findMany({
        where: sharedEventsWhere,
        include: {
          event: {
            select: {
              id: true,
              title: true,
              dateTime: true,
              location: true,
              creatorId: true,
              eventRoles: {
                where: {
                  userId: targetUserId,
                },
                select: {
                  role: true,
                },
              },
            },
          },
        },
      });

      if (sharedEventRSVPs.length === 0) {
        res.status(404).json({ message: "No connection found with this user" });
        return;
      }

      // Check if target user is a connection (attended at least one completed event together)
      const isConnection = sharedEventRSVPs.length > 0;

      // Helper to check if a field should be visible
      const isFieldVisible = (visibility: "CONNECTIONS" | "ORGANIZERS_ONLY" | "PRIVATE"): boolean => {
        if (visibility === "PRIVATE") return false;
        // For connections endpoint, we don't check ORGANIZERS_ONLY status
        // Only show fields if they are set to CONNECTIONS visibility and user is actually a connection
        if (visibility === "CONNECTIONS") return isConnection;
        return false;
      };

      // Determine what profile info to show based on privacy settings and connection status
      const photoUrl = isFieldVisible(targetUser.photoVisibility) ? targetUser.photoUrl : null;
      const bio = isFieldVisible(targetUser.bioVisibility) ? targetUser.bio : null;
      const location = isFieldVisible(targetUser.locationVisibility) ? targetUser.location : null;

      // Transform to shared events format
      const sharedEvents: SharedEvent[] = sharedEventRSVPs.map((rsvp) => {
        const isOrganizer = rsvp.event.creatorId === targetUserId ||
                           rsvp.event.eventRoles.length > 0;

        return {
          eventId: rsvp.event.id,
          eventTitle: rsvp.event.title,
          eventDate: rsvp.event.dateTime.toISOString(),
          eventLocation: rsvp.event.location,
          userRole: isOrganizer ? "ORGANIZER" : "ATTENDEE",
        };
      });

      // Apply sorting (default is by date descending - most recent first)
      sharedEvents.sort((a, b) => {
        return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
      });

      const response: ConnectionDetailResponse = {
        connection: {
          userId: targetUser.id,
          displayName: targetUser.displayName,
          photoUrl,
          bio,
          location,
          sharedEvents,
          totalSharedEvents: sharedEvents.length,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
