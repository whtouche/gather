import { useEffect, useState } from "react";
import { getEventAttendees, type Attendee, type AttendeesResponse } from "../services/api";

interface AttendeeListProps {
  eventId: string;
  /** Called when attendee data is fetched, useful for refreshing after RSVP changes */
  onRefresh?: () => void;
  /** Key that changes when a refresh is needed */
  refreshKey?: number;
}

type LoadState = "loading" | "success" | "error";

/**
 * AttendeeList component - displays attendees based on privacy permissions
 *
 * If user can view attendees (RSVP'd yes and visibility allows):
 *   - Shows full list with display names and organizer badges
 *
 * If user cannot view attendees:
 *   - Shows only aggregate count ("X attending")
 */
export function AttendeeList({ eventId, refreshKey = 0 }: AttendeeListProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [data, setData] = useState<AttendeesResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchAttendees = async () => {
      setLoadState("loading");
      setErrorMessage("");

      try {
        const response = await getEventAttendees(eventId);
        setData(response);
        setLoadState("success");
      } catch {
        setErrorMessage("Failed to load attendee information");
        setLoadState("error");
      }
    };

    fetchAttendees();
  }, [eventId, refreshKey]);

  // Loading state
  if (loadState === "loading") {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3">
          <div className="animate-pulse bg-gray-200 rounded-lg w-12 h-12"></div>
          <div className="flex-1">
            <div className="animate-pulse bg-gray-200 rounded h-5 w-32"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (loadState === "error") {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-gray-500 text-sm">{errorMessage}</p>
      </div>
    );
  }

  // No data
  if (!data) {
    return null;
  }

  const { attendeeCount, canViewAttendees, attendees } = data;

  // If no attendees, show empty state
  if (attendeeCount === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg
              className="h-6 w-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">No attendees yet</p>
            <p className="text-sm text-gray-500">Be the first to RSVP!</p>
          </div>
        </div>
      </div>
    );
  }

  // If user cannot view attendees, show aggregate count only
  if (!canViewAttendees || !attendees) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
            <svg
              className="h-6 w-6 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {attendeeCount} {attendeeCount === 1 ? "person" : "people"} attending
            </p>
            <p className="text-sm text-gray-500">
              RSVP "Yes" to see who's coming
            </p>
          </div>
        </div>
      </div>
    );
  }

  // User can view attendees - show full list
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Attendees ({attendeeCount})
        </h2>
      </div>

      <div className="space-y-3">
        {attendees.map((attendee) => (
          <AttendeeItem key={attendee.id} attendee={attendee} />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual attendee item in the list
 */
function AttendeeItem({ attendee }: { attendee: Attendee }) {
  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {attendee.photoUrl ? (
          <img
            src={attendee.photoUrl}
            alt={attendee.displayName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-purple-600">
              {attendee.displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Name and badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">
            {attendee.displayName}
          </span>
          {attendee.isOrganizer && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Organizer
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttendeeList;
