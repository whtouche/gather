import { prisma } from "./db.js";
import { maskEmail } from "./email.js";
import type { TargetAudience, DeliveryStatus } from "@prisma/client";

// Rate limits per spec REQ-MSG-014
const WEEKLY_EMAIL_LIMIT = 5;
const MIN_HOURS_BETWEEN_EMAILS = 24;
const WARNING_THRESHOLD = 0.8; // 80% threshold for limit warnings

/**
 * Data for rendering a mass email
 */
interface MassEmailData {
  subject: string;
  body: string;
  eventTitle: string;
  eventUrl: string;
  organizerName: string;
  unsubscribeUrl: string;
}

/**
 * Send a mass email (currently logs to console).
 * In production, this would integrate with an email provider like SendGrid, SES, etc.
 */
export function sendMassEmailToRecipient(
  recipientEmail: string,
  recipientName: string | null,
  data: MassEmailData
): void {
  console.log("========================================");
  console.log("MASS EMAIL");
  console.log("----------------------------------------");
  console.log(`To: ${recipientEmail}`);
  console.log(`Subject: [${data.eventTitle}] ${data.subject}`);
  console.log("----------------------------------------");
  console.log(`Hi ${recipientName || "there"},`);
  console.log("");
  console.log(data.body);
  console.log("");
  console.log(`View event: ${data.eventUrl}`);
  console.log("");
  console.log(`Unsubscribe from future emails: ${data.unsubscribeUrl}`);
  console.log("========================================");
}

/**
 * Get the start of the current week (Sunday midnight UTC)
 */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const diff = now.getUTCDate() - day;
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0, 0, 0, 0));
  return weekStart;
}

/**
 * Check if quota allows sending a mass email
 */
export async function checkMassEmailQuota(eventId: string): Promise<{
  allowed: boolean;
  error?: string;
  used: number;
  limit: number;
  remaining: number;
  nextSendAllowed?: Date;
}> {
  const weekStart = getWeekStart();

  let quota = await prisma.massCommunicationQuota.findUnique({
    where: { eventId },
  });

  // If no quota record exists, create one
  if (!quota) {
    quota = await prisma.massCommunicationQuota.create({
      data: {
        eventId,
        weeklyEmailCount: 0,
        weeklyResetAt: weekStart,
      },
    });
  }

  // Reset weekly count if we're in a new week
  if (quota.weeklyResetAt < weekStart) {
    quota = await prisma.massCommunicationQuota.update({
      where: { eventId },
      data: {
        weeklyEmailCount: 0,
        weeklyResetAt: weekStart,
      },
    });
  }

  const remaining = WEEKLY_EMAIL_LIMIT - quota.weeklyEmailCount;

  // Check weekly limit
  if (quota.weeklyEmailCount >= WEEKLY_EMAIL_LIMIT) {
    return {
      allowed: false,
      error: `Weekly mass email limit reached (${WEEKLY_EMAIL_LIMIT} per week). Resets on Sunday.`,
      used: quota.weeklyEmailCount,
      limit: WEEKLY_EMAIL_LIMIT,
      remaining: 0,
    };
  }

  // Check 24-hour spacing
  if (quota.lastEmailAt) {
    const hoursSinceLast = (Date.now() - quota.lastEmailAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLast < MIN_HOURS_BETWEEN_EMAILS) {
      const nextAllowed = new Date(quota.lastEmailAt.getTime() + MIN_HOURS_BETWEEN_EMAILS * 60 * 60 * 1000);
      return {
        allowed: false,
        error: `Must wait ${MIN_HOURS_BETWEEN_EMAILS} hours between mass emails. Next allowed: ${nextAllowed.toISOString()}`,
        used: quota.weeklyEmailCount,
        limit: WEEKLY_EMAIL_LIMIT,
        remaining,
        nextSendAllowed: nextAllowed,
      };
    }
  }

  return {
    allowed: true,
    used: quota.weeklyEmailCount,
    limit: WEEKLY_EMAIL_LIMIT,
    remaining,
  };
}

/**
 * Increment the mass email quota after sending
 */
export async function incrementMassEmailQuota(eventId: string): Promise<void> {
  await prisma.massCommunicationQuota.upsert({
    where: { eventId },
    update: {
      weeklyEmailCount: { increment: 1 },
      lastEmailAt: new Date(),
    },
    create: {
      eventId,
      weeklyEmailCount: 1,
      weeklyResetAt: getWeekStart(),
      lastEmailAt: new Date(),
    },
  });
}

/**
 * Get quota info for display
 */
export async function getMassEmailQuotaInfo(eventId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
  canSendNow: boolean;
  nextSendAllowed?: string;
  approachingLimit: boolean;
  atLimit: boolean;
}> {
  const result = await checkMassEmailQuota(eventId);
  const usagePercentage = result.used / result.limit;
  return {
    used: result.used,
    limit: result.limit,
    remaining: result.remaining,
    canSendNow: result.allowed,
    nextSendAllowed: result.nextSendAllowed?.toISOString(),
    approachingLimit: usagePercentage >= WARNING_THRESHOLD && usagePercentage < 1,
    atLimit: result.remaining === 0,
  };
}

/**
 * Get recipients by target audience
 */
