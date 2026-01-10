/**
 * Data Retention Job
 *
 * This job should be run periodically (e.g., daily) to:
 * 1. Send notifications to organizers 30 days before data archival
 * 2. Archive events that have exceeded their retention period
 * 3. Delete wall posts that have exceeded wall retention period
 * 4. Permanently delete events scheduled for deletion
 *
 * Can be run via cron job, scheduled task, or orchestration system:
 * - Cron: 0 2 * * * (daily at 2am)
 * - AWS EventBridge, Google Cloud Scheduler, etc.
 * - Kubernetes CronJob
 */

import { prisma } from "../utils/db.js";
import {
  getEventsNeedingRetentionNotification,
  getEventsReadyForArchival,
  getEventsReadyForDeletion,
  markRetentionNotificationSent,
  archiveEvent,
  permanentlyDeleteEvent,
  deleteExpiredWallPosts,
} from "../utils/retention.js";

interface JobResult {
  notificationsSent: number;
  eventsArchived: number;
  eventsDeleted: number;
  wallPostsDeleted: number;
  errors: Array<{ eventId: string; error: string }>;
}

/**
 * Send retention notifications to organizers
 */
async function sendRetentionNotifications(): Promise<{
  sent: number;
  errors: Array<{ eventId: string; error: string }>;
}> {
  const errors: Array<{ eventId: string; error: string }> = [];

  try {
    const events = await getEventsNeedingRetentionNotification();

    for (const event of events) {
      try {
        // Get organizers (creator + additional organizers)
        const organizers = await prisma.eventRole.findMany({
          where: { eventId: event.id },
          include: { user: true },
        });

        // Add creator if not already in organizers list
        const creator = await prisma.user.findUnique({
          where: { id: event.creatorId },
        });

        const organizerIds = new Set(organizers.map((o) => o.userId));
        if (creator && !organizerIds.has(creator.id)) {
          organizers.push({
            id: "creator",
            eventId: event.id,
            userId: creator.id,
            role: "ORGANIZER" as const,
            createdAt: new Date(),
            user: creator,
          });
        }

        // Create notifications for all organizers
        for (const organizer of organizers) {
          await prisma.notification.create({
            data: {
              userId: organizer.userId,
              eventId: event.id,
              type: "EVENT_UPDATED", // Reusing existing notification type
              message: `Event "${event.title}" will be archived in 30 days due to data retention policy. You can change retention settings in event settings.`,
            },
          });
        }

        // Mark notification as sent
        await markRetentionNotificationSent(event.id);
      } catch (error) {
        errors.push({
          eventId: event.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { sent: events.length - errors.length, errors };
  } catch (error) {
    console.error("Error sending retention notifications:", error);
    return { sent: 0, errors };
  }
}

/**
 * Archive events that have exceeded retention period
 */
async function archiveExpiredEvents(): Promise<{
  archived: number;
  errors: Array<{ eventId: string; error: string }>;
}> {
  const errors: Array<{ eventId: string; error: string }> = [];

  try {
    const events = await getEventsReadyForArchival();

    for (const event of events) {
      try {
        await archiveEvent(event.id);
      } catch (error) {
        errors.push({
          eventId: event.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { archived: events.length - errors.length, errors };
  } catch (error) {
    console.error("Error archiving events:", error);
    return { archived: 0, errors };
  }
}

/**
 * Delete events scheduled for permanent deletion
 */
async function deleteScheduledEvents(): Promise<{
  deleted: number;
  errors: Array<{ eventId: string; error: string }>;
}> {
  const errors: Array<{ eventId: string; error: string }> = [];

  try {
    const events = await getEventsReadyForDeletion();

    for (const event of events) {
      try {
        await permanentlyDeleteEvent(event.id);
      } catch (error) {
        errors.push({
          eventId: event.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { deleted: events.length - errors.length, errors };
  } catch (error) {
    console.error("Error deleting scheduled events:", error);
    return { deleted: 0, errors };
  }
}

/**
 * Clean up expired wall posts based on retention settings
 */
async function cleanupExpiredWallPosts(): Promise<{
  postsDeleted: number;
  errors: Array<{ eventId: string; error: string }>;
}> {
  let totalDeleted = 0;
  const errors: Array<{ eventId: string; error: string }> = [];

  try {
    // Find events with wall retention configured
    const eventsWithWallRetention = await prisma.event.findMany({
      where: {
        wallRetentionMonths: {
          not: null,
        },
      },
      select: {
        id: true,
        wallRetentionMonths: true,
      },
    });

    for (const event of eventsWithWallRetention) {
      try {
        if (event.wallRetentionMonths) {
          const deleted = await deleteExpiredWallPosts(event.id, event.wallRetentionMonths);
          totalDeleted += deleted;
        }
      } catch (error) {
        errors.push({
          eventId: event.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { postsDeleted: totalDeleted, errors };
  } catch (error) {
    console.error("Error cleaning up wall posts:", error);
    return { postsDeleted: 0, errors };
  }
}

/**
 * Main job execution
 */
export async function runRetentionJob(): Promise<JobResult> {
  console.log("Starting retention job...");
  const startTime = Date.now();

  const result: JobResult = {
    notificationsSent: 0,
    eventsArchived: 0,
    eventsDeleted: 0,
    wallPostsDeleted: 0,
    errors: [],
  };

  // Step 1: Send retention notifications
  const notifications = await sendRetentionNotifications();
  result.notificationsSent = notifications.sent;
  result.errors.push(...notifications.errors);

  // Step 2: Archive expired events
  const archived = await archiveExpiredEvents();
  result.eventsArchived = archived.archived;
  result.errors.push(...archived.errors);

  // Step 3: Delete scheduled events
  const deleted = await deleteScheduledEvents();
  result.eventsDeleted = deleted.deleted;
  result.errors.push(...deleted.errors);

  // Step 4: Clean up expired wall posts
  const wallCleanup = await cleanupExpiredWallPosts();
  result.wallPostsDeleted = wallCleanup.postsDeleted;
  result.errors.push(...wallCleanup.errors);

  const duration = Date.now() - startTime;
  console.log(`Retention job completed in ${duration}ms`);
  console.log(`- Notifications sent: ${result.notificationsSent}`);
  console.log(`- Events archived: ${result.eventsArchived}`);
  console.log(`- Events deleted: ${result.eventsDeleted}`);
  console.log(`- Wall posts deleted: ${result.wallPostsDeleted}`);
  if (result.errors.length > 0) {
    console.log(`- Errors: ${result.errors.length}`);
    result.errors.forEach((error) => {
      console.error(`  Event ${error.eventId}: ${error.error}`);
    });
  }

  return result;
}

// If run directly (not imported), execute the job
// This allows the file to be both imported and executed directly
const isMainModule = process.argv[1] && process.argv[1].includes("retentionJob");
if (isMainModule) {
  runRetentionJob()
    .then(() => {
      console.log("Job completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Job failed:", error);
      process.exit(1);
    });
}
