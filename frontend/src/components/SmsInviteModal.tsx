import { useState, useEffect } from "react";
import {
  sendSmsInvitations,
  getSmsQuota,
  isApiError,
  type SmsInvitationRecipient,
  type SmsInvitationSendResult,
  type SmsQuotaInfo,
} from "../services/api";

interface SmsInviteModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onInvitesSent?: () => void;
}

type ModalState = "input" | "sending" | "results";

/**
 * Parse a multi-line text input into phone recipients.
 * Supports formats:
 * - +15551234567
 * - 555-123-4567
 * - Name +15551234567
 * - +15551234567, Name
 */
function parseRecipients(input: string): SmsInvitationRecipient[] {
  const lines = input.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const recipients: SmsInvitationRecipient[] = [];
  // Phone regex: optional +, digits with optional spaces/dashes/parens
  const phoneRegex = /\+?[\d\s\-()]{7,}/;

  for (const line of lines) {
    // Find phone number in the line
    const phoneMatch = line.match(phoneRegex);
    if (!phoneMatch) continue;

    const phone = phoneMatch[0].replace(/[\s\-()]/g, "");

    // Try to extract name from the rest of the line
    const nameBeforePhone = line.substring(0, phoneMatch.index).trim().replace(/[,:]$/, "").trim();
    const nameAfterPhone = line.substring((phoneMatch.index || 0) + phoneMatch[0].length).trim().replace(/^[,:]/, "").trim();

    const name = nameBeforePhone || nameAfterPhone || undefined;

    recipients.push({ phone, name });
  }

  return recipients;
}

/**
 * Modal component for sending SMS invitations
 */
export function SmsInviteModal({
  eventId,
  isOpen,
  onClose,
  onInvitesSent,
}: SmsInviteModalProps) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<ModalState>("input");
  const [error, setError] = useState<string>("");
  const [quota, setQuota] = useState<SmsQuotaInfo | null>(null);
  const [results, setResults] = useState<{
    sent: number;
    failed: number;
    alreadyInvited: number;
    details: SmsInvitationSendResult[];
    quota: SmsQuotaInfo;
  } | null>(null);

  // Fetch quota when modal opens
  useEffect(() => {
    if (isOpen) {
      getSmsQuota(eventId)
        .then((response) => setQuota(response.quota))
        .catch(() => {
          // Ignore error, will show default values
        });
    }
  }, [isOpen, eventId]);

  const handleClose = () => {
    setInput("");
    setState("input");
    setError("");
    setResults(null);
    onClose();
  };

  const handleSend = async () => {
    setError("");
    const recipients = parseRecipients(input);

    if (recipients.length === 0) {
      setError("Please enter at least one valid phone number");
      return;
    }

    if (recipients.length > 50) {
      setError("Maximum 50 recipients at a time");
      return;
    }

    // Check quota
    if (quota) {
      if (quota.atTotalLimit) {
        setError("SMS total limit reached for this event");
        return;
      }
      if (quota.atDailyLimit) {
        setError("SMS daily limit reached. Try again tomorrow.");
        return;
      }
      if (recipients.length > quota.dailyRemaining) {
        setError(`Daily limit allows only ${quota.dailyRemaining} more SMS today`);
        return;
      }
      if (recipients.length > quota.totalRemaining) {
        setError(`Total limit allows only ${quota.totalRemaining} more SMS for this event`);
        return;
      }
    }

    setState("sending");

    try {
      const response = await sendSmsInvitations(eventId, recipients);
      setResults({
        sent: response.sent,
        failed: response.failed,
        alreadyInvited: response.alreadyInvited,
        details: response.results,
        quota: response.quota,
      });
      setQuota(response.quota);
      setState("results");
      if (response.sent > 0 && onInvitesSent) {
        onInvitesSent();
      }
    } catch (err) {
      setState("input");
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to send SMS invitations");
      }
    }
  };

  if (!isOpen) return null;

  const recipientCount = parseRecipients(input).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              Send SMS Invitations
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {state === "input" && (
              <>
                {/* Quota warning */}
                {quota && (quota.atDailyLimit || quota.atTotalLimit) && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-800">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="font-medium">
                        {quota.atTotalLimit
                          ? "SMS limit reached for this event"
                          : "Daily SMS limit reached"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Quota info */}
                {quota && !quota.atTotalLimit && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Today:</span>
                      <span>{quota.dailyCount}/{quota.dailyLimit} sent</span>
                    </div>
                    <div className="flex justify-between text-gray-600 mt-1">
                      <span>Total for event:</span>
                      <span>{quota.totalCount}/{quota.totalLimit} sent</span>
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-600 mb-3">
                  Enter phone numbers to send SMS invitations. One number per line.
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Formats: <code className="bg-gray-100 px-1 rounded">+15551234567</code>{" "}
                  or <code className="bg-gray-100 px-1 rounded">Name +15551234567</code>
                </p>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="+15551234567&#10;Jane Doe +15559876543&#10;+15550001111"
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                  disabled={quota?.atDailyLimit || quota?.atTotalLimit}
                />
                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}
                <div className="mt-3 text-sm text-gray-500">
                  {recipientCount} valid recipient(s) detected
                  {quota && recipientCount > 0 && (
                    <span className="ml-2">
                      ({quota.dailyRemaining} daily / {quota.totalRemaining} total remaining)
                    </span>
                  )}
                </div>
              </>
            )}

            {state === "sending" && (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Sending SMS invitations...</p>
              </div>
            )}

            {state === "results" && results && (
              <div>
                {/* Summary */}
                <div className="mb-4">
                  {results.sent > 0 && (
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{results.sent} SMS invitation(s) sent successfully</span>
                    </div>
                  )}
                  {results.alreadyInvited > 0 && (
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{results.alreadyInvited} already invited</span>
                    </div>
                  )}
                  {results.failed > 0 && (
                    <div className="flex items-center gap-2 text-red-600 mb-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>{results.failed} failed to send</span>
                    </div>
                  )}
                </div>

                {/* Updated quota */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Remaining today:</span>
                    <span>{results.quota.dailyRemaining} SMS</span>
                  </div>
                  <div className="flex justify-between text-gray-600 mt-1">
                    <span>Remaining total:</span>
                    <span>{results.quota.totalRemaining} SMS</span>
                  </div>
                </div>

                {/* Details */}
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Phone</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {results.details.map((result, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 text-gray-900 font-mono text-xs">{result.phone}</td>
                          <td className="px-3 py-2">
                            {result.success ? (
                              <span className="inline-flex items-center gap-1 text-green-600">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Sent
                              </span>
                            ) : result.alreadyInvited ? (
                              <span className="text-amber-600">Already invited</span>
                            ) : (
                              <span className="text-red-600">{result.error || "Failed"}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
            {state === "input" && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={recipientCount === 0 || quota?.atDailyLimit || quota?.atTotalLimit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  Send SMS Invitations
                </button>
              </>
            )}
            {state === "results" && (
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SmsInviteModal;
