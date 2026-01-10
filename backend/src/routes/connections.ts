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
 * Returns:
 * - List of connections with:
 *   - User's display name
 *   - Profile photo (if set)
 *   - Number of shared events
 *   - Most recent shared event name and date
 * - Sorted by most recent event together (default)
 */
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      // Find all completed events where the user RSVP'd YES
      const userCompletedEvents = await prisma.rSVP.findMany({
        where: {
          userId,
          response: "YES",
          event: {
            state: "COMPLETED",
          },
        },
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

      // Find all other users who RSVP'd YES to the same events
      const otherAttendees = await prisma.rSVP.findMany({
        where: {
          eventId: { in: userEventIds },
          response: "YES",
          userId: { not: userId }, // Exclude current user
        },
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

      // Sort by most recent event date (default sorting)
      connections.sort((a, b) => {
        if (!a.mostRecentEvent) return 1;
        if (!b.mostRecentEvent) return -1;
        return new Date(b.mostRecentEvent.eventDate).getTime() -
               new Date(a.mostRecentEvent.eventDate).getTime();
      });

      const response: ConnectionsResponse = {
        connections,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
