import { useState, useEffect } from "react";
import {
  sendMassSms,
  previewMassSmsRecipients,
  getMassSmsQuota,
  isApiError,
  type TargetAudience,
  type MassSmsQuota,
  type MassSmsRecipientPreview,
} from "../services/api";

interface MassSmsModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onMessageSent?: () => void;
}

type ModalState = "compose" | "preview" | "sending" | "results";

const AUDIENCE_OPTIONS: { value: TargetAudience; label: string; description: string }[] = [
  { value: "ALL", label: "All RSVP'd", description: "Everyone who has responded (Yes, No, Maybe)" },
  { value: "YES_ONLY", label: "Yes only", description: "Only confirmed attendees" },
  { value: "MAYBE_ONLY", label: "Maybe only", description: "Only tentative attendees" },
  { value: "NO_ONLY", label: "No only", description: "Only those who declined" },
  { value: "WAITLIST_ONLY", label: "Waitlist only", description: "Only people on the waitlist" },
];

export function MassSmsModal({
  eventId,
  isOpen,
  onClose,
  onMessageSent,
}: MassSmsModalProps) {
  const [state, setState] = useState<ModalState>("compose");
  const [message, setMessage] = useState("");
  const [targetAudience, setTargetAudience] = useState<TargetAudience>("YES_ONLY");
  const [error, setError] = useState("");
  const [quota, setQuota] = useState<MassSmsQuota | null>(null);
  const [recipientPreview, setRecipientPreview] = useState<{
    count: number;
    optedOutCount: number;
    preview: MassSmsRecipientPreview[];
    hasMore: boolean;
  } | null>(null);
  const [results, setResults] = useState<{
    sentCount: number;
    failedCount: number;
    recipientCount: number;
    optedOutCount: number;
  } | null>(null);

  // Load quota on mount
  useEffect(() => {
    if (isOpen) {
      loadQuota();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventId]);

  // Load recipient preview when audience changes
  useEffect(() => {
    if (isOpen && targetAudience) {
      loadRecipientPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventId, targetAudience]);

  const loadQuota = async () => {
    try {
      const response = await getMassSmsQuota(eventId);
      setQuota(response.quota);
    } catch (err) {
      console.error("Failed to load quota:", err);
    }
  };

  const loadRecipientPreview = async () => {
    try {
      const response = await previewMassSmsRecipients(eventId, targetAudience);
      setRecipientPreview(response);
    } catch (err) {
      console.error("Failed to load recipient preview:", err);
      setRecipientPreview(null);
    }
  };

  const handleClose = () => {
    setMessage("");
    setTargetAudience("YES_ONLY");
    setState("compose");
    setError("");
    setResults(null);
    setRecipientPreview(null);
    onClose();
  };

  const handlePreview = () => {
    setError("");

    if (!message.trim()) {
      setError("Message is required");
      return;
    }
    if (message.length > 160) {
      setError("Message must be 160 characters or less");
      return;
    }
    if (!recipientPreview || recipientPreview.count === 0) {
      setError("No recipients found for the selected audience");
      return;
    }
    if (quota && !quota.canSendNow) {
      setError("Cannot send: quota limit reached");
      return;
    }

    setState("preview");
  };

  const handleSend = async () => {
    setState("sending");
    setError("");

    try {
      const response = await sendMassSms(eventId, {
        message: message.trim(),
        targetAudience,
      });
      setResults({
        sentCount: response.sentCount,
        failedCount: response.failedCount,
        recipientCount: response.recipientCount,
        optedOutCount: response.optedOutCount,
      });
      setQuota(response.quota);
      setState("results");
      if (response.sentCount > 0 && onMessageSent) {
        onMessageSent();
      }
    } catch (err) {
      setState("compose");
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to send mass SMS");
      }
    }
  };

  if (!isOpen) return null;

  const charactersRemaining = 160 - message.length;
  const isOverLimit = charactersRemaining < 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {state === "compose" && "Send Mass SMS"}
              {state === "preview" && "Preview Message"}
              {state === "sending" && "Sending..."}
              {state === "results" && "Message Sent"}
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
          <div className="p-4 overflow-y-auto flex-1">
            {state === "compose" && (
              <>
                {/* Quota info */}
                {quota && (
                  <div className={`mb-4 p-3 rounded-lg ${
                    quota.atLimit ? 'bg-red-50 dark:bg-red-900/30' : quota.approachingLimit ? 'bg-amber-50 dark:bg-amber-900/30' : quota.canSendNow ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-amber-50 dark:bg-amber-900/30'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${
                        quota.atLimit ? 'text-red-700 dark:text-red-300' : quota.approachingLimit ? 'text-amber-700 dark:text-amber-300' : quota.canSendNow ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-300'
                      }`}>
                        {quota.used} of {quota.limit} mass SMS sent this week
                      </span>
                      {!quota.canSendNow && quota.nextSendAllowed && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          (Next: {new Date(quota.nextSendAllowed).toLocaleString()})
                        </span>
                      )}
                    </div>
                    <div className="mt-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          quota.atLimit ? 'bg-red-500' : quota.approachingLimit ? 'bg-amber-500' : quota.canSendNow ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${(quota.used / quota.limit) * 100}%` }}
                      />
                    </div>
                    {quota.approachingLimit && !quota.atLimit && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        Warning: You're approaching your weekly limit. {quota.remaining} SMS remaining.
                      </p>
                    )}
                    {quota.atLimit && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                        You've reached your weekly limit. Quota resets on Sunday.
                      </p>
                    )}
                  </div>
                )}

                {/* Target Audience */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target Audience
                  </label>
                  <div className="space-y-2">
                    {AUDIENCE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          targetAudience === option.value
                            ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="targetAudience"
                          value={option.value}
                          checked={targetAudience === option.value}
                          onChange={(e) => setTargetAudience(e.target.value as TargetAudience)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{option.label}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{option.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {recipientPreview && (
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      <p>{recipientPreview.count} recipient(s) will receive this message</p>
                      {recipientPreview.optedOutCount > 0 && (
                        <p className="text-amber-600 dark:text-amber-400">
                          {recipientPreview.optedOutCount} recipient(s) have opted out of SMS
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Message */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your SMS message here (max 160 characters)..."
                    rows={4}
                    maxLength={200}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 ${
                      isOverLimit
                        ? 'border-red-300 dark:border-red-600 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400'
                    }`}
                  />
                  <div className="mt-1 flex justify-between items-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Keep it short! SMS messages are limited to 160 characters.
                    </p>
                    <p className={`text-sm font-medium ${
                      isOverLimit ? 'text-red-600 dark:text-red-400' : charactersRemaining <= 20 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {charactersRemaining}
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Recipients can reply STOP to opt out of future SMS from this event.
                </p>
              </>
            )}

            {state === "preview" && (
              <div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">To:</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                    {recipientPreview?.count} recipient(s) - {AUDIENCE_OPTIONS.find(o => o.value === targetAudience)?.label}
                  </div>

                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Message ({message.length}/160 characters):</div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-3 whitespace-pre-wrap text-gray-900 dark:text-gray-100 font-mono text-sm">
                    {message}
                  </div>
                </div>

                {recipientPreview && recipientPreview.preview.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Recipients Preview:
                    </div>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                      {recipientPreview.preview.map((recipient, index) => (
                        <div key={index} className="px-3 py-2 flex items-center justify-between">
                          <span className="text-sm text-gray-900 dark:text-gray-100">{recipient.displayName}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{recipient.phone}</span>
                        </div>
                      ))}
                    </div>
                    {recipientPreview.hasMore && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        ...and {recipientPreview.count - recipientPreview.preview.length} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {state === "sending" && (
              <div className="py-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Sending SMS to {recipientPreview?.count} recipient(s)...</p>
              </div>
            )}

            {state === "results" && results && (
              <div className="py-8">
                <div className="text-center mb-6">
                  {results.sentCount > 0 ? (
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                      <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                      <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {results.sentCount > 0 ? "SMS Sent!" : "Failed to Send"}
                  </h3>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total recipients:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{results.recipientCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Successfully sent:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{results.sentCount}</span>
                  </div>
                  {results.failedCount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Failed:</span>
                      <span className="font-medium text-red-600 dark:text-red-400">{results.failedCount}</span>
                    </div>
                  )}
                  {results.optedOutCount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Opted out (skipped):</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">{results.optedOutCount}</span>
                    </div>
                  )}
                </div>

                {quota && (
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                    {quota.remaining} mass SMS remaining this week
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
            {state === "compose" && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePreview}
                  disabled={!quota?.canSendNow || !recipientPreview?.count || isOverLimit}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium disabled:bg-blue-300 dark:disabled:bg-blue-800 disabled:cursor-not-allowed"
                >
                  Preview
                </button>
              </>
            )}
            {state === "preview" && (
              <>
                <button
                  onClick={() => setState("compose")}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleSend}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
                >
                  Send to {recipientPreview?.count} recipient(s)
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

export default MassSmsModal;
