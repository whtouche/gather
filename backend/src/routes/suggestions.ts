import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// =============================================================================
// Types
// =============================================================================

interface SuggestedUser {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  relevanceScore: number;
  reason: string;
  sharedEventCount: number;
  lastSharedEventDate: string | null;
}

interface SuggestionsResponse {
  suggestions: SuggestedUser[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate relevance score for a suggested user
 *
 * Factors:
 * - Similar events attended: +10 points per similar event
 * - Recent interaction: +5 points if within last 30 days, +2 if within 90 days
 * - Frequency: +1 point per shared event
 */
function calculateRelevanceScore(
  similarEventCount: number,
  sharedEventCount: number,
  lastSharedEventDate: Date | null
): number {
  let score = 0;

  // Similar events weight heavily
  score += similarEventCount * 10;

  // Shared event frequency
  score += sharedEventCount;

  // Recency bonus
  if (lastSharedEventDate) {
    const daysSinceLastEvent = (Date.now() - lastSharedEventDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastEvent <= 30) {
      score += 5;
    } else if (daysSinceLastEvent <= 90) {
      score += 2;
    }
  }

  return score;
}

/**
 * Generate a reason for the suggestion
 */
function generateReason(
  similarEventCount: number,
  sharedEventCount: number,
  lastSharedEventDate: Date | null
): string {
  if (similarEventCount > 0 && sharedEventCount > 0) {
    return `Attended ${similarEventCount} similar event${similarEventCount > 1 ? 's' : ''} and ${sharedEventCount} total event${sharedEventCount > 1 ? 's' : ''} with you`;
  } else if (similarEventCount > 0) {
    return `Attended ${similarEventCount} similar event${similarEventCount > 1 ? 's' : ''}`;
  } else if (sharedEventCount > 0) {
    return `Attended ${sharedEventCount} event${sharedEventCount > 1 ? 's' : ''} with you`;
  }
  return "Potential connection based on event history";
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/suggestions/event/:eventId
 * Get smart suggestions for people to invite to an event
 *
 * This endpoint suggests users based on:
 * 1. Similar events they've attended (matching category, location)
 * 2. Past connections with the organizer
 * 3. Relevance ranking combining similarity and recency
 *
 * Query parameters:
 * - limit: Maximum number of suggestions to return (default: 10, max: 50)
 * - minScore: Minimum relevance score to include (default: 0)
 *
 * Returns:
 * - List of suggested users with:
 *   - User's display name and photo
 *   - Relevance score (higher = more relevant)
 *   - Reason for suggestion
 *   - Number of shared events with organizer
 *   - Date of last shared event
 * - Sorted by relevance score (highest first)
 */
router.get(
  "/event/:eventId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { eventId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const minScore = parseInt(req.query.minScore as string) || 0;

      // Verify the event exists and user is an organizer
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          eventRoles: {
            where: {
              userId,
              role: "ORGANIZER"
            },
          },
        },
      });

      if (!event) {
        res.status(404).json({ message: "Event not found" });
        return;
      }

      // Check if user is organizer (creator or has ORGANIZER role)
      const isOrganizer = event.creatorId === userId || event.eventRoles.length > 0;
      if (!isOrganizer) {
        res.status(403).json({ message: "Only organizers can view suggestions" });
        return;
      }

      // Get users who already RSVP'd or are invited to this event (to exclude them)
      const existingRSVPs = await prisma.rSVP.findMany({
        where: { eventId },
        select: { userId: true },
      });

      const invitedUsers = await prisma.emailInvitation.findMany({
        where: { eventId },
        select: { email: true },
      });

      const invitedPhones = await prisma.smsInvitation.findMany({
        where: { eventId },
        select: { phone: true },
      });

      const existingUserIds = new Set(existingRSVPs.map(r => r.userId));

      // Find users who have attended events with similar characteristics
      const similarEventWhere: {
        state: "COMPLETED";
        category?: string;
        location?: string;
      } = {
        state: "COMPLETED",
      };

      // Match by category if event has one
      if (event.category) {
        similarEventWhere.category = event.category;
      }

      // Match by location (exact match)
      if (event.location) {
        similarEventWhere.location = event.location;
      }

      // Find completed events with similar characteristics
      const similarEvents = await prisma.event.findMany({
        where: similarEventWhere,
        select: {
          id: true,
          category: true,
          location: true,
        },
        take: 100, // Limit to avoid performance issues
      });

      const similarEventIds = similarEvents.map(e => e.id);

