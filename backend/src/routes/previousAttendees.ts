import { Router } from "express";
import type { Response, NextFunction } from "express";
import { createApiError } from "../types/index.js";
import type { EventAuthenticatedRequest } from "../middleware/eventAuth.js";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireEventOrganizer } from "../middleware/eventAuth.js";
import { getPreviousAttendees, filterPreviousAttendeesByEvent } from "../utils/previousAttendees.js";
import { createAndSendEmailInvitation, maskEmail } from "../utils/email.js";
import { createAndSendSmsInvitation, maskPhone } from "../utils/sms.js";

const router = Router();

/**
 * GET /api/events/:id/previous-attendees
 * Get list of users from previous events (organizers only)
 */
router.get(
  "/events/:id/previous-attendees",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw createApiError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const { filterEventId } = req.query;

      // Get previous attendees
      let attendees = await getPreviousAttendees(userId);

      // Apply event filter if provided
      if (filterEventId && typeof filterEventId === "string") {
        attendees = await filterPreviousAttendeesByEvent(userId, filterEventId);
      }

      // Format response (mask contact info for privacy)
      const formattedAttendees = attendees.map((attendee) => ({
        userId: attendee.userId,
        displayName: attendee.displayName,
        photoUrl: attendee.photoUrl,
        email: attendee.email ? maskEmail(attendee.email) : null,
        phone: attendee.phone ? maskPhone(attendee.phone) : null,
        hasEmail: !!attendee.email,
        hasPhone: !!attendee.phone,
        lastEventId: attendee.lastEventId,
        lastEventTitle: attendee.lastEventTitle,
        lastEventDate: attendee.lastEventDate.toISOString(),
        sharedEventCount: attendee.sharedEventCount,
      }));

      res.json({
        attendees: formattedAttendees,
        total: formattedAttendees.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/previous-attendees/invite
 * Send invitations to selected previous attendees (organizers only)
 */
router.post(
  "/events/:id/previous-attendees/invite",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const { userIds } = req.body as { userIds: string[] };

      // Validate input
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw createApiError("At least one user must be selected", 400, "INVALID_INPUT");
      }

      if (userIds.length > 50) {
        throw createApiError("Maximum 50 recipients per request", 400, "TOO_MANY_RECIPIENTS");
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
          "Invitations can only be sent for published or ongoing events",
          400,
          "INVALID_EVENT_STATE"
        );
      }

      // Get user contact information
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          displayName: true,
          email: true,
          phone: true,
        },
      });

      if (users.length === 0) {
        throw createApiError("No valid users found", 400, "NO_USERS_FOUND");
      }

      // Check if any users are already invited or have RSVP'd
      const existingEmailInvitations = await prisma.emailInvitation.findMany({
        where: {
          eventId,
          email: { in: users.filter((u) => u.email).map((u) => u.email!.toLowerCase()) },
        },
        select: { email: true },
      });

      const existingSmsInvitations = await prisma.smsInvitation.findMany({
        where: {
          eventId,
          phone: { in: users.filter((u) => u.phone).map((u) => u.phone!) },
        },
        select: { phone: true },
      });

      const existingRsvps = await prisma.rSVP.findMany({
        where: {
          eventId,
          userId: { in: userIds },
        },
        select: { userId: true },
      });

      const alreadyInvitedEmails = new Set(existingEmailInvitations.map((inv) => inv.email.toLowerCase()));
      const alreadyInvitedPhones = new Set(existingSmsInvitations.map((inv) => inv.phone));
      const alreadyRsvpdUserIds = new Set(existingRsvps.map((rsvp) => rsvp.userId));

      // Determine the base URL for invite links
      const baseUrl = req.headers.origin || `${req.protocol}://${req.get("host")}`;

      // Send invitations
      const results: Array<{
        userId: string;
        displayName: string;
        contactMethod: "email" | "sms" | null;
        contact: string | null;
        success: boolean;
        error?: string;
        alreadyInvited?: boolean;
        alreadyRsvpd?: boolean;
      }> = [];

      for (const user of users) {
        // Skip if user already has an RSVP
        if (alreadyRsvpdUserIds.has(user.id)) {
          results.push({
            userId: user.id,
            displayName: user.displayName,
            contactMethod: null,
            contact: null,
            success: false,
            alreadyRsvpd: true,
            error: "Already RSVP'd to this event",
          });
          continue;
        }

        // Prefer email, fall back to phone
        if (user.email) {
          const normalizedEmail = user.email.toLowerCase();

          // Check if already invited
          if (alreadyInvitedEmails.has(normalizedEmail)) {
            results.push({
              userId: user.id,
              displayName: user.displayName,
              contactMethod: "email",
              contact: maskEmail(normalizedEmail),
              success: false,
              alreadyInvited: true,
              error: "Already invited via email",
            });
            continue;
          }

          // Send email invitation
          const result = await createAndSendEmailInvitation(
            eventId,
            normalizedEmail,
            user.displayName,
            baseUrl
          );

          results.push({
            userId: user.id,
            displayName: user.displayName,
            contactMethod: "email",
            contact: maskEmail(normalizedEmail),
            success: result.success,
            error: result.error,
          });
        } else if (user.phone) {
          // Check if already invited
          if (alreadyInvitedPhones.has(user.phone)) {
            results.push({
              userId: user.id,
              displayName: user.displayName,
              contactMethod: "sms",
              contact: maskPhone(user.phone),
              success: false,
              alreadyInvited: true,
              error: "Already invited via SMS",
            });
            continue;
          }

          // Send SMS invitation
          const result = await createAndSendSmsInvitation(
            eventId,
            user.phone,
            user.displayName,
            baseUrl
          );

          results.push({
            userId: user.id,
            displayName: user.displayName,
            contactMethod: "sms",
            contact: maskPhone(user.phone),
            success: result.success,
            error: result.error,
          });
        } else {
          // User has no contact method
          results.push({
            userId: user.id,
            displayName: user.displayName,
            contactMethod: null,
            contact: null,
            success: false,
            error: "No contact method available (no email or phone)",
          });
        }
      }

      const sentCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success && !r.alreadyInvited && !r.alreadyRsvpd).length;
      const alreadyInvitedCount = results.filter((r) => r.alreadyInvited).length;
      const alreadyRsvpdCount = results.filter((r) => r.alreadyRsvpd).length;

      res.status(201).json({
        message: `Sent ${sentCount} invitation(s)`,
        sent: sentCount,
        failed: failedCount,
        alreadyInvited: alreadyInvitedCount,
        alreadyRsvpd: alreadyRsvpdCount,
        results,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
