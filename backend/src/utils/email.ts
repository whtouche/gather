import { prisma } from "./db.js";
import type { Event, EmailInvitation, EmailInvitationStatus } from "@prisma/client";

/**
 * Email invitation data for rendering
 */
interface EmailInvitationData {
  recipientEmail: string;
  recipientName: string | null;
  eventTitle: string;
  eventDescription: string;
  eventDateTime: Date;
  eventTimezone: string;
  eventLocation: string;
  inviteUrl: string;
  organizerName: string;
}

/**
 * Send an email invitation (currently logs to console).
 * In production, this would integrate with an email provider like SendGrid, SES, etc.
 */
export function sendInvitationEmail(data: EmailInvitationData): void {
  const formattedDate = data.eventDateTime.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: data.eventTimezone,
  });

  const formattedTime = data.eventDateTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: data.eventTimezone,
  });

  console.log("========================================");
  console.log("EMAIL INVITATION");
  console.log("----------------------------------------");
  console.log(`To: ${data.recipientEmail}`);
  console.log(`Subject: You're invited to ${data.eventTitle}`);
  console.log("----------------------------------------");
  console.log(`Hi ${data.recipientName || "there"},`);
  console.log("");
  console.log(`${data.organizerName} has invited you to:`);
  console.log("");
  console.log(`${data.eventTitle}`);
  console.log(`${data.eventDescription.substring(0, 200)}${data.eventDescription.length > 200 ? "..." : ""}`);
  console.log("");
  console.log(`When: ${formattedDate} at ${formattedTime}`);
  console.log(`Where: ${data.eventLocation}`);
  console.log("");
  console.log(`RSVP here: ${data.inviteUrl}`);
  console.log("========================================");
}

/**
 * Result of sending an invitation email
 */
interface SendInvitationResult {
  success: boolean;
  invitationId: string;
  error?: string;
}

/**
 * Create and send an email invitation for an event.
 * Creates an invite link, email invitation record, and sends the email.
 */
export async function createAndSendEmailInvitation(
  eventId: string,
  email: string,
  recipientName: string | null,
  baseUrl: string
): Promise<SendInvitationResult> {
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

  // Create invite link and email invitation in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the invite link
    const inviteLink = await tx.inviteLink.create({
      data: {
        eventId,
        token,
        isActive: true,
      },
    });

    // Create the email invitation record
    const emailInvitation = await tx.emailInvitation.create({
      data: {
        eventId,
        inviteLinkId: inviteLink.id,
        email,
        recipientName,
        status: "PENDING",
      },
    });

    return { inviteLink, emailInvitation };
  });

  // Construct the invite URL
  const inviteUrl = `${baseUrl}/invite/${token}`;

  // Send the email
  try {
    sendInvitationEmail({
      recipientEmail: email,
      recipientName,
      eventTitle: event.title,
      eventDescription: event.description,
      eventDateTime: event.dateTime,
      eventTimezone: event.timezone,
      eventLocation: event.location,
      inviteUrl,
      organizerName: event.creator.displayName,
    });

    // Update status to SENT
    await prisma.emailInvitation.update({
      where: { id: result.emailInvitation.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    return { success: true, invitationId: result.emailInvitation.id };
  } catch (error) {
    // Update status to FAILED
    await prisma.emailInvitation.update({
      where: { id: result.emailInvitation.id },
      data: { status: "FAILED" },
    });

    return {
      success: false,
      invitationId: result.emailInvitation.id,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

/**
 * Mark an email invitation as opened.
 * Called when the recipient clicks a tracking pixel or link.
 */
export async function markEmailInvitationOpened(inviteLinkToken: string): Promise<void> {
  const inviteLink = await prisma.inviteLink.findUnique({
    where: { token: inviteLinkToken },
    include: { emailInvitation: true },
  });

  if (inviteLink?.emailInvitation && !inviteLink.emailInvitation.openedAt) {
    await prisma.emailInvitation.update({
      where: { id: inviteLink.emailInvitation.id },
      data: {
        status: "OPENED",
        openedAt: new Date(),
      },
    });
  }
}

/**
 * Mark an email invitation as RSVP'd.
 * Called when a user RSVPs to an event they were invited to via email.
 */
export async function markEmailInvitationRsvpd(inviteLinkToken: string): Promise<void> {
  const inviteLink = await prisma.inviteLink.findUnique({
    where: { token: inviteLinkToken },
    include: { emailInvitation: true },
  });

  if (inviteLink?.emailInvitation) {
    await prisma.emailInvitation.update({
      where: { id: inviteLink.emailInvitation.id },
      data: {
        status: "RSVPD",
        rsvpAt: new Date(),
      },
    });
  }
}

/**
 * Get email invitation statistics for an event.
 */
export async function getEmailInvitationStats(eventId: string): Promise<{
  total: number;
  pending: number;
  sent: number;
  opened: number;
  rsvpd: number;
  failed: number;
}> {
  const invitations = await prisma.emailInvitation.groupBy({
    by: ["status"],
    where: { eventId },
    _count: true,
  });

  const counts: Record<EmailInvitationStatus, number> = {
    PENDING: 0,
    SENT: 0,
    OPENED: 0,
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
    opened: counts.OPENED,
    rsvpd: counts.RSVPD,
    failed: counts.FAILED,
  };
}

/**
 * Mask an email address for privacy (shows first 2 chars and domain).
 * Example: john.doe@example.com -> jo***@example.com
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!domain) return email;

  const visibleChars = Math.min(2, localPart.length);
  const masked = localPart.substring(0, visibleChars) + "***";
  return `${masked}@${domain}`;
}
