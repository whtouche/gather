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

interface WallPostData {
  id: string;
  content: string;
  depth: number;
  parentId: string | null;
  isPinned: boolean;
  pinnedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    displayName: string;
    photoUrl: string | null;
  };
  reactions: Array<{
    id: string;
    userId: string;
    type: string;
  }>;
  replies?: WallPostData[];
  _count?: {
    replies: number;
  };
}

interface FormattedReply {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
    photoUrl: string | null;
    isOrganizer: boolean;
  };
  reactionCount: number;
  userHasReacted: boolean;
  replies?: FormattedReply[];
  replyCount?: number;
}

interface FormattedPost {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  pinnedAt: string | null;
  author: {
    id: string;
    displayName: string;
    photoUrl: string | null;
    isOrganizer: boolean;
  };
  reactionCount: number;
  userHasReacted: boolean;
  replyCount: number;
  replies: FormattedReply[];
}

/**
 * Format a wall post for API response
 */
function formatWallPost(
  post: WallPostData,
  organizerIds: Set<string>,
  currentUserId: string
): FormattedPost | FormattedReply {
  const userHasReacted = post.reactions.some((r) => r.userId === currentUserId);

  // Base formatted post/reply
  const formatted: FormattedPost | FormattedReply = {
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
    reactionCount: post.reactions.length,
    userHasReacted,
    replyCount: post._count?.replies ?? 0,
    replies: [],
  };

  // Add pinning info for top-level posts
  if (post.depth === 0) {
    (formatted as FormattedPost).isPinned = post.isPinned;
    (formatted as FormattedPost).pinnedAt = post.pinnedAt?.toISOString() ?? null;
  }

  // Format nested replies if they exist
  if (post.replies && post.replies.length > 0) {
    formatted.replies = post.replies.map((reply) =>
      formatWallPost(reply, organizerIds, currentUserId) as FormattedReply
    );
  }

  return formatted;
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

      // Fetch top-level wall posts with reactions and nested replies
      // Order: pinned posts first (by pin time desc), then by creation time desc
      const posts = await prisma.wallPost.findMany({
        where: {
          eventId,
          parentId: null, // Only top-level posts
        },
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              photoUrl: true,
            },
          },
          reactions: {
            select: {
              id: true,
              userId: true,
              type: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
          // First level replies
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              author: {
                select: {
                  id: true,
                  displayName: true,
                  photoUrl: true,
                },
              },
              reactions: {
                select: {
                  id: true,
                  userId: true,
                  type: true,
                },
              },
              _count: {
                select: {
                  replies: true,
                },
              },
              // Second level replies (max depth)
              replies: {
                orderBy: { createdAt: "asc" },
                include: {
                  author: {
                    select: {
                      id: true,
                      displayName: true,
                      photoUrl: true,
                    },
                  },
                  reactions: {
                    select: {
                      id: true,
                      userId: true,
                      type: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { isPinned: "desc" }, // Pinned posts first
          { pinnedAt: "desc" }, // Among pinned, most recently pinned first
          { createdAt: "desc" }, // Among non-pinned, newest first
        ],
      });

      res.json({
        canAccessWall: true,
        posts: posts.map((post) => formatWallPost(post as WallPostData, organizerIds, userId)),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/wall
 * Create a new wall post or reply (confirmed attendees only)
 */
router.post(
  "/:id/wall",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;
      const { content, parentId } = req.body;

      // Validate content
      if (!content || typeof content !== "string") {
        throw createApiError("Post content is required", 400, "MISSING_CONTENT");
      }

      const trimmedContent = content.trim();

      if (trimmedContent.length === 0) {
        throw createApiError("Post content cannot be empty", 400, "EMPTY_CONTENT");
      }

      // Different max length for replies vs posts
      const maxLength = parentId ? 1000 : 2000;
      if (trimmedContent.length > maxLength) {
        throw createApiError(
          `Content must be ${maxLength} characters or less`,
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

      // If this is a reply, validate the parent post
      let depth = 0;
      let effectiveParentId = parentId;

      if (parentId) {
        const parentPost = await prisma.wallPost.findUnique({
          where: { id: parentId },
          select: {
            id: true,
            eventId: true,
            depth: true,
            parentId: true,
          },
        });

        if (!parentPost) {
          throw createApiError("Parent post not found", 404, "PARENT_NOT_FOUND");
        }

        if (parentPost.eventId !== eventId) {
          throw createApiError("Parent post not found", 404, "PARENT_NOT_FOUND");
        }

        // Max depth is 2. If parent is at depth 2, reply to its parent instead
        if (parentPost.depth >= 2) {
          // Reply goes to the parent of the depth-2 post (at depth 1)
          effectiveParentId = parentPost.parentId;
          depth = 2;
        } else {
          depth = parentPost.depth + 1;
        }
      }

      // Create the post/reply
      const post = await prisma.wallPost.create({
        data: {
          eventId,
          authorId: userId,
          content: trimmedContent,
          parentId: effectiveParentId || null,
          depth,
        },
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              photoUrl: true,
            },
          },
          reactions: {
            select: {
              id: true,
              userId: true,
              type: true,
            },
          },
          _count: {
            select: {
              replies: true,
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
        post: formatWallPost(post as WallPostData, organizerIds, userId),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/events/:id/wall/:postId
 * Delete a wall post (author or organizer)
 * Organizer deletions create a moderation log entry and notify the author
 */
router.delete(
  "/:id/wall/:postId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const postId = req.params.postId;
      const userId = req.user!.id;

      // Check if event exists and get event title
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, title: true },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Get the post with content for moderation log
      const post = await prisma.wallPost.findUnique({
        where: { id: postId },
        select: {
          id: true,
          eventId: true,
          authorId: true,
          content: true,
        },
      });

      if (!post) {
        throw createApiError("Post not found", 404, "POST_NOT_FOUND");
      }

      // Verify the post belongs to this event
      if (post.eventId !== eventId) {
        throw createApiError("Post not found", 404, "POST_NOT_FOUND");
      }

      const isAuthor = post.authorId === userId;
      const isOrganizer = await isEventOrganizer(eventId, userId);

      // Must be either the author or an organizer
      if (!isAuthor && !isOrganizer) {
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

      // If an organizer deleted someone else's post, create moderation log and notify author
      if (isOrganizer && !isAuthor) {
        // Create moderation log entry
        await prisma.moderationLog.create({
          data: {
            eventId,
            moderatorId: userId,
            action: "DELETE",
            targetPostId: postId,
            postContent: post.content,
            postAuthorId: post.authorId,
          },
        });

        // Notify the post author
        await prisma.notification.create({
          data: {
            userId: post.authorId,
            eventId,
            type: "POST_DELETED_BY_MODERATOR",
            message: `Your post on "${event.title}" was removed by an organizer`,
          },
        });
      }

      res.json({
        message: "Post deleted successfully",
        moderatorDeleted: isOrganizer && !isAuthor,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/wall/:postId/reactions
 * Add a reaction to a post (confirmed attendees only)
 */
router.post(
  "/:id/wall/:postId/reactions",
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

      // Check if user can react (must be confirmed attendee or organizer)
      const isOrganizer = await isEventOrganizer(eventId, userId);
      const isAttendee = await isConfirmedAttendee(eventId, userId);

      if (!isOrganizer && !isAttendee) {
        throw createApiError(
          "Only confirmed attendees can react to posts",
          403,
          "NOT_ATTENDEE"
        );
      }

      // Get the post and verify it belongs to this event
      const post = await prisma.wallPost.findUnique({
        where: { id: postId },
        select: {
          id: true,
          eventId: true,
        },
      });

      if (!post) {
        throw createApiError("Post not found", 404, "POST_NOT_FOUND");
      }

      if (post.eventId !== eventId) {
        throw createApiError("Post not found", 404, "POST_NOT_FOUND");
      }

      // Check if user already reacted
      const existingReaction = await prisma.wallReaction.findUnique({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });

      if (existingReaction) {
        throw createApiError("You have already reacted to this post", 400, "ALREADY_REACTED");
      }

      // Create the reaction
      const reaction = await prisma.wallReaction.create({
        data: {
          postId,
          userId,
          type: "HEART",
        },
      });

      // Get updated reaction count
      const reactionCount = await prisma.wallReaction.count({
        where: { postId },
      });

      res.status(201).json({
        reaction: {
          id: reaction.id,
          type: reaction.type,
          createdAt: reaction.createdAt.toISOString(),
        },
        reactionCount,
        userHasReacted: true,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/events/:id/wall/:postId/reactions
 * Remove own reaction from a post (confirmed attendees only)
 */
router.delete(
  "/:id/wall/:postId/reactions",
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

      // Get the post and verify it belongs to this event
      const post = await prisma.wallPost.findUnique({
        where: { id: postId },
        select: {
          id: true,
          eventId: true,
        },
      });

      if (!post) {
        throw createApiError("Post not found", 404, "POST_NOT_FOUND");
      }

      if (post.eventId !== eventId) {
        throw createApiError("Post not found", 404, "POST_NOT_FOUND");
      }

      // Find and delete the user's reaction
      const existingReaction = await prisma.wallReaction.findUnique({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });

      if (!existingReaction) {
        throw createApiError("You have not reacted to this post", 404, "REACTION_NOT_FOUND");
      }

      await prisma.wallReaction.delete({
        where: { id: existingReaction.id },
      });

      // Get updated reaction count
      const reactionCount = await prisma.wallReaction.count({
        where: { postId },
      });

      res.json({
        message: "Reaction removed",
        reactionCount,
        userHasReacted: false,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/wall/:postId/pin
 * Pin a wall post to the top (organizers only)
 */
router.post(
  "/:id/wall/:postId/pin",
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

      // Check if user is an organizer
      const isOrganizer = await isEventOrganizer(eventId, userId);
      if (!isOrganizer) {
        throw createApiError("Only organizers can pin posts", 403, "FORBIDDEN");
      }

      // Get the post
      const post = await prisma.wallPost.findUnique({
        where: { id: postId },
        select: {
          id: true,
          eventId: true,
          depth: true,
          isPinned: true,
        },
      });

      if (!post) {
        throw createApiError("Post not found", 404, "POST_NOT_FOUND");
      }

      // Verify the post belongs to this event
      if (post.eventId !== eventId) {
        throw createApiError("Post not found", 404, "POST_NOT_FOUND");
      }

      // Only top-level posts can be pinned
      if (post.depth !== 0) {
        throw createApiError("Only top-level posts can be pinned", 400, "CANNOT_PIN_REPLY");
      }

      // Check if already pinned
      if (post.isPinned) {
        throw createApiError("Post is already pinned", 400, "ALREADY_PINNED");
      }

      // Pin the post
      const updatedPost = await prisma.wallPost.update({
        where: { id: postId },
        data: {
          isPinned: true,
          pinnedAt: new Date(),
        },
      });

      // Create moderation log entry
      await prisma.moderationLog.create({
        data: {
          eventId,
          moderatorId: userId,
          action: "PIN",
          targetPostId: postId,
        },
      });

      res.json({
        message: "Post pinned successfully",
        isPinned: updatedPost.isPinned,
        pinnedAt: updatedPost.pinnedAt?.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/events/:id/wall/:postId/pin
 * Unpin a wall post (organizers only)
 */
router.delete(
  "/:id/wall/:postId/pin",
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

      // Check if user is an organizer
      const isOrganizer = await isEventOrganizer(eventId, userId);
      if (!isOrganizer) {
        throw createApiError("Only organizers can unpin posts", 403, "FORBIDDEN");
      }

      // Get the post
      const post = await prisma.wallPost.findUnique({
        where: { id: postId },
        select: {
          id: true,
          eventId: true,
          isPinned: true,
        },
      });

      if (!post) {
        throw createApiError("Post not found", 404, "POST_NOT_FOUND");
      }

      // Verify the post belongs to this event
      if (post.eventId !== eventId) {
        throw createApiError("Post not found", 404, "POST_NOT_FOUND");
      }

      // Check if it's pinned
      if (!post.isPinned) {
        throw createApiError("Post is not pinned", 400, "NOT_PINNED");
      }

      // Unpin the post
      await prisma.wallPost.update({
        where: { id: postId },
        data: {
          isPinned: false,
          pinnedAt: null,
        },
      });

      // Create moderation log entry
      await prisma.moderationLog.create({
        data: {
          eventId,
          moderatorId: userId,
          action: "UNPIN",
          targetPostId: postId,
        },
      });

      res.json({
        message: "Post unpinned successfully",
        isPinned: false,
        pinnedAt: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/wall/moderation-log
 * Get moderation log for an event (organizers only)
 */
router.get(
  "/:id/wall/moderation-log",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;

      // Check if event exists
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Check if user is an organizer
      const isOrganizer = await isEventOrganizer(eventId, userId);
      if (!isOrganizer) {
        throw createApiError("Only organizers can view the moderation log", 403, "FORBIDDEN");
      }

      // Get moderation log entries
      const logs = await prisma.moderationLog.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        take: 100, // Limit to 100 most recent entries
      });

      // Get moderator and post author info
      const userIds = new Set<string>();
      logs.forEach((log) => {
        userIds.add(log.moderatorId);
        if (log.postAuthorId) {
          userIds.add(log.postAuthorId);
        }
      });

      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { id: true, displayName: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u.displayName]));

      res.json({
        logs: logs.map((log) => ({
          id: log.id,
          action: log.action,
          moderator: {
            id: log.moderatorId,
            displayName: userMap.get(log.moderatorId) || "Unknown",
          },
          targetPostId: log.targetPostId,
          postContent: log.postContent,
          postAuthor: log.postAuthorId
            ? {
                id: log.postAuthorId,
                displayName: userMap.get(log.postAuthorId) || "Unknown",
              }
            : null,
          createdAt: log.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
