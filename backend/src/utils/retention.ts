import type { Event, WallPost } from "@prisma/client";
import { prisma } from "./db.js";

/**
 * Default data retention period in months for completed events
 */
const DEFAULT_RETENTION_MONTHS = 24;

/**
 * Days before retention expiration to send notification to organizer
 */
const NOTIFICATION_DAYS_BEFORE_EXPIRATION = 30;

/**
 * Event data required for computing retention status
 */
export interface EventForRetention {
  id: string;
  state: string;
  dateTime: Date;
  endDateTime: Date | null;
  dataRetentionMonths: number;
  wallRetentionMonths: number | null;
  retentionNotificationSent: boolean;
  retentionNotificationSentAt: Date | null;
  archivedAt: Date | null;
  scheduledForDeletionAt: Date | null;
  createdAt: Date;
}

/**
 * Calculate when an event's data should be archived based on retention policy
 * Returns null if event is not yet eligible for archival
 */
export function calculateArchivalDate(
  event: EventForRetention,
  now: Date = new Date()
): Date | null {
  // Only completed events are eligible for archival
  if (event.state !== "COMPLETED") {
    return null;
  }

  // Use the event's end date time or creation date as baseline
  const eventEndTime = event.endDateTime || event.dateTime;

  // Add retention period to get archival date
  const archivalDate = new Date(eventEndTime);
  archivalDate.setMonth(archivalDate.getMonth() + event.dataRetentionMonths);

  return archivalDate;
}

/**
 * Check if an event needs a retention notification sent
 * Returns true if notification should be sent (30 days before archival)
 */
export function shouldSendRetentionNotification(
  event: EventForRetention,
  now: Date = new Date()
): boolean {
  // Skip if notification already sent
  if (event.retentionNotificationSent) {
    return false;
  }

  // Skip if event is not completed
  if (event.state !== "COMPLETED") {
    return false;
  }

  const archivalDate = calculateArchivalDate(event, now);
  if (!archivalDate) {
    return false;
  }

  // Calculate notification date (30 days before archival)
  const notificationDate = new Date(archivalDate);
  notificationDate.setDate(notificationDate.getDate() - NOTIFICATION_DAYS_BEFORE_EXPIRATION);

  // Send notification if we've reached the notification date
  return now >= notificationDate;
}

/**
 * Check if an event is ready to be archived
 */
export function isReadyForArchival(
  event: EventForRetention,
  now: Date = new Date()
): boolean {
  // Skip if already archived
  if (event.archivedAt) {
    return false;
  }

  // Skip if not completed
  if (event.state !== "COMPLETED") {
    return false;
  }

  const archivalDate = calculateArchivalDate(event, now);
  if (!archivalDate) {
    return false;
  }

  // Ready for archival if we've reached the archival date
  return now >= archivalDate;
}

/**
 * Get wall posts that should be deleted based on wall retention period
 */
export async function getExpiredWallPosts(
  eventId: string,
  wallRetentionMonths: number,
  now: Date = new Date()
): Promise<string[]> {
  if (!wallRetentionMonths || wallRetentionMonths <= 0) {
    return [];
  }

  // Calculate cutoff date
  const cutoffDate = new Date(now);
  cutoffDate.setMonth(cutoffDate.getMonth() - wallRetentionMonths);

  // Find posts older than retention period
  const expiredPosts = await prisma.wallPost.findMany({
    where: {
      eventId,
      createdAt: {
        lt: cutoffDate,
      },
    },
    select: {
      id: true,
    },
  });

  return expiredPosts.map((post) => post.id);
}

/**
 * Delete wall posts that have exceeded retention period
 */
export async function deleteExpiredWallPosts(
  eventId: string,
  wallRetentionMonths: number,
  now: Date = new Date()
): Promise<number> {
  const expiredPostIds = await getExpiredWallPosts(eventId, wallRetentionMonths, now);

  if (expiredPostIds.length === 0) {
    return 0;
  }

  // Delete expired posts
  const result = await prisma.wallPost.deleteMany({
    where: {
      id: {
        in: expiredPostIds,
      },
    },
  });

  return result.count;
}

/**
 * Mark an event as having sent retention notification
 */
export async function markRetentionNotificationSent(
  eventId: string,
  now: Date = new Date()
): Promise<void> {
  await prisma.event.update({
    where: { id: eventId },
    data: {
      retentionNotificationSent: true,
      retentionNotificationSentAt: now,
    },
  });
}

/**
 * Archive an event (soft delete - marks as archived but doesn't delete data)
 */
export async function archiveEvent(
  eventId: string,
  now: Date = new Date()
): Promise<void> {
  await prisma.event.update({
    where: { id: eventId },
    data: {
      archivedAt: now,
    },
  });
}

/**
 * Schedule an event for deletion (hard delete after grace period)
 */
export async function scheduleEventForDeletion(
  eventId: string,
  gracePeriodDays: number = 30,
  now: Date = new Date()
): Promise<void> {
  const deletionDate = new Date(now);
  deletionDate.setDate(deletionDate.getDate() + gracePeriodDays);

  await prisma.event.update({
    where: { id: eventId },
    data: {
      scheduledForDeletionAt: deletionDate,
    },
  });
}

/**
 * Get events that are ready for hard deletion
 */
export async function getEventsReadyForDeletion(now: Date = new Date()): Promise<Event[]> {
  return await prisma.event.findMany({
    where: {
      scheduledForDeletionAt: {
        lte: now,
      },
    },
  });
}

/**
 * Permanently delete an event and all related data
 * This is a hard delete that removes all data
 */
export async function permanentlyDeleteEvent(eventId: string): Promise<void> {
  // Prisma cascade deletes will handle related records
  await prisma.event.delete({
    where: { id: eventId },
  });
}

/**
 * Update event retention settings
 */
export async function updateEventRetentionSettings(
  eventId: string,
  dataRetentionMonths?: number,
  wallRetentionMonths?: number | null
): Promise<void> {
  const updateData: {
    dataRetentionMonths?: number;
    wallRetentionMonths?: number | null;
    retentionNotificationSent?: boolean;
    retentionNotificationSentAt?: null;
  } = {};

  if (dataRetentionMonths !== undefined) {
    updateData.dataRetentionMonths = dataRetentionMonths;
    // Reset notification if retention period is changed
    updateData.retentionNotificationSent = false;
    updateData.retentionNotificationSentAt = null;
  }

  if (wallRetentionMonths !== undefined) {
    updateData.wallRetentionMonths = wallRetentionMonths;
  }

  await prisma.event.update({
    where: { id: eventId },
    data: updateData,
  });
}

/**
 * Get events that need retention notifications
 */
export async function getEventsNeedingRetentionNotification(
  now: Date = new Date()
): Promise<Event[]> {
  const events = await prisma.event.findMany({
    where: {
      state: "COMPLETED",
      retentionNotificationSent: false,
      archivedAt: null,
    },
  });

  // Filter to events that need notification
  return events.filter((event) => shouldSendRetentionNotification(event, now));
}

/**
 * Get events ready for archival
 */
export async function getEventsReadyForArchival(now: Date = new Date()): Promise<Event[]> {
  const events = await prisma.event.findMany({
    where: {
      state: "COMPLETED",
      archivedAt: null,
    },
  });

  // Filter to events ready for archival
  return events.filter((event) => isReadyForArchival(event, now));
}
