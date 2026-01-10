import { useState, useEffect } from "react";
import {
  getMassEmailHistory,
  getMassEmailQuota,
  isApiError,
  type MassEmailRecord,
  type MassEmailQuota,
} from "../services/api";

interface MassEmailHistoryPanelProps {
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

export function MassEmailHistoryPanel({
  eventId,
  refreshKey = 0,
}: MassEmailHistoryPanelProps) {
  const [messages, setMessages] = useState<MassEmailRecord[]>([]);
  const [quota, setQuota] = useState<MassEmailQuota | null>(null);
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
        getMassEmailHistory(eventId),
        getMassEmailQuota(eventId),
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
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Mass Email History</h3>
          {quota && (
            <div className="text-sm text-gray-500">
              {quota.remaining} of {quota.limit} remaining this week
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {messages.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-300 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <p>No mass emails sent yet</p>
          <p className="text-sm mt-1">Send your first mass email to see history here</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {messages.map((message) => (
            <div key={message.id} className="p-4">
              {/* Message Summary Row */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === message.id ? null : message.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">
                      {message.subject || "(No subject)"}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      {AUDIENCE_LABELS[message.targetAudience] || message.targetAudience}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span>{formatDate(message.sentAt)}</span>
                    <span>by {message.organizer.displayName}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 ml-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{message.sentCount}</div>
                    <div className="text-xs text-gray-500">sent</div>
                  </div>
                  {message.failedCount > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-medium text-red-600">{message.failedCount}</div>
                      <div className="text-xs text-gray-500">failed</div>
                    </div>
                  )}
                  <svg
                    className={`h-5 w-5 text-gray-400 transition-transform ${
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
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-500 mb-1">Message:</div>
                    <div className="text-sm text-gray-900 whitespace-pre-wrap">
                      {message.body.length > 500
                        ? message.body.substring(0, 500) + "..."
                        : message.body}
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600">{message.recipientCount}</div>
                      <div className="text-xs text-blue-600">Recipients</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">{message.sentCount}</div>
                      <div className="text-xs text-green-600">Sent</div>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${message.openedCount > 0 ? 'bg-purple-50' : 'bg-gray-50'}`}>
                      <div className={`text-2xl font-bold ${message.openedCount > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                        {message.openedCount}
                      </div>
                      <div className={`text-xs ${message.openedCount > 0 ? 'text-purple-600' : 'text-gray-400'}`}>Opened</div>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${message.failedCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <div className={`text-2xl font-bold ${message.failedCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {message.failedCount}
                      </div>
                      <div className={`text-xs ${message.failedCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>Failed</div>
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

export default MassEmailHistoryPanel;
