import { useEffect, useState } from "react";
import {
  getEvent,
  publishEvent,
  isApiError,
  isAuthenticated,
  getAuthToken,
  getCurrentUser,
  type EventDetails,
} from "../services/api";
import { RSVPButtons } from "../components/RSVPButtons";
import { InviteLinkButton } from "../components/InviteLinkButton";
import { AttendeeList } from "../components/AttendeeList";
import { CancelEventModal } from "../components/CancelEventModal";
import { AttendeeListModal } from "../components/AttendeeListModal";
import { EmailInviteModal } from "../components/EmailInviteModal";
import { EmailInvitationsPanel } from "../components/EmailInvitationsPanel";
import { SmsInviteModal } from "../components/SmsInviteModal";
import { SmsInvitationsPanel } from "../components/SmsInvitationsPanel";
import { EventWall } from "../components/EventWall";
import { MassEmailModal } from "../components/MassEmailModal";
import { MassEmailHistoryPanel } from "../components/MassEmailHistoryPanel";
import { MassSmsModal } from "../components/MassSmsModal";
import { MassSmsHistoryPanel } from "../components/MassSmsHistoryPanel";
import { PreviousAttendeesModal } from "../components/PreviousAttendeesModal";
import { EventNotificationSettings } from "../components/EventNotificationSettings";
import { QuestionnaireBuilder } from "../components/QuestionnaireBuilder";

interface EventPageProps {
  eventId: string;
}

type PageState = "loading" | "success" | "error";

/**
 * Format a date for display
 */
function formatDate(dateString: string, timezone: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  });
}

/**
 * Format a time for display
 */
