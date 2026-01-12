import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EventCard } from "../components/EventCard";
import { NotificationDropdown } from "../components/NotificationDropdown";
import { ThemeToggle } from "../components/ThemeToggle";
import { getDashboard, isApiError } from "../services/api";
import type { DashboardResponse } from "../services/api";

type LoadingState = "loading" | "success" | "error";

/**
 * Empty state component for sections with no events
 */
function EmptyState({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="text-center py-8 px-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 mb-3">
        {icon}
      </div>
      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{title}</h4>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}

/**
 * Section header component
 */
function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
      {count > 0 && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 animate-pulse">
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
      <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
}

/**
 * Loading state for dashboard sections
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map((section) => (
        <section key={section}>
          <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
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
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-200 mb-4">
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
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Something went wrong</h3>
      <p className="text-gray-500 dark:text-gray-400 mb-4">{message}</p>
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
 * Dashboard page component.
 * Displays events in three sections: Organizing, Attending, and Pending Response.
 */
export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const fetchDashboard = async () => {
    setLoadingState("loading");
    setErrorMessage("");

    try {
      const data = await getDashboard();
      setDashboard(data);
      setLoadingState("success");
    } catch (error) {
      setLoadingState("error");
      if (isApiError(error)) {
        if (error.statusCode === 401) {
          setErrorMessage("Please log in to view your dashboard.");
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("Failed to load dashboard. Please try again.");
      }
    }
  };

  useEffect(() => {
    // Data fetching is an acceptable use case for calling async function in effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDashboard();
  }, []);

  // Check if user has any events at all
  const hasAnyEvents = dashboard && (
    dashboard.organizing.length > 0 ||
    dashboard.attending.length > 0 ||
    dashboard.pending.length > 0
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Events</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage your events and RSVPs
              </p>
            </div>
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <ThemeToggle />
              <Link
                to="/events/search"
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="w-5 h-5 mr-2 -ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Search
              </Link>
              <Link
                to="/connections"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="w-5 h-5 mr-2 -ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Connections
              </Link>
              <Link
                to="/profile"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="w-5 h-5 mr-2 -ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Profile
              </Link>
              <Link
                to="/past-events"
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="w-5 h-5 mr-2 -ml-1"
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
                Past Events
              </Link>
              <Link
                to="/events/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="w-5 h-5 mr-2 -ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Event
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadingState === "loading" && <LoadingSkeleton />}

        {loadingState === "error" && (
          <ErrorState message={errorMessage} onRetry={fetchDashboard} />
        )}

        {loadingState === "success" && dashboard && (
          <>
            {/* All empty state */}
            {!hasAnyEvents && (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-200 mb-6">
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No events yet
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  Create your first event or wait for an invitation to get started.
                </p>
                <Link
                  to="/events/new"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Create Your First Event
                </Link>
              </div>
            )}

            {hasAnyEvents && (
              <div className="space-y-10">
                {/* Events You're Organizing */}
                <section>
                  <SectionHeader title="Events You're Organizing" count={dashboard.organizing.length} />
                  {dashboard.organizing.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dashboard.organizing.map((event) => (
                        <EventCard key={event.id} event={event} variant="organizing" />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No events to organize"
                      description="Create an event to start organizing."
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

                {/* Events You're Attending */}
                <section>
                  <SectionHeader title="Events You're Attending" count={dashboard.attending.length} />
                  {dashboard.attending.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dashboard.attending.map((event) => (
                        <EventCard key={event.id} event={event} variant="attending" />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No upcoming events"
                      description="Events you RSVP 'Yes' to will appear here."
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

                {/* Pending Response */}
                <section>
                  <SectionHeader title="Pending Response" count={dashboard.pending.length} />
                  {dashboard.pending.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dashboard.pending.map((event) => (
                        <EventCard key={event.id} event={event} variant="pending" />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="All caught up!"
                      description="No events waiting for your response."
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
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

export default DashboardPage;
