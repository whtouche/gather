import { prisma } from "./db.js";

/**
 * Information about a user from previous events
 */
export interface PreviousAttendee {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  lastEventId: string;
  lastEventTitle: string;
  lastEventDate: Date;
  sharedEventCount: number;
}

/**
 * Get users from events that the organizer previously organized or attended.
 * Only includes users from COMPLETED events where they RSVP'd YES.
 * Excludes the organizer themselves.
 */
export async function getPreviousAttendees(userId: string): Promise<PreviousAttendee[]> {
  // Get completed events where user was an organizer
  const organizedEvents = await prisma.event.findMany({
    where: {
      eventRoles: {
        some: { userId, role: "ORGANIZER" },
      },
      state: "COMPLETED",
    },
    select: { id: true, title: true, dateTime: true },
  });

  // Get completed events where user RSVP'd YES
  const attendedEvents = await prisma.rSVP.findMany({
    where: {
      userId,
      response: "YES",
      event: { state: "COMPLETED" },
    },
    select: {
      event: {
        select: { id: true, title: true, dateTime: true },
      },
    },
  });

  // Combine all event IDs
  const allEventIds = [
    ...organizedEvents.map((e) => e.id),
    ...attendedEvents.map((r) => r.event.id),
  ];

  // Remove duplicates
  const uniqueEventIds = [...new Set(allEventIds)];

  if (uniqueEventIds.length === 0) {
    return [];
  }

  // Get all users who RSVP'd YES to any of these events
  const rsvps = await prisma.rSVP.findMany({
    where: {
      eventId: { in: uniqueEventIds },
      response: "YES",
      userId: { not: userId }, // Exclude the organizer themselves
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          photoUrl: true,
          email: true,
          phone: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          dateTime: true,
        },
      },
    },
    orderBy: {
      event: { dateTime: "desc" },
    },
  });

  // Group by user and collect event data
  const userMap = new Map<
    string,
    {
      user: {
        id: string;
        displayName: string;
        photoUrl: string | null;
        email: string | null;
        phone: string | null;
      };
      events: Array<{ id: string; title: string; dateTime: Date }>;
    }
  >();

  for (const rsvp of rsvps) {
    if (!userMap.has(rsvp.userId)) {
      userMap.set(rsvp.userId, {
        user: rsvp.user,
        events: [],
      });
    }
    userMap.get(rsvp.userId)!.events.push(rsvp.event);
  }

  // Convert to array with metadata
  const previousAttendees: PreviousAttendee[] = [];

  for (const [, data] of userMap) {
    // Get the most recent event
    const sortedEvents = data.events.sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
    const mostRecent = sortedEvents[0];

    previousAttendees.push({
      userId: data.user.id,
      displayName: data.user.displayName,
      photoUrl: data.user.photoUrl,
      email: data.user.email,
      phone: data.user.phone,
      lastEventId: mostRecent.id,
      lastEventTitle: mostRecent.title,
      lastEventDate: mostRecent.dateTime,
      sharedEventCount: data.events.length,
    });
  }

  // Sort by most recent event, then by shared event count
  previousAttendees.sort((a, b) => {
    const dateCompare = b.lastEventDate.getTime() - a.lastEventDate.getTime();
    if (dateCompare !== 0) return dateCompare;
    return b.sharedEventCount - a.sharedEventCount;
  });

  return previousAttendees;
}

/**
 * Filter previous attendees by a specific event they attended together
 */
export async function filterPreviousAttendeesByEvent(
  userId: string,
  filterEventId: string
): Promise<PreviousAttendee[]> {
  // Get all previous attendees
  const allAttendees = await getPreviousAttendees(userId);

  // Filter to only those who attended the specific event
  const eventAttendeeIds = await prisma.rSVP.findMany({
    where: {
      eventId: filterEventId,
      response: "YES",
    },
    select: { userId: true },
  });

  const attendeeIdSet = new Set(eventAttendeeIds.map((r) => r.userId));

  return allAttendees.filter((attendee) => attendeeIdSet.has(attendee.userId));
}
