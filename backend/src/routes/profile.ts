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
          isProfileHidden: user.isProfileHidden,
          emailNotifications: user.emailNotifications,
          smsNotifications: user.smsNotifications,
          wallActivityNotifications: user.wallActivityNotifications,
          connectionEventNotifications: user.connectionEventNotifications,
          isActive: user.isActive,
          deletionScheduledAt: user.deletionScheduledAt,
          deletionExecutionAt: user.deletionExecutionAt,
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
        isProfileHidden,
        emailNotifications,
        smsNotifications,
        wallActivityNotifications,
        connectionEventNotifications,
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

      // Validate and set advanced privacy option
      if (isProfileHidden !== undefined) {
        if (typeof isProfileHidden !== "boolean") {
          throw createApiError("isProfileHidden must be a boolean", 400, "INVALID_PROFILE_HIDDEN");
        }
        updateData.isProfileHidden = isProfileHidden;
      }

      // Validate and set notification preferences
      if (emailNotifications !== undefined) {
        if (typeof emailNotifications !== "boolean") {
          throw createApiError("Email notifications must be a boolean", 400, "INVALID_EMAIL_NOTIFICATIONS");
        }
        updateData.emailNotifications = emailNotifications;
      }

      if (smsNotifications !== undefined) {
        if (typeof smsNotifications !== "boolean") {
          throw createApiError("SMS notifications must be a boolean", 400, "INVALID_SMS_NOTIFICATIONS");
        }
        updateData.smsNotifications = smsNotifications;
      }

      if (wallActivityNotifications !== undefined) {
        if (typeof wallActivityNotifications !== "boolean") {
          throw createApiError("Wall activity notifications must be a boolean", 400, "INVALID_WALL_NOTIFICATIONS");
        }
        updateData.wallActivityNotifications = wallActivityNotifications;
      }

      if (connectionEventNotifications !== undefined) {
        if (typeof connectionEventNotifications !== "boolean") {
          throw createApiError("Connection event notifications must be a boolean", 400, "INVALID_CONNECTION_NOTIFICATIONS");
        }
        updateData.connectionEventNotifications = connectionEventNotifications;
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
          isProfileHidden: updatedUser.isProfileHidden,
          emailNotifications: updatedUser.emailNotifications,
          smsNotifications: updatedUser.smsNotifications,
          wallActivityNotifications: updatedUser.wallActivityNotifications,
          connectionEventNotifications: updatedUser.connectionEventNotifications,
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

      // Check if profile is fully hidden (overrides all field-level settings)
      // When hidden: only display name is visible, still appears in attendee lists, notes can still be added
      const isProfileFullyHidden = targetUser.isProfileHidden && !isSelf;

      if (!isProfileFullyHidden) {
        // Add optional fields based on granular visibility settings
        if (isFieldVisible(targetUser.photoVisibility)) {
          publicProfile.photoUrl = targetUser.photoUrl;
        }

        if (isFieldVisible(targetUser.bioVisibility)) {
          publicProfile.bio = targetUser.bio;
        }

        if (isFieldVisible(targetUser.locationVisibility)) {
          publicProfile.location = targetUser.location;
        }
      }

      // If viewing self, include all visibility settings
      if (isSelf) {
        publicProfile.phone = targetUser.phone;
        publicProfile.email = targetUser.email;
        publicProfile.photoVisibility = targetUser.photoVisibility;
        publicProfile.bioVisibility = targetUser.bioVisibility;
        publicProfile.locationVisibility = targetUser.locationVisibility;
        publicProfile.isProfileHidden = targetUser.isProfileHidden;
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

/**
 * GET /api/profile/events/:eventId/notifications
 * Get notification settings for a specific event
 */
router.get(
  "/events/:eventId/notifications",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const { eventId } = req.params;

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      // Verify user is an attendee of the event (has RSVP'd)
      const rsvp = await prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId: user.id,
          },
        },
      });

      if (!rsvp) {
        throw createApiError("Not an attendee of this event", 403, "NOT_ATTENDEE");
      }

      // Get or create event notification settings
      let settings = await prisma.eventNotificationSetting.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId: user.id,
          },
        },
      });

      // If no settings exist, return defaults
      if (!settings) {
        settings = {
          id: "",
          eventId,
          userId: user.id,
          muteAll: false,
          muteWallOnly: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      res.status(200).json({
        settings: {
          eventId: settings.eventId,
          muteAll: settings.muteAll,
          muteWallOnly: settings.muteWallOnly,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/profile/events/:eventId/notifications
 * Update notification settings for a specific event
 */
router.patch(
  "/events/:eventId/notifications",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const { eventId } = req.params;
      const { muteAll, muteWallOnly } = req.body;

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      // Verify user is an attendee of the event (has RSVP'd)
      const rsvp = await prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId: user.id,
          },
        },
      });

      if (!rsvp) {
        throw createApiError("Not an attendee of this event", 403, "NOT_ATTENDEE");
      }

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (muteAll !== undefined) {
        if (typeof muteAll !== "boolean") {
          throw createApiError("muteAll must be a boolean", 400, "INVALID_MUTE_ALL");
        }
        updateData.muteAll = muteAll;
      }

      if (muteWallOnly !== undefined) {
        if (typeof muteWallOnly !== "boolean") {
          throw createApiError("muteWallOnly must be a boolean", 400, "INVALID_MUTE_WALL_ONLY");
        }
        updateData.muteWallOnly = muteWallOnly;
      }

      // Upsert event notification settings
      const settings = await prisma.eventNotificationSetting.upsert({
        where: {
          eventId_userId: {
            eventId,
            userId: user.id,
          },
        },
        update: updateData,
        create: {
          eventId,
          userId: user.id,
          muteAll: muteAll ?? false,
          muteWallOnly: muteWallOnly ?? false,
        },
      });

      res.status(200).json({
        settings: {
          eventId: settings.eventId,
          muteAll: settings.muteAll,
          muteWallOnly: settings.muteWallOnly,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/profile/deactivate
 * Deactivate the user's account temporarily
 */
router.post(
  "/deactivate",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      if (!user.isActive) {
        throw createApiError("Account is already deactivated", 400, "ALREADY_DEACTIVATED");
      }

      // Deactivate account
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      res.status(200).json({
        message: "Account deactivated successfully. You can reactivate by logging in again.",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/profile/reactivate
 * Reactivate a deactivated account
 */
router.post(
  "/reactivate",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      if (user.isActive) {
        throw createApiError("Account is already active", 400, "ALREADY_ACTIVE");
      }

      // Reactivate account
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      });

      res.status(200).json({
        message: "Account reactivated successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/profile/delete-request
 * Request permanent account deletion with 14-day grace period
 */
router.post(
  "/delete-request",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      if (user.deletionScheduledAt) {
        throw createApiError("Account deletion already requested", 400, "DELETION_ALREADY_REQUESTED");
      }

      // Schedule deletion for 14 days from now
      const deletionScheduledAt = new Date();
      const deletionExecutionAt = new Date();
      deletionExecutionAt.setDate(deletionExecutionAt.getDate() + 14);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          deletionScheduledAt,
          deletionExecutionAt,
        },
      });

      // TODO: Send confirmation email/SMS

      res.status(200).json({
        message: "Account deletion scheduled. You have 14 days to cancel by logging in.",
        deletionScheduledAt,
        deletionExecutionAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/profile/cancel-deletion
 * Cancel a pending account deletion request
 */
router.post(
  "/cancel-deletion",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      if (!user.deletionScheduledAt) {
        throw createApiError("No deletion request found", 400, "NO_DELETION_REQUEST");
      }

      // Cancel deletion
      await prisma.user.update({
        where: { id: user.id },
        data: {
          deletionScheduledAt: null,
          deletionExecutionAt: null,
        },
      });

      res.status(200).json({
        message: "Account deletion cancelled successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/profile/export
 * Request a data export (queued for processing)
 */
router.post(
  "/export",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      // Check for existing pending or processing export
      const existingExport = await prisma.dataExport.findFirst({
        where: {
          userId: user.id,
          status: {
            in: ["PENDING", "PROCESSING"],
          },
        },
      });

      if (existingExport) {
        throw createApiError(
          "A data export is already in progress",
          400,
          "EXPORT_IN_PROGRESS"
        );
      }

      // Create new export request
      const dataExport = await prisma.dataExport.create({
        data: {
          userId: user.id,
          status: "PENDING",
        },
      });

      // TODO: Queue background job to process export

      res.status(200).json({
        message: "Data export requested. You will be notified when it's ready.",
        exportId: dataExport.id,
        status: dataExport.status,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/profile/exports
 * Get list of all data exports for the user
 */
router.get(
  "/exports",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      const exports = await prisma.dataExport.findMany({
        where: { userId: user.id },
        orderBy: { requestedAt: "desc" },
        take: 10, // Limit to most recent 10
      });

      res.status(200).json({
        exports: exports.map((exp) => ({
          id: exp.id,
          status: exp.status,
          requestedAt: exp.requestedAt,
          completedAt: exp.completedAt,
          fileUrl: exp.status === "COMPLETED" ? exp.fileUrl : null,
          expiresAt: exp.status === "COMPLETED" ? exp.expiresAt : null,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/profile/exports/:exportId
 * Get details of a specific export, including download URL if ready
 */
router.get(
  "/exports/:exportId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const { exportId } = req.params;

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      const dataExport = await prisma.dataExport.findFirst({
        where: {
          id: exportId,
          userId: user.id,
        },
      });

      if (!dataExport) {
        throw createApiError("Export not found", 404, "EXPORT_NOT_FOUND");
      }

      res.status(200).json({
        export: {
          id: dataExport.id,
          status: dataExport.status,
          requestedAt: dataExport.requestedAt,
          completedAt: dataExport.completedAt,
          fileUrl: dataExport.status === "COMPLETED" ? dataExport.fileUrl : null,
          expiresAt: dataExport.status === "COMPLETED" ? dataExport.expiresAt : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
