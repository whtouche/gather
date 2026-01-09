import { useState, useEffect } from "react";
import {
  validateInviteToken,
  startInviteRegistration,
  verifyInviteRegistration,
  setAuthToken,
  isAuthenticated,
  isApiError,
  type EventPreview,
} from "../services/api";

type ContactMethod = "phone" | "email";
type Step = "loading" | "register" | "verify" | "error" | "success";

interface InviteRegisterPageProps {
  inviteToken: string;
  onSuccess?: (eventId: string) => void;
}

/**
 * Registration page for invited users.
 * Handles both new user registration and existing user login via invite link.
 */
export function InviteRegisterPage({ inviteToken, onSuccess }: InviteRegisterPageProps) {
  // UI state
  const [step, setStep] = useState<Step>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Event data
  const [eventPreview, setEventPreview] = useState<EventPreview | null>(null);

  // Form data
  const [contactMethod, setContactMethod] = useState<ContactMethod>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [existingUser, setExistingUser] = useState(false);

  // Success data
  const [successEventId, setSuccessEventId] = useState<string | null>(null);

  // Validate invite token on mount
  useEffect(() => {
    async function validateToken() {
      // If already authenticated, redirect to event
      if (isAuthenticated()) {
        setStep("success");
        return;
      }

      try {
        const response = await validateInviteToken(inviteToken);
        if (response.valid && response.event) {
          setEventPreview(response.event);
          setStep("register");
        } else {
          setErrorMessage("This invitation link is invalid or has expired.");
          setStep("error");
        }
      } catch (error) {
        if (isApiError(error)) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to validate invitation link.");
        }
        setStep("error");
      }
    }

    validateToken();
  }, [inviteToken]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Handle registration form submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await startInviteRegistration({
        phone: contactMethod === "phone" ? phone : undefined,
        email: contactMethod === "email" ? email : undefined,
        displayName,
        inviteToken,
      });

      setExistingUser(response.existingUser);
      setStep("verify");
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to send verification code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle verification code submission
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await verifyInviteRegistration({
        phone: contactMethod === "phone" ? phone : undefined,
        email: contactMethod === "email" ? email : undefined,
        code: verificationCode,
        displayName,
        inviteToken,
        deviceInfo: navigator.userAgent,
      });

      // Store the auth token
      setAuthToken(response.token);

      // Set success state
      setSuccessEventId(response.event.id);
      setStep("success");

      // Callback to parent
      if (onSuccess) {
        onSuccess(response.event.id);
      }
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to verify code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Go back to registration form
  const handleBackToRegister = () => {
    setVerificationCode("");
    setErrorMessage("");
    setStep("register");
  };

  // Resend verification code
  const handleResendCode = async () => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await startInviteRegistration({
        phone: contactMethod === "phone" ? phone : undefined,
        email: contactMethod === "email" ? email : undefined,
        displayName,
        inviteToken,
      });
      setErrorMessage(""); // Clear any previous error
    } catch (error) {
      if (isApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to resend code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (step === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (step === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-gray-600">{errorMessage}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're In!</h1>
          <p className="text-gray-600 mb-6">
            Your account has been created. You can now RSVP to the event.
          </p>
          {successEventId && (
            <a
              href={`/events/${successEventId}`}
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              View Event & RSVP
            </a>
          )}
        </div>
      </div>
    );
  }

  // Verification step
  if (step === "verify") {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-md mx-auto">
          {/* Event Preview Card */}
          {eventPreview && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{eventPreview.title}</h2>
              <p className="text-gray-600 text-sm">{formatDate(eventPreview.dateTime)}</p>
              <p className="text-gray-500 text-sm">{eventPreview.location}</p>
            </div>
          )}

          {/* Verification Form */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <button
              type="button"
              onClick={handleBackToRegister}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">Enter Verification Code</h1>
            <p className="text-gray-600 mb-6">
              {existingUser
                ? `We found an existing account. Enter the code sent to ${contactMethod === "phone" ? phone : email} to log in.`
                : `Enter the 6-digit code sent to ${contactMethod === "phone" ? phone : email}`}
            </p>

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleVerifySubmit}>
              <div className="mb-6">
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  id="code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || verificationCode.length !== 6}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Verifying..." : "Verify & Continue"}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isSubmitting}
                className="text-blue-600 hover:text-blue-800 text-sm disabled:text-gray-400"
              >
                Resend code
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Event Preview Card */}
        {eventPreview && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            {eventPreview.imageUrl && (
              <img
                src={eventPreview.imageUrl}
                alt={eventPreview.title}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
            )}
            <h2 className="text-xl font-bold text-gray-900 mb-2">{eventPreview.title}</h2>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600 flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(eventPreview.dateTime)}
              </p>
              <p className="text-gray-600 flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {eventPreview.location}
              </p>
              <p className="text-gray-500 flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Hosted by {eventPreview.creator.displayName}
              </p>
            </div>
            {eventPreview.description && (
              <p className="mt-4 text-gray-600 text-sm line-clamp-3">{eventPreview.description}</p>
            )}
          </div>
        )}

        {/* Registration Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Join this Event</h1>
          <p className="text-gray-600 mb-6">
            Create an account to RSVP. It only takes a minute.
          </p>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleRegisterSubmit}>
            {/* Contact Method Toggle */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Method
              </label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setContactMethod("phone")}
                  className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                    contactMethod === "phone"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Phone
                </button>
                <button
                  type="button"
                  onClick={() => setContactMethod("email")}
                  className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                    contactMethod === "email"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Email
                </button>
              </div>
            </div>

            {/* Phone or Email Input */}
            {contactMethod === "phone" ? (
              <div className="mb-4">
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            ) : (
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            )}

            {/* Display Name */}
            <div className="mb-6">
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we call you?"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500">This is how you'll appear to other attendees</p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Sending Code..." : "Continue"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <a href="/login" className="text-blue-600 hover:text-blue-800">
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default InviteRegisterPage;
