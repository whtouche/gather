import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getConnectionDetail,
  isApiError,
  type ConnectionDetail,
  type SharedEvent,
  type ConnectionDetailFilters,
  getPrivateNote,
  createPrivateNote,
  updatePrivateNote,
  deletePrivateNote,
  type PrivateNote,
} from "../services/api";
import { PrivateNoteCard } from "../components/PrivateNoteCard";

type LoadingState = "loading" | "success" | "error";

/**
 * Shared event card component
 */
function SharedEventCard({ event }: { event: SharedEvent }) {
  const { eventId, eventTitle, eventDate, eventLocation, userRole } = event;

  return (
    <Link
      to={`/events/${eventId}`}
      className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate mb-1">
            {eventTitle}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <svg
              className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
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
            <span>
              {new Date(eventDate).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mt-1">
            <svg
              className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
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
            <span className="truncate">{eventLocation}</span>
          </div>
        </div>
        {userRole === "ORGANIZER" && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 flex-shrink-0">
            Organizer
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * Loading skeleton for event cards
 */
function EventCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 animate-pulse">
      <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
}

/**
 * Loading state for connection details page
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Profile skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
        <div className="flex items-start gap-6 mb-6">
          <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="flex-1">
            <div className="h-7 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>

      {/* Events skeleton */}
      <div>
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Error state component
 */
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-200 mb-4">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Something went wrong</h3>
      <p className="text-gray-500 dark:text-gray-400 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
      >
        Try Again
      </button>
    </div>
  );
}

/**
 * Filter bar component
 */
interface FilterBarProps {
  filters: ConnectionDetailFilters;
  onFiltersChange: (filters: ConnectionDetailFilters) => void;
  sharedEvents: SharedEvent[];
}

function FilterBar({ filters, onFiltersChange, sharedEvents }: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);

  // Get unique events for the event filter dropdown
  const uniqueEvents = Array.from(
    new Map(sharedEvents.map((e) => [e.eventId, e])).values()
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Filters</h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          {showFilters ? "Hide" : "Show"} Filters
        </button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Event filter */}
          <div>
            <label htmlFor="eventFilter" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Event
            </label>
            <select
              id="eventFilter"
              value={filters.eventId || ""}
              onChange={(e) => onFiltersChange({ ...filters, eventId: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All events</option>
              {uniqueEvents.map((event) => (
                <option key={event.eventId} value={event.eventId}>
                  {event.eventTitle}
                </option>
              ))}
            </select>
          </div>

          {/* Start date filter */}
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              From Date
            </label>
            <input
              type="date"
              id="startDate"
              value={filters.startDate || ""}
              onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End date filter */}
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              To Date
            </label>
            <input
              type="date"
              id="endDate"
              value={filters.endDate || ""}
              onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Active filters display */}
      {(filters.eventId || filters.startDate || filters.endDate) && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 dark:text-gray-300">Active filters:</span>
          {filters.eventId && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              Event
              <button
                onClick={() => onFiltersChange({ ...filters, eventId: undefined })}
                className="ml-1.5 inline-flex items-center"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </span>
          )}
          {filters.startDate && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              From: {new Date(filters.startDate).toLocaleDateString()}
              <button
                onClick={() => onFiltersChange({ ...filters, startDate: undefined })}
                className="ml-1.5 inline-flex items-center"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </span>
          )}
          {filters.endDate && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              To: {new Date(filters.endDate).toLocaleDateString()}
              <button
                onClick={() => onFiltersChange({ ...filters, endDate: undefined })}
                className="ml-1.5 inline-flex items-center"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </span>
          )}
          <button
            onClick={() => onFiltersChange({})}
            className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Connection detail page component.
 * Displays detailed information about a specific connection including shared event history.
 */
