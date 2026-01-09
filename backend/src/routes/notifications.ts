import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { createApiError } from "../types/index.js";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/notifications
 * Get all notifications for the authenticated user
 */
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      // Get query params for filtering
      const { unreadOnly } = req.query;

      const whereClause: { userId: string; read?: boolean } = { userId };
      if (unreadOnly === "true") {
        whereClause.read = false;
      }

      const notifications = await prisma.notification.findMany({
        where: whereClause,
        include: {
          event: {
            select: {
              id: true,
              title: true,
              state: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50, // Limit to 50 most recent notifications
      });

      // Get unread count
      const unreadCount = await prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      });

      res.json({
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          message: n.message,
          read: n.read,
          eventId: n.eventId,
          event: n.event
            ? {
                id: n.event.id,
                title: n.event.title,
                state: n.event.state,
              }
            : null,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications for the authenticated user
 */
router.get(
  "/unread-count",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const unreadCount = await prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      });

      res.json({ unreadCount });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/notifications/:id
 * Mark a notification as read
 */
router.patch(
  "/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const notificationId = req.params.id;

      // Verify the notification belongs to the user
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification) {
        throw createApiError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
      }

      if (notification.userId !== userId) {
        throw createApiError("Not authorized", 403, "FORBIDDEN");
      }

      const { read } = req.body;
      if (typeof read !== "boolean") {
        throw createApiError("read field must be a boolean", 400, "INVALID_INPUT");
      }

      const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: { read },
      });

      res.json({
        notification: {
          id: updated.id,
          type: updated.type,
          message: updated.message,
          read: updated.read,
          eventId: updated.eventId,
          createdAt: updated.createdAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for the authenticated user
 */
router.post(
  "/mark-all-read",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      await prisma.notification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: { read: true },
      });

      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete(
  "/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const notificationId = req.params.id;

      // Verify the notification belongs to the user
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification) {
        throw createApiError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
      }

      if (notification.userId !== userId) {
        throw createApiError("Not authorized", 403, "FORBIDDEN");
      }

      await prisma.notification.delete({
        where: { id: notificationId },
      });

      res.json({ message: "Notification deleted" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
