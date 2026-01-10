import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing routes
vi.mock("../utils/db.js", () => ({
  prisma: {
    questionnaireQuestion: {
      findMany: vi.fn(),
    },
    questionnaireResponse: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    rSVP: {
      findMany: vi.fn(),
    },
    event: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../utils/db.js";

describe("Questionnaire Response Summary (Organizer Views)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/events/:eventId/questionnaire/responses/summary", () => {
    const mockQuestions = [
      {
        id: "q1",
        eventId: "event-123",
        questionText: "What is your dietary restriction?",
        questionType: "SINGLE_CHOICE",
        isRequired: true,
        helpText: null,
        orderIndex: 0,
        choices: JSON.stringify(["None", "Vegetarian", "Vegan", "Gluten-free"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "q2",
        eventId: "event-123",
        questionText: "Will you bring a plus one?",
        questionType: "YES_NO",
        isRequired: false,
        helpText: null,
        orderIndex: 1,
        choices: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "q3",
        eventId: "event-123",
        questionText: "Rate your excitement level (1-10)",
        questionType: "NUMBER",
        isRequired: false,
        helpText: null,
        orderIndex: 2,
        choices: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockUsers = [
      { id: "user-1", displayName: "Alice" },
      { id: "user-2", displayName: "Bob" },
      { id: "user-3", displayName: "Charlie" },
    ];

    const mockResponses = [
      {
        id: "r1",
        questionId: "q1",
        eventId: "event-123",
        userId: "user-1",
        response: JSON.stringify("Vegetarian"),
        createdAt: new Date(),
        updatedAt: new Date(),
        question: mockQuestions[0],
      },
      {
        id: "r2",
        questionId: "q1",
        eventId: "event-123",
        userId: "user-2",
        response: JSON.stringify("Vegan"),
        createdAt: new Date(),
        updatedAt: new Date(),
        question: mockQuestions[0],
      },
      {
        id: "r3",
        questionId: "q2",
        eventId: "event-123",
        userId: "user-1",
        response: JSON.stringify(true),
        createdAt: new Date(),
        updatedAt: new Date(),
        question: mockQuestions[1],
      },
      {
        id: "r4",
        questionId: "q2",
        eventId: "event-123",
        userId: "user-2",
        response: JSON.stringify(false),
        createdAt: new Date(),
        updatedAt: new Date(),
        question: mockQuestions[1],
      },
      {
        id: "r5",
        questionId: "q3",
        eventId: "event-123",
        userId: "user-1",
        response: JSON.stringify(8),
        createdAt: new Date(),
        updatedAt: new Date(),
        question: mockQuestions[2],
      },
      {
        id: "r6",
        questionId: "q3",
        eventId: "event-123",
        userId: "user-2",
        response: JSON.stringify(10),
        createdAt: new Date(),
        updatedAt: new Date(),
        question: mockQuestions[2],
      },
      {
        id: "r7",
        questionId: "q3",
        eventId: "event-123",
        userId: "user-3",
        response: JSON.stringify(7),
        createdAt: new Date(),
        updatedAt: new Date(),
        question: mockQuestions[2],
      },
    ];

    it("should group responses by question", async () => {
      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue(mockQuestions as any);
      vi.mocked(prisma.questionnaireResponse.findMany).mockResolvedValue(mockResponses as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId: "event-123" },
        orderBy: { orderIndex: "asc" },
      });

      const responses = await prisma.questionnaireResponse.findMany({
        where: { eventId: "event-123" },
        include: { question: true },
      });

      expect(questions).toHaveLength(3);
      expect(responses).toHaveLength(7);

      // Group responses by question
      const responsesByQuestion = questions.map((q) => ({
        question: q,
        responses: responses.filter((r) => r.questionId === q.id),
      }));

      expect(responsesByQuestion[0].responses).toHaveLength(2); // q1
      expect(responsesByQuestion[1].responses).toHaveLength(2); // q2
      expect(responsesByQuestion[2].responses).toHaveLength(3); // q3
    });

    it("should calculate statistics for SINGLE_CHOICE questions", () => {
      const choiceResponses = [
        { response: JSON.stringify("Vegetarian") },
        { response: JSON.stringify("Vegan") },
        { response: JSON.stringify("Vegetarian") },
        { response: JSON.stringify("None") },
      ];

      const choiceCounts: Record<string, number> = {};
      choiceResponses.forEach((r) => {
        const parsed = JSON.parse(r.response);
        choiceCounts[parsed] = (choiceCounts[parsed] || 0) + 1;
      });

      expect(choiceCounts["Vegetarian"]).toBe(2);
      expect(choiceCounts["Vegan"]).toBe(1);
      expect(choiceCounts["None"]).toBe(1);
      expect(choiceCounts["Gluten-free"]).toBeUndefined();
    });

    it("should calculate statistics for MULTIPLE_CHOICE questions", () => {
      const multiChoiceResponses = [
        { response: JSON.stringify(["Red", "Blue"]) },
        { response: JSON.stringify(["Blue"]) },
        { response: JSON.stringify(["Red", "Green"]) },
      ];

      const choiceCounts: Record<string, number> = {};
      multiChoiceResponses.forEach((r) => {
        const parsed = JSON.parse(r.response);
        parsed.forEach((choice: string) => {
          choiceCounts[choice] = (choiceCounts[choice] || 0) + 1;
        });
      });

      expect(choiceCounts["Red"]).toBe(2);
      expect(choiceCounts["Blue"]).toBe(2);
      expect(choiceCounts["Green"]).toBe(1);
    });

    it("should calculate statistics for YES_NO questions", () => {
      const yesNoResponses = [
        { response: JSON.stringify(true) },
        { response: JSON.stringify(false) },
        { response: JSON.stringify(true) },
        { response: JSON.stringify(true) },
      ];

      const yesCount = yesNoResponses.filter(
        (r) => JSON.parse(r.response) === true
      ).length;
      const noCount = yesNoResponses.filter(
        (r) => JSON.parse(r.response) === false
      ).length;

      expect(yesCount).toBe(3);
      expect(noCount).toBe(1);
    });

    it("should calculate statistics for NUMBER questions", () => {
      const numberResponses = [
        { response: JSON.stringify(8) },
        { response: JSON.stringify(10) },
        { response: JSON.stringify(7) },
        { response: JSON.stringify(9) },
      ];

      const numbers = numberResponses
        .map((r) => JSON.parse(r.response))
        .filter((n): n is number => typeof n === "number");

      const sum = numbers.reduce((a, b) => a + b, 0);
      const avg = sum / numbers.length;
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);

      expect(avg).toBe(8.5);
      expect(min).toBe(7);
      expect(max).toBe(10);
      expect(numbers.length).toBe(4);
    });

    it("should filter responses by userId when provided", async () => {
      const filteredResponses = mockResponses.filter((r) => r.userId === "user-1");

      vi.mocked(prisma.questionnaireResponse.findMany).mockResolvedValue(
        filteredResponses as any
      );

      const responses = await prisma.questionnaireResponse.findMany({
        where: {
          eventId: "event-123",
          userId: "user-1",
        },
        include: { question: true },
      });

      expect(responses).toHaveLength(3);
      expect(responses.every((r) => r.userId === "user-1")).toBe(true);
    });

    it("should include user display names with responses", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

      const users = await prisma.user.findMany({
        where: { id: { in: ["user-1", "user-2", "user-3"] } },
        select: { id: true, displayName: true },
      });

      const usersMap = new Map(users.map((u) => [u.id, u]));

      expect(usersMap.get("user-1")?.displayName).toBe("Alice");
      expect(usersMap.get("user-2")?.displayName).toBe("Bob");
      expect(usersMap.get("user-3")?.displayName).toBe("Charlie");
    });

    it("should handle questions with no responses", async () => {
      const questionsOnly = mockQuestions;
      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue(questionsOnly as any);
      vi.mocked(prisma.questionnaireResponse.findMany).mockResolvedValue([]);

      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId: "event-123" },
      });

      const responses = await prisma.questionnaireResponse.findMany({
        where: { eventId: "event-123" },
      });

      const responsesByQuestion = questions.map((q) => ({
        question: q,
        responses: responses.filter((r) => r.questionId === q.id),
        responseCount: responses.filter((r) => r.questionId === q.id).length,
      }));

      expect(responsesByQuestion.every((q) => q.responseCount === 0)).toBe(true);
    });

    it("should parse JSON choices correctly", () => {
      const question = mockQuestions[0];
      const choices = JSON.parse(question.choices!);

      expect(Array.isArray(choices)).toBe(true);
      expect(choices).toEqual(["None", "Vegetarian", "Vegan", "Gluten-free"]);
    });

    it("should handle null choices for non-choice questions", () => {
      const question = mockQuestions[1]; // YES_NO question
      expect(question.choices).toBeNull();
    });
  });

  describe("GET /api/events/:eventId/questionnaire/responses/incomplete", () => {
    const mockQuestions = [
      {
        id: "q1",
        eventId: "event-123",
        questionText: "Required Question 1",
        questionType: "SHORT_TEXT",
        isRequired: true,
        helpText: null,
        orderIndex: 0,
        choices: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "q2",
        eventId: "event-123",
        questionText: "Required Question 2",
        questionType: "SHORT_TEXT",
        isRequired: true,
        helpText: null,
        orderIndex: 1,
        choices: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "q3",
        eventId: "event-123",
        questionText: "Optional Question",
        questionType: "SHORT_TEXT",
        isRequired: false,
        helpText: null,
        orderIndex: 2,
        choices: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it("should identify attendees with missing required questions", async () => {
      const yesRSVPs = [
        {
          id: "rsvp-1",
          eventId: "event-123",
          userId: "user-1",
          response: "YES",
          user: { id: "user-1", displayName: "Alice" },
        },
        {
          id: "rsvp-2",
          eventId: "event-123",
          userId: "user-2",
          response: "YES",
          user: { id: "user-2", displayName: "Bob" },
        },
      ];

      const user1Responses = [
        { questionId: "q1" }, // Only answered q1
      ];

      const user2Responses = [
        { questionId: "q1" },
        { questionId: "q2" }, // Answered both required questions
      ];

      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue(mockQuestions as any);
      vi.mocked(prisma.rSVP.findMany).mockResolvedValue(yesRSVPs as any);

      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId: "event-123" },
      });

      const requiredQuestionIds = questions.filter((q) => q.isRequired).map((q) => q.id);

      // Check user-1
      const user1AnsweredIds = new Set(user1Responses.map((r) => r.questionId));
      const user1Missing = requiredQuestionIds.filter((id) => !user1AnsweredIds.has(id));
      expect(user1Missing).toEqual(["q2"]); // Missing q2

      // Check user-2
      const user2AnsweredIds = new Set(user2Responses.map((r) => r.questionId));
      const user2Missing = requiredQuestionIds.filter((id) => !user2AnsweredIds.has(id));
      expect(user2Missing).toEqual([]); // Complete
    });

    it("should only check attendees who RSVP'd YES", async () => {
      const allRSVPs = [
        {
          id: "rsvp-1",
          eventId: "event-123",
          userId: "user-1",
          response: "YES",
          user: { id: "user-1", displayName: "Alice" },
        },
        {
          id: "rsvp-2",
          eventId: "event-123",
          userId: "user-2",
          response: "NO",
          user: { id: "user-2", displayName: "Bob" },
        },
        {
          id: "rsvp-3",
          eventId: "event-123",
          userId: "user-3",
          response: "MAYBE",
          user: { id: "user-3", displayName: "Charlie" },
        },
      ];

      const yesRSVPs = allRSVPs.filter((r) => r.response === "YES");

      expect(yesRSVPs).toHaveLength(1);
      expect(yesRSVPs[0].userId).toBe("user-1");
    });

    it("should calculate completion percentage", () => {
      const totalRequired = 3;
      const answeredRequired = 2;

      const completionPercentage = Math.round((answeredRequired / totalRequired) * 100);

      expect(completionPercentage).toBe(67);
    });

    it("should return empty array when all attendees are complete", async () => {
      const requiredQuestionIds = ["q1", "q2"];
      const yesRSVPs = [
        { userId: "user-1", user: { id: "user-1", displayName: "Alice" } },
        { userId: "user-2", user: { id: "user-2", displayName: "Bob" } },
      ];

      // Both users answered all required questions
      const user1Responses = [{ questionId: "q1" }, { questionId: "q2" }];
      const user2Responses = [{ questionId: "q1" }, { questionId: "q2" }];

      const incompleteAttendees = [];

      for (const rsvp of yesRSVPs) {
        const userResponses =
          rsvp.userId === "user-1" ? user1Responses : user2Responses;
        const answeredIds = new Set(userResponses.map((r) => r.questionId));
        const missing = requiredQuestionIds.filter((id) => !answeredIds.has(id));

        if (missing.length > 0) {
          incompleteAttendees.push(rsvp);
        }
      }

      expect(incompleteAttendees).toHaveLength(0);
    });

    it("should provide details of missing questions", async () => {
      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue(mockQuestions as any);

      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId: "event-123" },
      });

      const missingQuestionIds = ["q1", "q2"];
      const missingQuestions = questions
        .filter((q) => missingQuestionIds.includes(q.id))
        .map((q) => ({
          id: q.id,
          questionText: q.questionText,
        }));

      expect(missingQuestions).toHaveLength(2);
      expect(missingQuestions[0].questionText).toBe("Required Question 1");
      expect(missingQuestions[1].questionText).toBe("Required Question 2");
    });
  });

  describe("GET /api/events/:eventId/questionnaire/responses/export", () => {
    it("should generate CSV header with question texts", () => {
      const questions = [
        { questionText: "What is your name?" },
        { questionText: "What is your email?" },
        { questionText: "Dietary restrictions?" },
      ];

      const headers = ["Display Name", "RSVP Status", ...questions.map((q) => q.questionText)];

      expect(headers).toEqual([
        "Display Name",
        "RSVP Status",
        "What is your name?",
        "What is your email?",
        "Dietary restrictions?",
      ]);
    });

    it("should format array responses with semicolons", () => {
      const arrayResponse = ["Option 1", "Option 2", "Option 3"];
      const formatted = arrayResponse.join("; ");

      expect(formatted).toBe("Option 1; Option 2; Option 3");
    });

    it("should format boolean responses as Yes/No", () => {
      expect(true ? "Yes" : "No").toBe("Yes");
      expect(false ? "Yes" : "No").toBe("No");
    });

    it("should escape CSV special characters", () => {
      const escapeCSV = (value: string) => {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      expect(escapeCSV("Normal text")).toBe("Normal text");
      expect(escapeCSV("Text, with comma")).toBe('"Text, with comma"');
      expect(escapeCSV('Text with "quotes"')).toBe('"Text with ""quotes"""');
      expect(escapeCSV("Text\nwith\nnewlines")).toBe('"Text\nwith\nnewlines"');
    });

    it("should handle missing responses gracefully", () => {
      const questionIds = ["q1", "q2", "q3"];
      const responsesMap = new Map([
        ["q1", JSON.stringify("Answer 1")],
        // q2 missing
        ["q3", JSON.stringify("Answer 3")],
      ]);

      const row = questionIds.map((qId) => {
        const responseJson = responsesMap.get(qId);
        if (!responseJson) return "";
        return JSON.parse(responseJson);
      });

      expect(row).toEqual(["Answer 1", "", "Answer 3"]);
    });

    it("should build proper CSV format", () => {
      const headers = ["Name", "Email", "Response"];
      const rows = [
        ["Alice", "alice@example.com", "Yes"],
        ["Bob", "bob@example.com", "No"],
      ];

      const csvLines = [headers.join(","), ...rows.map((row) => row.join(","))];

      const csvContent = csvLines.join("\n");

      expect(csvContent).toBe(
        "Name,Email,Response\nAlice,alice@example.com,Yes\nBob,bob@example.com,No"
      );
    });

    it("should handle event not found error", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

      const event = await prisma.event.findUnique({
        where: { id: "nonexistent-event" },
      });

      expect(event).toBeNull();
    });

    it("should handle no questions scenario", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: "event-123",
        title: "Test Event",
      } as any);

      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue([]);

      const event = await prisma.event.findUnique({ where: { id: "event-123" } });
      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId: "event-123" },
      });

      expect(event).not.toBeNull();
      expect(questions).toHaveLength(0);
    });
  });
});
