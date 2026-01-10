import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getConnections, isApiError } from "../services/api";
import type { Connection, ConnectionsFilters } from "../services/api";

type LoadingState = "loading" | "success" | "error";

/**
 * Connection card component
 */
function ConnectionCard({ connection }: { connection: Connection }) {
  const { userId, displayName, photoUrl, sharedEventCount, mostRecentEvent } = connection;

  return (
    <Link
      to={`/connections/${userId}`}
      className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5"
    >
      <div className="flex items-start gap-4">
        {/* Profile photo */}
        <div className="flex-shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
              <svg
                className="w-7 h-7 text-gray-400"
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
            </div>
          )}
        </div>

        {/* Connection info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate">
            {displayName}
          </h3>

          <div className="mt-1 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <svg
                className="w-4 h-4 text-gray-400"
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
                {sharedEventCount} {sharedEventCount === 1 ? "event" : "events"} together
              </span>
            </div>
          </div>

          {mostRecentEvent && (
            <div className="mt-2 text-sm text-gray-500">
              <div className="truncate">
                Most recent: {mostRecentEvent.eventTitle}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {new Date(mostRecentEvent.eventDate).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Loading skeleton for connection cards
 */
function ConnectionCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-gray-200" />
        <div className="flex-1 min-w-0">
          <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-40 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Loading state for connections page
 */
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <ConnectionCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
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
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        No connections yet
      </h2>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        Attend events to meet new people and build connections. Your connections will appear here after events are completed.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Browse Events
      </Link>
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
 * Filter and sort bar component
 */
interface FilterSortBarProps {
  filters: ConnectionsFilters;
  onFiltersChange: (filters: ConnectionsFilters) => void;
}

function FilterSortBar({ filters, onFiltersChange }: FilterSortBarProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="text-sm font-medium text-gray-700">Filter & Sort</h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {showFilters ? "Hide" : "Show"} Options
        </button>
      </div>

      {/* Sort selector - always visible */}
      <div className="mb-4">
        <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-1">
          Sort by
        </label>
        <select
          id="sort"
          value={filters.sort || "recent"}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              sort: e.target.value as "recent" | "frequency" | "alphabetical",
            })
          }
          className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="recent">Most Recent Event</option>
          <option value="frequency">Most Events Together</option>
          <option value="alphabetical">Name (A-Z)</option>
        </select>
      </div>

      {showFilters && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          {/* Name search */}
          <div>
            <label htmlFor="nameSearch" className="block text-sm font-medium text-gray-700 mb-1">
              Search by name
            </label>
            <input
              type="text"
              id="nameSearch"
              placeholder="Search connections..."
              value={filters.name || ""}
              onChange={(e) => onFiltersChange({ ...filters, name: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date range filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Events from
              </label>
              <input
                type="date"
                id="startDate"
                value={filters.startDate || ""}
                onChange={(e) =>
                  onFiltersChange({ ...filters, startDate: e.target.value || undefined })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                Events to
              </label>
              <input
                type="date"
                id="endDate"
                value={filters.endDate || ""}
                onChange={(e) =>
                  onFiltersChange({ ...filters, endDate: e.target.value || undefined })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Active filters display */}
      {(filters.name || filters.startDate || filters.endDate) && (
        <div className="mt-4 flex items-center gap-2 flex-wrap pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-600">Active filters:</span>
          {filters.name && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Name: {filters.name}
              <button
                onClick={() => onFiltersChange({ ...filters, name: undefined })}
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
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
            onClick={() => onFiltersChange({ sort: filters.sort })}
            className="text-xs text-gray-600 hover:text-gray-800 underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Connections page component.
 * Displays all users who have attended events together with the authenticated user.
 */
export function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [filters, setFilters] = useState<ConnectionsFilters>({ sort: "recent" });

  const fetchConnections = async () => {
    setLoadingState("loading");
    setErrorMessage("");

    try {
      const data = await getConnections(filters);
      setConnections(data.connections);
      setLoadingState("success");
    } catch (error) {
      setLoadingState("error");
      if (isApiError(error)) {
        if (error.statusCode === 401) {
          setErrorMessage("Please log in to view your connections.");
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("Failed to load connections. Please try again.");
      }
    }
  };

  useEffect(() => {
    void fetchConnections();
  }, [filters]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
              <p className="mt-1 text-sm text-gray-500">
                People you've attended events with
              </p>
            </div>
            <Link
              to="/dashboard"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadingState === "loading" && <LoadingSkeleton />}

        {loadingState === "error" && (
          <ErrorState message={errorMessage} onRetry={fetchConnections} />
        )}

        {loadingState === "success" && (
          <>
            {connections.length === 0 && !filters.name && !filters.startDate && !filters.endDate ? (
              <EmptyState />
            ) : (
              <>
                {/* Filter and Sort Bar */}
                <FilterSortBar filters={filters} onFiltersChange={setFilters} />

                {/* Results */}
                {connections.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500 mb-4">No connections match the current filters.</p>
                    <button
                      onClick={() => setFilters({ sort: "recent" })}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <h2 className="text-lg font-medium text-gray-900">
                        {connections.length} {connections.length === 1 ? "Connection" : "Connections"}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {filters.sort === "alphabetical"
                          ? "Sorted by name (A-Z)"
                          : filters.sort === "frequency"
                          ? "Sorted by most events together"
                          : "Sorted by most recent event together"}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {connections.map((connection) => (
                        <ConnectionCard key={connection.userId} connection={connection} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default ConnectionsPage;
