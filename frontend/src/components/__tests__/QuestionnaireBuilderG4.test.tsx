import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuestionnaireBuilder } from "../QuestionnaireBuilder";
import * as api from "../../services/api";

// Mock the API
vi.mock("../../services/api", () => ({
  getQuestionnaire: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  reorderQuestions: vi.fn(),
  isApiError: vi.fn(),
}));

describe("QuestionnaireBuilder - G4 Edit Restrictions", () => {
  const mockEventId = "test-event-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: [], hasAnyResponses: false });
  });

  describe("Response Count Display", () => {
    it("should display response count badge for questions with responses", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Question with responses",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 5,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: true });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText(/5 response/i)).toBeInTheDocument();
      });
    });

    it("should show singular 'response' for count of 1", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Question with one response",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 1,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: true });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("1 response")).toBeInTheDocument();
      });
    });

    it("should not display response count for questions without responses", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Test question",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 0,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: false });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Test question")).toBeInTheDocument();
        // The response count badge should not be present
        expect(screen.queryByText(/\d+ response/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Adding Questions - Warning for Existing Responses", () => {
    it("should show warning when adding question and responses exist", async () => {
      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: [], hasAnyResponses: true });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      expect(screen.getByText(/responses have already been submitted/i)).toBeInTheDocument();
      expect(screen.getByText(/new questions must be optional when responses already exist/i)).toBeInTheDocument();
    });

    it("should not show warning when adding question and no responses exist", async () => {
      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: [], hasAnyResponses: false });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      expect(screen.queryByText(/responses have already been submitted/i)).not.toBeInTheDocument();
    });

    it("should disable required checkbox when adding question and responses exist", async () => {
      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: [], hasAnyResponses: true });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const requiredCheckbox = screen.getByRole("checkbox", { name: /required question/i });
      expect(requiredCheckbox).toBeDisabled();
    });

    it("should show helper text explaining required checkbox is disabled", async () => {
      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: [], hasAnyResponses: true });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      expect(screen.getByText(/new questions must be optional when responses already exist/i)).toBeInTheDocument();
    });
  });

  describe("Editing Questions - Restrictions with Responses", () => {
    it("should show warning when editing question with responses", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Question with responses",
          questionType: "SINGLE_CHOICE",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: ["Option A", "Option B"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 3,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: true });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Question with responses")).toBeInTheDocument();
      });

      const editButton = screen.getByText(/edit/i);
      fireEvent.click(editButton);

      expect(screen.getByText(/this question has 3 responses/i)).toBeInTheDocument();
      expect(screen.getByText(/you can only edit the question text and help text/i)).toBeInTheDocument();
      expect(screen.getByText(/cannot change choices or make it required/i)).toBeInTheDocument();
    });

    it("should disable choices input when editing question with responses", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Single choice question",
          questionType: "SINGLE_CHOICE",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: ["Option A", "Option B"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 2,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: true });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Single choice question")).toBeInTheDocument();
      });

      const editButton = screen.getByText(/edit/i);
      fireEvent.click(editButton);

      await waitFor(() => {
        const choiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
        choiceInputs.forEach(input => {
          expect(input).toBeDisabled();
        });
      });
    });

    it("should hide Add Choice and Remove buttons when editing question with responses", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Multiple choice question",
          questionType: "MULTIPLE_CHOICE",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: ["Option A", "Option B", "Option C"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 5,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: true });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Multiple choice question")).toBeInTheDocument();
      });

      const editButton = screen.getByText(/edit/i);
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.queryByText(/\+ add choice/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/remove/i)).not.toBeInTheDocument();
      });
    });

    it("should disable required checkbox when editing optional question with responses", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Optional question with responses",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 4,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: true });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Optional question with responses")).toBeInTheDocument();
      });

      const editButton = screen.getByText(/edit/i);
      fireEvent.click(editButton);

      await waitFor(() => {
        const requiredCheckbox = screen.getByRole("checkbox", { name: /required question/i });
        expect(requiredCheckbox).toBeDisabled();
        expect(requiredCheckbox).not.toBeChecked();
      });

      expect(screen.getByText(/cannot make required when responses already exist/i)).toBeInTheDocument();
    });

    it("should allow unchecking required checkbox when editing required question (making it optional)", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Required question with responses",
          questionType: "SHORT_TEXT",
          isRequired: true,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 4,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: true });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Required question with responses")).toBeInTheDocument();
      });

      const editButton = screen.getByText(/edit/i);
      fireEvent.click(editButton);

      await waitFor(() => {
        const requiredCheckbox = screen.getByRole("checkbox", { name: /required question/i });
        // Should be enabled because it's already required (can make it optional)
        expect(requiredCheckbox).not.toBeDisabled();
        expect(requiredCheckbox).toBeChecked();
      });
    });

    it("should not show warning when editing question without responses", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Question without responses",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 0,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: false });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Question without responses")).toBeInTheDocument();
      });

      const editButton = screen.getByText(/edit/i);
      fireEvent.click(editButton);

      expect(screen.queryByText(/this question has.*response/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/you can only edit/i)).not.toBeInTheDocument();
    });
  });

  describe("Deleting Questions - Restrictions with Responses", () => {
    it("should disable delete button for questions with responses", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Question with responses",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 7,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: true });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Question with responses")).toBeInTheDocument();
      });

      const deleteButton = screen.getByText(/delete/i);
      expect(deleteButton).toBeDisabled();
    });

    it("should show tooltip explaining why delete is disabled", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Question with responses",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 3,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: true });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Question with responses")).toBeInTheDocument();
      });

      const deleteButton = screen.getByText(/delete/i);
      expect(deleteButton).toHaveAttribute("title", "Cannot delete: 3 responses exist");
    });

    it("should enable delete button for questions without responses", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Question without responses",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 0,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: false });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Question without responses")).toBeInTheDocument();
      });

      const deleteButton = screen.getByText(/delete/i);
      expect(deleteButton).not.toBeDisabled();
    });
  });

  describe("Error Handling - G4 Restrictions", () => {
    it("should display error when trying to add required question with responses", async () => {
      const apiError = {
        message: "Cannot add required questions after responses have been submitted. New questions must be optional.",
        statusCode: 400,
        code: "CANNOT_ADD_REQUIRED_QUESTION_WITH_RESPONSES",
      };

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: [], hasAnyResponses: true });
      vi.mocked(api.createQuestion).mockRejectedValue(apiError);
      vi.mocked(api.isApiError).mockReturnValue(true);

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      // Try to submit (checkbox should be disabled, but testing error handling)
      const questionInput = screen.getByPlaceholderText(/enter your question/i);
      fireEvent.change(questionInput, { target: { value: "Test question" } });

      const submitButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/cannot add required questions after responses/i)).toBeInTheDocument();
      });
    });

    it("should clear error when starting to edit a question", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Question 1",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: 0,
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: false });
      vi.mocked(api.createQuestion).mockRejectedValue(new Error("Some error"));
      vi.mocked(api.isApiError).mockReturnValue(false);

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      // Create an error first
      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const questionInput = screen.getByPlaceholderText(/enter your question/i);
      fireEvent.change(questionInput, { target: { value: "Test" } });

      const submitButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to save question/i)).toBeInTheDocument();
      });

      // Now click Edit on existing question - error should clear
      const cancelButton = screen.getByText(/cancel/i);
      fireEvent.click(cancelButton);

      await waitFor(() => {
        const editButton = screen.getByText(/edit/i);
        fireEvent.click(editButton);
      });

      await waitFor(() => {
        expect(screen.queryByText(/failed to save question/i)).not.toBeInTheDocument();
      });
    });
  });
});
