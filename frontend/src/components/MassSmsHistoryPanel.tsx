import { useState, useEffect } from "react";
import {
  getMassSmsHistory,
  getMassSmsQuota,
  isApiError,
  type MassSmsRecord,
  type MassSmsQuota,
} from "../services/api";

interface MassSmsHistoryPanelProps {
  eventId: string;
  refreshKey?: number;
}

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: "All RSVP'd",
  YES_ONLY: "Yes only",
  MAYBE_ONLY: "Maybe only",
  NO_ONLY: "No only",
  WAITLIST_ONLY: "Waitlist",
};

export function MassSmsHistoryPanel({
  eventId,
  refreshKey = 0,
}: MassSmsHistoryPanelProps) {
  const [messages, setMessages] = useState<MassSmsRecord[]>([]);
  const [quota, setQuota] = useState<MassSmsQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, refreshKey]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [historyResponse, quotaResponse] = await Promise.all([
        getMassSmsHistory(eventId),
        getMassSmsQuota(eventId),
      ]);
      setMessages(historyResponse.messages);
      setQuota(quotaResponse.quota);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to load message history");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-100 dark:bg-gray-900/50 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mass SMS History</h3>
          {quota && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {quota.remaining} of {quota.limit} remaining this week
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {messages.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <svg
            className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <p>No mass SMS sent yet</p>
          <p className="text-sm mt-1">Send your first mass SMS to see history here</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {messages.map((message) => (
            <div key={message.id} className="p-4">
              {/* Message Summary Row */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === message.id ? null : message.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {message.body.length > 50
                        ? message.body.substring(0, 50) + "..."
                        : message.body}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {AUDIENCE_LABELS[message.targetAudience] || message.targetAudience}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span>{formatDate(message.sentAt)}</span>
                    <span>by {message.organizer.displayName}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 ml-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{message.sentCount}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">sent</div>
                  </div>
                  {message.failedCount > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-medium text-red-600 dark:text-red-400">{message.failedCount}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">failed</div>
                    </div>
                  )}
                  <svg
                    className={`h-5 w-5 text-gray-400 dark:text-gray-500 transition-transform ${
                      expandedId === message.id ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === message.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Message:</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{message.body.length}/160 characters</span>
                    </div>
                    <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2">
                      {message.body}
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{message.recipientCount}</div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">Recipients</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{message.sentCount}</div>
                      <div className="text-xs text-green-600 dark:text-green-400">Sent</div>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${message.failedCount > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-900/50'}`}>
                      <div className={`text-2xl font-bold ${message.failedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {message.failedCount}
                      </div>
                      <div className={`text-xs ${message.failedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>Failed</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MassSmsHistoryPanel;
