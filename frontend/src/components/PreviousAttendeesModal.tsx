import { useState, useEffect } from "react";
import {
  getPreviousAttendees,
  invitePreviousAttendees,
  isApiError,
  type PreviousAttendee,
} from "../services/api";

interface PreviousAttendeesModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onInvitesSent?: () => void;
}

type ModalState = "loading" | "browse" | "sending" | "results";

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PreviousAttendeesModal({
  eventId,
  isOpen,
  onClose,
  onInvitesSent,
}: PreviousAttendeesModalProps) {
  const [state, setState] = useState<ModalState>("loading");
  const [attendees, setAttendees] = useState<PreviousAttendee[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [results, setResults] = useState<{
    sent: number;
    failed: number;
    alreadyInvited: number;
    alreadyRsvpd: number;
    message: string;
  } | null>(null);

  // Load previous attendees on mount
  useEffect(() => {
    if (isOpen) {
      loadPreviousAttendees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventId]);

  const loadPreviousAttendees = async () => {
    setState("loading");
    setError("");
    try {
      const response = await getPreviousAttendees(eventId);
      setAttendees(response.attendees);
      setState("browse");
    } catch (err) {
      setState("browse");
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to load previous attendees");
      }
    }
  };

  const handleClose = () => {
    setSelectedUserIds(new Set());
    setState("loading");
    setError("");
    setResults(null);
    onClose();
  };

  const handleToggleSelection = (userId: string) => {
    const newSelection = new Set(selectedUserIds);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUserIds(newSelection);
  };

  const handleSelectAll = () => {
    // Only select attendees with contact methods
    const selectableUserIds = attendees
      .filter((a) => a.hasEmail || a.hasPhone)
      .map((a) => a.userId);
    setSelectedUserIds(new Set(selectableUserIds));
  };

  const handleDeselectAll = () => {
    setSelectedUserIds(new Set());
  };

  const handleSendInvites = async () => {
    if (selectedUserIds.size === 0) {
      setError("Please select at least one person to invite");
      return;
    }

    setState("sending");
    setError("");

    try {
      const response = await invitePreviousAttendees(eventId, Array.from(selectedUserIds));
      setResults({
        sent: response.sent,
        failed: response.failed,
        alreadyInvited: response.alreadyInvited,
        alreadyRsvpd: response.alreadyRsvpd,
        message: response.message,
      });
      setState("results");
      if (response.sent > 0 && onInvitesSent) {
        onInvitesSent();
      }
    } catch (err) {
      setState("browse");
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to send invitations");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Invite from Previous Events
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          {/* Loading state */}
          {state === "loading" && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-300 mt-4">Loading previous attendees...</p>
            </div>
          )}

          {/* Browse state */}
          {state === "browse" && (
            <>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              {attendees.length === 0 && !error && (
                <div className="text-center py-8">
                  <svg
                    className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4"
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
                  <p className="text-gray-600 dark:text-gray-300">No previous attendees found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    People from events you've organized or attended will appear here
                  </p>
                </div>
              )}

              {attendees.length > 0 && (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {attendees.length} people from your previous events
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-gray-400 dark:text-gray-500">|</span>
                      <button
                        onClick={handleDeselectAll}
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {attendees.map((attendee) => {
                      const isSelected = selectedUserIds.has(attendee.userId);
                      const canInvite = attendee.hasEmail || attendee.hasPhone;

                      return (
                        <div
                          key={attendee.userId}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            isSelected
                              ? "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
                              : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                          } ${!canInvite ? "opacity-50" : "cursor-pointer"}`}
                          onClick={() => canInvite && handleToggleSelection(attendee.userId)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => canInvite && handleToggleSelection(attendee.userId)}
                            disabled={!canInvite}
                            className="h-4 w-4 text-indigo-600 dark:text-indigo-500 rounded border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
                          />

                          {attendee.photoUrl ? (
                            <img
                              src={attendee.photoUrl}
                              alt={attendee.displayName}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">
                                {attendee.displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {attendee.displayName}
                            </p>
                            <div className="text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
                              <p className="truncate">
                                Last: {attendee.lastEventTitle} ({formatDate(attendee.lastEventDate)})
                              </p>
                              <p>
                                {attendee.sharedEventCount} shared event{attendee.sharedEventCount > 1 ? "s" : ""}
                                {!canInvite && " • No contact method"}
                              </p>
                            </div>
                          </div>

                          {canInvite && (
                            <div className="flex gap-1 text-xs text-gray-500 dark:text-gray-400">
                              {attendee.hasEmail && (
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Email</span>
                              )}
                              {attendee.hasPhone && (
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">SMS</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* Sending state */}
          {state === "sending" && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-300 mt-4">Sending invitations...</p>
            </div>
          )}

          {/* Results state */}
          {state === "results" && results && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 dark:text-green-300 mb-2">{results.message}</h3>
                <div className="text-sm text-green-800 dark:text-green-400 space-y-1">
                  {results.sent > 0 && <p>Sent: {results.sent}</p>}
                  {results.failed > 0 && <p>Failed: {results.failed}</p>}
                  {results.alreadyInvited > 0 && <p>Already invited: {results.alreadyInvited}</p>}
                  {results.alreadyRsvpd > 0 && <p>Already RSVP'd: {results.alreadyRsvpd}</p>}
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {(state === "browse" || state === "loading") && (
          <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 rounded-b-xl flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSendInvites}
              disabled={selectedUserIds.size === 0 || state === "loading"}
              className="flex-1 bg-indigo-600 dark:bg-indigo-700 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send Invitations ({selectedUserIds.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
