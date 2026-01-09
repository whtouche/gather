import { prisma } from "./db.js";
import type { SmsInvitationStatus } from "@prisma/client";

// Rate limits from spec: REQ-INV-006
const SMS_DAILY_LIMIT = 100;
const SMS_TOTAL_LIMIT = 500;

/**
 * SMS invitation data for rendering
 */
interface SmsInvitationData {
  recipientPhone: string;
  recipientName: string | null;
  eventTitle: string;
  eventDateTime: Date;
  eventTimezone: string;
  inviteUrl: string;
}

/**
 * Format a shortened invite URL for SMS (placeholder for URL shortener)
 * In production, this would integrate with a URL shortening service like Bitly
 */
function shortenUrl(url: string): string {
  // For now, just return the URL
  // In production, integrate with a URL shortener service
  return url;
}

/**
 * Format date and time for SMS (compact format)
 */
function formatDateForSms(date: Date, timezone: string): string {
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timezone,
  });

  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });

  return `${formattedDate} ${formattedTime}`;
}

/**
 * Compose an SMS message within 160 character limit
 */
function composeSmsMessage(data: SmsInvitationData): string {
  const shortUrl = shortenUrl(data.inviteUrl);
  const dateTime = formatDateForSms(data.eventDateTime, data.eventTimezone);

  // Target format: "Event: {title}\n{date time}\nRSVP: {url}"
  // Leave room for URL (up to ~40 chars with shortener)
  const maxTitleLength = 160 - 20 - dateTime.length - shortUrl.length;
  const truncatedTitle =
    data.eventTitle.length > maxTitleLength
      ? data.eventTitle.substring(0, maxTitleLength - 3) + "..."
      : data.eventTitle;

  return `Event: ${truncatedTitle}\n${dateTime}\nRSVP: ${shortUrl}`;
}

/**
 * Send an SMS invitation (currently logs to console).
 * In production, this would integrate with an SMS provider like Twilio.
 */
export function sendInvitationSms(data: SmsInvitationData): void {
  const message = composeSmsMessage(data);

  console.log("========================================");
  console.log("SMS INVITATION");
  console.log("----------------------------------------");
  console.log(`To: ${data.recipientPhone}`);
  console.log(`Characters: ${message.length}/160`);
  console.log("----------------------------------------");
  console.log(message);
  console.log("========================================");
}

/**
 * Result of sending an SMS invitation
 */
interface SendSmsInvitationResult {
  success: boolean;
  invitationId: string;
  error?: string;
}

/**
 * SMS quota info
 */
export interface SmsQuotaInfo {
  dailyCount: number;
  dailyLimit: number;
  dailyRemaining: number;
  totalCount: number;
  totalLimit: number;
  totalRemaining: number;
  atDailyLimit: boolean;
  atTotalLimit: boolean;
}

/**
 * Get or create SMS quota for an event
 */
async function getOrCreateQuota(eventId: string): Promise<{
  id: string;
  eventId: string;
  dailyCount: number;
  dailyResetAt: Date;
  totalCount: number;
}> {
  let quota = await prisma.smsQuota.findUnique({
    where: { eventId },
  });

  if (!quota) {
    quota = await prisma.smsQuota.create({
      data: {
        eventId,
        dailyCount: 0,
        dailyResetAt: new Date(),
        totalCount: 0,
      },
    });
  }

  // Check if daily count should be reset
  const now = new Date();
  const resetDate = new Date(quota.dailyResetAt);
  resetDate.setHours(0, 0, 0, 0);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (resetDate < todayStart) {
    quota = await prisma.smsQuota.update({
      where: { eventId },
      data: {
        dailyCount: 0,
        dailyResetAt: now,
      },
    });
  }

  return quota;
}

/**
 * Get SMS quota info for an event
 */
export async function getSmsQuotaInfo(eventId: string): Promise<SmsQuotaInfo> {
  const quota = await getOrCreateQuota(eventId);

  return {
    dailyCount: quota.dailyCount,
    dailyLimit: SMS_DAILY_LIMIT,
    dailyRemaining: Math.max(0, SMS_DAILY_LIMIT - quota.dailyCount),
    totalCount: quota.totalCount,
    totalLimit: SMS_TOTAL_LIMIT,
    totalRemaining: Math.max(0, SMS_TOTAL_LIMIT - quota.totalCount),
    atDailyLimit: quota.dailyCount >= SMS_DAILY_LIMIT,
    atTotalLimit: quota.totalCount >= SMS_TOTAL_LIMIT,
  };
}

/**
 * Check if sending SMS is allowed for an event (returns remaining capacity)
 */