export function ConnectionDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [connection, setConnection] = useState<ConnectionDetail | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [filters, setFilters] = useState<ConnectionDetailFilters>({});
  const [privateNote, setPrivateNote] = useState<PrivateNote | null>(null);
  const [noteLoadingState, setNoteLoadingState] = useState<LoadingState>("loading");

  const fetchConnectionDetail = async () => {
    if (!userId) {
      setLoadingState("error");
      setErrorMessage("No user ID provided.");
      return;
    }

    setLoadingState("loading");
    setErrorMessage("");

    try {
      const data = await getConnectionDetail(userId, filters);
      setConnection(data.connection);
      setLoadingState("success");
    } catch (error) {
      setLoadingState("error");
      if (isApiError(error)) {
        if (error.statusCode === 404) {
          setErrorMessage("Connection not found. You must have attended at least one event together.");
        } else if (error.statusCode === 401) {
          setErrorMessage("Please log in to view connection details.");
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("Failed to load connection details. Please try again.");
      }
    }
  };

  const fetchPrivateNote = async () => {
    if (!userId) return;

    setNoteLoadingState("loading");

    try {
      const note = await getPrivateNote(userId);
      setPrivateNote(note);
      setNoteLoadingState("success");
    } catch (error) {
      if (isApiError(error) && error.statusCode === 404) {
        // No note exists yet - this is fine
        setPrivateNote(null);
        setNoteLoadingState("success");
      } else {
        setNoteLoadingState("error");
      }
    }
  };

  const handleSaveNote = async (content: string, tags: string[]) => {
    if (!userId) return;

    if (privateNote) {
      // Update existing note
      const updatedNote = await updatePrivateNote(userId, { content, tags });
      setPrivateNote(updatedNote);
    } else {
      // Create new note
      const newNote = await createPrivateNote({ targetUserId: userId, content, tags });
      setPrivateNote(newNote);
    }
  };

  const handleDeleteNote = async () => {
    if (!userId) return;

    await deletePrivateNote(userId);
    setPrivateNote(null);
  };

  useEffect(() => {
    void fetchConnectionDetail();
    void fetchPrivateNote();
  }, [userId, filters]);

  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Invalid Connection</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">No user ID provided.</p>
          <Link
            to="/connections"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Connections
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connection Details</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Shared event history and profile information
              </p>
            </div>
            <Link
              to="/connections"
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <svg className="w-5 h-5 mr-2 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Connections
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadingState === "loading" && <LoadingSkeleton />}

        {loadingState === "error" && (
          <ErrorState message={errorMessage} onRetry={fetchConnectionDetail} />
        )}

        {loadingState === "success" && connection && (
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex items-start gap-6">
                  {/* Photo */}
                  <div className="flex-shrink-0">
                    {connection.photoUrl ? (
                      <img
                        src={connection.photoUrl}
                        alt={connection.displayName}
                        className="w-24 h-24 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-3xl font-medium text-gray-600 dark:text-gray-300">
                          {connection.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {connection.displayName}
                    </h2>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 mb-4">
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>
                          {connection.totalSharedEvents}{" "}
                          {connection.totalSharedEvents === 1 ? "event" : "events"} together
                        </span>
                      </div>
                    </div>

                    {/* Location */}
                    {connection.location && (
                      <p className="flex items-center text-gray-600 dark:text-gray-300 mb-2">
                        <svg className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {connection.location}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bio */}
                {connection.bio && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">About</h3>
                    <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{connection.bio}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Private Note */}
            {noteLoadingState === "success" && (
              <PrivateNoteCard
                note={privateNote}
                targetUserId={userId}
                targetUserDisplayName={connection.displayName}
                onSave={handleSaveNote}
                onDelete={privateNote ? handleDeleteNote : undefined}
              />
            )}

            {/* Filters */}
            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              sharedEvents={connection.sharedEvents}
            />

            {/* Shared Events */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Shared Events ({connection.sharedEvents.length})
              </h3>

              {connection.sharedEvents.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400">No events match the current filters.</p>
                  <button
                    onClick={() => setFilters({})}
                    className="mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {connection.sharedEvents.map((event) => (
                    <SharedEventCard key={event.eventId} event={event} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ConnectionDetailPage;
