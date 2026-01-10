import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuestionnaireResponses } from "../QuestionnaireResponses";
import * as api from "../../services/api";

// Mock the API
vi.mock("../../services/api", () => ({
  getQuestionnaireResponsesSummary: vi.fn(),
  getIncompleteAttendees: vi.fn(),
  exportQuestionnaireResponses: vi.fn(),
  isApiError: vi.fn(),
}));

describe("QuestionnaireResponses", () => {
  const mockEventId = "test-event-123";

  const mockSummary: api.QuestionnaireResponsesSummary = {
    questions: [
      {
        question: {
          id: "q1",
          eventId: mockEventId,
          questionText: "What is your dietary restriction?",
          questionType: "SINGLE_CHOICE",
          isRequired: true,
          helpText: null,
          orderIndex: 0,
          choices: ["None", "Vegetarian", "Vegan", "Gluten-free"],
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        responseCount: 3,
        responses: [
          {
            userId: "user-1",
            displayName: "Alice",
            response: "Vegetarian",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          {
            userId: "user-2",
            displayName: "Bob",
            response: "Vegan",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          {
            userId: "user-3",
            displayName: "Charlie",
            response: "Vegetarian",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
        statistics: {
          choiceCounts: {
            Vegetarian: 2,
            Vegan: 1,
          },
        },
      },
      {
        question: {
          id: "q2",
          eventId: mockEventId,
          questionText: "Will you bring a plus one?",
          questionType: "YES_NO",
          isRequired: false,
          helpText: null,
          orderIndex: 1,
          choices: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        responseCount: 3,
        responses: [
          {
            userId: "user-1",
            displayName: "Alice",
            response: true,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          {
            userId: "user-2",
            displayName: "Bob",
            response: false,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          {
            userId: "user-3",
            displayName: "Charlie",
            response: true,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
        statistics: {
          yesCount: 2,
          noCount: 1,
        },
      },
      {
        question: {
          id: "q3",
          eventId: mockEventId,
          questionText: "Rate your excitement (1-10)",
          questionType: "NUMBER",
          isRequired: false,
          helpText: null,
          orderIndex: 2,
          choices: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        responseCount: 3,
        responses: [
          {
            userId: "user-1",
            displayName: "Alice",
            response: 8,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          {
            userId: "user-2",
            displayName: "Bob",
            response: 10,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          {
            userId: "user-3",
            displayName: "Charlie",
            response: 7,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
        statistics: {
          average: 8.33,
          min: 7,
          max: 10,
          count: 3,
        },
      },
    ],
    totalRespondents: 3,
  };

  const mockIncomplete: api.IncompleteAttendeesResponse = {
    incompleteAttendees: [
      {
        userId: "user-4",
        displayName: "David",
        missingQuestions: [
          {
            id: "q1",
            questionText: "What is your dietary restriction?",
          },
        ],
        totalRequired: 1,
        answeredRequired: 0,
      },
    ],
    totalAttendees: 4,
    incompleteCount: 1,
    requiredQuestionCount: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getQuestionnaireResponsesSummary).mockResolvedValue(mockSummary);
    vi.mocked(api.getIncompleteAttendees).mockResolvedValue(mockIncomplete);
  });

  describe("Rendering", () => {
    it("should render loading state initially", () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("should render component with header and respondent count", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        expect(screen.getByText("Questionnaire Responses")).toBeInTheDocument();
        expect(screen.getByText(/3 respondents/i)).toBeInTheDocument();
      });
    });

    it("should render Export CSV button", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        expect(screen.getByText("Export CSV")).toBeInTheDocument();
      });
    });

    it("should render two tabs: Response Summary and Incomplete", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        expect(screen.getByText("Response Summary")).toBeInTheDocument();
        expect(screen.getByText(/Incomplete \(1\)/i)).toBeInTheDocument();
      });
    });
  });

  describe("Summary Tab", () => {
    it("should display all questions with their response counts", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        expect(screen.getByText("What is your dietary restriction?")).toBeInTheDocument();
        expect(screen.getByText("Will you bring a plus one?")).toBeInTheDocument();
        expect(screen.getByText("Rate your excitement (1-10)")).toBeInTheDocument();
        expect(screen.getAllByText(/3 responses/i)).toHaveLength(3);
      });
    });

    it("should show required indicator for required questions", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        const requiredIndicators = screen.getAllByText("*");
        expect(requiredIndicators.length).toBeGreaterThan(0);
      });
    });

    it("should display choice statistics with distribution bars", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        expect(screen.getByText("Response Distribution:")).toBeInTheDocument();
        expect(screen.getByText(/Vegetarian/)).toBeInTheDocument();
        expect(screen.getByText(/Vegan/)).toBeInTheDocument();
        expect(screen.getByText(/2 \(67%\)/)).toBeInTheDocument();
        expect(screen.getByText(/1 \(33%\)/)).toBeInTheDocument();
      });
    });

    it("should display YES/NO statistics", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        expect(screen.getByText(/Yes:/)).toBeInTheDocument();
        expect(screen.getByText(/No:/)).toBeInTheDocument();
      });
    });

    it("should display NUMBER statistics with average, min, max", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        expect(screen.getByText(/Average:/)).toBeInTheDocument();
        expect(screen.getByText(/Min:/)).toBeInTheDocument();
        expect(screen.getByText(/Max:/)).toBeInTheDocument();
        expect(screen.getByText(/8.33/)).toBeInTheDocument();
      });
    });

    it("should display individual responses with user names", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        expect(screen.getAllByText(/Alice:/)).toHaveLength(3);
        expect(screen.getAllByText(/Bob:/)).toHaveLength(3);
        expect(screen.getAllByText(/Charlie:/)).toHaveLength(3);
      });
    });

    it("should have a user filter dropdown", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        const filterLabel = screen.getByText("Filter by attendee:");
        expect(filterLabel).toBeInTheDocument();

        const select = screen.getByRole("combobox");
        expect(select).toBeInTheDocument();
      });
    });

    it("should filter responses when user is selected", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        const select = screen.getByRole("combobox");
        fireEvent.change(select, { target: { value: "user-1" } });
      });

      await waitFor(() => {
        expect(api.getQuestionnaireResponsesSummary).toHaveBeenCalledWith(
          mockEventId,
          "user-1"
        );
      });
    });
  });

  describe("Incomplete Tab", () => {
    it("should switch to incomplete tab when clicked", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        const incompleteTab = screen.getByText(/Incomplete \(1\)/i);
        fireEvent.click(incompleteTab);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/1 of 4 attendees haven't completed all required questions/i)
        ).toBeInTheDocument();
      });
    });

    it("should display incomplete attendees with missing questions", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        const incompleteTab = screen.getByText(/Incomplete \(1\)/i);
        fireEvent.click(incompleteTab);
      });

      await waitFor(() => {
        expect(screen.getByText("David")).toBeInTheDocument();
        expect(screen.getByText(/Answered 0 of 1 required questions/i)).toBeInTheDocument();
        expect(screen.getByText("Missing questions:")).toBeInTheDocument();
        expect(screen.getByText("What is your dietary restriction?")).toBeInTheDocument();
      });
    });

    it("should show success message when all attendees are complete", async () => {
      vi.mocked(api.getIncompleteAttendees).mockResolvedValue({
        incompleteAttendees: [],
        totalAttendees: 3,
        incompleteCount: 0,
        requiredQuestionCount: 1,
      });

      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        const incompleteTab = screen.getByText(/Incomplete \(0\)/i);
        fireEvent.click(incompleteTab);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/All attendees have completed the required questions!/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Export Functionality", () => {
    it("should call export API when Export CSV button is clicked", async () => {
      const mockBlob = new Blob(["test csv data"], { type: "text/csv" });
      vi.mocked(api.exportQuestionnaireResponses).mockResolvedValue(mockBlob);

      // Mock URL.createObjectURL
      window.URL.createObjectURL = vi.fn(() => "blob:mock-url");
      window.URL.revokeObjectURL = vi.fn();

      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        const exportButton = screen.getByText("Export CSV");
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(api.exportQuestionnaireResponses).toHaveBeenCalledWith(mockEventId);
      });
    });

    it("should disable export button when there are no respondents", async () => {
      vi.mocked(api.getQuestionnaireResponsesSummary).mockResolvedValue({
        questions: [],
        totalRespondents: 0,
      });

      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        const exportButton = screen.getByText("Export CSV");
        expect(exportButton).toBeDisabled();
      });
    });

    it("should show exporting state when export is in progress", async () => {
      const mockBlob = new Blob(["test csv data"], { type: "text/csv" });
      vi.mocked(api.exportQuestionnaireResponses).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockBlob), 100);
          })
      );

      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        const exportButton = screen.getByText("Export CSV");
        fireEvent.click(exportButton);
      });

      expect(screen.getByText("Exporting...")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should display error message when API call fails", async () => {
      vi.mocked(api.getQuestionnaireResponsesSummary).mockRejectedValue(
        new Error("Failed to load")
      );
      vi.mocked(api.isApiError).mockReturnValue(false);

      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load questionnaire responses/i)).toBeInTheDocument();
      });
    });

    it("should display API error message", async () => {
      const apiError = {
        message: "Event not found",
        statusCode: 404,
        code: "EVENT_NOT_FOUND",
      };

      vi.mocked(api.getQuestionnaireResponsesSummary).mockRejectedValue(apiError);
      vi.mocked(api.isApiError).mockReturnValue(true);

      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        expect(screen.getByText("Event not found")).toBeInTheDocument();
      });
    });

    it("should display error when export fails", async () => {
      vi.mocked(api.exportQuestionnaireResponses).mockRejectedValue(
        new Error("Export failed")
      );
      vi.mocked(api.isApiError).mockReturnValue(false);

      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        const exportButton = screen.getByText("Export CSV");
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to export responses/i)).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty questions list", async () => {
      vi.mocked(api.getQuestionnaireResponsesSummary).mockResolvedValue({
        questions: [],
        totalRespondents: 0,
      });

      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        expect(
          screen.getByText(/No questionnaire questions found for this event/i)
        ).toBeInTheDocument();
      });
    });

    it("should render response values correctly for different types", async () => {
      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        // String
        expect(screen.getByText(/Vegetarian/)).toBeInTheDocument();
        // Boolean (rendered as Yes/No)
        expect(screen.getByText(/Yes/)).toBeInTheDocument();
        expect(screen.getByText(/No/)).toBeInTheDocument();
        // Number
        expect(screen.getByText("8")).toBeInTheDocument();
        expect(screen.getByText("10")).toBeInTheDocument();
      });
    });

    it("should handle null/undefined response values", () => {
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

      expect(renderResponseValue(null, "SHORT_TEXT")).toBe("-");
      expect(renderResponseValue(undefined, "SHORT_TEXT")).toBe("-");
      expect(renderResponseValue(["A", "B"], "MULTIPLE_CHOICE")).toBe("A, B");
      expect(renderResponseValue(true, "YES_NO")).toBe("Yes");
      expect(renderResponseValue(false, "YES_NO")).toBe("No");
      expect(renderResponseValue(42, "NUMBER")).toBe("42");
    });

    it("should handle questions with no responses gracefully", async () => {
      const summaryWithNoResponses: api.QuestionnaireResponsesSummary = {
        questions: [
          {
            question: {
              id: "q1",
              eventId: mockEventId,
              questionText: "Unanswered question",
              questionType: "SHORT_TEXT",
              isRequired: false,
              helpText: null,
              orderIndex: 0,
              choices: null,
              createdAt: "2024-01-01T00:00:00Z",
              updatedAt: "2024-01-01T00:00:00Z",
            },
            responseCount: 0,
            responses: [],
            statistics: {},
          },
        ],
        totalRespondents: 0,
      };

      vi.mocked(api.getQuestionnaireResponsesSummary).mockResolvedValue(
        summaryWithNoResponses
      );

      render(<QuestionnaireResponses eventId={mockEventId} />);

      await waitFor(() => {
        expect(screen.getByText("Unanswered question")).toBeInTheDocument();
        expect(screen.getByText(/0 responses/i)).toBeInTheDocument();
      });
    });
  });
});
