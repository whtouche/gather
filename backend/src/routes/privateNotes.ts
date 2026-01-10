import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// =============================================================================
// Types
// =============================================================================

interface PrivateNoteResponse {
  id: string;
  targetUserId: string;
  targetUserDisplayName: string;
  targetUserPhotoUrl: string | null;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface PrivateNotesListResponse {
  notes: PrivateNoteResponse[];
}

interface CreatePrivateNoteRequest {
  targetUserId: string;
  content: string;
  tags?: string[];
}

interface UpdatePrivateNoteRequest {
  content: string;
  tags?: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validates note content and tags
 */
function validateNoteData(content: string, tags?: string[]): string | null {
  // Validate content
  if (!content || content.trim().length === 0) {
    return "Content is required";
  }
  if (content.length > 5000) {
    return "Content must not exceed 5000 characters";
  }

  // Validate tags if provided
  if (tags) {
    if (!Array.isArray(tags)) {
      return "Tags must be an array";
    }
    if (tags.length > 5) {
      return "Maximum 5 tags allowed";
    }
    for (const tag of tags) {
      if (typeof tag !== "string") {
        return "All tags must be strings";
      }
      if (tag.length > 30) {
        return "Each tag must not exceed 30 characters";
      }
    }
  }

  return null;
}

/**
 * Checks if two users are connections (attended at least one completed event together)
 */
async function areUsersConnected(userId1: string, userId2: string): Promise<boolean> {
  // Find all completed events where userId1 RSVP'd YES
  const user1Events = await prisma.rSVP.findMany({
    where: {
      userId: userId1,
      response: "YES",
      event: {
        state: "COMPLETED",
      },
    },
    select: {
      eventId: true,
    },
  });

  if (user1Events.length === 0) {
    return false;
  }

  const user1EventIds = user1Events.map((rsvp) => rsvp.eventId);

  // Check if userId2 also RSVP'd YES to any of these events
  const sharedEvent = await prisma.rSVP.findFirst({
    where: {
      userId: userId2,
      response: "YES",
      eventId: { in: user1EventIds },
    },
  });

  return sharedEvent !== null;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/private-notes
 * Get all private notes created by the authenticated user
 *
 * Query parameters:
 * - targetUserId: Filter by specific target user (optional)
 * - search: Search in content and tags (optional, case-insensitive)
 * - sort: Sort order - "recent" (default), "oldest", "alphabetical"
 *
 * Returns:
 * - List of all private notes created by the user
 * - Each note includes target user's display name and photo
 */
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const creatorId = req.user!.id;
      const { targetUserId, search, sort } = req.query;

      // Build where clause
      const where: {
        creatorId: string;
        targetUserId?: string;
        OR?: Array<{
          content?: { contains: string; mode: "insensitive" };
          tags?: { contains: string; mode: "insensitive" };
        }>;
      } = {
        creatorId,
      };

      // Filter by target user if provided
      if (targetUserId && typeof targetUserId === "string") {
        where.targetUserId = targetUserId;
      }

      // Search in content and tags if provided
      if (search && typeof search === "string") {
        where.OR = [
          { content: { contains: search, mode: "insensitive" } },
          { tags: { contains: search, mode: "insensitive" } },
        ];
      }

      // Determine sort order
      type OrderByType = { updatedAt: "desc" } | { createdAt: "asc" } | { targetUser: { displayName: "asc" } };
      let orderBy: OrderByType = { updatedAt: "desc" }; // Default: most recently updated
      if (sort === "oldest") {
        orderBy = { createdAt: "asc" };
      } else if (sort === "alphabetical") {
        orderBy = { targetUser: { displayName: "asc" } };
      } else if (sort === "recent") {
        orderBy = { updatedAt: "desc" };
      }

      // Fetch notes
      const notes = await prisma.privateNote.findMany({
        where,
        include: {
          targetUser: {
            select: {
              id: true,
              displayName: true,
              photoUrl: true,
            },
          },
        },
        orderBy,
      });

      // Transform to response format
      const response: PrivateNotesListResponse = {
        notes: notes.map((note) => {
          let tags: string[] = [];
          if (note.tags) {
            try {
              tags = JSON.parse(note.tags);
            } catch (error) {
              console.error(`Failed to parse tags for note ${note.id}:`, error);
              tags = [];
            }
          }
          return {
            id: note.id,
            targetUserId: note.targetUserId,
            targetUserDisplayName: note.targetUser.displayName,
            targetUserPhotoUrl: note.targetUser.photoUrl,
            content: note.content,
            tags,
            createdAt: note.createdAt.toISOString(),
            updatedAt: note.updatedAt.toISOString(),
          };
        }),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/private-notes/:targetUserId
 * Get the private note for a specific connection
 *
 * Returns:
 * - The private note for the target user (if exists)
 * - 404 if no note exists for this user
 */
router.get(
  "/:targetUserId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const creatorId = req.user!.id;
      const { targetUserId } = req.params;

      // Validate target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          displayName: true,
          photoUrl: true,
        },
      });

      if (!targetUser) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Find the note
      const note = await prisma.privateNote.findUnique({
        where: {
          creatorId_targetUserId: {
            creatorId,
            targetUserId,
          },
        },
      });

      if (!note) {
        res.status(404).json({ message: "No note found for this user" });
        return;
      }

      let tags: string[] = [];
      if (note.tags) {
        try {
          tags = JSON.parse(note.tags);
        } catch (error) {
          console.error(`Failed to parse tags for note ${note.id}:`, error);
          tags = [];
        }
      }

