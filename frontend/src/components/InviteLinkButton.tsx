import { useState } from "react";
import { generateInviteLink, isApiError } from "../services/api";

interface InviteLinkButtonProps {
  eventId: string;
  disabled?: boolean;
}

type CopyStatus = "idle" | "loading" | "copied" | "error";

/**
 * Button component that generates and copies an invitation link to clipboard.
 * Only visible to event organizers.
 */
export function InviteLinkButton({ eventId, disabled = false }: InviteLinkButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleGenerateAndCopy = async () => {
    if (disabled || status === "loading") return;

    setStatus("loading");
    setErrorMessage("");

    try {
      // Generate a new invitation link
      const response = await generateInviteLink(eventId);
      const token = response.inviteLink.token;

      // Construct the full invite URL
      const inviteUrl = `${window.location.origin}/invite/${token}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(inviteUrl);

      setStatus("copied");

      // Reset status after 3 seconds
      setTimeout(() => {
        setStatus("idle");
      }, 3000);
    } catch (error) {
      setStatus("error");
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to generate invitation link");
      }

      // Reset status after 5 seconds
      setTimeout(() => {
        setStatus("idle");
        setErrorMessage("");
      }, 5000);
    }
  };

  const getButtonText = () => {
    switch (status) {
      case "loading":
        return "Generating...";
      case "copied":
        return "Link Copied!";
      case "error":
        return "Error";
      default:
        return "Copy Invite Link";
    }
  };

  const getButtonClasses = () => {
    const baseClasses =
      "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

    if (disabled) {
      return `${baseClasses} bg-gray-200 text-gray-400 cursor-not-allowed`;
    }

    switch (status) {
      case "loading":
        return `${baseClasses} bg-blue-400 text-white cursor-wait`;
      case "copied":
        return `${baseClasses} bg-green-500 text-white focus:ring-green-500`;
      case "error":
        return `${baseClasses} bg-red-500 text-white focus:ring-red-500`;
      default:
        return `${baseClasses} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500`;
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleGenerateAndCopy}
        disabled={disabled || status === "loading"}
        className={getButtonClasses()}
        aria-label={status === "copied" ? "Invite link copied to clipboard" : "Generate and copy invite link"}
      >
        {/* Icon */}
        {status === "loading" ? (
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : status === "copied" ? (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : status === "error" ? (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        )}
        {getButtonText()}
      </button>
      {status === "error" && errorMessage && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export default InviteLinkButton;
