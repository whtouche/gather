import { useState, useEffect } from "react";
import {
  getQuestionnaire,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  type QuestionnaireQuestion,
  type QuestionType,
  type CreateQuestionInput,
  isApiError,
} from "../services/api";

interface QuestionnaireBuilderProps {
  eventId: string;
  isOrganizer: boolean;
}

interface QuestionFormData {
  questionText: string;
  questionType: QuestionType;
  isRequired: boolean;
  helpText: string;
  choices: string[];
}

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: "SHORT_TEXT", label: "Short Text", description: "Single line answer (max 200 chars)" },
  { value: "LONG_TEXT", label: "Long Text", description: "Paragraph answer (max 2000 chars)" },
  { value: "SINGLE_CHOICE", label: "Single Choice", description: "Choose one option from a list" },
  { value: "MULTIPLE_CHOICE", label: "Multiple Choice", description: "Choose multiple options" },
  { value: "YES_NO", label: "Yes/No", description: "Simple yes or no question" },
  { value: "NUMBER", label: "Number", description: "Numeric answer" },
  { value: "DATE", label: "Date", description: "Date picker" },
];

export function QuestionnaireBuilder({ eventId, isOrganizer }: QuestionnaireBuilderProps) {
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [hasAnyResponses, setHasAnyResponses] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<QuestionFormData>({
    questionText: "",
    questionType: "SHORT_TEXT",
    isRequired: false,
    helpText: "",
    choices: ["", ""],
  });

  // Load questions on mount
  useEffect(() => {
    loadQuestions();
  }, [eventId]);

  async function loadQuestions() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getQuestionnaire(eventId);
      setQuestions(data.questions);
      setHasAnyResponses(data.hasAnyResponses);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to load questionnaire");
      }
    } finally {
      setIsLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      questionText: "",
      questionType: "SHORT_TEXT",
      isRequired: false,
      helpText: "",
      choices: ["", ""],
    });
    setIsAdding(false);
    setEditingId(null);
  }

  function handleStartAdd() {
    resetForm();
    setIsAdding(true);
  }

  function handleStartEdit(question: QuestionnaireQuestion) {
    setFormData({
      questionText: question.questionText,
      questionType: question.questionType,
      isRequired: question.isRequired,
      helpText: question.helpText || "",
      choices: question.choices || ["", ""],
    });
    setEditingId(question.id);
    setIsAdding(false);
    // Clear any errors when starting to edit
    setError(null);
  }

  function handleCancelEdit() {
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const input: CreateQuestionInput = {
        questionText: formData.questionText.trim(),
        questionType: formData.questionType,
        isRequired: formData.isRequired,
        helpText: formData.helpText.trim() || undefined,
      };

      // Add choices for choice questions
      if (formData.questionType === "SINGLE_CHOICE" || formData.questionType === "MULTIPLE_CHOICE") {
        const validChoices = formData.choices.filter(c => c.trim() !== "");
        if (validChoices.length < 2) {
          setError("Please provide at least 2 choices");
          return;
        }
        input.choices = validChoices;
      }

      if (editingId) {
        // Update existing question
        await updateQuestion(eventId, editingId, input);
      } else {
        // Create new question
        await createQuestion(eventId, input);
      }

      await loadQuestions();
      resetForm();
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to save question");
      }
    }
  }

  async function handleDelete(questionId: string) {
    if (!confirm("Are you sure you want to delete this question?")) {
      return;
    }

    try {
      await deleteQuestion(eventId, questionId);
      await loadQuestions();
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("Failed to delete question");
      }
    }
  }

  function handleAddChoice() {
    setFormData({
      ...formData,
      choices: [...formData.choices, ""],
    });
  }

  function handleRemoveChoice(index: number) {
    if (formData.choices.length <= 2) return;
    setFormData({
      ...formData,
      choices: formData.choices.filter((_, i) => i !== index),
    });
  }

  function handleChoiceChange(index: number, value: string) {
    const newChoices = [...formData.choices];
    newChoices[index] = value;
    setFormData({
      ...formData,
      choices: newChoices,
    });
  }

  if (isLoading) {
    return <div className="text-center py-8 dark:text-gray-300">Loading questionnaire...</div>;
  }

  if (!isOrganizer) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/30 p-6">
        <h3 className="text-xl font-semibold mb-4 dark:text-white">Event Questionnaire</h3>
        {questions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No questionnaire has been created for this event.</p>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="border-l-4 border-blue-500 dark:border-blue-400 pl-4">
                <p className="font-medium dark:text-white">
                  {q.questionText}
                  {q.isRequired && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{QUESTION_TYPES.find(t => t.value === q.questionType)?.label}</p>
                {q.helpText && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{q.helpText}</p>}
                {q.choices && (
                  <ul className="text-sm text-gray-600 dark:text-gray-300 mt-2 list-disc list-inside">
                    {q.choices.map((choice, idx) => (
                      <li key={idx}>{choice}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/30 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold dark:text-white">Event Questionnaire</h3>
        {!isAdding && !editingId && (
          <button
            onClick={handleStartAdd}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            Add Question
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Question Form */}
      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
          <h4 className="font-semibold mb-4 dark:text-white">{editingId ? "Edit Question" : "New Question"}</h4>

          {/* G4: Warning when editing question with responses */}
          {editingId && (() => {
            const editingQuestion = questions.find(q => q.id === editingId);
            const hasResponses = editingQuestion && editingQuestion.responseCount && editingQuestion.responseCount > 0;
            return hasResponses ? (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <strong>Note:</strong> This question has {editingQuestion.responseCount} response{editingQuestion.responseCount !== 1 ? 's' : ''}.
                  You can only edit the question text and help text. Cannot change choices or make it required.
                </p>
              </div>
            ) : null;
          })()}

          {/* G4: Warning when adding new question and responses exist */}
          {isAdding && hasAnyResponses && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Note:</strong> Responses have already been submitted. New questions must be optional (not required).
              </p>
            </div>
          )}

          {/* Question Text */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Question Text <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.questionText}
              onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Enter your question..."
              maxLength={500}
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formData.questionText.length}/500 characters</p>
          </div>

          {/* Question Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Question Type <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <select
              value={formData.questionType}
              onChange={(e) => setFormData({ ...formData, questionType: e.target.value as QuestionType })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={!!editingId} // Don't allow changing type when editing
            >
              {QUESTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
          </div>

          {/* Choices (for choice questions) */}
          {(formData.questionType === "SINGLE_CHOICE" || formData.questionType === "MULTIPLE_CHOICE") && (() => {
            // G4: Check if we're editing a question with responses
            const editingQuestion = editingId ? questions.find(q => q.id === editingId) : null;
            const hasResponses = editingQuestion && editingQuestion.responseCount ? editingQuestion.responseCount > 0 : false;
            const choicesDisabled = !!(editingId && hasResponses);

            return (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Choices <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                {formData.choices.map((choice, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={choice}
                      onChange={(e) => handleChoiceChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-600"
                      placeholder={`Option ${index + 1}`}
                      maxLength={200}
                      disabled={choicesDisabled}
                    />
                    {formData.choices.length > 2 && !choicesDisabled && (
                      <button
                        type="button"
                        onClick={() => handleRemoveChoice(index)}
                        className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {formData.choices.length < 10 && !choicesDisabled && (
                  <button
                    type="button"
                    onClick={handleAddChoice}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    + Add Choice
                  </button>
                )}
              </div>
            );
          })()}

          {/* Required */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isRequired}
                onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 dark:bg-gray-800"
                disabled={(() => {
                  // G4: Disable if adding new question and responses exist
                  if (isAdding && hasAnyResponses) return true;
                  // G4: Disable if editing question with responses and trying to make it required
                  if (editingId) {
                    const editingQuestion = questions.find(q => q.id === editingId);
                    const hasResponses = editingQuestion && editingQuestion.responseCount ? editingQuestion.responseCount > 0 : false;
                    // Only disable if not already required and has responses
                    return hasResponses && !editingQuestion?.isRequired;
                  }
                  return false;
                })()}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Required question</span>
            </label>
            {isAdding && hasAnyResponses && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">New questions must be optional when responses already exist</p>
            )}
            {editingId && (() => {
              const editingQuestion = questions.find(q => q.id === editingId);
              const hasResponses = editingQuestion && editingQuestion.responseCount ? editingQuestion.responseCount > 0 : false;
              return hasResponses && !editingQuestion?.isRequired ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cannot make required when responses already exist</p>
              ) : null;
            })()}
          </div>

          {/* Help Text */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Help Text (optional)
            </label>
            <input
              type="text"
              value={formData.helpText}
              onChange={(e) => setFormData({ ...formData, helpText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Additional guidance for respondents..."
              maxLength={200}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formData.helpText.length}/200 characters</p>
          </div>

          {/* Form Actions */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              {editingId ? "Update Question" : "Add Question"}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Questions List */}
      {questions.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No questions yet. Click "Add Question" to create your first question.
        </p>
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/50"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">#{index + 1}</span>
                    <p className="font-medium dark:text-white">
                      {question.questionText}
                      {question.isRequired && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
                    </p>
                    {question.responseCount && question.responseCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                        {question.responseCount} response{question.responseCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {QUESTION_TYPES.find(t => t.value === question.questionType)?.label}
                  </p>
                  {question.helpText && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic">{question.helpText}</p>
                  )}
                  {question.choices && (
                    <ul className="text-sm text-gray-600 dark:text-gray-300 mt-2 list-disc list-inside">
                      {question.choices.map((choice, idx) => (
                        <li key={idx}>{choice}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStartEdit(question)}
                    className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(question.id)}
                    className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={question.responseCount ? question.responseCount > 0 : false}
                    title={question.responseCount && question.responseCount > 0 ? `Cannot delete: ${question.responseCount} response${question.responseCount !== 1 ? 's' : ''} exist` : ''}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
