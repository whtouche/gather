import { useState, useEffect } from "react";

// =============================================================================
// Types
// =============================================================================

export type QuestionType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "YES_NO"
  | "NUMBER"
  | "DATE";

export interface Question {
  id: string;
  eventId: string;
  questionText: string;
  questionType: QuestionType;
  isRequired: boolean;
  helpText: string | null;
  orderIndex: number;
  choices: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionnaireFormProps {
  eventId: string;
  authToken: string;
  questions: Question[];
  rsvpResponse: "YES" | "NO" | "MAYBE";
  onSubmit: (responses: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  apiBaseUrl?: string;
}

// =============================================================================
// Component
// =============================================================================

export function QuestionnaireForm({
  eventId,
  authToken,
  questions,
  rsvpResponse,
  onSubmit,
  onCancel,
  apiBaseUrl = "/api",
}: QuestionnaireFormProps) {
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing responses on mount
  useEffect(() => {
    const loadExistingResponses = async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/events/${eventId}/questionnaire/responses`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const existingResponses: Record<string, unknown> = {};
          data.responses.forEach((r: { questionId: string; response: unknown }) => {
            existingResponses[r.questionId] = r.response;
          });
          setResponses(existingResponses);
        }
      } catch (error) {
        // Silently fail - user can still fill out the form
        console.error("Failed to load existing responses:", error);
      }
    };

    loadExistingResponses();
  }, [eventId, authToken, apiBaseUrl]);

  const handleResponseChange = (questionId: string, value: unknown) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));

    // Clear error for this question
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[questionId];
      return newErrors;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Only enforce required questions for YES responses
    if (rsvpResponse === "YES") {
      questions
        .filter((q) => q.isRequired)
        .forEach((question) => {
          const response = responses[question.id];
          if (
            response === undefined ||
            response === null ||
            response === "" ||
            (Array.isArray(response) && response.length === 0)
          ) {
            newErrors[question.id] = "This question is required";
          }
        });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(responses);
    } catch (error) {
      setIsSubmitting(false);
      throw error;
    }
  };

  const handleSkip = () => {
    // For MAYBE responses, allow skipping the questionnaire
    if (rsvpResponse === "MAYBE" && onCancel) {
      onCancel();
    }
  };

  const renderQuestionInput = (question: Question) => {
    const response = responses[question.id];
    const error = errors[question.id];
    const inputId = `question-${question.id}`;

    const baseInputClasses =
      "mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500";
    const errorClasses = error
      ? "border-red-300 dark:border-red-700 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-500 dark:focus:ring-red-400"
      : "";

    switch (question.questionType) {
      case "SHORT_TEXT":
        return (
          <input
            type="text"
            id={inputId}
            value={(response as string) || ""}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            maxLength={200}
            className={`${baseInputClasses} ${errorClasses}`}
            placeholder="Enter your response..."
          />
        );

      case "LONG_TEXT":
        return (
          <textarea
            id={inputId}
            value={(response as string) || ""}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            maxLength={2000}
            rows={4}
            className={`${baseInputClasses} ${errorClasses}`}
            placeholder="Enter your response..."
          />
        );

      case "SINGLE_CHOICE":
        return (
          <div className="mt-2 space-y-2">
            {question.choices?.map((choice, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={inputId}
                  value={choice}
                  checked={response === choice}
                  onChange={(e) => handleResponseChange(question.id, e.target.value)}
                  className="text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600"
                />
                <span className="text-gray-700 dark:text-gray-300">{choice}</span>
              </label>
            ))}
          </div>
        );

      case "MULTIPLE_CHOICE":
        return (
          <div className="mt-2 space-y-2">
            {question.choices?.map((choice, index) => {
              const selectedChoices = (response as string[]) || [];
              return (
                <label key={index} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    value={choice}
                    checked={selectedChoices.includes(choice)}
                    onChange={(e) => {
                      const newChoices = e.target.checked
                        ? [...selectedChoices, choice]
                        : selectedChoices.filter((c) => c !== choice);
                      handleResponseChange(question.id, newChoices);
                    }}
                    className="text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 rounded dark:bg-gray-800 dark:border-gray-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">{choice}</span>
                </label>
              );
            })}
          </div>
        );

      case "YES_NO":
        return (
          <div className="mt-2 space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={inputId}
                value="true"
                checked={response === true}
                onChange={() => handleResponseChange(question.id, true)}
                className="text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600"
              />
              <span className="text-gray-700 dark:text-gray-300">Yes</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={inputId}
                value="false"
                checked={response === false}
                onChange={() => handleResponseChange(question.id, false)}
                className="text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600"
              />
              <span className="text-gray-700 dark:text-gray-300">No</span>
            </label>
          </div>
        );

      case "NUMBER":
        return (
          <input
            type="number"
            id={inputId}
            value={(response as number) || ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || val === null) {
                handleResponseChange(question.id, "");
              } else {
                const num = parseFloat(val);
                if (!isNaN(num)) {
                  handleResponseChange(question.id, num);
                }
              }
            }}
            className={`${baseInputClasses} ${errorClasses}`}
            placeholder="Enter a number..."
          />
        );

      case "DATE":
        return (
          <input
            type="date"
            id={inputId}
            value={(response as string) || ""}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            className={`${baseInputClasses} ${errorClasses}`}
          />
        );
    }
  };

  if (questions.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm dark:shadow-gray-900/30">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Event Questionnaire
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
        {rsvpResponse === "YES"
          ? "Please answer the following questions to complete your RSVP."
          : "You may optionally answer the following questions."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map((question) => (
          <div key={question.id}>
            <label
              htmlFor={`question-${question.id}`}
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {question.questionText}
              {question.isRequired && rsvpResponse === "YES" && (
                <span className="text-red-500 dark:text-red-400 ml-1">*</span>
              )}
            </label>
            {question.helpText && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{question.helpText}</p>
            )}
            {renderQuestionInput(question)}
            {errors[question.id] && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors[question.id]}</p>
            )}
          </div>
        ))}

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 dark:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : "Submit Responses"}
          </button>
          {rsvpResponse === "MAYBE" && onCancel && (
            <button
              type="button"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50"
            >
              Skip
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default QuestionnaireForm;
