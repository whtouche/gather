import { Link } from "react-router-dom";
import type { DashboardEvent, OrganizingEvent, AttendingEvent, PendingEvent } from "../services/api";

type EventCardVariant = "organizing" | "attending" | "pending";

interface EventCardProps {
  event: DashboardEvent | OrganizingEvent | AttendingEvent | PendingEvent;
  variant: EventCardVariant;
}

/**
 * Format a date string into a human-readable format
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a time string into a human-readable format
 */
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Get a relative date description (e.g., "Today", "Tomorrow", "In 3 days")
 */
function getRelativeDate(dateString: string): string | null {
  const eventDate = new Date(dateString);
  const today = new Date();

  // Reset time to compare just dates
  today.setHours(0, 0, 0, 0);
  const eventDateOnly = new Date(eventDate);
  eventDateOnly.setHours(0, 0, 0, 0);

  const diffTime = eventDateOnly.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  return null;
}

/**
 * Type guard to check if event is an OrganizingEvent
 */
function isOrganizingEvent(event: DashboardEvent | OrganizingEvent | AttendingEvent | PendingEvent): event is OrganizingEvent {
  return "rsvpCounts" in event;
}

/**
 * Type guard to check if event has RSVP status
 */
function hasRsvpStatus(event: DashboardEvent | OrganizingEvent | AttendingEvent | PendingEvent): event is AttendingEvent | PendingEvent {
  return "rsvpStatus" in event;
}

/**
 * Get the RSVP status badge color and text
 */
function getRsvpBadge(status: string | null): { color: string; text: string } | null {
  if (!status) return null;

  switch (status) {
    case "YES":
      return { color: "bg-green-100 text-green-800", text: "Going" };
    case "MAYBE":
      return { color: "bg-yellow-100 text-yellow-800", text: "Maybe" };
    case "NO":
      return { color: "bg-red-100 text-red-800", text: "Not Going" };
    default:
      return null;
  }
}

/**
 * Get the event state badge styling
 */
function getStateBadge(state: string): { color: string; text: string } | null {
  switch (state) {
    case "DRAFT":
      return { color: "bg-gray-100 text-gray-800", text: "Draft" };
    case "ONGOING":
      return { color: "bg-blue-100 text-blue-800", text: "Happening Now" };
    case "CLOSED":
      return { color: "bg-orange-100 text-orange-800", text: "RSVPs Closed" };
    default:
      return null;
  }
}

/**
 * Event card component for displaying event information in the dashboard.
 * Supports different variants for organizing, attending, and pending events.
 */
export function EventCard({ event, variant }: EventCardProps) {
  const relativeDate = getRelativeDate(event.dateTime);
  const stateBadge = getStateBadge(event.state);

  return (
    <Link
      to={`/events/${event.id}`}
      className="block group"
    >
      <article className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 overflow-hidden">
        {/* Optional event image */}
        {event.imageUrl && (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={event.imageUrl}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          </div>
        )}

        <div className="p-4">
          {/* Header with badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {variant === "organizing" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                Organizer
              </span>
            )}

            {stateBadge && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stateBadge.color}`}>
                {stateBadge.text}
              </span>
            )}

            {hasRsvpStatus(event) && event.rsvpStatus && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRsvpBadge(event.rsvpStatus)?.color || ""}`}>
                {getRsvpBadge(event.rsvpStatus)?.text}
              </span>
            )}

            {relativeDate && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                {relativeDate}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
            {event.title}
          </h3>

          {/* Date and time */}
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <svg
              className="w-4 h-4 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>
              {formatDate(event.dateTime)} at {formatTime(event.dateTime)}
            </span>
          </div>

          {/* Location */}
          <div className="flex items-start text-sm text-gray-600 mb-3">
            <svg
              className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="line-clamp-1">{event.location}</span>
          </div>

          {/* RSVP counts for organizing events */}
          {isOrganizingEvent(event) && (
            <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
              <div className="flex items-center text-sm">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-medium mr-1.5">
                  {event.rsvpCounts.yes}
                </span>
                <span className="text-gray-500">Going</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium mr-1.5">
                  {event.rsvpCounts.maybe}
                </span>
                <span className="text-gray-500">Maybe</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-medium mr-1.5">
                  {event.rsvpCounts.no}
                </span>
                <span className="text-gray-500">No</span>
              </div>
            </div>
          )}

          {/* Category tag if present */}
          {event.category && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                {event.category}
              </span>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}

export default EventCard;
