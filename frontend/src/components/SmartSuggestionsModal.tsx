import { useState, useEffect } from "react";
import {
  getSmartSuggestions,
  invitePreviousAttendees,
  isApiError,
  type SmartSuggestion,
} from "../services/api";

interface SmartSuggestionsModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onInvitesSent?: () => void;
}

type ModalState = "loading" | "browse" | "sending" | "results";

/**
 * Format date for display
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SmartSuggestionsModal({
  eventId,
  isOpen,
  onClose,
  onInvitesSent,
}: SmartSuggestionsModalProps) {
  const [state, setState] = useState<ModalState>("loading");
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [results, setResults] = useState<{
    sent: number;
    failed: number;
    alreadyInvited: number;
    alreadyRsvpd: number;
    message: string;
  } | null>(null);

  // Load suggestions on mount
  useEffect(() => {
    if (isOpen) {
      loadSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventId]);

  const loadSuggestions = async () => {
    setState("loading");
    setError("");
    try {
      const response = await getSmartSuggestions(eventId);
      setSuggestions(response.suggestions);
      setState("browse");
    } catch (err) {
      setState("browse");
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to load suggestions");
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
    const selectableUserIds = suggestions.map((s) => s.userId);
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

  /**
   * Get relevance badge color based on score
   */
  const getRelevanceBadge = (score: number): { color: string; label: string } => {
    if (score >= 20) return { color: "bg-green-100 text-green-800", label: "High Match" };
    if (score >= 10) return { color: "bg-blue-100 text-blue-800", label: "Good Match" };
    return { color: "bg-gray-100 text-gray-800", label: "Potential Match" };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Smart Suggestions</h2>
              <p className="text-sm text-gray-600 mt-1">
                AI-powered recommendations based on event similarity and connections
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Analyzing connections and finding matches...</p>
            </div>
          )}

          {/* Browse state */}
          {state === "browse" && (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              {suggestions.length === 0 && !error && (
                <div className="text-center py-8">
                  <svg
                    className="h-12 w-12 text-gray-400 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  <p className="text-gray-600">No suggestions available</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Try organizing more events to build your network
                  </p>
                </div>
              )}

              {suggestions.length > 0 && (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">
                        {suggestions.length} suggested {suggestions.length === 1 ? "person" : "people"}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSelectAll}
                          className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                        >
                          Select All
                        </button>
                        <span className="text-gray-400">|</span>
                        <button
                          onClick={handleDeselectAll}
                          className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <svg
                          className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <p className="text-sm text-purple-800">
                          These people are suggested based on similar events they've attended and your
                          connection history. Higher match scores indicate stronger relevance.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {suggestions.map((suggestion) => {
                      const isSelected = selectedUserIds.has(suggestion.userId);
                      const badge = getRelevanceBadge(suggestion.relevanceScore);

                      return (
                        <div
                          key={suggestion.userId}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                            isSelected
                              ? "border-purple-300 bg-purple-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                          onClick={() => handleToggleSelection(suggestion.userId)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelection(suggestion.userId)}
                            className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 mt-1"
                          />

                          {suggestion.photoUrl ? (
                            <img
                              src={suggestion.photoUrl}
                              alt={suggestion.displayName}
                              className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-gray-600 text-sm font-medium">
                                {suggestion.displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-medium text-gray-900">
                                {suggestion.displayName}
                              </p>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${badge.color}`}
                              >
                                {badge.label}
                              </span>
                            </div>

                            <p className="text-sm text-gray-600 mb-1">{suggestion.reason}</p>

                            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                              {suggestion.sharedEventCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <svg
                                    className="h-3.5 w-3.5"
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
                                  {suggestion.sharedEventCount} connection
                                  {suggestion.sharedEventCount !== 1 ? "s" : ""}
                                </span>
                              )}
                              {suggestion.lastSharedEventDate && (
                                <span className="flex items-center gap-1">
                                  <svg
                                    className="h-3.5 w-3.5"
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
                                  Last: {formatDate(suggestion.lastSharedEventDate)}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                  />
                                </svg>
                                Score: {suggestion.relevanceScore}
                              </span>
                            </div>
                          </div>
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Sending invitations...</p>
            </div>
          )}

          {/* Results state */}
          {state === "results" && results && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">{results.message}</h3>
                <div className="text-sm text-green-800 space-y-1">
                  {results.sent > 0 && <p>Sent: {results.sent}</p>}
                  {results.failed > 0 && <p>Failed: {results.failed}</p>}
                  {results.alreadyInvited > 0 && <p>Already invited: {results.alreadyInvited}</p>}
                  {results.alreadyRsvpd > 0 && <p>Already RSVP'd: {results.alreadyRsvpd}</p>}
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {(state === "browse" || state === "loading") && (
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSendInvites}
              disabled={selectedUserIds.size === 0 || state === "loading"}
              className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send Invitations ({selectedUserIds.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
