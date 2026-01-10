import { prisma } from "./db.js";
import { maskPhone } from "./sms.js";
import type { TargetAudience, DeliveryStatus } from "@prisma/client";

// Rate limits per spec REQ-MSG-014
const WEEKLY_SMS_LIMIT = 3;
const MIN_HOURS_BETWEEN_SMS = 24;
const WARNING_THRESHOLD = 0.8; // 80% threshold for limit warnings

/**
 * Send a mass SMS (currently logs to console).
 * In production, this would integrate with an SMS provider like Twilio.
 */
export function sendMassSmsToRecipient(
  recipientPhone: string,
  recipientName: string | null,
  message: string,
  eventTitle: string
): void {
  console.log("========================================");
  console.log("MASS SMS");
  console.log("----------------------------------------");
  console.log(`To: ${recipientPhone}`);
  console.log(`Characters: ${message.length}/160`);
  console.log("----------------------------------------");
  console.log(message);
  console.log("");
  console.log(`Reply STOP to opt out of SMS from ${eventTitle}`);
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
 * Check if quota allows sending a mass SMS
 */
export async function checkMassSmsQuota(eventId: string): Promise<{
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
        weeklySmsCount: 0,
        weeklyResetAt: weekStart,
      },
    });
  }

  // Reset weekly count if we're in a new week
  if (quota.weeklyResetAt < weekStart) {
    quota = await prisma.massCommunicationQuota.update({
      where: { eventId },
      data: {
        weeklySmsCount: 0,
        weeklyResetAt: weekStart,
      },
    });
  }

  const remaining = WEEKLY_SMS_LIMIT - quota.weeklySmsCount;

  // Check weekly limit
  if (quota.weeklySmsCount >= WEEKLY_SMS_LIMIT) {
    return {
      allowed: false,
      error: `Weekly mass SMS limit reached (${WEEKLY_SMS_LIMIT} per week). Resets on Sunday.`,
      used: quota.weeklySmsCount,
      limit: WEEKLY_SMS_LIMIT,
      remaining: 0,
    };
  }

  // Check 24-hour spacing
  if (quota.lastSmsAt) {
    const hoursSinceLast = (Date.now() - quota.lastSmsAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLast < MIN_HOURS_BETWEEN_SMS) {
      const nextAllowed = new Date(quota.lastSmsAt.getTime() + MIN_HOURS_BETWEEN_SMS * 60 * 60 * 1000);
      return {
        allowed: false,
        error: `Must wait ${MIN_HOURS_BETWEEN_SMS} hours between mass SMS messages. Next allowed: ${nextAllowed.toISOString()}`,
        used: quota.weeklySmsCount,
        limit: WEEKLY_SMS_LIMIT,
        remaining,
        nextSendAllowed: nextAllowed,
      };
    }
  }

  return {
    allowed: true,
    used: quota.weeklySmsCount,
    limit: WEEKLY_SMS_LIMIT,
    remaining,
  };
}

/**
 * Increment the mass SMS quota after sending
 */
export async function incrementMassSmsQuota(eventId: string): Promise<void> {
  await prisma.massCommunicationQuota.upsert({
    where: { eventId },
    update: {
      weeklySmsCount: { increment: 1 },
      lastSmsAt: new Date(),
    },
    create: {
      eventId,
      weeklySmsCount: 1,
      weeklyResetAt: getWeekStart(),
      lastSmsAt: new Date(),
    },
  });
}

/**
 * Get quota info for display
 */
export async function getMassSmsQuotaInfo(eventId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
  canSendNow: boolean;
  nextSendAllowed?: string;
  approachingLimit: boolean;
  atLimit: boolean;
}> {
  const result = await checkMassSmsQuota(eventId);
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
 * Get recipients by target audience (phone numbers only)
 */
export async function getSmsRecipientsByAudience(
  eventId: string,
  audience: TargetAudience
): Promise<Array<{ userId: string; phone: string; displayName: string; smsOptedOut: boolean }>> {
  if (audience === "WAITLIST_ONLY") {
    // Get waitlist users with phone numbers
    const waitlistEntries = await prisma.waitlist.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            displayName: true,
          },
        },
      },
    });

    return waitlistEntries
      .filter((entry) => entry.user.phone)
      .map((entry) => ({
        userId: entry.user.id,
        phone: entry.user.phone!,
        displayName: entry.user.displayName,
        smsOptedOut: false, // Waitlist users haven't opted out yet
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
          phone: true,
          displayName: true,
        },
      },
    },
  });

  // Check for SMS opt-outs for this event
  const userIds = rsvps.filter((rsvp) => rsvp.user.phone).map((rsvp) => rsvp.userId);
  const optOuts = await prisma.smsOptOut.findMany({
    where: {
      eventId,
      userId: { in: userIds },
    },
  });
  const optedOutUserIds = new Set(optOuts.map((o: { userId: string }) => o.userId));

  return rsvps
    .filter((rsvp) => rsvp.user.phone)
    .map((rsvp) => ({
      userId: rsvp.user.id,
      phone: rsvp.user.phone!,
      displayName: rsvp.user.displayName,
      smsOptedOut: optedOutUserIds.has(rsvp.userId),
    }));
}

