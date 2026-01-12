import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  startLogin,
  verifyLogin,
  setAuthToken,
  isApiError,
} from "../services/api";

type LoginStep = "contact" | "verify";
type ContactMethod = "phone" | "email";

/**
 * Login page component with two-step verification flow.
 * Step 1: Enter phone or email
 * Step 2: Enter 6-digit verification code
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  // Form state
  const [step, setStep] = useState<LoginStep>("contact");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle contact form submission (step 1)
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await startLogin({
        phone: contactMethod === "phone" ? phone : undefined,
        email: contactMethod === "email" ? email : undefined,
      });

      setStep("verify");
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "USER_NOT_FOUND") {
          setError("No account found with this " + (contactMethod === "phone" ? "phone number" : "email") + ". Please register first.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to send verification code. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle verification code submission (step 2)
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await verifyLogin({
        phone: contactMethod === "phone" ? phone : undefined,
        email: contactMethod === "email" ? email : undefined,
        code: verificationCode,
        deviceInfo: navigator.userAgent,
      });

      // Store the auth token
      setAuthToken(response.token);

      // Redirect to the intended destination
      window.location.href = redirectPath;
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to verify code. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    setIsLoading(true);
    setError("");

    try {
      await startLogin({
        phone: contactMethod === "phone" ? phone : undefined,
        email: contactMethod === "email" ? email : undefined,
      });
      setError(""); // Clear any previous errors
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to resend code. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Go back to contact form
  const handleBackToContact = () => {
    setVerificationCode("");
    setError("");
    setStep("contact");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <a href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gather</h1>
          </a>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {step === "contact" ? "Sign in to your account" : "Enter verification code"}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Contact form */}
          {step === "contact" && (
            <form onSubmit={handleContactSubmit}>
              {/* Contact Method Toggle */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sign in with
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
                    autoFocus
                  />
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
                    autoFocus
                  />
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
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
            </form>
          )}

          {/* Step 2: Verification form */}
          {step === "verify" && (
            <div>
              {/* Back button */}
              <div className="flex items-center mb-4">
                <button
                  type="button"
                  onClick={handleBackToContact}
                  className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              </div>

              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Enter the 6-digit code sent to {contactMethod === "phone" ? phone : email}
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
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || verificationCode.length !== 6}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isLoading}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm disabled:text-gray-400 dark:disabled:text-gray-500"
                >
                  Resend code
                </button>
              </div>
            </div>
          )}

          {/* Link to registration */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-gray-600 dark:text-gray-300">
              Don&apos;t have an account?{" "}
              <a
                href={`/register${redirectPath !== "/dashboard" ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
