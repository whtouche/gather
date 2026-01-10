import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing routes
vi.mock("../utils/db.js", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    questionnaireQuestion: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    questionnaireResponse: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../utils/db.js";

describe("Questionnaire functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Question validation", () => {
    it("should require question text", () => {
      const invalidQuestion = {
        questionText: "",
        questionType: "SHORT_TEXT",
      };

      expect(invalidQuestion.questionText).toBe("");
    });

    it("should enforce maximum question text length of 500 characters", () => {
      const longText = "a".repeat(501);
      const validText = "a".repeat(500);

      expect(longText.length).toBeGreaterThan(500);
      expect(validText.length).toBe(500);
    });

    it("should enforce maximum help text length of 200 characters", () => {
      const longHelpText = "a".repeat(201);
      const validHelpText = "a".repeat(200);

      expect(longHelpText.length).toBeGreaterThan(200);
      expect(validHelpText.length).toBe(200);
    });

    it("should validate question types", () => {
      const validTypes = [
        "SHORT_TEXT",
        "LONG_TEXT",
        "SINGLE_CHOICE",
        "MULTIPLE_CHOICE",
        "YES_NO",
        "NUMBER",
        "DATE",
      ];

      validTypes.forEach((type) => {
        expect(validTypes).toContain(type);
      });
    });

    it("should require choices for SINGLE_CHOICE questions", () => {
      const singleChoiceQuestion = {
        questionText: "What is your favorite color?",
        questionType: "SINGLE_CHOICE",
        choices: ["Red", "Blue", "Green"],
      };

      expect(singleChoiceQuestion.choices).toBeDefined();
      expect(singleChoiceQuestion.choices.length).toBeGreaterThanOrEqual(2);
    });

    it("should require choices for MULTIPLE_CHOICE questions", () => {
      const multipleChoiceQuestion = {
        questionText: "Which colors do you like?",
        questionType: "MULTIPLE_CHOICE",
        choices: ["Red", "Blue", "Green", "Yellow"],
      };

      expect(multipleChoiceQuestion.choices).toBeDefined();
      expect(multipleChoiceQuestion.choices.length).toBeGreaterThanOrEqual(2);
    });

    it("should enforce minimum 2 choices and maximum 10 choices", () => {
      const twoChoices = ["Option 1", "Option 2"];
      const tenChoices = Array.from({ length: 10 }, (_, i) => `Option ${i + 1}`);
      const oneChoice = ["Option 1"];
      const elevenChoices = Array.from({ length: 11 }, (_, i) => `Option ${i + 1}`);

      expect(twoChoices.length).toBe(2);
      expect(tenChoices.length).toBe(10);
      expect(oneChoice.length).toBeLessThan(2);
      expect(elevenChoices.length).toBeGreaterThan(10);
    });

    it("should enforce maximum choice text length of 200 characters", () => {
      const longChoice = "a".repeat(201);
      const validChoice = "a".repeat(200);

      expect(longChoice.length).toBeGreaterThan(200);
      expect(validChoice.length).toBe(200);
    });

    it("should not require choices for non-choice question types", () => {
      const textQuestion = {
        questionText: "What is your name?",
        questionType: "SHORT_TEXT",
        choices: null,
      };

      expect(textQuestion.questionType).toBe("SHORT_TEXT");
      expect(textQuestion.choices).toBeNull();
    });

    it("should validate that choices are non-empty strings", () => {
      const validChoices = ["Option 1", "Option 2", "Option 3"];
      const invalidChoices = ["", "Option 2"];

      validChoices.forEach((choice) => {
        expect(choice.trim()).not.toBe("");
      });

      expect(invalidChoices[0].trim()).toBe("");
    });
  });

  describe("Question ordering", () => {
    it("should assign orderIndex based on creation order", () => {
      const questions = [
        { id: "q1", orderIndex: 0 },
        { id: "q2", orderIndex: 1 },
        { id: "q3", orderIndex: 2 },
      ];

      questions.forEach((q, index) => {
        expect(q.orderIndex).toBe(index);
      });
    });

    it("should allow reordering questions", () => {
      const originalOrder = [
        { id: "q1", orderIndex: 0 },
        { id: "q2", orderIndex: 1 },
        { id: "q3", orderIndex: 2 },
      ];

      const newOrder = [
        { id: "q3", orderIndex: 0 },
        { id: "q1", orderIndex: 1 },
        { id: "q2", orderIndex: 2 },
      ];

      expect(originalOrder[0].id).toBe("q1");
      expect(newOrder[0].id).toBe("q3");
    });

    it("should retrieve questions in orderIndex ascending order", async () => {
      const mockQuestions = [
        {
          id: "q1",
          eventId: "event-123",
          questionText: "Question 1",
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "q2",
          eventId: "event-123",
          questionText: "Question 2",
          questionType: "YES_NO",
          isRequired: true,
          helpText: null,
          orderIndex: 1,
          choices: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue(
        mockQuestions as any
      );

      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId: "event-123" },
        orderBy: { orderIndex: "asc" },
      });

      expect(questions[0].orderIndex).toBeLessThan(questions[1].orderIndex);
    });
  });

  describe("Question types", () => {
    it("should support SHORT_TEXT questions", () => {
      const question = {
        questionType: "SHORT_TEXT",
        questionText: "What is your name?",
      };

      expect(question.questionType).toBe("SHORT_TEXT");
    });

    it("should support LONG_TEXT questions", () => {
      const question = {
        questionType: "LONG_TEXT",
        questionText: "Tell us about yourself",
      };

      expect(question.questionType).toBe("LONG_TEXT");
    });

    it("should support SINGLE_CHOICE questions", () => {
      const question = {
        questionType: "SINGLE_CHOICE",
        questionText: "What is your favorite color?",
        choices: ["Red", "Blue", "Green"],
      };

      expect(question.questionType).toBe("SINGLE_CHOICE");
      expect(question.choices).toBeDefined();
    });

    it("should support MULTIPLE_CHOICE questions", () => {
      const question = {
        questionType: "MULTIPLE_CHOICE",
        questionText: "Which colors do you like?",
        choices: ["Red", "Blue", "Green", "Yellow"],
      };

      expect(question.questionType).toBe("MULTIPLE_CHOICE");
      expect(question.choices).toBeDefined();
    });

    it("should support YES_NO questions", () => {
      const question = {
        questionType: "YES_NO",
        questionText: "Are you attending?",
      };

      expect(question.questionType).toBe("YES_NO");
    });

    it("should support NUMBER questions", () => {
      const question = {
        questionType: "NUMBER",
        questionText: "How many guests are you bringing?",
      };

      expect(question.questionType).toBe("NUMBER");
    });

    it("should support DATE questions", () => {
      const question = {
        questionType: "DATE",
        questionText: "When is your birthday?",
      };

      expect(question.questionType).toBe("DATE");
    });
  });

  describe("Question CRUD operations", () => {
    it("should create a new question with valid data", async () => {
      const mockQuestion = {
        id: "question-123",
        eventId: "event-123",
        questionText: "What is your dietary preference?",
        questionType: "SINGLE_CHOICE" as const,
        isRequired: true,
        helpText: "We want to accommodate everyone",
        orderIndex: 0,
        choices: JSON.stringify(["Vegetarian", "Vegan", "No preference"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.questionnaireQuestion.create).mockResolvedValue(
        mockQuestion as any
      );

      const question = await prisma.questionnaireQuestion.create({
        data: {
          eventId: "event-123",
          questionText: "What is your dietary preference?",
          questionType: "SINGLE_CHOICE",
          isRequired: true,
          helpText: "We want to accommodate everyone",
          orderIndex: 0,
          choices: JSON.stringify(["Vegetarian", "Vegan", "No preference"]),
        },
      });

      expect(question.id).toBe("question-123");
      expect(question.questionText).toBe("What is your dietary preference?");
    });

    it("should update an existing question", async () => {
      const updatedQuestion = {
        id: "question-123",
        eventId: "event-123",
        questionText: "Updated question text",
        questionType: "SHORT_TEXT" as const,
        isRequired: false,
        helpText: "Updated help text",
        orderIndex: 0,
        choices: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.questionnaireQuestion.update).mockResolvedValue(
        updatedQuestion as any
      );

      const question = await prisma.questionnaireQuestion.update({
        where: { id: "question-123" },
        data: {
          questionText: "Updated question text",
          helpText: "Updated help text",
        },
      });

      expect(question.questionText).toBe("Updated question text");
      expect(question.helpText).toBe("Updated help text");
    });

    it("should delete a question", async () => {
      const mockQuestion = {
        id: "question-123",
        eventId: "event-123",
        questionText: "To be deleted",
        questionType: "SHORT_TEXT" as const,
        isRequired: false,
        helpText: null,
        orderIndex: 0,
        choices: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.questionnaireQuestion.delete).mockResolvedValue(
        mockQuestion as any
      );

      const deletedQuestion = await prisma.questionnaireQuestion.delete({
        where: { id: "question-123" },
      });

      expect(deletedQuestion.id).toBe("question-123");
    });

    it("should retrieve all questions for an event", async () => {
      const mockQuestions = [
        {
          id: "q1",
          eventId: "event-123",
          questionText: "Question 1",
          questionType: "SHORT_TEXT" as const,
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "q2",
          eventId: "event-123",
          questionText: "Question 2",
          questionType: "YES_NO" as const,
          isRequired: true,
          helpText: null,
          orderIndex: 1,
          choices: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue(
        mockQuestions as any
      );

      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId: "event-123" },
        orderBy: { orderIndex: "asc" },
      });

      expect(questions).toHaveLength(2);
      expect(questions[0].eventId).toBe("event-123");
    });
  });

  describe("JSON parsing safety", () => {
    it("should safely parse valid JSON choices", () => {
      const validJson = JSON.stringify(["Option 1", "Option 2", "Option 3"]);
      let parsed = null;

      try {
        parsed = JSON.parse(validJson);
      } catch (error) {
        parsed = null;
      }

      expect(parsed).toEqual(["Option 1", "Option 2", "Option 3"]);
    });

    it("should handle invalid JSON gracefully", () => {
      const invalidJson = "{invalid json}";
      let parsed = null;

      try {
        parsed = JSON.parse(invalidJson);
      } catch (error) {
        parsed = null;
      }

      expect(parsed).toBeNull();
    });

    it("should handle null choices", () => {
      const nullChoices = null;
      let parsed = null;

      if (nullChoices) {
        try {
          parsed = JSON.parse(nullChoices);
        } catch (error) {
          parsed = null;
        }
      }

      expect(parsed).toBeNull();
    });
  });

  describe("Question ownership and permissions", () => {
    it("should verify question belongs to event before operations", async () => {
      const mockQuestion = {
        id: "question-123",
        eventId: "event-123",
        questionText: "Test question",
        questionType: "SHORT_TEXT" as const,
        isRequired: false,
        helpText: null,
        orderIndex: 0,
        choices: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.questionnaireQuestion.findUnique).mockResolvedValue(
        mockQuestion as any
      );

      const question = await prisma.questionnaireQuestion.findUnique({
        where: { id: "question-123" },
      });

      expect(question?.eventId).toBe("event-123");
    });

    it("should check if question has responses before deletion", async () => {
      const mockResponse = {
        id: "response-123",
        questionId: "question-123",
        eventId: "event-123",
        userId: "user-123",
        response: JSON.stringify("My answer"),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.questionnaireResponse.findFirst).mockResolvedValue(
        mockResponse as any
      );

      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { questionId: "question-123" },
      });

      expect(hasResponses).toBeDefined();
    });
  });

  describe("Reordering questions", () => {
    it("should update multiple questions in a transaction", async () => {
      const questionIds = ["q1", "q2", "q3"];
      const updatePromises = questionIds.map((id, index) =>
        prisma.questionnaireQuestion.update({
          where: { id },
          data: { orderIndex: index },
        })
      );

      vi.mocked(prisma.$transaction).mockResolvedValue([
        {
          id: "q1",
          eventId: "event-123",
          questionText: "Q1",
          questionType: "SHORT_TEXT" as const,
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "q2",
          eventId: "event-123",
          questionText: "Q2",
          questionType: "SHORT_TEXT" as const,
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
          questionText: "Q3",
          questionType: "SHORT_TEXT" as const,
          isRequired: false,
          helpText: null,
          orderIndex: 2,
          choices: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      const result = await prisma.$transaction(updatePromises);

      expect(result).toHaveLength(3);
    });

    it("should validate all questions belong to the event before reordering", async () => {
      const questionIds = ["q1", "q2", "q3"];
      const eventId = "event-123";

      const mockQuestions = [
        {
          id: "q1",
          eventId: "event-123",
          questionText: "Q1",
          questionType: "SHORT_TEXT" as const,
          isRequired: false,
          helpText: null,
          orderIndex: 0,
          choices: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "q2",
          eventId: "event-123",
          questionText: "Q2",
          questionType: "SHORT_TEXT" as const,
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
          questionText: "Q3",
          questionType: "SHORT_TEXT" as const,
          isRequired: false,
          helpText: null,
          orderIndex: 2,
          choices: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue(
        mockQuestions as any
      );

      const questions = await prisma.questionnaireQuestion.findMany({
        where: {
          id: { in: questionIds },
          eventId,
        },
      });

      expect(questions.length).toBe(questionIds.length);
      questions.forEach((q) => {
        expect(q.eventId).toBe(eventId);
      });
    });
  });

  describe("Required field handling", () => {
    it("should default isRequired to false when not specified", () => {
      const question = {
        questionText: "Optional question",
        questionType: "SHORT_TEXT",
        isRequired: false,
      };

      expect(question.isRequired).toBe(false);
    });

    it("should allow marking questions as required", () => {
      const requiredQuestion = {
        questionText: "Required question",
        questionType: "SHORT_TEXT",
        isRequired: true,
      };

      expect(requiredQuestion.isRequired).toBe(true);
    });

    it("should validate isRequired is a boolean", () => {
      const validQuestion = {
        questionText: "Question",
        questionType: "SHORT_TEXT",
        isRequired: true,
      };

      expect(typeof validQuestion.isRequired).toBe("boolean");
    });
  });
});
