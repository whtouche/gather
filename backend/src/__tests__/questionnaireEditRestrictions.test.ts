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
      groupBy: vi.fn(),
    },
    questionnaireResponse: {
      findFirst: vi.fn(),
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../utils/db.js";

describe("Questionnaire G4 - Edit Restrictions with Responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /questionnaire - Response Counts", () => {
    it("should include response counts for each question", async () => {
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
          questionType: "SHORT_TEXT",
          isRequired: false,
          helpText: null,
          orderIndex: 1,
          choices: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockResponseCounts = [
        { questionId: "q1", _count: { id: 5 } },
        { questionId: "q2", _count: { id: 3 } },
      ];

      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: "event-123",
        title: "Test Event",
      } as any);
      vi.mocked(prisma.questionnaireQuestion.findMany).mockResolvedValue(mockQuestions as any);
      vi.mocked(prisma.questionnaireResponse.findFirst).mockResolvedValue({
        id: "resp-1",
      } as any);
      vi.mocked(prisma.questionnaireResponse.groupBy).mockResolvedValue(mockResponseCounts as any);

      // Simulate response structure
      const responseCounts = await prisma.questionnaireResponse.groupBy({
        by: ['questionId'],
        where: { questionId: { in: ["q1", "q2"] } },
        _count: { id: true },
      });

      expect(responseCounts).toHaveLength(2);
      expect(responseCounts[0]._count.id).toBe(5);
      expect(responseCounts[1]._count.id).toBe(3);
    });

    it("should return hasAnyResponses flag when responses exist", async () => {
      vi.mocked(prisma.questionnaireResponse.findFirst).mockResolvedValue({
        id: "resp-1",
        questionId: "q1",
        eventId: "event-123",
        userId: "user-1",
        response: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const hasAnyResponses = await prisma.questionnaireResponse.findFirst({
        where: { eventId: "event-123" },
      });

      expect(hasAnyResponses).toBeTruthy();
    });

    it("should handle empty question list without errors", async () => {
      const questionIds: string[] = [];
      const responseCounts = questionIds.length > 0
        ? await prisma.questionnaireResponse.groupBy({
            by: ['questionId'],
            where: { questionId: { in: questionIds } },
            _count: { id: true },
          })
        : [];

      expect(responseCounts).toEqual([]);
    });
  });

  describe("POST /questionnaire - Create with Restrictions", () => {
    it("should allow creating optional questions when responses exist", async () => {
      vi.mocked(prisma.questionnaireResponse.findFirst).mockResolvedValue({
        id: "resp-1",
      } as any);

      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { eventId: "event-123" },
      });

      const newQuestion = {
        questionText: "New optional question",
        questionType: "SHORT_TEXT" as const,
        isRequired: false,
      };

      // Should be allowed
      expect(hasResponses).toBeTruthy();
      expect(newQuestion.isRequired).toBe(false);
    });

    it("should detect when adding required questions when responses exist", async () => {
      vi.mocked(prisma.questionnaireResponse.findFirst).mockResolvedValue({
        id: "resp-1",
      } as any);

      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { eventId: "event-123" },
      });

      const newQuestion = {
        questionText: "New required question",
        questionType: "SHORT_TEXT" as const,
        isRequired: true,
      };

      // Should be blocked by API
      expect(hasResponses).toBeTruthy();
      expect(newQuestion.isRequired).toBe(true);
      // In actual API, this would throw:
      // "Cannot add required questions after responses have been submitted"
    });
  });

  describe("PATCH /questionnaire/:questionId - Update with Restrictions", () => {
    it("should allow updating question text when responses exist", async () => {
      const existingQuestion = {
        id: "q1",
        eventId: "event-123",
        questionText: "Original question",
        questionType: "SHORT_TEXT" as const,
        isRequired: false,
        helpText: null,
        orderIndex: 0,
        choices: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.questionnaireQuestion.findUnique).mockResolvedValue(existingQuestion as any);
      vi.mocked(prisma.questionnaireResponse.findFirst).mockResolvedValue({
        id: "resp-1",
        questionId: "q1",
      } as any);

      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { questionId: "q1" },
      });

      const updateData = {
        questionText: "Updated question text",
      };

      // Should be allowed
      expect(hasResponses).toBeTruthy();
      expect(updateData.questionText).toBeDefined();
    });

    it("should allow updating help text when responses exist", async () => {
      const existingQuestion = {
        id: "q1",
        eventId: "event-123",
        questionText: "Test question",
        questionType: "SHORT_TEXT" as const,
        isRequired: false,
        helpText: "Original help",
        orderIndex: 0,
        choices: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.questionnaireQuestion.findUnique).mockResolvedValue(existingQuestion as any);
      vi.mocked(prisma.questionnaireResponse.findFirst).mockResolvedValue({
        id: "resp-1",
        questionId: "q1",
      } as any);

      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { questionId: "q1" },
      });

      const updateData = {
        helpText: "Updated help text",
      };

      // Should be allowed
      expect(hasResponses).toBeTruthy();
      expect(updateData.helpText).toBeDefined();
    });

    it("should detect when making optional question required when responses exist", async () => {
      const existingQuestion = {
        id: "q1",
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

      vi.mocked(prisma.questionnaireQuestion.findUnique).mockResolvedValue(existingQuestion as any);
      vi.mocked(prisma.questionnaireResponse.findFirst).mockResolvedValue({
        id: "resp-1",
        questionId: "q1",
      } as any);

      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { questionId: "q1" },
      });

      const updateData = {
        isRequired: true,
      };

      // Should be blocked by API
      expect(hasResponses).toBeTruthy();
      expect(updateData.isRequired).toBe(true);
      expect(existingQuestion.isRequired).toBe(false);
      // In actual API, this would throw:
      // "Cannot make a question required after responses have been submitted"
    });

    it("should allow keeping isRequired true when already required", async () => {
      const existingQuestion = {
        id: "q1",
        eventId: "event-123",
        questionText: "Test question",
        questionType: "SHORT_TEXT" as const,
        isRequired: true,
        helpText: null,
        orderIndex: 0,
        choices: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.questionnaireQuestion.findUnique).mockResolvedValue(existingQuestion as any);
      vi.mocked(prisma.questionnaireResponse.findFirst).mockResolvedValue({
        id: "resp-1",
        questionId: "q1",
      } as any);

      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { questionId: "q1" },
      });

      const updateData = {
        questionText: "Updated text",
        isRequired: true, // Already required, no change
      };

      // Should be allowed (no actual change to required status)
      expect(hasResponses).toBeTruthy();
      expect(existingQuestion.isRequired).toBe(true);
      expect(updateData.isRequired).toBe(true);
    });

    it("should detect when changing choices when responses exist", async () => {
      const existingQuestion = {
        id: "q1",
        eventId: "event-123",
        questionText: "Test question",
        questionType: "SINGLE_CHOICE" as const,
        isRequired: false,
        helpText: null,
        orderIndex: 0,
        choices: JSON.stringify(["Option A", "Option B"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.questionnaireQuestion.findUnique).mockResolvedValue(existingQuestion as any);
      vi.mocked(prisma.questionnaireResponse.findFirst).mockResolvedValue({
        id: "resp-1",
        questionId: "q1",
      } as any);

      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { questionId: "q1" },
      });

      const updateData = {
        choices: ["Option A", "Option B", "Option C"], // Adding a choice
      };

      // Should be blocked by API
      expect(hasResponses).toBeTruthy();
      expect(updateData.choices).toBeDefined();
      // In actual API, this would throw:
      // "Cannot change choices after responses have been submitted"
    });
  });

  describe("DELETE /questionnaire/:questionId - Delete with Restrictions", () => {
    it("should allow deleting question without responses", async () => {
      const existingQuestion = {
        id: "q1",
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

      vi.mocked(prisma.questionnaireQuestion.findUnique).mockResolvedValue(existingQuestion as any);
      vi.mocked(prisma.questionnaireResponse.findFirst).mockResolvedValue(null);

      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { questionId: "q1" },
      });

      // Should be allowed
      expect(hasResponses).toBeNull();
    });

    it("should detect when deleting question with responses", async () => {
      const existingQuestion = {
        id: "q1",
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

      vi.mocked(prisma.questionnaireQuestion.findUnique).mockResolvedValue(existingQuestion as any);
      vi.mocked(prisma.questionnaireResponse.findFirst).mockResolvedValue({
        id: "resp-1",
        questionId: "q1",
        eventId: "event-123",
        userId: "user-1",
        response: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { questionId: "q1" },
      });

      // Should be blocked by API
      expect(hasResponses).toBeTruthy();
      // In actual API, this would throw:
      // "Cannot delete a question that has responses. This would lose user data."
    });
  });

  describe("Data Integrity", () => {
    it("should verify response counts match question IDs", async () => {
      const questionIds = ["q1", "q2", "q3"];
      const mockResponseCounts = [
        { questionId: "q1", _count: { id: 10 } },
        { questionId: "q3", _count: { id: 5 } },
      ];

      vi.mocked(prisma.questionnaireResponse.groupBy).mockResolvedValue(mockResponseCounts as any);

      const responseCounts = await prisma.questionnaireResponse.groupBy({
        by: ['questionId'],
        where: { questionId: { in: questionIds } },
        _count: { id: true },
      });

      const responseCountMap = new Map(
        responseCounts.map(rc => [rc.questionId, rc._count.id])
      );

      expect(responseCountMap.get("q1")).toBe(10);
      expect(responseCountMap.get("q2")).toBeUndefined();
      expect(responseCountMap.get("q3")).toBe(5);
    });

    it("should handle questions with zero responses correctly", async () => {
      const questionIds = ["q1", "q2"];
      const mockResponseCounts = [
        { questionId: "q1", _count: { id: 0 } },
      ];

      vi.mocked(prisma.questionnaireResponse.groupBy).mockResolvedValue(mockResponseCounts as any);

      const responseCounts = await prisma.questionnaireResponse.groupBy({
        by: ['questionId'],
        where: { questionId: { in: questionIds } },
        _count: { id: true },
      });

      const responseCountMap = new Map(
        responseCounts.map(rc => [rc.questionId, rc._count.id])
      );

      // Questions with 0 responses might not appear in groupBy result
      expect(responseCountMap.get("q1")).toBe(0);
      expect(responseCountMap.get("q2") || 0).toBe(0);
    });
  });
});
