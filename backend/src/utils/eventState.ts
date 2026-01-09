import type { EventState } from "@prisma/client";

/**
 * Default event duration in hours (used when no end time is specified)
 */
const DEFAULT_EVENT_DURATION_HOURS = 3;

/**
 * Event data required for computing state
 */
export interface EventForStateComputation {
  state: EventState;
  dateTime: Date;
  endDateTime: Date | null;
  rsvpDeadline: Date | null;
}

/**
 * Compute the effective state of an event based on stored state and current time.
 *
 * State transition rules:
 * - DRAFT: Stays draft until explicitly published
 * - CANCELLED: Stays cancelled (terminal state)
 * - PUBLISHED: Transitions to CLOSED when RSVP deadline passes
 * - CLOSED: Transitions to ONGOING when event start time passes
 * - PUBLISHED/CLOSED: Transitions to ONGOING when event start time passes
 * - ONGOING: Transitions to COMPLETED when event end time passes
 *
 * Note: We compute state on-the-fly rather than storing it to avoid
 * needing background jobs for every state transition.
 */
export function computeEventState(
  event: EventForStateComputation,
  now: Date = new Date()
): EventState {
  const { state, dateTime, endDateTime, rsvpDeadline } = event;

  // Terminal states - these don't change automatically
  if (state === "DRAFT" || state === "CANCELLED") {
    return state;
  }

  // Calculate the effective end time
  const effectiveEndDateTime = endDateTime
    ? endDateTime
    : new Date(dateTime.getTime() + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000);

  // Check if event has ended -> COMPLETED
  if (now >= effectiveEndDateTime) {
    return "COMPLETED";
  }

  // Check if event has started -> ONGOING
  if (now >= dateTime) {
    return "ONGOING";
  }

  // Check if RSVP deadline has passed -> CLOSED
  if (rsvpDeadline && now >= rsvpDeadline) {
    return "CLOSED";
  }

  // Default: keep current state (should be PUBLISHED at this point)
  return state;
}

/**
 * Check if RSVPs are currently allowed for an event based on its computed state
 */
export function canAcceptRsvps(
  event: EventForStateComputation,
  now: Date = new Date()
): boolean {
  const computedState = computeEventState(event, now);
  return computedState === "PUBLISHED";
}

/**
 * Get human-readable state label
 */
export function getStateLabel(state: EventState): string {
  switch (state) {
    case "DRAFT":
      return "Draft";
    case "PUBLISHED":
      return "Published";
    case "CLOSED":
      return "RSVPs Closed";
    case "ONGOING":
      return "In Progress";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return state;
  }
}

/**
 * Check if an event can be cancelled (not already cancelled or completed)
 */
export function canBeCancelled(event: EventForStateComputation, now: Date = new Date()): boolean {
  const computedState = computeEventState(event, now);
  // Cannot cancel already cancelled or completed events
  return computedState !== "CANCELLED" && computedState !== "COMPLETED";
}

/**
 * Synchronize stored state with computed state.
 * This returns the state that should be stored in the database.
 *
 * We only update to COMPLETED since other states either:
 * - Are terminal (DRAFT, CANCELLED)
 * - Are computed dynamically (CLOSED, ONGOING)
 *
 * This can be used in a cron job to update historical events.
 */
export function getStateToStore(
  event: EventForStateComputation,
  now: Date = new Date()
): EventState | null {
  const currentStored = event.state;
  const computed = computeEventState(event, now);

  // Only store COMPLETED state permanently
  // Other states (CLOSED, ONGOING) are computed dynamically
  if (computed === "COMPLETED" && currentStored !== "COMPLETED") {
    return "COMPLETED";
  }

  return null;
}
