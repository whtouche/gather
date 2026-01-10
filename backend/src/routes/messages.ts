import { Router } from "express";
import type { Response, NextFunction } from "express";
import { createApiError } from "../types/index.js";
import type { EventAuthenticatedRequest } from "../middleware/eventAuth.js";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireEventOrganizer } from "../middleware/eventAuth.js";
import {
  checkMassEmailQuota,
  getMassEmailQuotaInfo,
  getRecipientsByAudience,
  sendMassEmail,
  getMassEmailHistory,
  getMassEmailDetails,
  maskEmail,
} from "../utils/massEmail.js";
import {
  checkMassSmsQuota,
  getMassSmsQuotaInfo,
  getSmsRecipientsByAudience,
  sendMassSms,
  getMassSmsHistory,
  getMassSmsDetails,
  handleSmsOptOut,
  maskPhone,
} from "../utils/massSms.js";
import type { TargetAudience } from "@prisma/client";

const router = Router();

// Valid target audiences
const VALID_AUDIENCES: TargetAudience[] = ["ALL", "YES_ONLY", "MAYBE_ONLY", "NO_ONLY", "WAITLIST_ONLY"];

/**
 * GET /api/events/:id/messages/email/quota
 * Get mass email quota info for an event (organizers only)
 */
router.get(
  "/:id/messages/email/quota",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;

      const quota = await getMassEmailQuotaInfo(eventId);

      res.json({ quota });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/messages/email/preview
 * Preview recipients for a mass email based on target audience (organizers only)
 */
router.get(
  "/:id/messages/email/preview",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const { audience } = req.query;

      // Validate audience
      if (!audience || !VALID_AUDIENCES.includes(audience as TargetAudience)) {
        throw createApiError(
          `Invalid audience. Must be one of: ${VALID_AUDIENCES.join(", ")}`,
          400,
          "INVALID_AUDIENCE"
        );
      }

      const recipients = await getRecipientsByAudience(eventId, audience as TargetAudience);

      // Return count and preview (first 10 recipients with masked emails)
      const preview = recipients.slice(0, 10).map((r) => ({
        displayName: r.displayName,
        email: maskEmail(r.email),
      }));

      res.json({
        count: recipients.length,
        preview,
        hasMore: recipients.length > 10,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/messages/email
 * Send a mass email to event attendees (organizers only)
 */
router.post(
  "/:id/messages/email",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;
      const { subject, body, targetAudience } = req.body as {
        subject: string;
        body: string;
        targetAudience: string;
      };

      // Validate input
      if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
        throw createApiError("Subject is required", 400, "INVALID_INPUT");
      }

      if (subject.length > 200) {
        throw createApiError("Subject must be 200 characters or less", 400, "INVALID_INPUT");
      }

      if (!body || typeof body !== "string" || body.trim().length === 0) {
        throw createApiError("Message body is required", 400, "INVALID_INPUT");
      }

      if (body.length > 10000) {
        throw createApiError("Message body must be 10,000 characters or less", 400, "INVALID_INPUT");
      }

      if (!targetAudience || !VALID_AUDIENCES.includes(targetAudience as TargetAudience)) {
        throw createApiError(
          `Invalid target audience. Must be one of: ${VALID_AUDIENCES.join(", ")}`,
          400,
          "INVALID_AUDIENCE"
        );
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
          "Mass emails can only be sent for published or ongoing events",
          400,
          "INVALID_EVENT_STATE"
        );
      }

      // Check quota
      const quotaCheck = await checkMassEmailQuota(eventId);
      if (!quotaCheck.allowed) {
        throw createApiError(quotaCheck.error || "Mass email quota exceeded", 429, "QUOTA_EXCEEDED");
      }

      // Check there are recipients
      const recipients = await getRecipientsByAudience(eventId, targetAudience as TargetAudience);
      if (recipients.length === 0) {
        throw createApiError(
          "No recipients found for the selected audience",
          400,
          "NO_RECIPIENTS"
        );
      }

      // Determine the base URL
      const baseUrl = req.headers.origin || `${req.protocol}://${req.get("host")}`;

      // Send the mass email
      const result = await sendMassEmail(
        eventId,
        userId,
        subject.trim(),
        body.trim(),
        targetAudience as TargetAudience,
        baseUrl
      );

      // Get updated quota
      const updatedQuota = await getMassEmailQuotaInfo(eventId);

      res.status(201).json({
        message: `Mass email sent to ${result.sentCount} recipient(s)`,
        id: result.massCommunicationId,
        recipientCount: result.recipientCount,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        quota: updatedQuota,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/messages/email/history
 * Get mass email history for an event (organizers only)
 */
router.get(
  "/:id/messages/email/history",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const parsedLimit = parseInt(req.query.limit as string);
      const parsedOffset = parseInt(req.query.offset as string);
      const limit = Math.min(Number.isNaN(parsedLimit) ? 20 : Math.max(1, parsedLimit), 100);
      const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(0, parsedOffset);

      const history = await getMassEmailHistory(eventId, limit, offset);

      res.json(history);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/messages/email/:messageId
 * Get details of a specific mass email (organizers only)
 */
router.get(
  "/:id/messages/email/:messageId",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const messageId = req.params.messageId;

      const details = await getMassEmailDetails(messageId);

      if (!details) {
        throw createApiError("Message not found", 404, "MESSAGE_NOT_FOUND");
      }

      // Verify the message belongs to this event
      const message = await prisma.massCommunication.findUnique({
        where: { id: messageId },
        select: { eventId: true },
      });

      if (message?.eventId !== eventId) {
        throw createApiError("Message not found", 404, "MESSAGE_NOT_FOUND");
      }

      res.json(details);
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// Mass SMS Routes
// =============================================================================

/**
 * GET /api/events/:id/messages/sms/quota
 * Get mass SMS quota info for an event (organizers only)
 */
router.get(
  "/:id/messages/sms/quota",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;

      const quota = await getMassSmsQuotaInfo(eventId);

      res.json({ quota });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/messages/sms/preview
 * Preview recipients for a mass SMS based on target audience (organizers only)
 */
router.get(
  "/:id/messages/sms/preview",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const { audience } = req.query;

      // Validate audience
      if (!audience || !VALID_AUDIENCES.includes(audience as TargetAudience)) {
        throw createApiError(
          `Invalid audience. Must be one of: ${VALID_AUDIENCES.join(", ")}`,
          400,
          "INVALID_AUDIENCE"
        );
      }

      const recipients = await getSmsRecipientsByAudience(eventId, audience as TargetAudience);

      // Filter opted-out users for preview
      const activeRecipients = recipients.filter((r) => !r.smsOptedOut);
      const optedOutCount = recipients.length - activeRecipients.length;

      // Return count and preview (first 10 recipients with masked phones)
      const preview = activeRecipients.slice(0, 10).map((r) => ({
        displayName: r.displayName,
        phone: maskPhone(r.phone),
      }));

      res.json({
        count: activeRecipients.length,
        optedOutCount,
        preview,
        hasMore: activeRecipients.length > 10,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/messages/sms
 * Send a mass SMS to event attendees (organizers only)
 */
router.post(
  "/:id/messages/sms",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;
      const { message, targetAudience } = req.body as {
        message: string;
        targetAudience: string;
      };

      // Validate input
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        throw createApiError("Message is required", 400, "INVALID_INPUT");
      }

      if (message.length > 160) {
        throw createApiError("Message must be 160 characters or less", 400, "INVALID_INPUT");
      }

      if (!targetAudience || !VALID_AUDIENCES.includes(targetAudience as TargetAudience)) {
        throw createApiError(
          `Invalid target audience. Must be one of: ${VALID_AUDIENCES.join(", ")}`,
          400,
          "INVALID_AUDIENCE"
        );
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
          "Mass SMS can only be sent for published or ongoing events",
          400,
          "INVALID_EVENT_STATE"
        );
      }

      // Check quota
      const quotaCheck = await checkMassSmsQuota(eventId);
      if (!quotaCheck.allowed) {
        throw createApiError(quotaCheck.error || "Mass SMS quota exceeded", 429, "QUOTA_EXCEEDED");
      }

      // Check there are recipients
      const recipients = await getSmsRecipientsByAudience(eventId, targetAudience as TargetAudience);
      const activeRecipients = recipients.filter((r) => !r.smsOptedOut);
      if (activeRecipients.length === 0) {
        throw createApiError(
          "No recipients found for the selected audience (all may have opted out)",
          400,
          "NO_RECIPIENTS"
        );
      }

      // Send the mass SMS
      const result = await sendMassSms(
        eventId,
        userId,
        message.trim(),
        targetAudience as TargetAudience
      );

      // Get updated quota
      const updatedQuota = await getMassSmsQuotaInfo(eventId);

      res.status(201).json({
        message: `Mass SMS sent to ${result.sentCount} recipient(s)`,
        id: result.massCommunicationId,
        recipientCount: result.recipientCount,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        optedOutCount: result.optedOutCount,
        quota: updatedQuota,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/messages/sms/history
 * Get mass SMS history for an event (organizers only)
 */
router.get(
  "/:id/messages/sms/history",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const parsedLimit = parseInt(req.query.limit as string);
      const parsedOffset = parseInt(req.query.offset as string);
      const limit = Math.min(Number.isNaN(parsedLimit) ? 20 : Math.max(1, parsedLimit), 100);
      const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(0, parsedOffset);

      const history = await getMassSmsHistory(eventId, limit, offset);

      res.json(history);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/messages/sms/:messageId
 * Get details of a specific mass SMS (organizers only)
 */
router.get(
  "/:id/messages/sms/:messageId",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const messageId = req.params.messageId;

      const details = await getMassSmsDetails(messageId);

      if (!details) {
        throw createApiError("Message not found", 404, "MESSAGE_NOT_FOUND");
      }

      // Verify the message belongs to this event
      const message = await prisma.massCommunication.findUnique({
        where: { id: messageId },
        select: { eventId: true },
      });

      if (message?.eventId !== eventId) {
        throw createApiError("Message not found", 404, "MESSAGE_NOT_FOUND");
      }

      res.json(details);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:id/messages/sms/opt-out
 * Opt out of SMS for an event (authenticated users)
 */
router.post(
  "/:id/messages/sms/opt-out",
  requireAuth,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;

      // Verify the event exists
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      await handleSmsOptOut(eventId, userId);

      res.json({ message: "Successfully opted out of SMS for this event" });
    } catch (error) {
      if (error instanceof Error && error.message === "User is not associated with this event") {
        next(createApiError("You are not associated with this event", 400, "NOT_ASSOCIATED"));
        return;
      }
      next(error);
    }
  }
);

export default router;
