import { useState, useEffect, useCallback } from "react";
import { QuestionnaireForm, type Question } from "./QuestionnaireForm";

// =============================================================================
// Types
// =============================================================================

type RSVPResponse = "YES" | "NO" | "MAYBE";

interface RSVPData {
  id: string;
  eventId: string;
  userId: string;
  response: RSVPResponse;
  createdAt: string;
  updatedAt: string;
}

interface RSVPState {
  rsvp: RSVPData | null;
  canModify: boolean;
  deadlinePassed: boolean;
  rsvpDeadline: string | null;
}

interface WaitlistState {
  onWaitlist: boolean;
  position: number | null;
  totalWaitlist: number;
  notifiedAt: string | null;
  expiresAt: string | null;
}

interface RSVPButtonsProps {
  eventId: string;
  authToken: string;
  initialRsvp?: RSVPResponse | null;
  rsvpDeadline?: string | null;
  capacity?: number | null;
  waitlistEnabled?: boolean;
  currentYesCount?: number;
  onRsvpChange?: (response: RSVPResponse | null) => void;
  apiBaseUrl?: string;
}

// =============================================================================
// Helper functions
// =============================================================================

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "Deadline has passed";
  } else if (diffDays === 0) {
    return "Deadline is today!";
  } else if (diffDays === 1) {
    return "Deadline is tomorrow";
  } else if (diffDays <= 7) {
    return `${diffDays} days left to RSVP`;
  } else {
    return `RSVP by ${date.toLocaleDateString()}`;
  }
}

function getDeadlineUrgency(deadline: string | null): "none" | "warning" | "urgent" | "passed" {
  if (!deadline) return "none";

  const date = new Date(deadline);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "passed";
  if (diffDays <= 1) return "urgent";
  if (diffDays <= 3) return "warning";
  return "none";
}

// =============================================================================
// Component
// =============================================================================

