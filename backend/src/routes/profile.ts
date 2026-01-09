import { Router, type Response, type NextFunction } from "express";
import { prisma } from "../utils/db.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { createApiError, type AuthenticatedRequest } from "../types/index.js";
import type { ProfileVisibility } from "@prisma/client";

const router = Router();

// Valid visibility values
const VALID_VISIBILITY_VALUES: ProfileVisibility[] = ["CONNECTIONS", "ORGANIZERS_ONLY", "PRIVATE"];

/**
 * Check if a user is a "connection" of another user
 * A connection is someone who has attended the same event as YES
 */
async function areConnections(userId1: string, userId2: string): Promise<boolean> {
  // Find events where both users have RSVP'd YES
  const sharedEvents = await prisma.rSVP.findMany({
    where: {
      userId: userId1,
      response: "YES",
      event: {
        rsvps: {
          some: {
            userId: userId2,
            response: "YES",
          },
        },
      },
    },
    take: 1,
  });

  return sharedEvents.length > 0;
}

/**
 * Check if a user is an organizer of any event that the target user has RSVP'd to
 */
async function isOrganizerForUser(organizerId: string, targetUserId: string): Promise<boolean> {
  // Find events where organizerId is an organizer AND targetUserId has RSVP'd
  const count = await prisma.eventRole.count({
    where: {
      userId: organizerId,
      role: "ORGANIZER",
      event: {
        rsvps: {
          some: {
            userId: targetUserId,
          },
        },
      },
    },
  });

  return count > 0;
}

/**
 * GET /api/profile
 * Get current user's full profile
 */
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      res.status(200).json({
        profile: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          displayName: user.displayName,
          photoUrl: user.photoUrl,
          bio: user.bio,
          location: user.location,
          photoVisibility: user.photoVisibility,
          bioVisibility: user.bioVisibility,
          locationVisibility: user.locationVisibility,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/profile
 * Update current user's profile
 */
router.patch(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      const {
        displayName,
        photoUrl,
        bio,
        location,
        photoVisibility,
        bioVisibility,
        locationVisibility,
      } = req.body;

      // Build update data object
      const updateData: Record<string, unknown> = {};

      // Validate and set display name
      if (displayName !== undefined) {
        if (typeof displayName !== "string" || displayName.trim().length === 0) {
          throw createApiError("Display name cannot be empty", 400, "INVALID_DISPLAY_NAME");
        }
        if (displayName.length > 100) {
          throw createApiError("Display name must be 100 characters or less", 400, "DISPLAY_NAME_TOO_LONG");
        }
        updateData.displayName = displayName.trim();
      }

      // Validate and set photo URL
      if (photoUrl !== undefined) {
        if (photoUrl !== null && typeof photoUrl !== "string") {
          throw createApiError("Photo URL must be a string or null", 400, "INVALID_PHOTO_URL");
        }
        updateData.photoUrl = photoUrl;
      }

      // Validate and set bio
      if (bio !== undefined) {
        if (bio !== null && typeof bio !== "string") {
          throw createApiError("Bio must be a string or null", 400, "INVALID_BIO");
        }
        if (bio && bio.length > 500) {
          throw createApiError("Bio must be 500 characters or less", 400, "BIO_TOO_LONG");
        }
        updateData.bio = bio;
      }

      // Validate and set location
      if (location !== undefined) {
        if (location !== null && typeof location !== "string") {
          throw createApiError("Location must be a string or null", 400, "INVALID_LOCATION");
        }
        updateData.location = location;
      }

      // Validate and set visibility settings
      if (photoVisibility !== undefined) {
        if (!VALID_VISIBILITY_VALUES.includes(photoVisibility)) {
          throw createApiError(
            `Photo visibility must be one of: ${VALID_VISIBILITY_VALUES.join(", ")}`,
            400,
            "INVALID_PHOTO_VISIBILITY"
          );
        }
        updateData.photoVisibility = photoVisibility;
      }

      if (bioVisibility !== undefined) {
        if (!VALID_VISIBILITY_VALUES.includes(bioVisibility)) {
          throw createApiError(
            `Bio visibility must be one of: ${VALID_VISIBILITY_VALUES.join(", ")}`,
            400,
            "INVALID_BIO_VISIBILITY"
          );
        }
        updateData.bioVisibility = bioVisibility;
      }

      if (locationVisibility !== undefined) {
        if (!VALID_VISIBILITY_VALUES.includes(locationVisibility)) {
          throw createApiError(
            `Location visibility must be one of: ${VALID_VISIBILITY_VALUES.join(", ")}`,
            400,
            "INVALID_LOCATION_VISIBILITY"
          );
        }
        updateData.locationVisibility = locationVisibility;
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      res.status(200).json({
        profile: {
          id: updatedUser.id,
          phone: updatedUser.phone,
          email: updatedUser.email,
          displayName: updatedUser.displayName,
          photoUrl: updatedUser.photoUrl,
          bio: updatedUser.bio,
          location: updatedUser.location,
          photoVisibility: updatedUser.photoVisibility,
          bioVisibility: updatedUser.bioVisibility,
          locationVisibility: updatedUser.locationVisibility,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/:id
 * View another user's public profile with visibility filtering
 */
router.get(
  "/users/:id",
  optionalAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.params.id;
      const viewerId = req.user?.id;

      // Fetch target user
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      // Determine relationship between viewer and target
      let isConnection = false;
      let isOrganizer = false;
      let isSelf = false;

      if (viewerId) {
        isSelf = viewerId === targetUserId;

        if (!isSelf) {
          // Check if they are connections (attended same event)
          isConnection = await areConnections(viewerId, targetUserId);

          // Check if viewer is an organizer for any event the target is attending
          isOrganizer = await isOrganizerForUser(viewerId, targetUserId);
        }
      }

      // Helper to check if a field should be visible
      const isFieldVisible = (visibility: ProfileVisibility): boolean => {
        if (isSelf) return true;
        if (visibility === "PRIVATE") return false;
        if (visibility === "ORGANIZERS_ONLY") return isOrganizer;
        if (visibility === "CONNECTIONS") return isConnection || isOrganizer;
        return false;
      };

      // Build response with visibility filtering
      const publicProfile: Record<string, unknown> = {
        id: targetUser.id,
        displayName: targetUser.displayName,
      };

      // Add optional fields based on visibility
      if (isFieldVisible(targetUser.photoVisibility)) {
        publicProfile.photoUrl = targetUser.photoUrl;
      }

      if (isFieldVisible(targetUser.bioVisibility)) {
        publicProfile.bio = targetUser.bio;
      }

      if (isFieldVisible(targetUser.locationVisibility)) {
        publicProfile.location = targetUser.location;
      }

      // If viewing self, include all visibility settings
      if (isSelf) {
        publicProfile.phone = targetUser.phone;
        publicProfile.email = targetUser.email;
        publicProfile.photoVisibility = targetUser.photoVisibility;
        publicProfile.bioVisibility = targetUser.bioVisibility;
        publicProfile.locationVisibility = targetUser.locationVisibility;
        publicProfile.createdAt = targetUser.createdAt;
        publicProfile.updatedAt = targetUser.updatedAt;
      }

      res.status(200).json({
        user: publicProfile,
        relationship: {
          isSelf,
          isConnection,
          isOrganizer,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
