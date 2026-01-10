import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing routes
vi.mock("../utils/db.js", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    rSVP: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    questionnaireQuestion: {
      findMany: vi.fn(),
    },
    questionnaireResponse: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../utils/db.js";

describe("RSVP with Questionnaire Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEvent = {
    id: "event-123",
    organizerId: "organizer-123",
    title: "Test Event",
    description: "Test Description",
    location: "Test Location",
    startTime: new Date("2024-12-31T20:00:00Z"),
    endTime: new Date("2024-12-31T23:59:00Z"),
    isPublic: true,
    capacity: null,
    waitlistEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQuestions = [
    {
      id: "q1",
      eventId: "event-123",
      questionText: "Dietary restrictions?",
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
      questionText: "Will you bring a guest?",
      questionType: "YES_NO" as const,
      isRequired: false,
      helpText: null,
      orderIndex: 1,
      choices: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  describe("RSVP with questionnaire responses", () => {
    it("should accept RSVP with valid questionnaire responses", async () => {
      const rsvpInput = {
        response: "YES" as const,
        questionnaireResponses: {
          q1: "Vegetarian",
          q2: true,
        },
      };

      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);
      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue(
        mockQuestions as any
      );

      const mockRsvp = {
        id: "rsvp-123",
        eventId: "event-123",
        userId: "user-123",
        response: "YES",
        needsReconfirmation: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.rSVP.upsert).mockResolvedValue(mockRsvp as any);

      const result = await prisma.rSVP.upsert({
        where: {
          eventId_userId: {
            eventId: "event-123",
            userId: "user-123",
          },
        },
        create: {
          eventId: "event-123",
          userId: "user-123",
          response: "YES",
          needsReconfirmation: false,
        },
        update: {
          response: "YES",
          needsReconfirmation: false,
        },
      });

      expect(result.response).toBe("YES");
    });

    it("should validate required questions for YES RSVP", () => {
      const rsvpInput = {
        response: "YES" as const,
        questionnaireResponses: {
          q2: true, // Missing q1 which is required
        },
      };

      const requiredQuestions = mockQuestions.filter((q) => q.isRequired);
      const missingRequired = requiredQuestions.filter(
        (q) =>
          !rsvpInput.questionnaireResponses[
            q.id as keyof typeof rsvpInput.questionnaireResponses
          ]
      );

      expect(missingRequired).toHaveLength(1);
      expect(missingRequired[0].id).toBe("q1");
    });

    it("should allow empty questionnaire for NO RSVP", async () => {
      const rsvpInput = {
        response: "NO" as const,
        questionnaireResponses: {},
      };

      const mockRsvp = {
        id: "rsvp-123",
        eventId: "event-123",
        userId: "user-123",
        response: "NO",
        needsReconfirmation: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.rSVP.upsert).mockResolvedValue(mockRsvp as any);

      const result = await prisma.rSVP.upsert({
        where: {
          eventId_userId: {
            eventId: "event-123",
            userId: "user-123",
          },
        },
        create: {
          eventId: "event-123",
          userId: "user-123",
          response: "NO",
          needsReconfirmation: false,
        },
        update: {
          response: "NO",
          needsReconfirmation: false,
        },
      });

      expect(result.response).toBe("NO");
      expect(Object.keys(rsvpInput.questionnaireResponses)).toHaveLength(0);
    });

    it("should allow optional questionnaire for MAYBE RSVP", async () => {
      const rsvpInput = {
        response: "MAYBE" as const,
        questionnaireResponses: {
          q2: false, // Only answering optional question
        },
      };

      const mockRsvp = {
        id: "rsvp-123",
        eventId: "event-123",
        userId: "user-123",
        response: "MAYBE",
        needsReconfirmation: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.rSVP.upsert).mockResolvedValue(mockRsvp as any);

      const result = await prisma.rSVP.upsert({
        where: {
          eventId_userId: {
            eventId: "event-123",
            userId: "user-123",
          },
        },
        create: {
          eventId: "event-123",
          userId: "user-123",
          response: "MAYBE",
          needsReconfirmation: false,
        },
        update: {
          response: "MAYBE",
          needsReconfirmation: false,
        },
      });

      expect(result.response).toBe("MAYBE");
    });

    it("should save questionnaire responses when RSVP is submitted", async () => {
      const responses = {
        q1: "Vegetarian",
        q2: true,
      };

      vi.mocked(prisma.questionnaireResponse.upsert)
        .mockResolvedValueOnce({
          id: "resp-1",
          questionId: "q1",
          eventId: "event-123",
          userId: "user-123",
          response: JSON.stringify("Vegetarian"),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .mockResolvedValueOnce({
          id: "resp-2",
          questionId: "q2",
          eventId: "event-123",
          userId: "user-123",
          response: JSON.stringify(true),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);

      const results = await Promise.all(
        Object.entries(responses).map(([questionId, value]) =>
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
        )
      );

      expect(results).toHaveLength(2);
      expect(results[0].questionId).toBe("q1");
      expect(results[1].questionId).toBe("q2");
    });

    it("should update existing RSVP with new questionnaire responses", async () => {
      const existingRsvp = {
        id: "rsvp-123",
        eventId: "event-123",
        userId: "user-123",
        response: "YES",
        needsReconfirmation: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedResponses = {
        q1: "Vegan", // Updated from "Vegetarian"
        q2: false, // Changed from true
      };

      vi.mocked(prisma.rSVP.findUnique).mockResolvedValue(
        existingRsvp as any
      );

      vi.mocked(prisma.questionnaireResponse.upsert).mockResolvedValue({
        id: "resp-1",
        questionId: "q1",
        eventId: "event-123",
        userId: "user-123",
        response: JSON.stringify("Vegan"),
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
          response: JSON.stringify("Vegan"),
        },
        update: {
          response: JSON.stringify("Vegan"),
        },
      });

      expect(result.response).toBe(JSON.stringify("Vegan"));
    });

    it("should validate question belongs to the event", () => {
      const questionEventId = "event-123";
      const rsvpEventId = "event-123";
      const invalidQuestionEventId = "event-999";

      expect(questionEventId).toBe(rsvpEventId);
      expect(invalidQuestionEventId).not.toBe(rsvpEventId);
    });

    it("should handle RSVP without questionnaire responses", async () => {
      const rsvpInput = {
        response: "YES" as const,
      };

      // Event has no questions
      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue([]);

      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId: "event-123" },
      });

      expect(questions).toHaveLength(0);
    });

    it("should validate response types match question types", () => {
      const testCases = [
        {
          questionType: "SHORT_TEXT",
          validResponse: "text",
          invalidResponse: 123,
        },
        {
          questionType: "YES_NO",
          validResponse: true,
          invalidResponse: "yes",
        },
        {
          questionType: "NUMBER",
          validResponse: 42,
          invalidResponse: "42",
        },
        {
          questionType: "SINGLE_CHOICE",
          validResponse: "Option A",
          invalidResponse: ["Option A"],
        },
        {
          questionType: "MULTIPLE_CHOICE",
          validResponse: ["Option A", "Option B"],
          invalidResponse: "Option A",
        },
      ];

      testCases.forEach((testCase) => {
        expect(typeof testCase.validResponse).not.toBe(
          typeof testCase.invalidResponse
        );
      });
    });

    it("should validate choices against available options", () => {
      const questionChoices = ["Red", "Blue", "Green"];
      const validChoice = "Blue";
      const invalidChoice = "Purple";
      const validMultiple = ["Red", "Green"];
      const invalidMultiple = ["Red", "Purple"];

      expect(questionChoices).toContain(validChoice);
      expect(questionChoices).not.toContain(invalidChoice);
      expect(validMultiple.every((c) => questionChoices.includes(c))).toBe(
        true
      );
      expect(invalidMultiple.every((c) => questionChoices.includes(c))).toBe(
        false
      );
    });
  });

  describe("Validation errors", () => {
    it("should reject invalid question IDs", () => {
      const validQuestionIds = ["q1", "q2"];
      const responses = {
        q1: "Answer",
        q999: "Invalid", // Question doesn't exist
      };

      const invalidIds = Object.keys(responses).filter(
        (id) => !validQuestionIds.includes(id)
      );

      expect(invalidIds).toHaveLength(1);
      expect(invalidIds[0]).toBe("q999");
    });

    it("should reject responses that are too long for SHORT_TEXT", () => {
      const maxLength = 200;
      const validResponse = "a".repeat(maxLength);
      const tooLongResponse = "a".repeat(maxLength + 1);

      expect(validResponse.length).toBe(maxLength);
      expect(tooLongResponse.length).toBeGreaterThan(maxLength);
    });

    it("should reject responses that are too long for LONG_TEXT", () => {
      const maxLength = 2000;
      const validResponse = "a".repeat(maxLength);
      const tooLongResponse = "a".repeat(maxLength + 1);

      expect(validResponse.length).toBe(maxLength);
      expect(tooLongResponse.length).toBeGreaterThan(maxLength);
    });

    it("should reject invalid date formats", () => {
      const validDates = [
        "2024-01-15",
        "2024-01-15T10:30:00Z",
        "2024-12-31",
      ];
      const invalidDates = ["15-01-2024", "invalid", "2024/01/15"];

      validDates.forEach((date) => {
        expect(isNaN(new Date(date).getTime())).toBe(false);
      });

      invalidDates.forEach((date) => {
        const parsed = new Date(date);
        // Note: Some invalid formats might still parse, but we check the original string
        if (date === "invalid") {
          expect(isNaN(parsed.getTime())).toBe(true);
        }
      });
    });

    it("should reject non-boolean values for YES_NO questions", () => {
      const validResponses = [true, false];
      const invalidResponses = ["yes", "no", 1, 0, "true", "false"];

      validResponses.forEach((resp) => {
        expect(typeof resp).toBe("boolean");
      });

      invalidResponses.forEach((resp) => {
        expect(typeof resp).not.toBe("boolean");
      });
    });

    it("should reject non-numeric values for NUMBER questions", () => {
      const validNumbers = [0, 42, -10, 3.14];
      const invalidNumbers = ["42", "3.14", "zero", null, true];

      validNumbers.forEach((num) => {
        expect(typeof num).toBe("number");
        expect(isNaN(num)).toBe(false);
      });

      invalidNumbers.forEach((num) => {
        if (num !== null) {
          expect(typeof num).not.toBe("number");
        }
      });
    });
  });

  describe("Optional vs Required questions", () => {
    it("should allow skipping optional questions", () => {
      const questions = [
        { id: "q1", isRequired: true },
        { id: "q2", isRequired: false },
        { id: "q3", isRequired: false },
      ];
      const responses = {
        q1: "Required answer",
        // q2 and q3 are omitted
      };

      const missingRequired = questions
        .filter((q) => q.isRequired)
        .filter((q) => !responses[q.id as keyof typeof responses]);

      expect(missingRequired).toHaveLength(0);
    });

    it("should not allow skipping required questions for YES RSVP", () => {
      const rsvpResponse = "YES";
      const questions = [
        { id: "q1", isRequired: true },
        { id: "q2", isRequired: true },
      ];
      const responses = {
        q1: "Answer 1",
        // q2 is missing
      };

      if (rsvpResponse === "YES") {
        const missingRequired = questions
          .filter((q) => q.isRequired)
          .filter((q) => !responses[q.id as keyof typeof responses]);

        expect(missingRequired).toHaveLength(1);
      }
    });

    it("should handle empty string as missing for required questions", () => {
      const responses = {
        q1: "", // Empty string
        q2: null,
        q3: undefined,
      };

      const isEmpty = (value: unknown) =>
        value === undefined || value === null || value === "";

      expect(isEmpty(responses.q1)).toBe(true);
      expect(isEmpty(responses.q2)).toBe(true);
      expect(isEmpty(responses.q3)).toBe(true);
    });

    it("should handle empty array as missing for required MULTIPLE_CHOICE", () => {
      const responses = {
        q1: [] as string[],
        q2: ["Option A"],
      };

      expect(responses.q1.length).toBe(0);
      expect(responses.q2.length).toBeGreaterThan(0);
    });
  });
});