function formatTime(dateString: string, timezone: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

/**
 * Get badge color based on event state
 */
function getStateBadgeClasses(state: string): string {
  switch (state) {
    case "DRAFT":
      return "bg-yellow-100 text-yellow-800";
    case "PUBLISHED":
      return "bg-green-100 text-green-800";
    case "CLOSED":
      return "bg-orange-100 text-orange-800";
    case "ONGOING":
      return "bg-blue-100 text-blue-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    case "COMPLETED":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Get human-readable state label
 */
function getStateLabel(state: string): string {
  switch (state) {
    case "DRAFT":
      return "Draft";
    case "PUBLISHED":
      return "Published";
    case "CLOSED":
      return "RSVPs Closed";
    case "ONGOING":
      return "In Progress";
    case "CANCELLED":
      return "Cancelled";
    case "COMPLETED":
      return "Completed";
    default:
      return state;
  }
}

/**
 * Check if an event can be cancelled based on its state
 */
function canBeCancelled(state: string): boolean {
  return state !== "CANCELLED" && state !== "COMPLETED";
}

/**
 * EventPage component - displays full event details
 */
export function EventPage({ eventId }: EventPageProps) {
  const [state, setState] = useState<PageState>("loading");
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorCode, setErrorCode] = useState<string>("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string>("");
  const [attendeeRefreshKey, setAttendeeRefreshKey] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showEmailInviteModal, setShowEmailInviteModal] = useState(false);
  const [emailInviteRefreshKey, setEmailInviteRefreshKey] = useState(0);
  const [showSmsInviteModal, setShowSmsInviteModal] = useState(false);
  const [smsInviteRefreshKey, setSmsInviteRefreshKey] = useState(0);
  const [showMassEmailModal, setShowMassEmailModal] = useState(false);
  const [massEmailRefreshKey, setMassEmailRefreshKey] = useState(0);
  const [showMassSmsModal, setShowMassSmsModal] = useState(false);
  const [massSmsRefreshKey, setMassSmsRefreshKey] = useState(0);
  const [showPreviousAttendeesModal, setShowPreviousAttendeesModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [wallRefreshKey, setWallRefreshKey] = useState(0);

  const loggedIn = isAuthenticated();
  const authToken = getAuthToken();

  useEffect(() => {
    const fetchEvent = async () => {
      setState("loading");
      setErrorMessage("");
      setErrorCode("");

      try {
        const response = await getEvent(eventId);
        setEvent(response.event);
        setIsOrganizer(response.isOrganizer);
        setState("success");
      } catch (error) {
        setState("error");
        if (isApiError(error)) {
          setErrorMessage(error.message);
          setErrorCode(error.code || "");
        } else {
          setErrorMessage("Failed to load event details");
        }
      }
    };

    fetchEvent();
  }, [eventId]);

  // Fetch current user ID for wall post ownership
  useEffect(() => {
    if (loggedIn) {
      getCurrentUser()
        .then((response) => {
          setCurrentUserId(response.user.id);
        })
        .catch(() => {
          // Ignore errors - user just won't see delete buttons
        });
    }
  }, [loggedIn]);

  const handlePublish = async () => {
    if (!event || isPublishing) return;

    setIsPublishing(true);
    setPublishError("");

    try {
      const response = await publishEvent(eventId);
      setEvent(response.event);
    } catch (error) {
      if (isApiError(error)) {
        setPublishError(error.message);
      } else {
        setPublishError("Failed to publish event");
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRsvpChange = () => {
    // Refresh event data to get updated counts
    getEvent(eventId).then((response) => {
      setEvent(response.event);
    });
    // Trigger attendee list refresh
    setAttendeeRefreshKey((prev) => prev + 1);
    // Trigger wall refresh (access may have changed)
    setWallRefreshKey((prev) => prev + 1);
  };

  const handleEventCancelled = () => {
    // Refresh event data to get updated state
    getEvent(eventId).then((response) => {
      setEvent(response.event);
    });
    setShowCancelModal(false);
  };

  // Loading state
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading event details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    const getErrorIcon = () => {
      if (errorCode === "EVENT_NOT_FOUND") {
        return (
          <svg
            className="h-16 w-16 text-gray-400 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2a10 10 0 110 20 10 10 0 010-20z"
            />
          </svg>
        );
      }
      return (
        <svg
          className="h-16 w-16 text-gray-400 mx-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-8 text-center">
          {getErrorIcon()}
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            {errorCode === "EVENT_NOT_FOUND" ? "Event Not Found" : "Something Went Wrong"}
          </h1>
          <p className="mt-2 text-gray-600">{errorMessage}</p>
          <a
            href="/"
            className="mt-6 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  // No event data
  if (!event) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero section with event image or gradient */}
      <div
        className={`relative h-64 md:h-80 ${
          event.imageUrl
            ? "bg-cover bg-center"
            : "bg-gradient-to-br from-blue-600 to-purple-700"
        }`}
        style={event.imageUrl ? { backgroundImage: `url(${event.imageUrl})` } : undefined}
      >
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="max-w-3xl mx-auto">
            {/* State badge */}
            <span
              className={`inline-block px-3 py-1 text-sm font-medium rounded-full mb-3 ${getStateBadgeClasses(
                event.state
              )}`}
            >
              {getStateLabel(event.state)}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-white">{event.title}</h1>
          </div>
        </div>
      </div>

      {/* Event details */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Organizer Actions */}
        {isOrganizer && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Organizer Actions</h2>
            <div className="flex flex-wrap gap-3">
              {/* Edit Event button */}
              <a
                href={`/events/${event.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit Event
              </a>

              {/* Share Invite Link */}
              <InviteLinkButton eventId={event.id} />

              {/* Send Email Invites button */}
              {(event.state === "PUBLISHED" || event.state === "ONGOING") && (
                <button
                  onClick={() => setShowEmailInviteModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  Send Email Invites
                </button>
              )}

              {/* Send SMS Invites button */}
              {(event.state === "PUBLISHED" || event.state === "ONGOING") && (
                <button
                  onClick={() => setShowSmsInviteModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  Send SMS Invites
                </button>
              )}

              {/* Send Mass Email button */}
              {(event.state === "PUBLISHED" || event.state === "ONGOING") && (
                <button
                  onClick={() => setShowMassEmailModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                    />
                  </svg>
                  Send Mass Email
                </button>
              )}

              {/* Send Mass SMS button */}
              {(event.state === "PUBLISHED" || event.state === "ONGOING") && (
                <button
                  onClick={() => setShowMassSmsModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                  Send Mass SMS
                </button>
              )}

              {/* Invite from Previous Attendees button */}
              {(event.state === "PUBLISHED" || event.state === "ONGOING") && (
                <button
                  onClick={() => setShowPreviousAttendeesModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors font-medium"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  Invite from Previous Events
                </button>
              )}

              {/* Manage Attendees button */}
              <button
                onClick={() => setShowAttendeeModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                <svg
                  className="h-5 w-5"
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
                Manage Attendees
              </button>

              {/* Publish button (if draft) */}
              {event.state === "DRAFT" && (
                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-green-400 disabled:cursor-not-allowed"
                >
                  {isPublishing ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Publishing...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Publish Event
                    </>
                  )}
                </button>
              )}

              {/* Cancel Event button (if event can be cancelled) */}
              {canBeCancelled(event.state) && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Cancel Event
                </button>
              )}
            </div>
            {publishError && (
              <p className="mt-3 text-sm text-red-600">{publishError}</p>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Date and Time */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {formatDate(event.dateTime, event.timezone)}
                </h3>
                <p className="text-gray-600">
                  {formatTime(event.dateTime, event.timezone)}
                  {event.endDateTime && ` - ${formatTime(event.endDateTime, event.timezone)}`}
                </p>
                <p className="text-sm text-gray-500">{event.timezone}</p>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Location</h3>
                <p className="text-gray-600">{event.location}</p>
              </div>
            </div>
          </div>

          {/* Hosted by */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {event.creator.photoUrl ? (
                  <img
                    src={event.creator.photoUrl}
                    alt={event.creator.displayName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-lg font-semibold text-purple-600">
                      {event.creator.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Hosted by</p>
                <p className="font-semibold text-gray-900">{event.creator.displayName}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-3">About this event</h3>
            <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
          </div>

          {/* Additional details (if available) */}
          {(event.dressCode || event.notes || event.category) && (
            <div className="p-6 border-t border-gray-100 space-y-4">
              {event.category && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Category:</span>
                  <span className="ml-2 text-gray-900">{event.category}</span>
                </div>
              )}
              {event.dressCode && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Dress Code:</span>
                  <span className="ml-2 text-gray-900">{event.dressCode}</span>
                </div>
              )}
              {event.notes && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Additional Notes:</span>
                  <p className="mt-1 text-gray-900 whitespace-pre-wrap">{event.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attendee Share Section - for confirmed attendees when sharing is allowed */}
        {!isOrganizer &&
          event.userRsvp === "YES" &&
          event.allowInviteSharing &&
          (event.state === "PUBLISHED" || event.state === "ONGOING") && (
            <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Share This Event</h2>
              <p className="text-gray-600 mb-4">
                Invite others to this event by sharing the invitation link.
              </p>
              <InviteLinkButton eventId={event.id} />
            </div>
          )}

        {/* RSVP Section */}
        <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">RSVP</h2>

          {/* Event is cancelled */}
          {event.state === "CANCELLED" && (
            <div className="text-center py-4">
              <p className="text-gray-600">This event has been cancelled.</p>
            </div>
          )}

          {/* Event is completed */}
          {event.state === "COMPLETED" && (
            <div className="text-center py-4">
              <p className="text-gray-600">This event has ended.</p>
            </div>
          )}

          {/* Event is ongoing */}
          {event.state === "ONGOING" && (
            <div className="text-center py-4">
              <p className="text-gray-600">
                This event is currently in progress. RSVPs are no longer accepted.
              </p>
            </div>
          )}

          {/* Event is closed (RSVP deadline passed) */}
          {event.state === "CLOSED" && (
            <div className="text-center py-4">
              <p className="text-gray-600">
                The RSVP deadline has passed. Contact the organizer if you need to make changes.
              </p>
              {event.userRsvp && (
                <p className="mt-2 text-sm text-gray-500">
                  Your RSVP: <span className="font-medium">{event.userRsvp}</span>
                </p>
              )}
            </div>
          )}

          {/* Event is draft - only organizers can see */}
          {event.state === "DRAFT" && (
            <div className="text-center py-4">
              <p className="text-gray-600">
                This event is still in draft mode. RSVPs will be available once the event is
                published.
              </p>
            </div>
          )}

          {/* Event is published - show RSVP options */}
          {event.state === "PUBLISHED" && (
            <>
              {loggedIn && authToken ? (
                <>
                  {/* Reconfirmation prompt */}
                  {event.needsReconfirmation && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <svg
                            className="h-5 w-5 text-amber-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-amber-800">
                            Event details have changed
                          </h3>
                          <p className="mt-1 text-sm text-amber-700">
                            The date, time, or location of this event has been updated. Please review
                            the changes and reconfirm your RSVP.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <RSVPButtons
                    eventId={event.id}
                    authToken={authToken}
                    initialRsvp={event.userRsvp as "YES" | "NO" | "MAYBE" | null}
                    rsvpDeadline={event.rsvpDeadline}
                    onRsvpChange={handleRsvpChange}
                  />
                </>
              ) : (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">Sign in to RSVP to this event.</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a
                      href={`/login?redirect=/events/${event.id}`}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Sign In
                    </a>
                    <a
                      href={`/register?redirect=/events/${event.id}`}
                      className="px-6 py-3 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                    >
                      Create Account
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Questionnaire Section */}
        {event.state !== "DRAFT" && event.state !== "CANCELLED" && (
          <div className="mt-6">
            <QuestionnaireBuilder eventId={event.id} isOrganizer={isOrganizer} />
          </div>
        )}

        {/* Event Wall Section */}
        {event.state !== "DRAFT" && event.state !== "CANCELLED" && (
          <div className="mt-6" key={wallRefreshKey}>
            <EventWall eventId={event.id} currentUserId={currentUserId} isOrganizer={isOrganizer} />
          </div>
        )}

        {/* Email Invitations Panel (organizers only) */}
        {isOrganizer && (event.state === "PUBLISHED" || event.state === "ONGOING") && (
          <div className="mt-6">
            <EmailInvitationsPanel eventId={event.id} refreshKey={emailInviteRefreshKey} />
          </div>
        )}

        {/* SMS Invitations Panel (organizers only) */}
        {isOrganizer && (event.state === "PUBLISHED" || event.state === "ONGOING") && (
          <div className="mt-6">
            <SmsInvitationsPanel eventId={event.id} refreshKey={smsInviteRefreshKey} />
          </div>
        )}

        {/* Mass Email History Panel (organizers only) */}
        {isOrganizer && (event.state === "PUBLISHED" || event.state === "ONGOING") && (
          <div className="mt-6">
            <MassEmailHistoryPanel eventId={event.id} refreshKey={massEmailRefreshKey} />
          </div>
        )}

        {/* Mass SMS History Panel (organizers only) */}
        {isOrganizer && (event.state === "PUBLISHED" || event.state === "ONGOING") && (
          <div className="mt-6">
            <MassSmsHistoryPanel eventId={event.id} refreshKey={massSmsRefreshKey} />
          </div>
        )}

        {/* Attendee List Section */}
        <div className="mt-6">
          <AttendeeList eventId={event.id} refreshKey={attendeeRefreshKey} />
        </div>

        {/* Event Notification Settings Section */}
        {loggedIn && (
          <div className="mt-6">
            <EventNotificationSettings eventId={event.id} />
          </div>
        )}

        {/* Back to Dashboard link */}
        {loggedIn && (
          <div className="mt-6 text-center">
            <a
              href="/dashboard"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Back to Dashboard
            </a>
          </div>
        )}
      </div>

      {/* Cancel Event Modal */}
      {event && (
        <CancelEventModal
          eventId={event.id}
          eventTitle={event.title}
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onCancelled={handleEventCancelled}
        />
      )}

      {/* Attendee List Modal (for organizers) */}
      {event && isOrganizer && (
        <AttendeeListModal
          eventId={event.id}
          isOpen={showAttendeeModal}
          onClose={() => setShowAttendeeModal(false)}
        />
      )}

      {/* Email Invite Modal (for organizers) */}
      {event && isOrganizer && (
        <EmailInviteModal
          eventId={event.id}
          isOpen={showEmailInviteModal}
          onClose={() => setShowEmailInviteModal(false)}
          onInvitesSent={() => setEmailInviteRefreshKey((prev) => prev + 1)}
        />
      )}

      {/* SMS Invite Modal (for organizers) */}
      {event && isOrganizer && (
        <SmsInviteModal
          eventId={event.id}
          isOpen={showSmsInviteModal}
          onClose={() => setShowSmsInviteModal(false)}
          onInvitesSent={() => setSmsInviteRefreshKey((prev) => prev + 1)}
        />
      )}

      {/* Mass Email Modal (for organizers) */}
      {event && isOrganizer && (
        <MassEmailModal
          eventId={event.id}
          isOpen={showMassEmailModal}
          onClose={() => setShowMassEmailModal(false)}
          onMessageSent={() => setMassEmailRefreshKey((prev) => prev + 1)}
        />
      )}

      {/* Mass SMS Modal (for organizers) */}
      {event && isOrganizer && (
        <MassSmsModal
          eventId={event.id}
          isOpen={showMassSmsModal}
          onClose={() => setShowMassSmsModal(false)}
          onMessageSent={() => setMassSmsRefreshKey((prev) => prev + 1)}
        />
      )}

      {/* Previous Attendees Modal (for organizers) */}
      {event && isOrganizer && (
        <PreviousAttendeesModal
          eventId={event.id}
          isOpen={showPreviousAttendeesModal}
          onClose={() => setShowPreviousAttendeesModal(false)}
          onInvitesSent={() => {
            setEmailInviteRefreshKey((prev) => prev + 1);
            setSmsInviteRefreshKey((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}

export default EventPage;