      const response: PrivateNoteResponse = {
        id: note.id,
        targetUserId: note.targetUserId,
        targetUserDisplayName: targetUser.displayName,
        targetUserPhotoUrl: targetUser.photoUrl,
        content: note.content,
        tags,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/private-notes
 * Create a new private note for a connection
 *
 * Body:
 * - targetUserId: User ID to create note about (required)
 * - content: Note content (required, 1-5000 characters)
 * - tags: Array of tags (optional, max 5 tags, max 30 chars each)
 *
 * Returns:
 * - The created private note
 */
router.post(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const creatorId = req.user!.id;
      const { targetUserId, content, tags } = req.body as CreatePrivateNoteRequest;

      // Validate request body
      if (!targetUserId) {
        res.status(400).json({ message: "targetUserId is required" });
        return;
      }

      // Validate content and tags
      const validationError = validateNoteData(content, tags);
      if (validationError) {
        res.status(400).json({ message: validationError });
        return;
      }

      // Cannot create note about yourself
      if (targetUserId === creatorId) {
        res.status(400).json({ message: "Cannot create a note about yourself" });
        return;
      }

      // Validate target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          displayName: true,
          photoUrl: true,
        },
      });

      if (!targetUser) {
        res.status(404).json({ message: "Target user not found" });
        return;
      }

      // Check if users are connected
      // Note: Per spec REQ-SOC-010, notes can only be added about connections
      const areConnected = await areUsersConnected(creatorId, targetUserId);
      if (!areConnected) {
        res.status(403).json({
          message: "You can only create notes about users you are connected with (shared completed events)"
        });
        return;
      }

      // Check if note already exists
      const existingNote = await prisma.privateNote.findUnique({
        where: {
          creatorId_targetUserId: {
            creatorId,
            targetUserId,
          },
        },
      });

      if (existingNote) {
        res.status(400).json({
          message: "A note already exists for this user. Use PUT to update it."
        });
        return;
      }

      // Create the note
      const note = await prisma.privateNote.create({
        data: {
          creatorId,
          targetUserId,
          content: content.trim(),
          tags: tags ? JSON.stringify(tags) : null,
        },
      });

      let parsedTags: string[] = [];
      if (note.tags) {
        try {
          parsedTags = JSON.parse(note.tags);
        } catch (error) {
          console.error(`Failed to parse tags for note ${note.id}:`, error);
          parsedTags = [];
        }
      }

      const response: PrivateNoteResponse = {
        id: note.id,
        targetUserId: note.targetUserId,
        targetUserDisplayName: targetUser.displayName,
        targetUserPhotoUrl: targetUser.photoUrl,
        content: note.content,
        tags: parsedTags,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/private-notes/:targetUserId
 * Update an existing private note
 *
 * Body:
 * - content: Updated note content (required, 1-5000 characters)
 * - tags: Updated array of tags (optional, max 5 tags, max 30 chars each)
 *
 * Returns:
 * - The updated private note
 */
router.put(
  "/:targetUserId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const creatorId = req.user!.id;
      const { targetUserId } = req.params;
      const { content, tags } = req.body as UpdatePrivateNoteRequest;

      // Validate content and tags
      const validationError = validateNoteData(content, tags);
      if (validationError) {
        res.status(400).json({ message: validationError });
        return;
      }

      // Find the existing note
      const existingNote = await prisma.privateNote.findUnique({
        where: {
          creatorId_targetUserId: {
            creatorId,
            targetUserId,
          },
        },
      });

      if (!existingNote) {
        res.status(404).json({ message: "Note not found" });
        return;
      }

      // Update the note
      const updatedNote = await prisma.privateNote.update({
        where: {
          creatorId_targetUserId: {
            creatorId,
            targetUserId,
          },
        },
        data: {
          content: content.trim(),
          tags: tags ? JSON.stringify(tags) : null,
        },
        include: {
          targetUser: {
            select: {
              id: true,
              displayName: true,
              photoUrl: true,
            },
          },
        },
      });

      let parsedTags: string[] = [];
      if (updatedNote.tags) {
        try {
          parsedTags = JSON.parse(updatedNote.tags);
        } catch (error) {
          console.error(`Failed to parse tags for note ${updatedNote.id}:`, error);
          parsedTags = [];
        }
      }

      const response: PrivateNoteResponse = {
        id: updatedNote.id,
        targetUserId: updatedNote.targetUserId,
        targetUserDisplayName: updatedNote.targetUser.displayName,
        targetUserPhotoUrl: updatedNote.targetUser.photoUrl,
        content: updatedNote.content,
        tags: parsedTags,
        createdAt: updatedNote.createdAt.toISOString(),
        updatedAt: updatedNote.updatedAt.toISOString(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/private-notes/:targetUserId
 * Delete a private note
 *
 * Returns:
 * - 204 No Content on success
 */
router.delete(
  "/:targetUserId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const creatorId = req.user!.id;
      const { targetUserId } = req.params;

      // Find the note to ensure it exists and belongs to the user
      const note = await prisma.privateNote.findUnique({
        where: {
          creatorId_targetUserId: {
            creatorId,
            targetUserId,
          },
        },
      });

      if (!note) {
        res.status(404).json({ message: "Note not found" });
        return;
      }

      // Delete the note
      await prisma.privateNote.delete({
        where: {
          creatorId_targetUserId: {
            creatorId,
            targetUserId,
          },
        },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
