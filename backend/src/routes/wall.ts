import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { createApiError } from "../types/index.js";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Check if a user is a confirmed attendee (RSVP YES) of an event
 */
async function isConfirmedAttendee(eventId: string, userId: string): Promise<boolean> {
  const rsvp = await prisma.rSVP.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
    select: { response: true },
  });
  return rsvp?.response === "YES";
}

/**
 * Check if a user is an organizer of an event
 */
async function isEventOrganizer(eventId: string, userId: string): Promise<boolean> {
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
 * Format a wall post for API response
 */
function formatWallPost(post: {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    displayName: string;
    photoUrl: string | null;
  };
}, organizerIds: Set<string>) {
  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: {
      id: post.author.id,
      displayName: post.author.displayName,
      photoUrl: post.author.photoUrl,
      isOrganizer: organizerIds.has(post.author.id),
    },
  };
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/events/:id/wall
 * Get wall posts for an event (confirmed attendees only)
 * Returns posts in reverse chronological order (newest first)
 */
router.get(
  "/:id/wall",
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
          state: true,
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

      // Check if user can access the wall
      const isOrganizer = await isEventOrganizer(eventId, userId);
      const isAttendee = await isConfirmedAttendee(eventId, userId);

      if (!isOrganizer && !isAttendee) {
        res.json({
          canAccessWall: false,
          message: "RSVP 'Yes' to access the event wall",
          posts: null,
        });
        return;
      }

      // Get organizer IDs for badges
      const organizerIds = new Set([
        event.creatorId,
        ...event.eventRoles.map((role) => role.userId),
      ]);

      // Fetch wall posts (newest first)
      const posts = await prisma.wallPost.findMany({
        where: { eventId },
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              photoUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({
        canAccessWall: true,
        posts: posts.map((post) => formatWallPost(post, organizerIds)),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/wall
 * Create a new wall post (confirmed attendees only)
 */
router.post(
  "/:id/wall",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;
      const { content } = req.body;

      // Validate content
      if (!content || typeof content !== "string") {
        throw createApiError("Post content is required", 400, "MISSING_CONTENT");
      }

      const trimmedContent = content.trim();

      if (trimmedContent.length === 0) {
        throw createApiError("Post content cannot be empty", 400, "EMPTY_CONTENT");
      }

      if (trimmedContent.length > 2000) {
        throw createApiError(
          "Post content must be 2000 characters or less",
          400,
          "CONTENT_TOO_LONG"
        );
      }

      // Check if event exists
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          state: true,
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

      // Check if user can post to the wall
      const isOrganizer = await isEventOrganizer(eventId, userId);
      const isAttendee = await isConfirmedAttendee(eventId, userId);

      if (!isOrganizer && !isAttendee) {
        throw createApiError(
          "Only confirmed attendees can post to the event wall",
          403,
          "NOT_ATTENDEE"
        );
      }

      // Create the post
      const post = await prisma.wallPost.create({
        data: {
          eventId,
          authorId: userId,
          content: trimmedContent,
        },
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              photoUrl: true,
            },
          },
        },
      });

      // Get organizer IDs for badge
      const organizerIds = new Set([
        event.creatorId,
        ...event.eventRoles.map((role) => role.userId),
      ]);

      res.status(201).json({
        post: formatWallPost(post, organizerIds),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/events/:id/wall/:postId
 * Delete a wall post (author only)
 */
router.delete(
  "/:id/wall/:postId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const postId = req.params.postId;
      const userId = req.user!.id;

      // Check if event exists
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Get the post
      const post = await prisma.wallPost.findUnique({
        where: { id: postId },
        select: {
          id: true,
          eventId: true,
          authorId: true,
        },
      });

      if (!post) {
        throw createApiError("Post not found", 404, "POST_NOT_FOUND");
      }

      // Verify the post belongs to this event
      if (post.eventId !== eventId) {
        throw createApiError("Post not found", 404, "POST_NOT_FOUND");
      }

      // Only the author can delete their own post
      if (post.authorId !== userId) {
        throw createApiError(
          "You can only delete your own posts",
          403,
          "FORBIDDEN"
        );
      }

      // Delete the post
      await prisma.wallPost.delete({
        where: { id: postId },
      });

      res.json({
        message: "Post deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
