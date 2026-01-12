import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  startRegistration,
  verifyRegistration,
  setAuthToken,
  isApiError,
} from "../services/api";

type RegistrationStep = "form" | "verify";
type ContactMethod = "phone" | "email";

/**
 * Registration page component.
 * Two-step flow: enter contact info, then verify with code.
 */
export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";

  // Registration flow state
  const [step, setStep] = useState<RegistrationStep>("form");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Handle registration form submission (step 1)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await startRegistration({
        phone: contactMethod === "phone" ? phone : undefined,
        email: contactMethod === "email" ? email : undefined,
        displayName,
      });

      setStep("verify");
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to send verification code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle verification code submission (step 2)
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await verifyRegistration({
        phone: contactMethod === "phone" ? phone : undefined,
        email: contactMethod === "email" ? email : undefined,
        code: verificationCode,
        displayName,
        deviceInfo: navigator.userAgent,
      });

      // Store the auth token
      setAuthToken(response.token);

      // Redirect to the specified URL or dashboard
      navigate(redirectUrl);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to verify code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      await startRegistration({
        phone: contactMethod === "phone" ? phone : undefined,
        email: contactMethod === "email" ? email : undefined,
        displayName,
      });
      setError(""); // Clear any previous errors
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to resend code. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Go back to registration form
  const handleBackToForm = () => {
    setVerificationCode("");
    setError("");
    setStep("form");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo/Brand */}
        <h1 className="text-center text-3xl font-bold text-gray-900 dark:text-white">Gather</h1>
        <h2 className="mt-2 text-center text-xl text-gray-600 dark:text-gray-300">
          {step === "form" ? "Create your account" : "Verify your account"}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow-sm rounded-xl sm:px-10">
          {/* Error message */}
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Step 1: Registration form */}
          {step === "form" && (
            <form onSubmit={handleRegisterSubmit}>
              {/* Contact Method Toggle */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contact Method
                </label>
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setContactMethod("phone")}
                    className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                      contactMethod === "phone"
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
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
                        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                    }`}
                  >
                    Email
                  </button>
                </div>
              </div>

              {/* Phone or Email Input */}
              {contactMethod === "phone" ? (
                <div className="mb-6">
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    We&apos;ll send you a verification code via SMS
                  </p>
                </div>
              ) : (
                <div className="mb-6">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    We&apos;ll send you a verification code via email
                  </p>
                </div>
              )}

              {/* Display Name */}
              <div className="mb-6">
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How should we call you?"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  This is how you&apos;ll appear to event organizers and other attendees
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending Code...
                  </span>
                ) : (
                  "Continue"
                )}
              </button>

              {/* Link to login */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Already have an account?{" "}
                  <a
                    href={`/login${redirectUrl !== "/dashboard" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`}
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Sign in
                  </a>
                </p>
              </div>
            </form>
          )}

          {/* Step 2: Verification */}
          {step === "verify" && (
            <div>
              {/* Back button */}
              <button
                type="button"
                onClick={handleBackToForm}
                className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-6"
              >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Enter the 6-digit code sent to{" "}
                <span className="font-medium">{contactMethod === "phone" ? phone : email}</span>
              </p>

              <form onSubmit={handleVerifySubmit}>
                <div className="mb-6">
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    id="code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>

              {/* Resend code button */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isSubmitting}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
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

export default RegisterPage;
