import { useEffect, useState } from "react";
import {
  validateInviteToken,
  startInviteRegistration,
  verifyInviteRegistration,
  setAuthToken,
  isAuthenticated,
  isApiError,
  type EventPreview,
} from "../services/api";

interface InvitePageProps {
  token: string;
}

type PageState = "loading" | "success" | "error";
type RegistrationStep = "idle" | "form" | "verify";
type ContactMethod = "phone" | "email";

/**
 * Format a date for display
 */
function formatDate(dateString: string, timezone: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  });
}

/**
 * Format a time for display
 */
function formatTime(dateString: string, timezone: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

/**
 * Page component for displaying event preview from invitation link.
 * Visitors access this page when clicking on a shared invite link.
 */
export function InvitePage({ token }: InvitePageProps) {
  const [state, setState] = useState<PageState>("loading");
  const [event, setEvent] = useState<EventPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorCode, setErrorCode] = useState<string>("");

  // Registration flow state
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>("idle");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [existingUser, setExistingUser] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const fetchEventPreview = async () => {
      setState("loading");
      setErrorMessage("");
      setErrorCode("");

      // Check if already logged in
      if (isAuthenticated()) {
        setIsLoggedIn(true);
      }

      try {
        const response = await validateInviteToken(token);
        setEvent(response.event);
        setState("success");
      } catch (error) {
        setState("error");
        if (isApiError(error)) {
          setErrorMessage(error.message);
          setErrorCode(error.code || "");
        } else {
          setErrorMessage("Failed to load event details");
        }
      }
    };

    fetchEventPreview();
  }, [token]);

  // Handle registration form submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setRegistrationError("");

    try {
      const response = await startInviteRegistration({
        phone: contactMethod === "phone" ? phone : undefined,
        email: contactMethod === "email" ? email : undefined,
        displayName,
        inviteToken: token,
      });

      setExistingUser(response.existingUser);
      setRegistrationStep("verify");
    } catch (error) {
      if (isApiError(error)) {
        setRegistrationError(error.message);
      } else {
        setRegistrationError("Failed to send verification code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle verification code submission
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setRegistrationError("");

    try {
      const response = await verifyInviteRegistration({
        phone: contactMethod === "phone" ? phone : undefined,
        email: contactMethod === "email" ? email : undefined,
        code: verificationCode,
        displayName,
        inviteToken: token,
        deviceInfo: navigator.userAgent,
      });

      // Store the auth token
      setAuthToken(response.token);
      setIsLoggedIn(true);
      setRegistrationStep("idle");

      // Redirect to event page
      window.location.href = `/events/${response.event.id}`;
    } catch (error) {
      if (isApiError(error)) {
        setRegistrationError(error.message);
      } else {
        setRegistrationError("Failed to verify code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    setIsSubmitting(true);
    setRegistrationError("");

    try {
      await startInviteRegistration({
        phone: contactMethod === "phone" ? phone : undefined,
        email: contactMethod === "email" ? email : undefined,
        displayName,
        inviteToken: token,
      });
    } catch (error) {
      if (isApiError(error)) {
        setRegistrationError(error.message);
      } else {
        setRegistrationError("Failed to resend code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Go back to registration form
  const handleBackToForm = () => {
    setVerificationCode("");
    setRegistrationError("");
    setRegistrationStep("form");
  };

  // Loading state
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading event details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    const getErrorIcon = () => {
      if (errorCode === "EVENT_CANCELLED" || errorCode === "INVITE_INACTIVE") {
        return (
          <svg
            className="h-16 w-16 text-gray-400 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        );
      }
      if (errorCode === "EVENT_COMPLETED") {
        return (
          <svg
            className="h-16 w-16 text-gray-400 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      }
      return (
        <svg
          className="h-16 w-16 text-gray-400 mx-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-8 text-center">
          {getErrorIcon()}
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            {errorCode === "INVITE_NOT_FOUND" && "Invitation Not Found"}
            {errorCode === "INVITE_INACTIVE" && "Invitation No Longer Active"}
            {errorCode === "INVITE_EXPIRED" && "Invitation Expired"}
            {errorCode === "EVENT_CANCELLED" && "Event Cancelled"}
            {errorCode === "EVENT_COMPLETED" && "Event Has Ended"}
            {errorCode === "EVENT_NOT_AVAILABLE" && "Event Not Available"}
            {!errorCode && "Something Went Wrong"}
          </h1>
          <p className="mt-2 text-gray-600">{errorMessage}</p>
          <a
            href="/"
            className="mt-6 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  // Success state - show event preview
  if (!event) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero section with event image or gradient */}
      <div
        className={`relative h-64 ${
          event.imageUrl
            ? "bg-cover bg-center"
            : "bg-gradient-to-br from-blue-600 to-purple-700"
        }`}
        style={event.imageUrl ? { backgroundImage: `url(${event.imageUrl})` } : undefined}
      >
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="max-w-3xl mx-auto">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-sm rounded-full mb-3">
              You&apos;re Invited
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-white">{event.title}</h1>
          </div>
        </div>
      </div>

      {/* Event details */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Date and Time */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {formatDate(event.dateTime, event.timezone)}
                </h3>
                <p className="text-gray-600">
                  {formatTime(event.dateTime, event.timezone)}
                  {event.endDateTime && ` - ${formatTime(event.endDateTime, event.timezone)}`}
                </p>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Location</h3>
                <p className="text-gray-600">{event.location}</p>
              </div>
            </div>
          </div>

          {/* Hosted by */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {event.creator.photoUrl ? (
                  <img
                    src={event.creator.photoUrl}
                    alt={event.creator.displayName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-lg font-semibold text-purple-600">
                      {event.creator.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Hosted by</p>
                <p className="font-semibold text-gray-900">{event.creator.displayName}</p>
              </div>
            </div>
          </div>

          {/* Attendance info */}
          {event.attendeeCount > 0 && (
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {event.attendeeCount} {event.attendeeCount === 1 ? "person" : "people"} attending
                  </p>
                  {event.capacity && (
                    <p className="text-sm text-gray-500">
                      {event.capacity - event.attendeeCount} spots remaining
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 mb-3">About this event</h3>
            <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
          </div>
        </div>

        {/* RSVP Call to Action */}
        <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
          {/* Already logged in - show RSVP link */}
          {isLoggedIn && (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">You&apos;re signed in!</h2>
              <p className="text-gray-600 mb-4">You can now RSVP to this event.</p>
              <a
                href={`/events/${event.id}`}
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                View Event & RSVP
              </a>
            </div>
          )}

          {/* Initial state - show options */}
          {!isLoggedIn && registrationStep === "idle" && (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Ready to join?</h2>
              <p className="text-gray-600 mb-4">Create an account or sign in to RSVP to this event.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setRegistrationStep("form")}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Quick Sign Up
                </button>
                <a
                  href={`/login?redirect=/invite/${token}`}
                  className="px-6 py-3 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                >
                  Already have an account?
                </a>
              </div>
            </div>
          )}

          {/* Registration form */}
          {!isLoggedIn && registrationStep === "form" && (
            <div>
              <div className="flex items-center mb-4">
                <button
                  type="button"
                  onClick={() => setRegistrationStep("idle")}
                  className="flex items-center text-gray-600 hover:text-gray-900"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mb-2">Quick Sign Up</h2>
              <p className="text-gray-600 mb-6">
                Create an account to RSVP. It only takes a minute.
              </p>

              {registrationError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {registrationError}
                </div>
              )}

              <form onSubmit={handleRegisterSubmit}>
                {/* Contact Method Toggle */}
                <div className="mb-4">
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
                  <p className="mt-1 text-sm text-gray-500">This is how you&apos;ll appear to other attendees</p>
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
            </div>
          )}

          {/* Verification step */}
          {!isLoggedIn && registrationStep === "verify" && (
            <div>
              <div className="flex items-center mb-4">
                <button
                  type="button"
                  onClick={handleBackToForm}
                  className="flex items-center text-gray-600 hover:text-gray-900"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mb-2">Enter Verification Code</h2>
              <p className="text-gray-600 mb-6">
                {existingUser
                  ? `We found an existing account. Enter the code sent to ${contactMethod === "phone" ? phone : email} to log in.`
                  : `Enter the 6-digit code sent to ${contactMethod === "phone" ? phone : email}`}
              </p>

              {registrationError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {registrationError}
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
          )}
        </div>
      </div>
    </div>
  );
}

export default InvitePage;
