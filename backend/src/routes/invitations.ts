import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { createApiError } from "../types/index.js";
import type { EventAuthenticatedRequest } from "../middleware/eventAuth.js";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireEventOrganizer } from "../middleware/eventAuth.js";
import {
  createAndSendEmailInvitation,
  markEmailInvitationOpened,
  getEmailInvitationStats,
  maskEmail,
} from "../utils/email.js";

const router = Router();

/**
 * Generate a cryptographically secure token for invitation links.
 * Uses 32 bytes (256 bits) of randomness, encoded as hex (64 characters).
 */
function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * POST /api/events/:id/invitations
 * Generate a new invitation link for an event (organizers only)
 */
router.post(
  "/events/:id/invitations",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;

      // Check event state - can only create invitations for published events
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { state: true, allowInviteSharing: true },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Only allow invitation links for published events
      if (event.state !== "PUBLISHED" && event.state !== "ONGOING") {
        throw createApiError(
          "Invitation links can only be created for published or ongoing events",
          400,
          "INVALID_EVENT_STATE"
        );
      }

      // Generate secure token
      const token = generateInviteToken();

      // Create the invite link
      const inviteLink = await prisma.inviteLink.create({
        data: {
          eventId,
          token,
          isActive: true,
        },
      });

      res.status(201).json({
        inviteLink: {
          id: inviteLink.id,
          token: inviteLink.token,
          isActive: inviteLink.isActive,
          createdAt: inviteLink.createdAt.toISOString(),
          expiresAt: inviteLink.expiresAt?.toISOString() || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/invitations/:token
 * Validate an invitation token and get event preview.
 * This endpoint is public (no auth required) so anyone with the link can access it.
 */
router.get(
  "/invitations/:token",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.params;

      if (!token || typeof token !== "string") {
        throw createApiError("Invalid invitation token", 400, "INVALID_TOKEN");
      }

      // Find the invite link
      const inviteLink = await prisma.inviteLink.findUnique({
        where: { token },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              description: true,
              dateTime: true,
              endDateTime: true,
              timezone: true,
              location: true,
              imageUrl: true,
              capacity: true,
              state: true,
              category: true,
              creator: {
                select: {
                  id: true,
                  displayName: true,
                  photoUrl: true,
                },
              },
              _count: {
                select: {
                  rsvps: {
                    where: { response: "YES" },
                  },
                },
              },
            },
          },
        },
      });

      if (!inviteLink) {
        throw createApiError("Invitation link not found", 404, "INVITE_NOT_FOUND");
      }

      // Check if the link is active
      if (!inviteLink.isActive) {
        throw createApiError("This invitation link is no longer active", 410, "INVITE_INACTIVE");
      }

      // Check if the link has expired
      if (inviteLink.expiresAt && inviteLink.expiresAt < new Date()) {
        throw createApiError("This invitation link has expired", 410, "INVITE_EXPIRED");
      }

      // Check event state - invitation should not work for cancelled or completed events
      const event = inviteLink.event;
      if (event.state === "CANCELLED") {
        throw createApiError("This event has been cancelled", 410, "EVENT_CANCELLED");
      }

      if (event.state === "COMPLETED") {
        throw createApiError("This event has already ended", 410, "EVENT_COMPLETED");
      }

      if (event.state === "DRAFT") {
        throw createApiError("This event is not yet available", 404, "EVENT_NOT_AVAILABLE");
      }

      // Mark email invitation as opened if this came from an email invite
      await markEmailInvitationOpened(token);

      // Return event preview
      res.json({
        valid: true,
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
          state: event.state,
          category: event.category,
          creator: event.creator,
          attendeeCount: event._count.rsvps,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/invitations/email
 * Send email invitations to one or more recipients (organizers only)
 */
router.post(
  "/events/:id/invitations/email",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const { recipients } = req.body as {
        recipients: Array<{ email: string; name?: string }>;
      };

      // Validate input
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        throw createApiError("At least one recipient is required", 400, "INVALID_INPUT");
      }

      if (recipients.length > 50) {
        throw createApiError("Maximum 50 recipients per request", 400, "TOO_MANY_RECIPIENTS");
      }

      // Validate each recipient has a valid email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const recipient of recipients) {
        if (!recipient.email || !emailRegex.test(recipient.email)) {
          throw createApiError(
            `Invalid email address: ${recipient.email || "empty"}`,
            400,
            "INVALID_EMAIL"
          );
        }
      }

      // Check event state
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { state: true, title: true },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      if (event.state !== "PUBLISHED" && event.state !== "ONGOING") {
        throw createApiError(
          "Email invitations can only be sent for published or ongoing events",
          400,
          "INVALID_EVENT_STATE"
        );
      }

      // Check for already-invited emails
      const existingInvitations = await prisma.emailInvitation.findMany({
        where: {
          eventId,
          email: { in: recipients.map((r) => r.email.toLowerCase()) },
        },
        select: { email: true },
      });

      const alreadyInvitedEmails = new Set(existingInvitations.map((inv) => inv.email.toLowerCase()));

      // Determine the base URL for invite links
      const baseUrl = req.headers.origin || `${req.protocol}://${req.get("host")}`;

      // Send invitations
      const results: Array<{
        email: string;
        success: boolean;
        error?: string;
        alreadyInvited?: boolean;
      }> = [];

      for (const recipient of recipients) {
        const normalizedEmail = recipient.email.toLowerCase();

        // Skip if already invited
        if (alreadyInvitedEmails.has(normalizedEmail)) {
          results.push({
            email: maskEmail(normalizedEmail),
            success: false,
            alreadyInvited: true,
            error: "Already invited",
          });
          continue;
        }

        const result = await createAndSendEmailInvitation(
          eventId,
          normalizedEmail,
          recipient.name || null,
          baseUrl
        );

        results.push({
          email: maskEmail(normalizedEmail),
          success: result.success,
          error: result.error,
        });
      }

      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success && !r.alreadyInvited).length;
      const alreadyInvitedCount = results.filter((r) => r.alreadyInvited).length;

      res.status(201).json({
        message: `Sent ${successCount} invitation(s)`,
        sent: successCount,
        failed: failedCount,
        alreadyInvited: alreadyInvitedCount,
        results,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/invitations/email
 * Get email invitation list and stats for an event (organizers only)
 */
router.get(
  "/events/:id/invitations/email",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;

      // Get all email invitations for this event
      const invitations = await prisma.emailInvitation.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          recipientName: true,
          status: true,
          sentAt: true,
          openedAt: true,
          rsvpAt: true,
          createdAt: true,
        },
      });

      // Get aggregate stats
      const stats = await getEmailInvitationStats(eventId);

      // Mask emails for privacy
      const maskedInvitations = invitations.map((inv) => ({
        id: inv.id,
        email: maskEmail(inv.email),
        recipientName: inv.recipientName,
        status: inv.status,
        sentAt: inv.sentAt?.toISOString() || null,
        openedAt: inv.openedAt?.toISOString() || null,
        rsvpAt: inv.rsvpAt?.toISOString() || null,
        createdAt: inv.createdAt.toISOString(),
      }));

      res.json({
        invitations: maskedInvitations,
        stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
