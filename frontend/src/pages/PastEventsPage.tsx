import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EventCard } from "../components/EventCard";
import { getPastEvents, isApiError } from "../services/api";
import type { PastDashboardResponse } from "../services/api";

type LoadingState = "loading" | "success" | "error";

/**
 * Empty state component for sections with no events
 */
function EmptyState({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="text-center py-8 px-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-400 mb-3">
        {icon}
      </div>
      <h4 className="text-sm font-medium text-gray-900 mb-1">{title}</h4>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}

/**
 * Section header component
 */
function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {count > 0 && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
          {count}
        </span>
      )}
    </div>
  );
}

/**
 * Loading skeleton for event cards
 */
function EventCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-pulse">
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-16 bg-gray-200 rounded" />
        <div className="h-5 w-12 bg-gray-200 rounded" />
      </div>
      <div className="h-6 w-3/4 bg-gray-200 rounded mb-3" />
      <div className="h-4 w-1/2 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-2/3 bg-gray-200 rounded" />
    </div>
  );
}

/**
 * Loading state for past events sections
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2].map((section) => (
        <section key={section}>
          <div className="h-7 w-48 bg-gray-200 rounded mb-4 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((card) => (
              <EventCardSkeleton key={card} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Error state component
 */
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-4">
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
      <p className="text-gray-500 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Try Again
      </button>
    </div>
  );
}

/**
 * Past Events page component.
 * Displays past events in two sections: Events You Organized and Events You Attended.
 * Events are sorted by date descending (most recent first).
 */
export function PastEventsPage() {
  const [pastEvents, setPastEvents] = useState<PastDashboardResponse | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const fetchPastEvents = async () => {
    setLoadingState("loading");
    setErrorMessage("");

    try {
      const data = await getPastEvents();
      setPastEvents(data);
      setLoadingState("success");
    } catch (error) {
      setLoadingState("error");
      if (isApiError(error)) {
        if (error.statusCode === 401) {
          setErrorMessage("Please log in to view your past events.");
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("Failed to load past events. Please try again.");
      }
    }
  };

  useEffect(() => {
    // Data fetching is an acceptable use case for calling async function in effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPastEvents();
  }, []);

  // Check if user has any past events at all
  const hasAnyPastEvents = pastEvents && (
    pastEvents.pastOrganizing.length > 0 ||
    pastEvents.pastAttending.length > 0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Link
                  to="/dashboard"
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="Back to dashboard"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Past Events</h1>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Your event history
              </p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              View Upcoming Events
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadingState === "loading" && <LoadingSkeleton />}

        {loadingState === "error" && (
          <ErrorState message={errorMessage} onRetry={fetchPastEvents} />
        )}

        {loadingState === "success" && pastEvents && (
          <>
            {/* All empty state */}
            {!hasAnyPastEvents && (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 text-gray-400 mb-6">
                  <svg
                    className="w-10 h-10"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  No past events yet
                </h2>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Your event history will appear here once events you've organized or attended are completed.
                </p>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  View Upcoming Events
                </Link>
              </div>
            )}

            {hasAnyPastEvents && (
              <div className="space-y-10">
                {/* Events You Organized */}
                <section>
                  <SectionHeader title="Events You Organized" count={pastEvents.pastOrganizing.length} />
                  {pastEvents.pastOrganizing.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pastEvents.pastOrganizing.map((event) => (
                        <EventCard key={event.id} event={event} variant="organizing" />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No past organized events"
                      description="Events you organize will appear here after they're completed."
                      icon={
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                      }
                    />
                  )}
                </section>

                {/* Events You Attended */}
                <section>
                  <SectionHeader title="Events You Attended" count={pastEvents.pastAttending.length} />
                  {pastEvents.pastAttending.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pastEvents.pastAttending.map((event) => (
                        <EventCard key={event.id} event={event} variant="attending" />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No past attended events"
                      description="Events you attend will appear here after they're completed."
                      icon={
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      }
                    />
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default PastEventsPage;