      // Find all users who attended these similar events
      const similarEventAttendees = await prisma.rSVP.findMany({
        where: {
          eventId: { in: similarEventIds },
          response: "YES",
          userId: { not: userId }, // Exclude current user
        },
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
          event: {
            select: {
              id: true,
              category: true,
              location: true,
              dateTime: true,
            },
          },
        },
      });

      // Get all completed events the organizer attended
      const organizerEvents = await prisma.rSVP.findMany({
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
              dateTime: true,
            },
          },
        },
      });

      const organizerEventIds = organizerEvents.map(r => r.eventId);

      // Find connections (users who attended events with the organizer)
      const connections = await prisma.rSVP.findMany({
        where: {
          eventId: { in: organizerEventIds },
          response: "YES",
          userId: { not: userId },
        },
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
          event: {
            select: {
              dateTime: true,
            },
          },
        },
      });

      // Build a map of user suggestions
      const suggestionMap = new Map<string, {
        user: {
          id: string;
          displayName: string;
          photoUrl: string | null;
          email: string | null;
          phone: string | null;
        };
        similarEventCount: number;
        sharedEventCount: number;
        lastSharedEventDate: Date | null;
      }>();

      // Process similar event attendees
      for (const rsvp of similarEventAttendees) {
        const existing = suggestionMap.get(rsvp.userId);
        if (existing) {
          existing.similarEventCount++;
        } else {
          suggestionMap.set(rsvp.userId, {
            user: rsvp.user,
            similarEventCount: 1,
            sharedEventCount: 0,
            lastSharedEventDate: null,
          });
        }
      }

      // Process connections to add shared event data
      for (const rsvp of connections) {
        const existing = suggestionMap.get(rsvp.userId);
        if (existing) {
          existing.sharedEventCount++;
          if (!existing.lastSharedEventDate ||
              rsvp.event.dateTime > existing.lastSharedEventDate) {
            existing.lastSharedEventDate = rsvp.event.dateTime;
          }
        } else {
          suggestionMap.set(rsvp.userId, {
            user: rsvp.user,
            similarEventCount: 0,
            sharedEventCount: 1,
            lastSharedEventDate: rsvp.event.dateTime,
          });
        }
      }

      // Filter out users who are already involved with the event
      const invitedEmails = new Set(invitedUsers.map(i => i.email));
      const invitedPhoneNumbers = new Set(invitedPhones.map(i => i.phone));

      const filteredSuggestions = Array.from(suggestionMap.entries()).filter(([userId, data]) => {
        // Exclude if already RSVP'd
        if (existingUserIds.has(userId)) return false;

        // Exclude if already invited by email or phone
        if (data.user.email && invitedEmails.has(data.user.email)) return false;
        if (data.user.phone && invitedPhoneNumbers.has(data.user.phone)) return false;

        return true;
      });

      // Calculate relevance scores and transform to response format
      const suggestions: SuggestedUser[] = filteredSuggestions
        .map(([userId, data]) => {
          const score = calculateRelevanceScore(
            data.similarEventCount,
            data.sharedEventCount,
            data.lastSharedEventDate
          );

          return {
            userId: data.user.id,
            displayName: data.user.displayName,
            photoUrl: data.user.photoUrl,
            relevanceScore: score,
            reason: generateReason(
              data.similarEventCount,
              data.sharedEventCount,
              data.lastSharedEventDate
            ),
            sharedEventCount: data.sharedEventCount,
            lastSharedEventDate: data.lastSharedEventDate?.toISOString() || null,
          };
        })
        .filter(s => s.relevanceScore >= minScore)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      const response: SuggestionsResponse = {
        suggestions,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/suggestions/connections
 * Get smart suggestions for new connections based on event similarity
 *
 * This endpoint suggests users the current user might want to connect with
 * based on attending similar types of events, even if they haven't attended
 * the same specific events yet.
 *
 * Query parameters:
 * - limit: Maximum number of suggestions to return (default: 10, max: 50)
 * - minScore: Minimum relevance score to include (default: 5)
 *
 * Returns:
 * - List of suggested users sorted by relevance
 */
router.get(
  "/connections",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const minScore = parseInt(req.query.minScore as string) || 5;

      // Get user's completed events
      const userEvents = await prisma.rSVP.findMany({
        where: {
          userId,
          response: "YES",
          event: {
            state: "COMPLETED",
          },
        },
        include: {
          event: {
            select: {
              id: true,
              category: true,
              location: true,
              dateTime: true,
            },
          },
        },
      });

      if (userEvents.length === 0) {
        res.json({ suggestions: [] });
        return;
      }

      // Extract categories and locations from user's events
      const categories = new Set(
        userEvents
          .map(r => r.event.category)
          .filter((c): c is string => c !== null)
      );

      const locations = new Set(
        userEvents
          .map(r => r.event.location)
          .filter((l): l is string => l !== null && l !== "")
      );

      const userEventIds = userEvents.map(r => r.eventId);

      // Get existing connections (users who attended same events)
      const existingConnections = await prisma.rSVP.findMany({
        where: {
          eventId: { in: userEventIds },
          response: "YES",
          userId: { not: userId },
        },
        select: {
          userId: true,
        },
      });

      const existingConnectionIds = new Set(existingConnections.map(r => r.userId));

      // Find events with similar characteristics (category or location match)
      const similarEvents = await prisma.event.findMany({
        where: {
          state: "COMPLETED",
          OR: [
            { category: { in: Array.from(categories) } },
            { location: { in: Array.from(locations) } },
          ],
          id: { notIn: userEventIds }, // Events user hasn't attended
        },
        select: {
          id: true,
          category: true,
          location: true,
          dateTime: true,
        },
        take: 200, // Limit to avoid performance issues
      });

      const similarEventIds = similarEvents.map(e => e.id);

      // Find users who attended these similar events
      const similarEventAttendees = await prisma.rSVP.findMany({
        where: {
          eventId: { in: similarEventIds },
          response: "YES",
          userId: {
            notIn: [userId, ...Array.from(existingConnectionIds)]
          },
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
              category: true,
              location: true,
              dateTime: true,
            },
          },
        },
      });

      // Build suggestion map
      const suggestionMap = new Map<string, {
        user: {
          id: string;
          displayName: string;
          photoUrl: string | null;
        };
        categoryMatches: number;
        locationMatches: number;
        mostRecentEventDate: Date | null;
      }>();

      for (const rsvp of similarEventAttendees) {
        const existing = suggestionMap.get(rsvp.userId);
        const categoryMatch = rsvp.event.category && categories.has(rsvp.event.category) ? 1 : 0;
        const locationMatch = rsvp.event.location && locations.has(rsvp.event.location) ? 1 : 0;

        if (existing) {
          existing.categoryMatches += categoryMatch;
          existing.locationMatches += locationMatch;
          if (!existing.mostRecentEventDate ||
              rsvp.event.dateTime > existing.mostRecentEventDate) {
            existing.mostRecentEventDate = rsvp.event.dateTime;
          }
        } else {
          suggestionMap.set(rsvp.userId, {
            user: rsvp.user,
            categoryMatches: categoryMatch,
            locationMatches: locationMatch,
            mostRecentEventDate: rsvp.event.dateTime,
          });
        }
      }

      // Calculate scores and transform to response format
      const suggestions: SuggestedUser[] = Array.from(suggestionMap.values())
        .map(data => {
          // Score: category matches worth more than location matches
          const score = data.categoryMatches * 8 + data.locationMatches * 3;

          // Add recency bonus
          let recencyBonus = 0;
          if (data.mostRecentEventDate) {
            const daysSince = (Date.now() - data.mostRecentEventDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince <= 30) recencyBonus = 3;
            else if (daysSince <= 90) recencyBonus = 1;
          }

          const totalScore = score + recencyBonus;

          // Generate reason
          let reason = "";
          if (data.categoryMatches > 0 && data.locationMatches > 0) {
            reason = `Attended ${data.categoryMatches + data.locationMatches} event${data.categoryMatches + data.locationMatches > 1 ? 's' : ''} with similar interests and locations`;
          } else if (data.categoryMatches > 0) {
            reason = `Attended ${data.categoryMatches} event${data.categoryMatches > 1 ? 's' : ''} with similar interests`;
          } else if (data.locationMatches > 0) {
            reason = `Attended ${data.locationMatches} event${data.locationMatches > 1 ? 's' : ''} in similar locations`;
          } else {
            reason = "Potential connection based on event patterns";
          }

          return {
            userId: data.user.id,
            displayName: data.user.displayName,
            photoUrl: data.user.photoUrl,
            relevanceScore: totalScore,
            reason,
            sharedEventCount: 0, // Not existing connections
            lastSharedEventDate: null,
          };
        })
        .filter(s => s.relevanceScore >= minScore)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      const response: SuggestionsResponse = {
        suggestions,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
