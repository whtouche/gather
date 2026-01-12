import { useState } from "react";
import {
  sendEmailInvitations,
  isApiError,
  type EmailInvitationRecipient,
  type EmailInvitationSendResult,
} from "../services/api";

interface EmailInviteModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onInvitesSent?: () => void;
}

type ModalState = "input" | "sending" | "results";

/**
 * Parse a multi-line text input into email recipients.
 * Supports formats:
 * - email@example.com
 * - Name <email@example.com>
 * - email@example.com, name
 */
function parseRecipients(input: string): EmailInvitationRecipient[] {
  const lines = input.split(/[\n,]/).map((line) => line.trim()).filter(Boolean);
  const recipients: EmailInvitationRecipient[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const nameEmailRegex = /^(.+?)\s*<([^\s@]+@[^\s@]+\.[^\s@]+)>$/;

  for (const line of lines) {
    // Try "Name <email>" format
    const nameEmailMatch = line.match(nameEmailRegex);
    if (nameEmailMatch) {
      recipients.push({
        name: nameEmailMatch[1].trim(),
        email: nameEmailMatch[2].trim().toLowerCase(),
      });
      continue;
    }

    // Try plain email format
    if (emailRegex.test(line)) {
      recipients.push({ email: line.toLowerCase() });
      continue;
    }

    // Try "email, name" or "email name" format
    const parts = line.split(/[,\t]/).map((p) => p.trim());
    if (parts.length >= 2 && emailRegex.test(parts[0])) {
      recipients.push({
        email: parts[0].toLowerCase(),
        name: parts[1],
      });
      continue;
    }

    // Skip invalid entries
  }

  return recipients;
}

/**
 * Modal component for sending email invitations
 */
export function EmailInviteModal({
  eventId,
  isOpen,
  onClose,
  onInvitesSent,
}: EmailInviteModalProps) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<ModalState>("input");
  const [error, setError] = useState<string>("");
  const [results, setResults] = useState<{
    sent: number;
    failed: number;
    alreadyInvited: number;
    details: EmailInvitationSendResult[];
  } | null>(null);

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
      setError("Please enter at least one valid email address");
      return;
    }

    if (recipients.length > 50) {
      setError("Maximum 50 recipients at a time");
      return;
    }

    setState("sending");

    try {
      const response = await sendEmailInvitations(eventId, recipients);
      setResults({
        sent: response.sent,
        failed: response.failed,
        alreadyInvited: response.alreadyInvited,
        details: response.results,
      });
      setState("results");
      if (response.sent > 0 && onInvitesSent) {
        onInvitesSent();
      }
    } catch (err) {
      setState("input");
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to send invitations");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Send Email Invitations
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
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
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Enter email addresses to send invitations. You can add one per line or separate with commas.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Formats: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">email@example.com</code>{" "}
                  or <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Name &lt;email@example.com&gt;</code>
                </p>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="john@example.com&#10;Jane Doe <jane@example.com>&#10;bob@example.com"
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none font-mono text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                {error && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
                )}
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  {parseRecipients(input).length} valid recipient(s) detected
                </div>
              </>
            )}

            {state === "sending" && (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Sending invitations...</p>
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
                      <span>{results.sent} invitation(s) sent successfully</span>
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

                {/* Details */}
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Email</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {results.details.map((result, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100 font-mono text-xs">{result.email}</td>
                          <td className="px-3 py-2">
                            {result.success ? (
                              <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Sent
                              </span>
                            ) : result.alreadyInvited ? (
                              <span className="text-amber-600 dark:text-amber-400">Already invited</span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400">{result.error || "Failed"}</span>
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
          <div className="flex justify-end gap-3 p-4 border-t border-gray-100 dark:border-gray-700">
            {state === "input" && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={parseRecipients(input).length === 0}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium disabled:bg-blue-300 dark:disabled:bg-blue-800 disabled:cursor-not-allowed"
                >
                  Send Invitations
                </button>
              </>
            )}
            {state === "results" && (
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
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

export default EmailInviteModal;
