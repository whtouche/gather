import { useState, useEffect } from "react";
import {
  getFullAttendeeList,
  promoteToOrganizer,
  demoteOrganizer,
  isApiError,
  type OrganizerAttendee,
} from "../services/api";

interface AttendeeListModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "all" | "yes" | "no" | "maybe";

/**
 * Modal component for viewing and managing attendees
 * Allows organizers to view full attendee list and promote/demote organizers
 */
export function AttendeeListModal({ eventId, isOpen, onClose }: AttendeeListModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<OrganizerAttendee[]>([]);
  const [counts, setCounts] = useState({ yes: 0, no: 0, maybe: 0 });
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load attendees when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadAttendees = async () => {
      setIsLoading(true);
      setError(null);
      setActionError(null);

      try {
        const response = await getFullAttendeeList(eventId);
        setAttendees(response.attendees);
        setCounts(response.counts);
      } catch (err) {
        if (isApiError(err)) {
          setError(err.message);
        } else {
          setError("Failed to load attendees");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadAttendees();
  }, [eventId, isOpen]);

  /**
   * Handle promoting an attendee to organizer
   */
  const handlePromote = async (userId: string) => {
    setActionInProgress(userId);
    setActionError(null);

    try {
      await promoteToOrganizer(eventId, userId);
      // Update local state
      setAttendees((prev) =>
        prev.map((attendee) =>
          attendee.id === userId ? { ...attendee, isOrganizer: true } : attendee
        )
      );
    } catch (err) {
      if (isApiError(err)) {
        setActionError(err.message);
      } else {
        setActionError("Failed to promote user");
      }
    } finally {
      setActionInProgress(null);
    }
  };

  /**
   * Handle demoting an organizer
   */
  const handleDemote = async (userId: string) => {
    setActionInProgress(userId);
    setActionError(null);

    try {
      await demoteOrganizer(eventId, userId);
      // Update local state
      setAttendees((prev) =>
        prev.map((attendee) =>
          attendee.id === userId ? { ...attendee, isOrganizer: false } : attendee
        )
      );
    } catch (err) {
      if (isApiError(err)) {
        setActionError(err.message);
      } else {
        setActionError("Failed to demote organizer");
      }
    } finally {
      setActionInProgress(null);
    }
  };

  /**
   * Filter attendees by RSVP status
   */
  const getFilteredAttendees = (): OrganizerAttendee[] => {
    if (activeTab === "all") return attendees;
    const statusMap: Record<TabType, string> = {
      all: "",
      yes: "YES",
      no: "NO",
      maybe: "MAYBE",
    };
    return attendees.filter((a) => a.rsvpStatus === statusMap[activeTab]);
  };

  /**
   * Format RSVP date
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  /**
   * Get RSVP status badge classes
   */
  const getStatusBadgeClasses = (status: string): string => {
    switch (status) {
      case "YES":
        return "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300";
      case "NO":
        return "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300";
      case "MAYBE":
        return "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
    }
  };

  if (!isOpen) return null;

  const filteredAttendees = getFilteredAttendees();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Attendee List</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              <svg
                className="w-6 h-6"
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
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-300">Loading attendees...</span>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                <p className="text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Content when loaded */}
            {!isLoading && !error && (
              <>
                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                  <button
                    onClick={() => setActiveTab("all")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === "all"
                        ? "border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    All ({attendees.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("yes")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === "yes"
                        ? "border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    Going ({counts.yes})
                  </button>
                  <button
                    onClick={() => setActiveTab("no")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === "no"
                        ? "border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    Not Going ({counts.no})
                  </button>
                  <button
                    onClick={() => setActiveTab("maybe")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === "maybe"
                        ? "border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    Maybe ({counts.maybe})
                  </button>
                </div>

                {/* Action error */}
                {actionError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-700 dark:text-red-400">{actionError}</p>
                  </div>
                )}

                {/* Attendee list */}
                <div className="max-h-96 overflow-y-auto">
                  {filteredAttendees.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No attendees in this category
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredAttendees.map((attendee) => (
                        <li
                          key={attendee.id}
                          className="py-4 flex items-center justify-between"
                        >
                          <div className="flex items-center min-w-0">
                            {/* Avatar */}
                            {attendee.photoUrl ? (
                              <img
                                src={attendee.photoUrl}
                                alt={attendee.displayName}
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-gray-600 dark:text-gray-300 font-medium">
                                  {attendee.displayName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}

                            {/* Info */}
                            <div className="ml-3 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {attendee.displayName}
                                </p>
                                {attendee.isCreator && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300">
                                    Creator
                                  </span>
                                )}
                                {attendee.isOrganizer && !attendee.isCreator && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                                    Organizer
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClasses(
                                    attendee.rsvpStatus
                                  )}`}
                                >
                                  {attendee.rsvpStatus === "YES"
                                    ? "Going"
                                    : attendee.rsvpStatus === "NO"
                                    ? "Not Going"
                                    : "Maybe"}
                                </span>
                                <span className="text-xs">
                                  RSVP'd {formatDate(attendee.rsvpDate)}
                                </span>
                              </div>
                              {(attendee.email || attendee.phone) && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                  {attendee.email || attendee.phone}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="ml-4 flex-shrink-0">
                            {attendee.isCreator ? (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                Cannot modify creator
                              </span>
                            ) : attendee.isOrganizer ? (
                              <button
                                onClick={() => handleDemote(attendee.id)}
                                disabled={actionInProgress === attendee.id}
                                className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {actionInProgress === attendee.id
                                  ? "Demoting..."
                                  : "Remove Organizer"}
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePromote(attendee.id)}
                                disabled={actionInProgress === attendee.id}
                                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {actionInProgress === attendee.id
                                  ? "Promoting..."
                                  : "Make Organizer"}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AttendeeListModal;