export async function checkSmsQuota(
  eventId: string,
  count: number
): Promise<{
  allowed: boolean;
  error?: string;
  quotaInfo: SmsQuotaInfo;
}> {
  const quotaInfo = await getSmsQuotaInfo(eventId);

  if (quotaInfo.totalRemaining < count) {
    return {
      allowed: false,
      error: `SMS total limit reached (${quotaInfo.totalCount}/${SMS_TOTAL_LIMIT}). Cannot send ${count} more.`,
      quotaInfo,
    };
  }

  if (quotaInfo.dailyRemaining < count) {
    return {
      allowed: false,
      error: `SMS daily limit reached (${quotaInfo.dailyCount}/${SMS_DAILY_LIMIT}). Cannot send ${count} more today.`,
      quotaInfo,
    };
  }

  return { allowed: true, quotaInfo };
}

/**
 * Increment SMS quota for an event
 */
async function incrementQuota(eventId: string, count: number = 1): Promise<void> {
  await prisma.smsQuota.upsert({
    where: { eventId },
    update: {
      dailyCount: { increment: count },
      totalCount: { increment: count },
    },
    create: {
      eventId,
      dailyCount: count,
      totalCount: count,
      dailyResetAt: new Date(),
    },
  });
}

/**
 * Create and send an SMS invitation for an event.
 * Creates an invite link, SMS invitation record, and sends the SMS.
 */
export async function createAndSendSmsInvitation(
  eventId: string,
  phone: string,
  recipientName: string | null,
  baseUrl: string
): Promise<SendSmsInvitationResult> {
  // Get the event with organizer info
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      creator: {
        select: { displayName: true },
      },
    },
  });

  if (!event) {
    return { success: false, invitationId: "", error: "Event not found" };
  }

  // Generate a unique invite token
  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");

  // Create invite link and SMS invitation in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the invite link
    const inviteLink = await tx.inviteLink.create({
      data: {
        eventId,
        token,
        isActive: true,
      },
    });

    // Create the SMS invitation record
    const smsInvitation = await tx.smsInvitation.create({
      data: {
        eventId,
        inviteLinkId: inviteLink.id,
        phone,
        recipientName,
        status: "PENDING",
      },
    });

    return { inviteLink, smsInvitation };
  });

  // Construct the invite URL
  const inviteUrl = `${baseUrl}/invite/${token}`;

  // Send the SMS
  try {
    sendInvitationSms({
      recipientPhone: phone,
      recipientName,
      eventTitle: event.title,
      eventDateTime: event.dateTime,
      eventTimezone: event.timezone,
      inviteUrl,
    });

    // Update status to SENT and increment quota
    await prisma.smsInvitation.update({
      where: { id: result.smsInvitation.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    await incrementQuota(eventId);

    return { success: true, invitationId: result.smsInvitation.id };
  } catch (error) {
    // Update status to FAILED
    await prisma.smsInvitation.update({
      where: { id: result.smsInvitation.id },
      data: { status: "FAILED" },
    });

    return {
      success: false,
      invitationId: result.smsInvitation.id,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

/**
 * Mark an SMS invitation as RSVP'd.
 * Called when a user RSVPs to an event they were invited to via SMS.
 */
export async function markSmsInvitationRsvpd(inviteLinkToken: string): Promise<void> {
  const inviteLink = await prisma.inviteLink.findUnique({
    where: { token: inviteLinkToken },
    include: { smsInvitation: true },
  });

  if (inviteLink?.smsInvitation) {
    await prisma.smsInvitation.update({
      where: { id: inviteLink.smsInvitation.id },
      data: {
        status: "RSVPD",
        rsvpAt: new Date(),
      },
    });
  }
}

/**
 * Get SMS invitation statistics for an event.
 */
export async function getSmsInvitationStats(eventId: string): Promise<{
  total: number;
  pending: number;
  sent: number;
  rsvpd: number;
  failed: number;
}> {
  const invitations = await prisma.smsInvitation.groupBy({
    by: ["status"],
    where: { eventId },
    _count: true,
  });

  const counts: Record<SmsInvitationStatus, number> = {
    PENDING: 0,
    SENT: 0,
    RSVPD: 0,
    FAILED: 0,
  };

  for (const inv of invitations) {
    counts[inv.status] = inv._count;
  }

  return {
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    pending: counts.PENDING,
    sent: counts.SENT,
    rsvpd: counts.RSVPD,
    failed: counts.FAILED,
  };
}

/**
 * Mask a phone number for privacy (shows last 4 digits).
 * Example: +15551234567 -> ***4567
 */
export function maskPhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.length <= 4) return phone;

  const lastFour = digitsOnly.slice(-4);
  return `***${lastFour}`;
}