export async function getRecipientsByAudience(
  eventId: string,
  audience: TargetAudience
): Promise<Array<{ userId: string; email: string; displayName: string }>> {
  if (audience === "WAITLIST_ONLY") {
    // Get waitlist users with email addresses
    const waitlistEntries = await prisma.waitlist.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    return waitlistEntries
      .filter((entry) => entry.user.email)
      .map((entry) => ({
        userId: entry.user.id,
        email: entry.user.email!,
        displayName: entry.user.displayName,
      }));
  }

  // Build RSVP response filter based on audience
  let responseFilter: { response?: "YES" | "NO" | "MAYBE" } = {};
  if (audience === "YES_ONLY") {
    responseFilter = { response: "YES" };
  } else if (audience === "MAYBE_ONLY") {
    responseFilter = { response: "MAYBE" };
  } else if (audience === "NO_ONLY") {
    responseFilter = { response: "NO" };
  }
  // "ALL" means no filter

  const rsvps = await prisma.rSVP.findMany({
    where: {
      eventId,
      ...responseFilter,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
  });

  return rsvps
    .filter((rsvp) => rsvp.user.email)
    .map((rsvp) => ({
      userId: rsvp.user.id,
      email: rsvp.user.email!,
      displayName: rsvp.user.displayName,
    }));
}

/**
 * Result of sending mass emails
 */
export interface SendMassEmailResult {
  massCommunicationId: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
}

/**
 * Send mass email to attendees
 */
export async function sendMassEmail(
  eventId: string,
  organizerId: string,
  subject: string,
  body: string,
  targetAudience: TargetAudience,
  baseUrl: string
): Promise<SendMassEmailResult> {
  // Get event info
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      creator: {
        select: { displayName: true },
      },
    },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  // Get recipients
  const recipients = await getRecipientsByAudience(eventId, targetAudience);

  // Create mass communication record
  const massCommunication = await prisma.massCommunication.create({
    data: {
      eventId,
      organizerId,
      type: "EMAIL",
      subject,
      body,
      targetAudience,
      recipientCount: recipients.length,
    },
  });

  let sentCount = 0;
  let failedCount = 0;

  // Send to each recipient
  for (const recipient of recipients) {
    const emailData: MassEmailData = {
      subject,
      body,
      eventTitle: event.title,
      eventUrl: `${baseUrl}/events/${eventId}`,
      organizerName: event.creator.displayName,
      unsubscribeUrl: `${baseUrl}/unsubscribe?eventId=${encodeURIComponent(eventId)}&userId=${encodeURIComponent(recipient.userId)}`,
    };

    let status: DeliveryStatus = "PENDING";
    let failureReason: string | undefined;

    try {
      sendMassEmailToRecipient(recipient.email, recipient.displayName, emailData);
      status = "SENT";
      sentCount++;
    } catch (error) {
      status = "FAILED";
      failureReason = error instanceof Error ? error.message : "Unknown error";
      failedCount++;
    }

    // Create recipient record
    await prisma.massCommunicationRecipient.create({
      data: {
        massCommunicationId: massCommunication.id,
        userId: recipient.userId,
        contactMethod: "EMAIL",
        recipient: recipient.email,
        status,
        sentAt: status === "SENT" ? new Date() : undefined,
        failedAt: status === "FAILED" ? new Date() : undefined,
        failureReason,
      },
    });
  }

  // Update communication record with final counts
  await prisma.massCommunication.update({
    where: { id: massCommunication.id },
    data: {
      sentCount,
      failedCount,
    },
  });

  // Increment quota
  await incrementMassEmailQuota(eventId);

  return {
    massCommunicationId: massCommunication.id,
    recipientCount: recipients.length,
    sentCount,
    failedCount,
  };
}

/**
 * Get mass email history for an event
 */
export async function getMassEmailHistory(
  eventId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{
  messages: Array<{
    id: string;
    subject: string | null;
    body: string;
    targetAudience: string;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
    openedCount: number;
    sentAt: string;
    organizer: {
      id: string;
      displayName: string;
    };
  }>;
  total: number;
}> {
  const [messages, total] = await Promise.all([
    prisma.massCommunication.findMany({
      where: {
        eventId,
        type: "EMAIL",
      },
      orderBy: { sentAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        organizer: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    }),
    prisma.massCommunication.count({
      where: {
        eventId,
        type: "EMAIL",
      },
    }),
  ]);

  return {
    messages: messages.map((msg) => ({
      id: msg.id,
      subject: msg.subject,
      body: msg.body,
      targetAudience: msg.targetAudience,
      recipientCount: msg.recipientCount,
      sentCount: msg.sentCount,
      failedCount: msg.failedCount,
      openedCount: msg.openedCount,
      sentAt: msg.sentAt.toISOString(),
      organizer: msg.organizer,
    })),
    total,
  };
}

/**
 * Get details of a specific mass communication
 */
export async function getMassEmailDetails(
  communicationId: string
): Promise<{
  id: string;
  subject: string | null;
  body: string;
  targetAudience: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  openedCount: number;
  sentAt: string;
  recipients: Array<{
    userId: string;
    displayName: string;
    email: string;
    status: string;
    sentAt: string | null;
    openedAt: string | null;
  }>;
} | null> {
  const communication = await prisma.massCommunication.findUnique({
    where: { id: communicationId },
    include: {
      recipients: {
        include: {
          user: {
            select: {
              displayName: true,
            },
          },
        },
      },
    },
  });

  if (!communication) {
    return null;
  }

  return {
    id: communication.id,
    subject: communication.subject,
    body: communication.body,
    targetAudience: communication.targetAudience,
    recipientCount: communication.recipientCount,
    sentCount: communication.sentCount,
    failedCount: communication.failedCount,
    openedCount: communication.openedCount,
    sentAt: communication.sentAt.toISOString(),
    recipients: communication.recipients.map((r) => ({
      userId: r.userId,
      displayName: r.user.displayName,
      email: maskEmail(r.recipient),
      status: r.status,
      sentAt: r.sentAt?.toISOString() || null,
      openedAt: r.openedAt?.toISOString() || null,
    })),
  };
}

// Re-export maskEmail for convenience
export { maskEmail };
