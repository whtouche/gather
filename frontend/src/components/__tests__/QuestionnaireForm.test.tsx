import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QuestionnaireForm, type Question } from "../QuestionnaireForm";

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("QuestionnaireForm", () => {
  const mockQuestions: Question[] = [
    {
      id: "q1",
      eventId: "event-123",
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
      eventId: "event-123",
      questionText: "Select your favorite color",
      questionType: "SINGLE_CHOICE",
      isRequired: false,
      helpText: null,
      orderIndex: 1,
      choices: ["Red", "Blue", "Green"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "q3",
      eventId: "event-123",
      questionText: "Will you attend?",
      questionType: "YES_NO",
      isRequired: true,
      helpText: null,
      orderIndex: 2,
      choices: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const defaultProps = {
    eventId: "event-123",
    authToken: "test-token",
    questions: mockQuestions,
    rsvpResponse: "YES" as const,
    onSubmit: vi.fn(() => Promise.resolve()),
    apiBaseUrl: "http://test-api.com/api",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("Rendering", () => {
    it("should render all questions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(<QuestionnaireForm {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("What is your name?")
        ).toBeInTheDocument();
        expect(
          screen.getByText("Select your favorite color")
        ).toBeInTheDocument();
        expect(screen.getByText("Will you attend?")).toBeInTheDocument();
      });
    });

    it("should show required indicator for required questions on YES RSVP", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(<QuestionnaireForm {...defaultProps} rsvpResponse="YES" />);

      await waitFor(() => {
        const requiredIndicators = screen.getAllByText("*");
        expect(requiredIndicators.length).toBeGreaterThan(0);
      });
    });

    it("should show help text when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(<QuestionnaireForm {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("Please enter your full name")
        ).toBeInTheDocument();
      });
    });

    it("should render different input types correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(<QuestionnaireForm {...defaultProps} />);

      await waitFor(() => {
        // SHORT_TEXT renders as input
        const textInput = screen.getByPlaceholderText("Enter your response...");
        expect(textInput).toBeInTheDocument();
        expect(textInput.tagName).toBe("INPUT");

        // SINGLE_CHOICE renders as radio buttons
        const radioButtons = screen.getAllByRole("radio");
        expect(radioButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Question Types", () => {
    it("should render SHORT_TEXT input", async () => {
      const questions: Question[] = [
        {
          ...mockQuestions[0],
          questionType: "SHORT_TEXT",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(
        <QuestionnaireForm {...defaultProps} questions={questions} />
      );

      await waitFor(() => {
        const input = screen.getByPlaceholderText("Enter your response...");
        expect(input).toHaveAttribute("type", "text");
        expect(input).toHaveAttribute("maxlength", "200");
      });
    });

    it("should render LONG_TEXT textarea", async () => {
      const questions: Question[] = [
        {
          ...mockQuestions[0],
          questionType: "LONG_TEXT",
          questionText: "Tell us more",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(
        <QuestionnaireForm {...defaultProps} questions={questions} />
      );

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText("Enter your response...");
        expect(textarea.tagName).toBe("TEXTAREA");
        expect(textarea).toHaveAttribute("maxlength", "2000");
      });
    });

    it("should render SINGLE_CHOICE radio buttons", async () => {
      const questions: Question[] = [
        {
          ...mockQuestions[1],
          questionType: "SINGLE_CHOICE",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(
        <QuestionnaireForm {...defaultProps} questions={questions} />
      );

      await waitFor(() => {
        expect(screen.getByText("Red")).toBeInTheDocument();
        expect(screen.getByText("Blue")).toBeInTheDocument();
        expect(screen.getByText("Green")).toBeInTheDocument();

        const radioButtons = screen.getAllByRole("radio");
        expect(radioButtons).toHaveLength(3);
      });
    });

    it("should render MULTIPLE_CHOICE checkboxes", async () => {
      const questions: Question[] = [
        {
          ...mockQuestions[1],
          questionType: "MULTIPLE_CHOICE",
          questionText: "Select all that apply",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(
        <QuestionnaireForm {...defaultProps} questions={questions} />
      );

      await waitFor(() => {
        const checkboxes = screen.getAllByRole("checkbox");
        expect(checkboxes).toHaveLength(3);
      });
    });

    it("should render YES_NO radio buttons", async () => {
      const questions: Question[] = [
        {
          ...mockQuestions[2],
          questionType: "YES_NO",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(
        <QuestionnaireForm {...defaultProps} questions={questions} />
      );

      await waitFor(() => {
        expect(screen.getByText("Yes")).toBeInTheDocument();
        expect(screen.getByText("No")).toBeInTheDocument();

        const radioButtons = screen.getAllByRole("radio");
        expect(radioButtons).toHaveLength(2);
      });
    });

    it("should render NUMBER input", async () => {
      const questions: Question[] = [
        {
          ...mockQuestions[0],
          questionType: "NUMBER",
          questionText: "How many guests?",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(
        <QuestionnaireForm {...defaultProps} questions={questions} />
      );

      await waitFor(() => {
        const input = screen.getByPlaceholderText("Enter a number...");
        expect(input).toHaveAttribute("type", "number");
      });
    });

    it("should render DATE input", async () => {
      const questions: Question[] = [
        {
          ...mockQuestions[0],
          questionType: "DATE",
          questionText: "When is your birthday?",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(
        <QuestionnaireForm {...defaultProps} questions={questions} />
      );

      await waitFor(() => {
        const input = screen.getByLabelText(/When is your birthday?/);
        expect(input).toHaveAttribute("type", "date");
      });
    });
  });

  describe("User Interactions", () => {
    it("should update text input value", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(<QuestionnaireForm {...defaultProps} />);

      await waitFor(() => {
        const input = screen.getByPlaceholderText("Enter your response...");
        fireEvent.change(input, { target: { value: "John Doe" } });
        expect(input).toHaveValue("John Doe");
      });
    });

    it("should select radio button", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(<QuestionnaireForm {...defaultProps} />);

      await waitFor(() => {
        const blueOption = screen.getByLabelText("Blue");
        fireEvent.click(blueOption);
        expect(blueOption).toBeChecked();
      });
    });

    it("should toggle checkbox", async () => {
      const questions: Question[] = [
        {
          ...mockQuestions[1],
          questionType: "MULTIPLE_CHOICE",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(
        <QuestionnaireForm {...defaultProps} questions={questions} />
      );

      await waitFor(() => {
        const redCheckbox = screen.getByLabelText("Red");
        const blueCheckbox = screen.getByLabelText("Blue");

        fireEvent.click(redCheckbox);
        expect(redCheckbox).toBeChecked();

        fireEvent.click(blueCheckbox);
        expect(blueCheckbox).toBeChecked();
        expect(redCheckbox).toBeChecked(); // Both should be checked

        fireEvent.click(redCheckbox);
        expect(redCheckbox).not.toBeChecked();
      });
    });

    it("should handle NUMBER input correctly", async () => {
      const questions: Question[] = [
        {
          ...mockQuestions[0],
          questionType: "NUMBER",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(
        <QuestionnaireForm {...defaultProps} questions={questions} />
      );

      await waitFor(() => {
        const input = screen.getByPlaceholderText("Enter a number...");

        // Enter a valid number
        fireEvent.change(input, { target: { value: "42" } });
        expect(input).toHaveValue(42);

        // Clear the input
        fireEvent.change(input, { target: { value: "" } });
        expect(input).toHaveValue(null);
      });
    });
  });

  describe("Form Validation", () => {
    it("should validate required fields for YES RSVP", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      const onSubmit = vi.fn(() => Promise.resolve());

      render(
        <QuestionnaireForm
          {...defaultProps}
          rsvpResponse="YES"
          onSubmit={onSubmit}
        />
      );

      await waitFor(() => {
        const submitButton = screen.getByText("Submit Responses");
        fireEvent.click(submitButton);
      });

      // Should show validation errors
      await waitFor(() => {
        expect(
          screen.getAllByText("This question is required")
        ).toHaveLength(2);
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("should not validate required fields for MAYBE RSVP", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      const onSubmit = vi.fn(() => Promise.resolve());

      render(
        <QuestionnaireForm
          {...defaultProps}
          rsvpResponse="MAYBE"
          onSubmit={onSubmit}
        />
      );

      await waitFor(() => {
        const submitButton = screen.getByText("Submit Responses");
        fireEvent.click(submitButton);
      });

      // Should not show validation errors
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
    });

    it("should clear validation error when field is filled", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(
        <QuestionnaireForm {...defaultProps} rsvpResponse="YES" />
      );

      await waitFor(() => {
        const submitButton = screen.getByText("Submit Responses");
        fireEvent.click(submitButton);
      });

      // Should show validation error
      await waitFor(() => {
        expect(screen.getAllByText("This question is required").length).toBeGreaterThan(0);
      });

      // Fill in the field
      const input = screen.getByPlaceholderText("Enter your response...");
      fireEvent.change(input, { target: { value: "John Doe" } });

      // Error should be cleared (or reduced)
      await waitFor(() => {
        const errors = screen.queryAllByText("This question is required");
        expect(errors.length).toBeLessThan(2);
      });
    });

    it("should allow submission with all required fields filled", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      const onSubmit = vi.fn(() => Promise.resolve());

      render(
        <QuestionnaireForm
          {...defaultProps}
          rsvpResponse="YES"
          onSubmit={onSubmit}
        />
      );

      await waitFor(() => {
        // Fill in required fields
        const textInput = screen.getByPlaceholderText("Enter your response...");
        fireEvent.change(textInput, { target: { value: "John Doe" } });

        const yesButton = screen.getByLabelText("Yes");
        fireEvent.click(yesButton);

        const submitButton = screen.getByText("Submit Responses");
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          q1: "John Doe",
          q3: true,
        });
      });
    });
  });

  describe("Loading Existing Responses", () => {
    it("should load and display existing responses", async () => {
      const existingResponses = {
        responses: [
          {
            questionId: "q1",
            response: "John Doe",
          },
          {
            questionId: "q2",
            response: "Blue",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(existingResponses),
      });

      render(<QuestionnaireForm {...defaultProps} />);

      await waitFor(() => {
        const textInput = screen.getByPlaceholderText("Enter your response...");
        expect(textInput).toHaveValue("John Doe");

        const blueOption = screen.getByLabelText("Blue");
        expect(blueOption).toBeChecked();
      });
    });

    it("should handle failed response load gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      render(<QuestionnaireForm {...defaultProps} />);

      // Should still render the form
      await waitFor(() => {
        expect(
          screen.getByText("What is your name?")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Skip/Cancel functionality", () => {
    it("should show Skip button for MAYBE RSVP", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      const onCancel = vi.fn();

      render(
        <QuestionnaireForm
          {...defaultProps}
          rsvpResponse="MAYBE"
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Skip")).toBeInTheDocument();
      });
    });

    it("should not show Skip button for YES RSVP", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      render(
        <QuestionnaireForm {...defaultProps} rsvpResponse="YES" />
      );

      await waitFor(() => {
        expect(screen.queryByText("Skip")).not.toBeInTheDocument();
      });
    });

    it("should call onCancel when Skip is clicked", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      const onCancel = vi.fn();

      render(
        <QuestionnaireForm
          {...defaultProps}
          rsvpResponse="MAYBE"
          onCancel={onCancel}
        />
      );

      await waitFor(() => {
        const skipButton = screen.getByText("Skip");
        fireEvent.click(skipButton);
      });

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("Submission State", () => {
    it("should disable submit button while submitting", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ responses: [] }),
      });

      const onSubmit = vi.fn(
        (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <QuestionnaireForm
          {...defaultProps}
          rsvpResponse="MAYBE"
          onSubmit={onSubmit}
        />
      );

      await waitFor(() => {
        const submitButton = screen.getByText("Submit Responses");
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        const submitButton = screen.getByText("Submitting...");
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe("Empty state", () => {
    it("should not render when no questions", async () => {
      const { container } = render(
        <QuestionnaireForm {...defaultProps} questions={[]} />
      );

      expect(container.firstChild).toBeNull();
    });
  });
});
