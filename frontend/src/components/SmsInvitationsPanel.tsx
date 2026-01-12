import { useEffect, useState } from "react";
import {
  getSmsInvitations,
  isApiError,
  type SmsInvitation,
  type SmsInvitationStats,
  type SmsQuotaInfo,
} from "../services/api";

interface SmsInvitationsPanelProps {
  eventId: string;
  refreshKey?: number;
}

type LoadState = "loading" | "success" | "error";

/**
 * Get status badge classes based on invitation status
 */
function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case "SENT":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "RSVPD":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "FAILED":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "PENDING":
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case "SENT":
      return "Sent";
    case "RSVPD":
      return "RSVP'd";
    case "FAILED":
      return "Failed";
    case "PENDING":
    default:
      return "Pending";
  }
}

/**
 * Format a date string for display
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Panel component showing SMS invitation list and stats for organizers
 */
export function SmsInvitationsPanel({
  eventId,
  refreshKey = 0,
}: SmsInvitationsPanelProps) {
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string>("");
  const [invitations, setInvitations] = useState<SmsInvitation[]>([]);
  const [stats, setStats] = useState<SmsInvitationStats | null>(null);
  const [quota, setQuota] = useState<SmsQuotaInfo | null>(null);

  useEffect(() => {
    const fetchInvitations = async () => {
      setState("loading");
      setError("");

      try {
        const response = await getSmsInvitations(eventId);
        setInvitations(response.invitations);
        setStats(response.stats);
        setQuota(response.quota);
        setState("success");
      } catch (err) {
        setState("error");
        if (isApiError(err)) {
          setError(err.message);
        } else {
          setError("Failed to load SMS invitations");
        }
      }
    };

    fetchInvitations();
  }, [eventId, refreshKey]);

  if (state === "loading") {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">SMS Invitations</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">SMS Invitations</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">SMS Invitations</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
          No SMS invitations sent yet. Use the "Send SMS Invites" button above to invite guests.
        </p>
        {quota && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm text-center">
            <span className="text-gray-600 dark:text-gray-400">
              {quota.dailyRemaining} daily / {quota.totalRemaining} total SMS remaining
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">SMS Invitations</h3>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.sent}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Sent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.rsvpd}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">RSVP'd</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
          </div>
        </div>
      )}

      {/* Quota info */}
      {quota && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border-b border-gray-100 dark:border-gray-700 text-sm text-center">
          <span className="text-blue-800 dark:text-blue-300">
            SMS Quota: {quota.dailyRemaining}/{quota.dailyLimit} daily | {quota.totalRemaining}/{quota.totalLimit} total remaining
          </span>
        </div>
      )}

      {/* Invitation list */}
      <div className="max-h-64 overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Recipient</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {invitations.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {inv.recipientName || "Unknown"}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{inv.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClasses(
                      inv.status
                    )}`}
                  >
                    {getStatusLabel(inv.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                  {formatDate(inv.sentAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SmsInvitationsPanel;
