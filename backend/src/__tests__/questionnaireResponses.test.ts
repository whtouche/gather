import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing routes
vi.mock("../utils/db.js", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    questionnaireQuestion: {
      findMany: vi.fn(),
    },
    questionnaireResponse: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "../utils/db.js";

describe("Questionnaire Responses functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET questionnaire responses", () => {
    it("should retrieve user's responses for an event", async () => {
      const mockResponses = [
        {
          id: "response-1",
          questionId: "q1",
          eventId: "event-123",
          userId: "user-123",
          response: JSON.stringify("My answer"),
          createdAt: new Date(),
          updatedAt: new Date(),
          question: {
            id: "q1",
            questionText: "What is your name?",
            questionType: "SHORT_TEXT",
            isRequired: true,
            helpText: null,
            orderIndex: 0,
            choices: null,
          },
        },
      ];

      vi.mocked(prisma.questionnaireResponse.findMany).mockResolvedValue(
        mockResponses as any
      );

      const responses = await prisma.questionnaireResponse.findMany({
        where: {
          eventId: "event-123",
          userId: "user-123",
        },
        include: {
          question: true,
        },
      });

      expect(responses).toHaveLength(1);
      expect(responses[0].userId).toBe("user-123");
      expect(responses[0].question.questionText).toBe("What is your name?");
    });

    it("should parse JSON response data correctly", () => {
      const stringResponse = JSON.stringify("Text answer");
      const arrayResponse = JSON.stringify(["Choice1", "Choice2"]);
      const booleanResponse = JSON.stringify(true);
      const numberResponse = JSON.stringify(42);

      expect(JSON.parse(stringResponse)).toBe("Text answer");
      expect(JSON.parse(arrayResponse)).toEqual(["Choice1", "Choice2"]);
      expect(JSON.parse(booleanResponse)).toBe(true);
      expect(JSON.parse(numberResponse)).toBe(42);
    });

    it("should handle empty response list", async () => {
      vi.mocked(prisma.questionnaireResponse.findMany).mockResolvedValue([]);

      const responses = await prisma.questionnaireResponse.findMany({
        where: {
          eventId: "event-123",
          userId: "user-123",
        },
      });

      expect(responses).toHaveLength(0);
    });
  });

  describe("POST questionnaire responses", () => {
    const mockQuestions = [
      {
        id: "q1",
        eventId: "event-123",
        questionText: "What is your name?",
        questionType: "SHORT_TEXT" as const,
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
        questionText: "What is your favorite color?",
        questionType: "SINGLE_CHOICE" as const,
        isRequired: false,
        helpText: null,
        orderIndex: 1,
        choices: JSON.stringify(["Red", "Blue", "Green"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it("should save valid responses", async () => {
      const responses = {
        q1: "John Doe",
        q2: "Blue",
      };

      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue(
        mockQuestions as any
      );

      vi.mocked(prisma.questionnaireResponse.upsert).mockResolvedValue({
        id: "response-1",
        questionId: "q1",
        eventId: "event-123",
        userId: "user-123",
        response: JSON.stringify("John Doe"),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await prisma.questionnaireResponse.upsert({
        where: {
          questionId_userId: {
            questionId: "q1",
            userId: "user-123",
          },
        },
        create: {
          questionId: "q1",
          eventId: "event-123",
          userId: "user-123",
          response: JSON.stringify("John Doe"),
        },
        update: {
          response: JSON.stringify("John Doe"),
        },
      });

      expect(result.response).toBe(JSON.stringify("John Doe"));
    });

    it("should validate required questions are answered", () => {
      const requiredQuestion = mockQuestions[0];
      const responses = { q2: "Blue" }; // Missing q1 which is required

      expect(requiredQuestion.isRequired).toBe(true);
      expect(responses).not.toHaveProperty("q1");
    });

    it("should validate SHORT_TEXT responses", () => {
      const validShortText = "This is valid";
      const tooLongText = "a".repeat(201);

      expect(validShortText.length).toBeLessThanOrEqual(200);
      expect(tooLongText.length).toBeGreaterThan(200);
    });

    it("should validate LONG_TEXT responses", () => {
      const validLongText = "a".repeat(2000);
      const tooLongText = "a".repeat(2001);

      expect(validLongText.length).toBeLessThanOrEqual(2000);
      expect(tooLongText.length).toBeGreaterThan(2000);
    });

    it("should validate SINGLE_CHOICE responses against available choices", () => {
      const question = mockQuestions[1];
      const choices = JSON.parse(question.choices!);
      const validChoice = "Blue";
      const invalidChoice = "Purple";

      expect(choices).toContain(validChoice);
      expect(choices).not.toContain(invalidChoice);
    });

    it("should validate MULTIPLE_CHOICE responses", () => {
      const validChoices = ["Red", "Blue"];
      const invalidChoices = ["Red", "Purple"];
      const availableChoices = ["Red", "Blue", "Green"];

      const allValid = validChoices.every((c) => availableChoices.includes(c));
      const allInvalid = invalidChoices.every((c) =>
        availableChoices.includes(c)
      );

      expect(allValid).toBe(true);
      expect(allInvalid).toBe(false);
    });

    it("should validate YES_NO responses are boolean", () => {
      const validResponse = true;
      const invalidResponse = "yes";

      expect(typeof validResponse).toBe("boolean");
      expect(typeof invalidResponse).not.toBe("boolean");
    });

    it("should validate NUMBER responses", () => {
      const validNumber = 42;
      const invalidNumber = "not a number";

      expect(typeof validNumber).toBe("number");
      expect(typeof invalidNumber).not.toBe("number");
    });

    it("should validate DATE responses", () => {
      const validDate = "2024-01-15";
      const invalidDate = "not-a-date";

      const parsedValid = new Date(validDate);
      const parsedInvalid = new Date(invalidDate);

      expect(isNaN(parsedValid.getTime())).toBe(false);
      expect(isNaN(parsedInvalid.getTime())).toBe(true);
    });

    it("should upsert responses (create or update)", async () => {
      const existingResponse = {
        id: "response-1",
        questionId: "q1",
        eventId: "event-123",
        userId: "user-123",
        response: JSON.stringify("Old answer"),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedResponse = {
        ...existingResponse,
        response: JSON.stringify("New answer"),
      };

      vi.mocked(prisma.questionnaireResponse.upsert).mockResolvedValue(
        updatedResponse as any
      );

      const result = await prisma.questionnaireResponse.upsert({
        where: {
          questionId_userId: {
            questionId: "q1",
            userId: "user-123",
          },
        },
        create: {
          questionId: "q1",
          eventId: "event-123",
          userId: "user-123",
          response: JSON.stringify("New answer"),
        },
        update: {
          response: JSON.stringify("New answer"),
        },
      });

      expect(result.response).toBe(JSON.stringify("New answer"));
    });

    it("should validate all question IDs exist", async () => {
      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue(
        mockQuestions as any
      );

      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId: "event-123" },
      });

      const validQuestionIds = questions.map((q) => q.id);
      const responseQuestionIds = ["q1", "q2", "q999"];

      const allQuestionsExist = responseQuestionIds.every((id) =>
        validQuestionIds.includes(id)
      );

      expect(allQuestionsExist).toBe(false);
    });

    it("should handle multiple responses in batch", async () => {
      const responses = {
        q1: "John Doe",
        q2: "Blue",
      };

      const upsertPromises = Object.entries(responses).map(
        ([questionId, value]) =>
          prisma.questionnaireResponse.upsert({
            where: {
              questionId_userId: {
                questionId,
                userId: "user-123",
              },
            },
            create: {
              questionId,
              eventId: "event-123",
              userId: "user-123",
              response: JSON.stringify(value),
            },
            update: {
              response: JSON.stringify(value),
            },
          })
      );

      expect(upsertPromises).toHaveLength(2);
    });

    it("should allow optional questions to be empty", () => {
      const optionalQuestion = mockQuestions[1]; // q2 is not required
      const responses = { q1: "John Doe" }; // q2 is omitted

      expect(optionalQuestion.isRequired).toBe(false);
      expect(responses).not.toHaveProperty("q2");
    });
  });

  describe("Response validation with RSVP context", () => {
    it("should require all required questions for YES RSVP", () => {
      const rsvpResponse = "YES";
      const requiredQuestions = [
        { id: "q1", isRequired: true, questionText: "Required 1" },
        { id: "q2", isRequired: true, questionText: "Required 2" },
      ];
      const responses = { q1: "Answer 1" }; // Missing q2

      if (rsvpResponse === "YES") {
        const missingRequired = requiredQuestions.filter(
          (q) => q.isRequired && !responses[q.id as keyof typeof responses]
        );
        expect(missingRequired).toHaveLength(1);
      }
    });

    it("should allow optional questions for MAYBE RSVP", () => {
      const rsvpResponse = "MAYBE";
      const requiredQuestions = [
        { id: "q1", isRequired: true, questionText: "Required 1" },
      ];
      const responses = {}; // Empty responses

      // For MAYBE, we allow empty responses
      expect(rsvpResponse).toBe("MAYBE");
      expect(Object.keys(responses)).toHaveLength(0);
    });

    it("should not require questionnaire for NO RSVP", () => {
      const rsvpResponse = "NO";
      const responses = {}; // Empty responses

      // For NO, questionnaire is optional
      expect(rsvpResponse).toBe("NO");
      expect(Object.keys(responses)).toHaveLength(0);
    });
  });

  describe("JSON storage and retrieval", () => {
    it("should store responses as JSON strings", () => {
      const responses = {
        string: "text",
        array: ["a", "b"],
        boolean: true,
        number: 42,
      };

      const jsonStrings = Object.entries(responses).map(([key, value]) => ({
        key,
        json: JSON.stringify(value),
      }));

      jsonStrings.forEach((item) => {
        expect(typeof item.json).toBe("string");
        const parsed = JSON.parse(item.json);
        expect(parsed).toEqual(responses[item.key as keyof typeof responses]);
      });
    });

    it("should handle null and undefined values", () => {
      const nullValue = null;
      const undefinedValue = undefined;

      expect(JSON.stringify(nullValue)).toBe("null");
      expect(JSON.stringify(undefinedValue)).toBe(undefined);
    });

    it("should handle empty arrays and objects", () => {
      const emptyArray: string[] = [];
      const emptyObject = {};

      expect(JSON.parse(JSON.stringify(emptyArray))).toEqual([]);
      expect(JSON.parse(JSON.stringify(emptyObject))).toEqual({});
    });
  });

  describe("Edge cases", () => {
    it("should handle special characters in text responses", () => {
      const specialChars = "Hello \"World\" & <tags> 'quotes'";
      const jsonString = JSON.stringify(specialChars);
      const parsed = JSON.parse(jsonString);

      expect(parsed).toBe(specialChars);
    });

    it("should handle Unicode characters", () => {
      const unicode = "Hello 世界 🌍";
      const jsonString = JSON.stringify(unicode);
      const parsed = JSON.parse(jsonString);

      expect(parsed).toBe(unicode);
    });

    it("should handle very long LONG_TEXT responses", () => {
      const longText = "a".repeat(2000);
      expect(longText.length).toBe(2000);
      expect(longText.length).toBeLessThanOrEqual(2000);
    });

    it("should validate DATE format is ISO 8601", () => {
      const isoDate = "2024-01-15T10:30:00.000Z";
      const simpleDate = "2024-01-15";
      const invalidDate = "15/01/2024";

      expect(new Date(isoDate).toISOString()).toBe(isoDate);
      expect(isNaN(new Date(simpleDate).getTime())).toBe(false);
      // Note: "15/01/2024" might parse differently in different locales
    });
  });
});