export function RSVPButtons({
  eventId,
  authToken,
  initialRsvp = null,
  rsvpDeadline = null,
  capacity = null,
  waitlistEnabled = false,
  currentYesCount = 0,
  onRsvpChange,
  apiBaseUrl = "/api",
}: RSVPButtonsProps) {
  const [rsvpState, setRsvpState] = useState<RSVPState>({
    rsvp: initialRsvp ? { response: initialRsvp } as RSVPData : null,
    canModify: true,
    deadlinePassed: false,
    rsvpDeadline,
  });
  const [waitlistState, setWaitlistState] = useState<WaitlistState>({
    onWaitlist: false,
    position: null,
    totalWaitlist: 0,
    notifiedAt: null,
    expiresAt: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [pendingRsvp, setPendingRsvp] = useState<RSVPResponse | null>(null);

  // Calculate if event is at capacity
  const isAtCapacity = capacity !== null && currentYesCount >= capacity && rsvpState.rsvp?.response !== "YES";

  // Fetch current RSVP state
  const fetchRsvp = useCallback(async () => {
    if (!authToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/events/${eventId}/rsvp`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to fetch RSVP");
      }

      const data = await response.json();
      setRsvpState({
        rsvp: data.rsvp,
        canModify: data.canModify,
        deadlinePassed: data.deadlinePassed,
        rsvpDeadline: data.rsvpDeadline,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [eventId, authToken, apiBaseUrl]);

  // Fetch waitlist status
  const fetchWaitlist = useCallback(async () => {
    if (!authToken || !waitlistEnabled) return;

    try {
      const response = await fetch(`${apiBaseUrl}/events/${eventId}/waitlist`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWaitlistState({
          onWaitlist: data.onWaitlist,
          position: data.waitlist?.position || null,
          totalWaitlist: data.waitlist?.totalWaitlist || 0,
          notifiedAt: data.waitlist?.notifiedAt || null,
          expiresAt: data.waitlist?.expiresAt || null,
        });
      }
    } catch {
      // Silently fail - waitlist status is optional
    }
  }, [eventId, authToken, apiBaseUrl, waitlistEnabled]);

  // Fetch questionnaire questions
  const fetchQuestions = useCallback(async () => {
    if (!authToken) return;

    try {
      const response = await fetch(`${apiBaseUrl}/events/${eventId}/questionnaire`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
      }
    } catch {
      // Silently fail - questionnaire is optional
    }
  }, [eventId, authToken, apiBaseUrl]);

  // Fetch RSVP, waitlist, and questions on mount
  useEffect(() => {
    fetchRsvp();
    fetchWaitlist();
    fetchQuestions();
  }, [fetchRsvp, fetchWaitlist, fetchQuestions]);

  // Handle RSVP button click - check for questionnaire
  const handleRsvpClick = (response: RSVPResponse) => {
    // For YES and MAYBE with questionnaire, show the form first
    if ((response === "YES" || response === "MAYBE") && questions.length > 0) {
      setPendingRsvp(response);
      setShowQuestionnaire(true);
    } else {
      // For NO or no questionnaire, submit directly
      submitRsvp(response);
    }
  };

  // Submit RSVP (called directly or after questionnaire)
  const submitRsvp = async (response: RSVPResponse, questionnaireResponses?: Record<string, unknown>) => {
    if (!authToken || !rsvpState.canModify) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const body: { response: RSVPResponse; questionnaireResponses?: Record<string, unknown> } = { response };
      if (questionnaireResponses) {
        body.questionnaireResponses = questionnaireResponses;
      }

      const res = await fetch(`${apiBaseUrl}/events/${eventId}/rsvp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to submit RSVP");
      }

      setRsvpState((prev) => ({
        ...prev,
        rsvp: data.rsvp,
      }));
      setSuccessMessage(data.message || "RSVP submitted successfully!");
      onRsvpChange?.(response);
      setShowQuestionnaire(false);
      setPendingRsvp(null);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle questionnaire submission
  const handleQuestionnaireSubmit = async (responses: Record<string, unknown>) => {
    if (pendingRsvp) {
      await submitRsvp(pendingRsvp, responses);
    }
  };

  // Handle questionnaire cancellation (for MAYBE responses)
  const handleQuestionnaireCancel = async () => {
    if (pendingRsvp === "MAYBE") {
      // Submit MAYBE without questionnaire responses
      await submitRsvp(pendingRsvp, {});
    }
    setShowQuestionnaire(false);
    setPendingRsvp(null);
  };

  // Remove RSVP
  const removeRsvp = async () => {
    if (!authToken || !rsvpState.canModify || !rsvpState.rsvp) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${apiBaseUrl}/events/${eventId}/rsvp`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to remove RSVP");
      }

      setRsvpState((prev) => ({
        ...prev,
        rsvp: null,
      }));
      setSuccessMessage("RSVP removed successfully!");
      onRsvpChange?.(null);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Join waitlist
  const joinWaitlist = async () => {
    if (!authToken) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${apiBaseUrl}/events/${eventId}/waitlist`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to join waitlist");
      }

      setWaitlistState({
        onWaitlist: true,
        position: data.waitlist?.position || null,
        totalWaitlist: 0,
        notifiedAt: null,
        expiresAt: null,
      });
      setSuccessMessage(data.message || "You have been added to the waitlist!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Leave waitlist
  const leaveWaitlist = async () => {
    if (!authToken) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${apiBaseUrl}/events/${eventId}/waitlist`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to leave waitlist");
      }

      setWaitlistState({
        onWaitlist: false,
        position: null,
        totalWaitlist: 0,
        notifiedAt: null,
        expiresAt: null,
      });
      setSuccessMessage("You have been removed from the waitlist");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm waitlist spot
  const confirmWaitlistSpot = async () => {
    if (!authToken) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${apiBaseUrl}/events/${eventId}/waitlist/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to confirm spot");
      }

      // Update states - user is now RSVP'd YES
      setRsvpState((prev) => ({
        ...prev,
        rsvp: { response: "YES" } as RSVPData,
      }));
      setWaitlistState({
        onWaitlist: false,
        position: null,
        totalWaitlist: 0,
        notifiedAt: null,
        expiresAt: null,
      });
      setSuccessMessage(data.message || "Your attendance has been confirmed!");
      onRsvpChange?.("YES");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentResponse = rsvpState.rsvp?.response;
  const deadlineUrgency = getDeadlineUrgency(rsvpState.rsvpDeadline);

  // Button styling based on state
  const getButtonClasses = (response: RSVPResponse): string => {
    const baseClasses =
      "px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const isSelected = currentResponse === response;
    const isDisabled = !rsvpState.canModify || isSubmitting;

    if (isDisabled) {
      if (isSelected) {
        switch (response) {
          case "YES":
            return `${baseClasses} bg-green-100 text-green-800 border-2 border-green-500`;
          case "NO":
            return `${baseClasses} bg-red-100 text-red-800 border-2 border-red-500`;
          case "MAYBE":
            return `${baseClasses} bg-yellow-100 text-yellow-800 border-2 border-yellow-500`;
        }
      }
      return `${baseClasses} bg-gray-100 text-gray-400 border border-gray-200`;
    }

    if (isSelected) {
      switch (response) {
        case "YES":
          return `${baseClasses} bg-green-500 text-white border-2 border-green-600 hover:bg-green-600 focus:ring-green-500 shadow-md`;
        case "NO":
          return `${baseClasses} bg-red-500 text-white border-2 border-red-600 hover:bg-red-600 focus:ring-red-500 shadow-md`;
        case "MAYBE":
          return `${baseClasses} bg-yellow-500 text-white border-2 border-yellow-600 hover:bg-yellow-600 focus:ring-yellow-500 shadow-md`;
      }
    }

    switch (response) {
      case "YES":
        return `${baseClasses} bg-white text-green-700 border-2 border-green-300 hover:bg-green-50 hover:border-green-400 focus:ring-green-500`;
      case "NO":
        return `${baseClasses} bg-white text-red-700 border-2 border-red-300 hover:bg-red-50 hover:border-red-400 focus:ring-red-500`;
      case "MAYBE":
        return `${baseClasses} bg-white text-yellow-700 border-2 border-yellow-300 hover:bg-yellow-50 hover:border-yellow-400 focus:ring-yellow-500`;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Deadline warning */}
      {rsvpState.rsvpDeadline && deadlineUrgency !== "none" && (
        <div
          className={`p-3 rounded-lg text-sm ${
            deadlineUrgency === "passed"
              ? "bg-gray-100 text-gray-700"
              : deadlineUrgency === "urgent"
              ? "bg-red-100 text-red-700 border border-red-200"
              : "bg-yellow-100 text-yellow-700 border border-yellow-200"
          }`}
        >
          <span className="font-medium">
            {deadlineUrgency === "urgent" && "Hurry! "}
            {formatDeadline(rsvpState.rsvpDeadline)}
          </span>
        </div>
      )}

      {/* Deadline passed message */}
      {rsvpState.deadlinePassed && (
        <div className="p-4 bg-gray-100 rounded-lg border border-gray-200">
          <p className="text-gray-700 font-medium">RSVP deadline has passed</p>
          <p className="text-gray-500 text-sm mt-1">
            Please contact the organizer if you need to change your RSVP.
          </p>
        </div>
      )}

      {/* Current RSVP status */}
      {currentResponse && (
        <div className="text-sm text-gray-600">
          <span>Your current response: </span>
          <span
            className={`font-semibold ${
              currentResponse === "YES"
                ? "text-green-600"
                : currentResponse === "NO"
                ? "text-red-600"
                : "text-yellow-600"
            }`}
          >
            {currentResponse === "YES"
              ? "Yes, I'll attend"
              : currentResponse === "NO"
              ? "No, I can't attend"
              : "Maybe"}
          </span>
        </div>
      )}

      {/* Waitlist notification - user has been notified of available spot */}
      {waitlistState.onWaitlist && waitlistState.notifiedAt && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-green-800 font-medium">A spot has opened up!</p>
          <p className="text-green-600 text-sm mt-1">
            {waitlistState.expiresAt
              ? `You have until ${new Date(waitlistState.expiresAt).toLocaleString()} to confirm your spot.`
              : "Please confirm your attendance."}
          </p>
          <button
            type="button"
            onClick={confirmWaitlistSpot}
            disabled={isSubmitting}
            className="mt-3 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isSubmitting ? "Confirming..." : "Confirm My Spot"}
          </button>
        </div>
      )}

      {/* Waitlist status - user is on waitlist but not notified yet */}
      {waitlistState.onWaitlist && !waitlistState.notifiedAt && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-blue-800 font-medium">You're on the waitlist</p>
          <p className="text-blue-600 text-sm mt-1">
            {waitlistState.position
              ? `Position: #${waitlistState.position}${waitlistState.totalWaitlist > 0 ? ` of ${waitlistState.totalWaitlist}` : ""}`
              : "We'll notify you when a spot opens up."}
          </p>
          <button
            type="button"
            onClick={leaveWaitlist}
            disabled={isSubmitting}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
          >
            Leave waitlist
          </button>
        </div>
      )}

      {/* At capacity message with waitlist option */}
      {isAtCapacity && !waitlistState.onWaitlist && !currentResponse && (
        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
          <p className="text-orange-800 font-medium">This event is at capacity</p>
          {waitlistEnabled ? (
            <>
              <p className="text-orange-600 text-sm mt-1">
                You can join the waitlist to be notified if a spot opens up.
              </p>
              <button
                type="button"
                onClick={joinWaitlist}
                disabled={isSubmitting}
                className="mt-3 px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
              >
                {isSubmitting ? "Joining..." : "Join Waitlist"}
              </button>
            </>
          ) : (
            <p className="text-orange-600 text-sm mt-1">
              No more spots are available for this event.
            </p>
          )}
        </div>
      )}

      {/* RSVP Buttons - hide Yes button if at capacity and not already RSVP'd yes */}
      {!waitlistState.onWaitlist && (
        <div className="flex flex-wrap gap-3">
          {/* Only show Yes button if not at capacity or user already RSVP'd yes */}
          {(!isAtCapacity || currentResponse === "YES") && (
            <button
              type="button"
              onClick={() => handleRsvpClick("YES")}
              disabled={!rsvpState.canModify || isSubmitting}
              className={getButtonClasses("YES")}
              aria-pressed={currentResponse === "YES"}
            >
              {isSubmitting && currentResponse !== "YES" ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                  Saving...
                </span>
              ) : (
                "Yes"
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleRsvpClick("NO")}
            disabled={!rsvpState.canModify || isSubmitting}
            className={getButtonClasses("NO")}
            aria-pressed={currentResponse === "NO"}
          >
            {isSubmitting && currentResponse !== "NO" ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                Saving...
              </span>
            ) : (
              "No"
            )}
          </button>

          <button
            type="button"
            onClick={() => handleRsvpClick("MAYBE")}
            disabled={!rsvpState.canModify || isSubmitting}
            className={getButtonClasses("MAYBE")}
            aria-pressed={currentResponse === "MAYBE"}
          >
            {isSubmitting && currentResponse !== "MAYBE" ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                Saving...
              </span>
            ) : (
              "Maybe"
            )}
          </button>
        </div>
      )}

      {/* Remove RSVP option */}
      {currentResponse && rsvpState.canModify && !waitlistState.onWaitlist && (
        <button
          type="button"
          onClick={removeRsvp}
          disabled={isSubmitting}
          className="text-sm text-gray-500 hover:text-gray-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Remove my RSVP
        </button>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="p-3 bg-green-100 text-green-700 rounded-lg border border-green-200 animate-fade-in">
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Questionnaire Form */}
      {showQuestionnaire && pendingRsvp && questions.length > 0 && (
        <div className="mt-4">
          <QuestionnaireForm
            eventId={eventId}
            authToken={authToken}
            questions={questions}
            rsvpResponse={pendingRsvp}
            onSubmit={handleQuestionnaireSubmit}
            onCancel={pendingRsvp === "MAYBE" ? handleQuestionnaireCancel : undefined}
            apiBaseUrl={apiBaseUrl}
          />
        </div>
      )}
    </div>
  );
}

export default RSVPButtons;
