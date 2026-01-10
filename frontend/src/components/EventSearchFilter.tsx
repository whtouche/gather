import { useState } from "react";
import type { EventSearchFilters } from "../services/api";

interface EventSearchFilterProps {
  onSearch: (filters: EventSearchFilters) => void;
  initialFilters?: EventSearchFilters;
}

/**
 * Event search and filter component
 * Provides UI controls for searching and filtering events by:
 * - Title (text search)
 * - Date range
 * - Event state (upcoming, past, cancelled)
 * - User role (organizer, attendee)
 */
export function EventSearchFilter({ onSearch, initialFilters = {} }: EventSearchFilterProps) {
  const [title, setTitle] = useState(initialFilters.title || "");
  const [startDate, setStartDate] = useState(initialFilters.startDate || "");
  const [endDate, setEndDate] = useState(initialFilters.endDate || "");
  const [state, setState] = useState<EventSearchFilters["state"] | "">(initialFilters.state || "");
  const [role, setRole] = useState<EventSearchFilters["role"] | "">(initialFilters.role || "");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSearch = () => {
    const filters: EventSearchFilters = {};

    if (title.trim()) filters.title = title.trim();
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (state) filters.state = state;
    if (role) filters.role = role;

    onSearch(filters);
  };

  const handleReset = () => {
    setTitle("");
    setStartDate("");
    setEndDate("");
    setState("");
    setRole("");
    onSearch({});
  };

  const hasActiveFilters = title || startDate || endDate || state || role;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
      {/* Search bar - always visible */}
      <div className="p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
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
            </div>
            <input
              type="text"
              placeholder="Search events by title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg
              className={`w-5 h-5 mr-2 -ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {[title, startDate, endDate, state, role].filter(Boolean).length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={handleSearch}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Search
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Advanced filters - collapsible */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date range */}
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            {/* Event state */}
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                Event Status
              </label>
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value as EventSearchFilters["state"] | "")}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">All Events</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* User role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                My Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as EventSearchFilters["role"] | "")}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">All Roles</option>
                <option value="organizer">Organizer</option>
                <option value="attendee">Attendee</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
