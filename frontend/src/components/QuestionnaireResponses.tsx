import { useState, useEffect } from "react";
import {
  getQuestionnaireResponsesSummary,
  getIncompleteAttendees,
  exportQuestionnaireResponses,
  type QuestionnaireResponsesSummary,
  type IncompleteAttendeesResponse,
  type QuestionWithResponses,
  isApiError,
} from "../services/api";

interface QuestionnaireResponsesProps {
  eventId: string;
}

export function QuestionnaireResponses({ eventId }: QuestionnaireResponsesProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<QuestionnaireResponsesSummary | null>(null);
  const [incomplete, setIncomplete] = useState<IncompleteAttendeesResponse | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"summary" | "incomplete">("summary");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [eventId, selectedUserId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryData, incompleteData] = await Promise.all([
        getQuestionnaireResponsesSummary(eventId, selectedUserId),
        getIncompleteAttendees(eventId),
      ]);

      setSummary(summaryData);
      setIncomplete(incompleteData);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to load questionnaire responses");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await exportQuestionnaireResponses(eventId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `questionnaire-responses-${eventId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to export responses");
      }
    } finally {
      setExporting(false);
    }
  };

  const renderResponseValue = (response: unknown, _questionType: string): string => {
    if (response === null || response === undefined) {
      return "-";
    }

    if (Array.isArray(response)) {
      return response.join(", ");
    }

    if (typeof response === "boolean") {
      return response ? "Yes" : "No";
    }

    return String(response);
  };

  const renderStatistics = (question: QuestionWithResponses) => {
    const { statistics, question: q } = question;

    if (q.questionType === "SINGLE_CHOICE" || q.questionType === "MULTIPLE_CHOICE") {
      if (!statistics.choiceCounts) return null;

      return (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-gray-700">Response Distribution:</p>
          {Object.entries(statistics.choiceCounts).map(([choice, count]) => (
            <div key={choice} className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{choice}</span>
                  <span className="text-gray-600">{count} ({Math.round((count / question.responseCount) * 100)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(count / question.responseCount) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (q.questionType === "YES_NO") {
      return (
        <div className="mt-3">
          <p className="text-sm font-medium text-gray-700 mb-2">Response Distribution:</p>
          <div className="flex gap-4 text-sm">
            <span className="text-gray-700">
              Yes: <span className="font-semibold">{statistics.yesCount || 0}</span>
            </span>
            <span className="text-gray-700">
              No: <span className="font-semibold">{statistics.noCount || 0}</span>
            </span>
          </div>
        </div>
      );
    }

    if (q.questionType === "NUMBER" && statistics.average !== undefined) {
      return (
        <div className="mt-3 text-sm text-gray-700 space-y-1">
          <p><span className="font-medium">Average:</span> {statistics.average.toFixed(2)}</p>
          <p><span className="font-medium">Min:</span> {statistics.min}</p>
          <p><span className="font-medium">Max:</span> {statistics.max}</p>
          <p><span className="font-medium">Count:</span> {statistics.count}</p>
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!summary || summary.questions.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <p className="text-gray-600">No questionnaire questions found for this event.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Questionnaire Responses</h2>
          <p className="text-gray-600 mt-1">
            {summary.totalRespondents} {summary.totalRespondents === 1 ? "respondent" : "respondents"}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || summary.totalRespondents === 0}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("summary")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "summary"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Response Summary
          </button>
          <button
            onClick={() => setActiveTab("incomplete")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "incomplete"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Incomplete ({incomplete?.incompleteCount || 0})
          </button>
        </nav>
      </div>

      {/* Summary Tab */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          {/* Filter by attendee */}
          {summary.totalRespondents > 0 && (
            <div className="flex items-center gap-3">
              <label htmlFor="userFilter" className="text-sm font-medium text-gray-700">
                Filter by attendee:
              </label>
              <select
                id="userFilter"
                value={selectedUserId || ""}
                onChange={(e) => setSelectedUserId(e.target.value || undefined)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All attendees</option>
                {/* Get unique users from responses */}
                {Array.from(
                  new Set(
                    summary.questions.flatMap((q) =>
                      q.responses.map((r) => JSON.stringify({ id: r.userId, name: r.displayName }))
                    )
                  )
                )
                  .map((str) => JSON.parse(str))
                  .map((user: { id: string; name: string }) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Questions and Responses */}
          <div className="space-y-6">
            {summary.questions.map((questionData) => (
              <div
                key={questionData.question.id}
                className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {questionData.question.questionText}
                    {questionData.question.isRequired && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                    <span className="capitalize">
                      {questionData.question.questionType.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <span>•</span>
                    <span>{questionData.responseCount} responses</span>
                  </div>
                </div>

                {/* Statistics */}
                {renderStatistics(questionData)}

                {/* Individual Responses */}
                {questionData.responses.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Individual Responses:</h4>
                    <div className="space-y-2">
                      {questionData.responses.map((response, idx) => (
                        <div
                          key={`${response.userId}-${idx}`}
                          className="flex items-start gap-3 py-2 px-3 bg-gray-50 rounded-lg"
                        >
                          <span className="text-sm font-medium text-gray-900 min-w-[150px]">
                            {response.displayName}:
                          </span>
                          <span className="text-sm text-gray-700">
                            {renderResponseValue(response.response, questionData.question.questionType)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incomplete Tab */}
      {activeTab === "incomplete" && incomplete && (
        <div className="space-y-4">
          {incomplete.incompleteCount === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <p className="text-green-800 font-medium">
                All attendees have completed the required questions!
              </p>
            </div>
          ) : (
            <>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  {incomplete.incompleteCount} of {incomplete.totalAttendees} attendees haven't
                  completed all required questions.
                </p>
              </div>

              <div className="space-y-3">
                {incomplete.incompleteAttendees.map((attendee) => (
                  <div
                    key={attendee.userId}
                    className="bg-white border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{attendee.displayName}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Answered {attendee.answeredRequired} of {attendee.totalRequired} required
                          questions
                        </p>
                      </div>
                    </div>

                    {attendee.missingQuestions.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Missing questions:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                          {attendee.missingQuestions.map((q) => (
                            <li key={q.id}>{q.questionText}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
