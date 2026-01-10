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

describe("QuestionnaireBuilder", () => {
  const mockEventId = "test-event-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: [], hasAnyResponses: false });
  });

  describe("Rendering", () => {
    it("should render loading state initially", () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);
      expect(screen.getByText(/loading questionnaire/i)).toBeInTheDocument();
    });

    it("should render empty state when no questions exist (organizer)", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(
          screen.getByText(/no questions yet/i)
        ).toBeInTheDocument();
      });
    });

    it("should render empty state for non-organizers", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={false} />);

      await waitFor(() => {
        expect(
          screen.getByText(/no questionnaire has been created/i)
        ).toBeInTheDocument();
      });
    });

    it("should show Add Question button for organizers", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });
    });

    it("should not show Add Question button for non-organizers", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={false} />);

      await waitFor(() => {
        expect(screen.queryByText(/add question/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Question Display", () => {
    it("should display existing questions", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "What is your name?",
          questionType: "SHORT_TEXT",
          isRequired: true,
          helpText: "Please enter your full name",
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "q2",
          eventId: mockEventId,
          questionText: "What is your favorite color?",
          questionType: "SINGLE_CHOICE",
          isRequired: false,
          helpText: null,
          orderIndex: 1,
          choices: ["Red", "Blue", "Green"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: false });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={false} />);

      await waitFor(() => {
        expect(screen.getByText("What is your name?")).toBeInTheDocument();
        expect(screen.getByText("What is your favorite color?")).toBeInTheDocument();
      });
    });

    it("should display required indicator for required questions", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Required question",
          questionType: "SHORT_TEXT",
          isRequired: true,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: false });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={false} />);

      await waitFor(() => {
        expect(screen.getByText("Required question")).toBeInTheDocument();
        const asterisks = screen.getAllByText("*");
        expect(asterisks.length).toBeGreaterThan(0);
      });
    });

    it("should display help text when provided", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Question with help",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: "This is helpful information",
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: false });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={false} />);

      await waitFor(() => {
        expect(screen.getByText("This is helpful information")).toBeInTheDocument();
      });
    });

    it("should display choices for choice-type questions", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Pick your favorite",
          questionType: "SINGLE_CHOICE",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: ["Option A", "Option B", "Option C"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: false });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={false} />);

      await waitFor(() => {
        expect(screen.getByText("Option A")).toBeInTheDocument();
        expect(screen.getByText("Option B")).toBeInTheDocument();
        expect(screen.getByText("Option C")).toBeInTheDocument();
      });
    });
  });

  describe("Adding Questions (Organizer)", () => {
    it("should show form when Add Question is clicked", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      expect(screen.getByText(/new question/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter your question/i)).toBeInTheDocument();
    });

    it("should create a new question when form is submitted", async () => {
      const newQuestion: api.QuestionnaireQuestion = {
        id: "new-q",
        eventId: mockEventId,
        questionText: "New question",
        questionType: "SHORT_TEXT",
        isRequired: false,
        helpText: null,
        orderIndex: 0,
        choices: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(api.createQuestion).mockResolvedValue(newQuestion);
      vi.mocked(api.getQuestionnaire).mockResolvedValueOnce({ questions: [], hasAnyResponses: false }).mockResolvedValueOnce({ questions: [newQuestion], hasAnyResponses: false });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const questionInput = screen.getByPlaceholderText(/enter your question/i);
      fireEvent.change(questionInput, { target: { value: "New question" } });

      const submitButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(api.createQuestion).toHaveBeenCalledWith(mockEventId, {
          questionText: "New question",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: undefined,
        });
      });
    });

    it("should show choices input for SINGLE_CHOICE questions", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const typeSelect = screen.getByRole("combobox");
      fireEvent.change(typeSelect, { target: { value: "SINGLE_CHOICE" } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/option 1/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/option 2/i)).toBeInTheDocument();
      });
    });

    it("should show choices input for MULTIPLE_CHOICE questions", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const typeSelect = screen.getByRole("combobox");
      fireEvent.change(typeSelect, { target: { value: "MULTIPLE_CHOICE" } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/option 1/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/option 2/i)).toBeInTheDocument();
      });
    });

    it("should allow adding more choice options", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const typeSelect = screen.getByRole("combobox");
      fireEvent.change(typeSelect, { target: { value: "SINGLE_CHOICE" } });

      await waitFor(() => {
        expect(screen.getByText(/\+ add choice/i)).toBeInTheDocument();
      });

      const addChoiceButton = screen.getByText(/\+ add choice/i);
      fireEvent.click(addChoiceButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/option 3/i)).toBeInTheDocument();
      });
    });

    it("should enforce maximum of 10 choices", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const typeSelect = screen.getByRole("combobox");
      fireEvent.change(typeSelect, { target: { value: "SINGLE_CHOICE" } });

      // Add choices until we have 10
      for (let i = 0; i < 8; i++) {
        const addChoiceButton = screen.getByText(/\+ add choice/i);
        fireEvent.click(addChoiceButton);
      }

      await waitFor(() => {
        expect(screen.queryByText(/\+ add choice/i)).not.toBeInTheDocument();
      });
    });

    it("should allow removing choice options (when more than 2)", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const typeSelect = screen.getByRole("combobox");
      fireEvent.change(typeSelect, { target: { value: "SINGLE_CHOICE" } });

      // Add a third choice
      const addChoiceButton = screen.getByText(/\+ add choice/i);
      fireEvent.click(addChoiceButton);

      await waitFor(() => {
        const removeButtons = screen.getAllByText(/remove/i);
        expect(removeButtons.length).toBeGreaterThan(0);
      });
    });

    it("should enforce 500 character limit for question text", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const questionInput = screen.getByPlaceholderText(/enter your question/i);
      expect(questionInput).toHaveAttribute("maxLength", "500");
    });

    it("should enforce 200 character limit for help text", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const helpTextInput = screen.getByPlaceholderText(/additional guidance/i);
      expect(helpTextInput).toHaveAttribute("maxLength", "200");
    });

    it("should enforce 200 character limit for each choice", async () => {
      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const typeSelect = screen.getByRole("combobox");
      fireEvent.change(typeSelect, { target: { value: "SINGLE_CHOICE" } });

      await waitFor(() => {
        const choiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
        choiceInputs.forEach((input) => {
          expect(input).toHaveAttribute("maxLength", "200");
        });
      });
    });
  });

  describe("Editing Questions (Organizer)", () => {
    it("should show edit form when Edit button is clicked", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Existing question",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: false });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Existing question")).toBeInTheDocument();
      });

      const editButton = screen.getByText(/edit/i);
      fireEvent.click(editButton);

      expect(screen.getByText(/edit question/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue("Existing question")).toBeInTheDocument();
    });

    it("should disable question type select when editing", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Existing question",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: false });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Existing question")).toBeInTheDocument();
      });

      const editButton = screen.getByText(/edit/i);
      fireEvent.click(editButton);

      const typeSelect = screen.getByRole("combobox");
      expect(typeSelect).toBeDisabled();
    });

    it("should update question when edit form is submitted", async () => {
      const mockQuestion: api.QuestionnaireQuestion = {
        id: "q1",
        eventId: mockEventId,
        questionText: "Original question",
        questionType: "SHORT_TEXT",
        isRequired: false,
        helpText: null,
        orderIndex: 0,
        choices: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedQuestion: api.QuestionnaireQuestion = {
        ...mockQuestion,
        questionText: "Updated question",
      };

      vi.mocked(api.getQuestionnaire)
        .mockResolvedValueOnce({ questions: [mockQuestion], hasAnyResponses: false })
        .mockResolvedValueOnce({ questions: [updatedQuestion], hasAnyResponses: false });
      vi.mocked(api.updateQuestion).mockResolvedValue(updatedQuestion);

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Original question")).toBeInTheDocument();
      });

      const editButton = screen.getByText(/edit/i);
      fireEvent.click(editButton);

      const questionInput = screen.getByDisplayValue("Original question");
      fireEvent.change(questionInput, { target: { value: "Updated question" } });

      const updateButton = screen.getByText(/update question/i);
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(api.updateQuestion).toHaveBeenCalledWith(mockEventId, "q1", {
          questionText: "Updated question",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: undefined,
        });
      });
    });
  });

  describe("Deleting Questions (Organizer)", () => {
    it("should show confirmation dialog when Delete is clicked", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Question to delete",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: mockQuestions, hasAnyResponses: false });

      // Mock confirm
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Question to delete")).toBeInTheDocument();
      });

      const deleteButton = screen.getByText(/delete/i);
      fireEvent.click(deleteButton);

      expect(confirmSpy).toHaveBeenCalledWith(
        "Are you sure you want to delete this question?"
      );

      confirmSpy.mockRestore();
    });

    it("should delete question when confirmed", async () => {
      const mockQuestions: api.QuestionnaireQuestion[] = [
        {
          id: "q1",
          eventId: mockEventId,
          questionText: "Question to delete",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(api.getQuestionnaire)
        .mockResolvedValueOnce({ questions: mockQuestions, hasAnyResponses: false })
        .mockResolvedValueOnce({ questions: [], hasAnyResponses: false });
      vi.mocked(api.deleteQuestion).mockResolvedValue();

      // Mock confirm to return true
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Question to delete")).toBeInTheDocument();
      });

      const deleteButton = screen.getByText(/delete/i);
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(api.deleteQuestion).toHaveBeenCalledWith(mockEventId, "q1");
      });

      confirmSpy.mockRestore();
    });
  });

  describe("Error Handling", () => {
    it("should display error message when loading fails", async () => {
      vi.mocked(api.getQuestionnaire).mockRejectedValue(new Error("Network error"));
      vi.mocked(api.isApiError).mockReturnValue(false);

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load questionnaire/i)).toBeInTheDocument();
      });
    });

    it("should display API error message when available", async () => {
      const apiError = {
        message: "Unauthorized access",
        statusCode: 403,
        code: "FORBIDDEN",
      };

      vi.mocked(api.getQuestionnaire).mockRejectedValue(apiError);
      vi.mocked(api.isApiError).mockReturnValue(true);

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByText("Unauthorized access")).toBeInTheDocument();
      });
    });

    it("should display error when creating question fails", async () => {
      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: [], hasAnyResponses: false });
      vi.mocked(api.createQuestion).mockRejectedValue(new Error("Creation failed"));
      vi.mocked(api.isApiError).mockReturnValue(false);

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const questionInput = screen.getByPlaceholderText(/enter your question/i);
      fireEvent.change(questionInput, { target: { value: "Test question" } });

      const submitButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to save question/i)).toBeInTheDocument();
      });
    });

    it("should show error when choice validation fails", async () => {
      vi.mocked(api.getQuestionnaire).mockResolvedValue({ questions: [], hasAnyResponses: false });

      render(<QuestionnaireBuilder eventId={mockEventId} isOrganizer={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add question/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(addButton);

      const typeSelect = screen.getByRole("combobox");
      fireEvent.change(typeSelect, { target: { value: "SINGLE_CHOICE" } });

      const questionInput = screen.getByPlaceholderText(/enter your question/i);
      fireEvent.change(questionInput, { target: { value: "Test question" } });

      // Leave choices empty
      const submitButton = screen.getByRole("button", { name: /add question/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/please provide at least 2 choices/i)).toBeInTheDocument();
      });
    });
  });
});
