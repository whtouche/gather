import { useEffect, useState } from "react";
import {
  getEmailInvitations,
  isApiError,
  type EmailInvitation,
  type EmailInvitationStats,
} from "../services/api";

interface EmailInvitationsPanelProps {
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
      return "bg-blue-100 text-blue-800";
    case "OPENED":
      return "bg-purple-100 text-purple-800";
    case "RSVPD":
      return "bg-green-100 text-green-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "PENDING":
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case "SENT":
      return "Sent";
    case "OPENED":
      return "Opened";
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
 * Panel component showing email invitation list and stats for organizers
 */
export function EmailInvitationsPanel({
  eventId,
  refreshKey = 0,
}: EmailInvitationsPanelProps) {
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string>("");
  const [invitations, setInvitations] = useState<EmailInvitation[]>([]);
  const [stats, setStats] = useState<EmailInvitationStats | null>(null);

  useEffect(() => {
    const fetchInvitations = async () => {
      setState("loading");
      setError("");

      try {
        const response = await getEmailInvitations(eventId);
        setInvitations(response.invitations);
        setStats(response.stats);
        setState("success");
      } catch (err) {
        setState("error");
        if (isApiError(err)) {
          setError(err.message);
        } else {
          setError("Failed to load email invitations");
        }
      }
    };

    fetchInvitations();
  }, [eventId, refreshKey]);

  if (state === "loading") {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Invitations</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Invitations</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Invitations</h3>
        <p className="text-gray-500 text-center py-4">
          No email invitations sent yet. Use the "Send Email Invites" button above to invite guests.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">Email Invitations</h3>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 p-4 bg-gray-50 border-b border-gray-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
            <div className="text-xs text-gray-500">Sent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.opened}</div>
            <div className="text-xs text-gray-500">Opened</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.rsvpd}</div>
            <div className="text-xs text-gray-500">RSVP'd</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-xs text-gray-500">Failed</div>
          </div>
        </div>
      )}

      {/* Invitation list */}
      <div className="max-h-64 overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Recipient</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Sent</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Opened</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invitations.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {inv.recipientName || "Unknown"}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">{inv.email}</div>
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
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {formatDate(inv.sentAt)}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {formatDate(inv.openedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default EmailInvitationsPanel;