/**
 * Result of sending mass SMS
 */
export interface SendMassSmsResult {
  massCommunicationId: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  optedOutCount: number;
}

/**
 * Send mass SMS to attendees
 */
export async function sendMassSms(
  eventId: string,
  organizerId: string,
  message: string,
  targetAudience: TargetAudience
): Promise<SendMassSmsResult> {
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
  const recipients = await getSmsRecipientsByAudience(eventId, targetAudience);

  // Filter out opted-out recipients
  const activeRecipients = recipients.filter((r) => !r.smsOptedOut);
  const optedOutCount = recipients.length - activeRecipients.length;

  // Create mass communication record
  const massCommunication = await prisma.massCommunication.create({
    data: {
      eventId,
      organizerId,
      type: "SMS",
      body: message,
      targetAudience,
      recipientCount: activeRecipients.length,
    },
  });

  let sentCount = 0;
  let failedCount = 0;

  // Send to each recipient
  for (const recipient of activeRecipients) {
    let status: DeliveryStatus = "PENDING";
    let failureReason: string | undefined;

    try {
      sendMassSmsToRecipient(recipient.phone, recipient.displayName, message, event.title);
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
        contactMethod: "SMS",
        recipient: recipient.phone,
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
  await incrementMassSmsQuota(eventId);

  return {
    massCommunicationId: massCommunication.id,
    recipientCount: activeRecipients.length,
    sentCount,
    failedCount,
    optedOutCount,
  };
}

/**
 * Get mass SMS history for an event
 */
export async function getMassSmsHistory(
  eventId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{
  messages: Array<{
    id: string;
    body: string;
    targetAudience: string;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
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
        type: "SMS",
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
        type: "SMS",
      },
    }),
  ]);

  return {
    messages: messages.map((msg) => ({
      id: msg.id,
      body: msg.body,
      targetAudience: msg.targetAudience,
      recipientCount: msg.recipientCount,
      sentCount: msg.sentCount,
      failedCount: msg.failedCount,
      sentAt: msg.sentAt.toISOString(),
      organizer: msg.organizer,
    })),
    total,
  };
}

/**
 * Get details of a specific mass SMS
 */
export async function getMassSmsDetails(
  communicationId: string
): Promise<{
  id: string;
  body: string;
  targetAudience: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string;
  recipients: Array<{
    userId: string;
    displayName: string;
    phone: string;
    status: string;
    sentAt: string | null;
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
    body: communication.body,
    targetAudience: communication.targetAudience,
    recipientCount: communication.recipientCount,
    sentCount: communication.sentCount,
    failedCount: communication.failedCount,
    sentAt: communication.sentAt.toISOString(),
    recipients: communication.recipients.map((r) => ({
      userId: r.userId,
      displayName: r.user.displayName,
      phone: maskPhone(r.recipient),
      status: r.status,
      sentAt: r.sentAt?.toISOString() || null,
    })),
  };
}

/**
 * Handle STOP opt-out from a user for an event
 */
export async function handleSmsOptOut(
  eventId: string,
  userId: string
): Promise<void> {
  // Check if user is associated with this event (has RSVP'd or is on waitlist)
  const [rsvp, waitlist] = await Promise.all([
    prisma.rSVP.findUnique({
      where: { eventId_userId: { eventId, userId } },
    }),
    prisma.waitlist.findUnique({
      where: { eventId_userId: { eventId, userId } },
    }),
  ]);

  if (!rsvp && !waitlist) {
    throw new Error("User is not associated with this event");
  }

  await prisma.smsOptOut.upsert({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
    update: {},
    create: {
      eventId,
      userId,
    },
  });
}

/**
 * Check if a user has opted out of SMS for an event
 */
export async function checkSmsOptOut(
  eventId: string,
  userId: string
): Promise<boolean> {
  const optOut = await prisma.smsOptOut.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
  });
  return !!optOut;
}

/**
 * Get opt-out count for an event
 */
export async function getOptOutCount(eventId: string): Promise<number> {
  return prisma.smsOptOut.count({
    where: { eventId },
  });
}

// Re-export maskPhone for convenience
export { maskPhone };
