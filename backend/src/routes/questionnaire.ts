import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { EventAuthenticatedRequest } from "../middleware/eventAuth.js";
import { createApiError } from "../types/index.js";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireEventOrganizer } from "../middleware/eventAuth.js";

const router = Router();

// =============================================================================
// Validation helpers
// =============================================================================

type QuestionType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "YES_NO"
  | "NUMBER"
  | "DATE";

interface CreateQuestionInput {
  questionText: string;
  questionType: QuestionType;
  isRequired?: boolean;
  helpText?: string;
  choices?: string[];
}

interface UpdateQuestionInput {
  questionText?: string;
  isRequired?: boolean;
  helpText?: string | null;
  choices?: string[];
  orderIndex?: number;
}

function validateCreateQuestionInput(input: unknown): CreateQuestionInput {
  if (!input || typeof input !== "object") {
    throw createApiError("Invalid request body", 400, "INVALID_INPUT");
  }

  const data = input as Record<string, unknown>;

  // Validate questionText
  if (!data.questionText || typeof data.questionText !== "string" || data.questionText.trim() === "") {
    throw createApiError("Question text is required", 400, "MISSING_QUESTION_TEXT");
  }

  if (data.questionText.length > 500) {
    throw createApiError("Question text must be 500 characters or less", 400, "QUESTION_TEXT_TOO_LONG");
  }

  // Validate questionType
  const validTypes: QuestionType[] = [
    "SHORT_TEXT",
    "LONG_TEXT",
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "YES_NO",
    "NUMBER",
    "DATE"
  ];

  if (!data.questionType || typeof data.questionType !== "string") {
    throw createApiError("Question type is required", 400, "MISSING_QUESTION_TYPE");
  }

  if (!validTypes.includes(data.questionType as QuestionType)) {
    throw createApiError(
      `Invalid question type. Must be one of: ${validTypes.join(", ")}`,
      400,
      "INVALID_QUESTION_TYPE"
    );
  }

  // Validate isRequired (optional, default false)
  if (data.isRequired !== undefined && typeof data.isRequired !== "boolean") {
    throw createApiError("isRequired must be a boolean", 400, "INVALID_IS_REQUIRED");
  }

  // Validate helpText (optional)
  if (data.helpText !== undefined && data.helpText !== null) {
    if (typeof data.helpText !== "string") {
      throw createApiError("Help text must be a string", 400, "INVALID_HELP_TEXT");
    }
    if (data.helpText.length > 200) {
      throw createApiError("Help text must be 200 characters or less", 400, "HELP_TEXT_TOO_LONG");
    }
  }

  // Validate choices for choice questions
  const questionType = data.questionType as QuestionType;
  if (questionType === "SINGLE_CHOICE" || questionType === "MULTIPLE_CHOICE") {
    if (!data.choices || !Array.isArray(data.choices)) {
      throw createApiError("Choices are required for choice questions", 400, "MISSING_CHOICES");
    }

    if (data.choices.length < 2 || data.choices.length > 10) {
      throw createApiError("Choice questions must have between 2 and 10 options", 400, "INVALID_CHOICES_COUNT");
    }

    for (const choice of data.choices) {
      if (typeof choice !== "string" || choice.trim() === "") {
        throw createApiError("All choices must be non-empty strings", 400, "INVALID_CHOICE");
      }
      if (choice.length > 200) {
        throw createApiError("Each choice must be 200 characters or less", 400, "CHOICE_TOO_LONG");
      }
    }
  }

  return {
    questionText: data.questionText,
    questionType: questionType,
    isRequired: (data.isRequired as boolean | undefined) ?? false,
    helpText: data.helpText as string | undefined,
    choices: data.choices as string[] | undefined,
  };
}

function validateUpdateQuestionInput(input: unknown): UpdateQuestionInput {
  if (!input || typeof input !== "object") {
    throw createApiError("Invalid request body", 400, "INVALID_INPUT");
  }

  const data = input as Record<string, unknown>;
  const result: UpdateQuestionInput = {};

  // Validate questionText (optional)
  if (data.questionText !== undefined) {
    if (typeof data.questionText !== "string" || data.questionText.trim() === "") {
      throw createApiError("Question text must be a non-empty string", 400, "INVALID_QUESTION_TEXT");
    }
    if (data.questionText.length > 500) {
      throw createApiError("Question text must be 500 characters or less", 400, "QUESTION_TEXT_TOO_LONG");
    }
    result.questionText = data.questionText;
  }

  // Validate isRequired (optional)
  if (data.isRequired !== undefined) {
    if (typeof data.isRequired !== "boolean") {
      throw createApiError("isRequired must be a boolean", 400, "INVALID_IS_REQUIRED");
    }
    result.isRequired = data.isRequired;
  }

  // Validate helpText (optional, can be null to clear)
  if (data.helpText !== undefined) {
    if (data.helpText !== null) {
      if (typeof data.helpText !== "string") {
        throw createApiError("Help text must be a string", 400, "INVALID_HELP_TEXT");
      }
      if (data.helpText.length > 200) {
        throw createApiError("Help text must be 200 characters or less", 400, "HELP_TEXT_TOO_LONG");
      }
      result.helpText = data.helpText;
    } else {
      result.helpText = null;
    }
  }

  // Validate choices (optional)
  if (data.choices !== undefined) {
    if (!Array.isArray(data.choices)) {
      throw createApiError("Choices must be an array", 400, "INVALID_CHOICES");
    }
    if (data.choices.length < 2 || data.choices.length > 10) {
      throw createApiError("Choice questions must have between 2 and 10 options", 400, "INVALID_CHOICES_COUNT");
    }
    for (const choice of data.choices) {
      if (typeof choice !== "string" || choice.trim() === "") {
        throw createApiError("All choices must be non-empty strings", 400, "INVALID_CHOICE");
      }
      if (choice.length > 200) {
        throw createApiError("Each choice must be 200 characters or less", 400, "CHOICE_TOO_LONG");
      }
    }
    result.choices = data.choices;
  }

  // Validate orderIndex (optional)
  if (data.orderIndex !== undefined) {
    if (typeof data.orderIndex !== "number" || data.orderIndex < 0) {
      throw createApiError("Order index must be a non-negative number", 400, "INVALID_ORDER_INDEX");
    }
    result.orderIndex = data.orderIndex;
  }

  return result;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/events/:eventId/questionnaire
 * Get all questions for an event's questionnaire
 */
router.get(
  "/:eventId/questionnaire",
  requireAuth,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;

      // Check if event exists
      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Get questions ordered by orderIndex
      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId },
        orderBy: { orderIndex: "asc" },
      });

      // Parse choices JSON for each question
      const questionsWithParsedChoices = questions.map((q) => {
        let parsedChoices = null;
        if (q.choices) {
          try {
            parsedChoices = JSON.parse(q.choices);
          } catch (error) {
            // If JSON parsing fails, return null
            parsedChoices = null;
          }
        }
        return {
          id: q.id,
          eventId: q.eventId,
          questionText: q.questionText,
          questionType: q.questionType,
          isRequired: q.isRequired,
          helpText: q.helpText,
          orderIndex: q.orderIndex,
          choices: parsedChoices,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
        };
      });

      res.json({ questions: questionsWithParsedChoices });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:eventId/questionnaire
 * Create a new question for an event's questionnaire
 * Requires: Organizer role
 */
router.post(
  "/:eventId/questionnaire",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const input = validateCreateQuestionInput(req.body);

      // Get the current max orderIndex for this event
      const maxOrder = await prisma.questionnaireQuestion.findFirst({
        where: { eventId },
        orderBy: { orderIndex: "desc" },
        select: { orderIndex: true },
      });

      const nextOrderIndex = maxOrder ? maxOrder.orderIndex + 1 : 0;

      // Create the question
      const question = await prisma.questionnaireQuestion.create({
        data: {
          eventId,
          questionText: input.questionText,
          questionType: input.questionType,
          isRequired: input.isRequired,
          helpText: input.helpText,
          orderIndex: nextOrderIndex,
          choices: input.choices ? JSON.stringify(input.choices) : null,
        },
      });

      // Parse choices for response
      let parsedChoices = null;
      if (question.choices) {
        try {
          parsedChoices = JSON.parse(question.choices);
        } catch (error) {
          parsedChoices = null;
        }
      }

      const questionResponse = {
        id: question.id,
        eventId: question.eventId,
        questionText: question.questionText,
        questionType: question.questionType,
        isRequired: question.isRequired,
        helpText: question.helpText,
        orderIndex: question.orderIndex,
        choices: parsedChoices,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
      };

      res.status(201).json({ question: questionResponse });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/events/:eventId/questionnaire/:questionId
 * Update a question
 * Requires: Organizer role
 */
router.patch(
  "/:eventId/questionnaire/:questionId",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId, questionId } = req.params;
      const input = validateUpdateQuestionInput(req.body);

      // Check if question exists and belongs to this event
      const existingQuestion = await prisma.questionnaireQuestion.findUnique({
        where: { id: questionId },
      });

      if (!existingQuestion) {
        throw createApiError("Question not found", 404, "QUESTION_NOT_FOUND");
      }

      if (existingQuestion.eventId !== eventId) {
        throw createApiError("Question does not belong to this event", 403, "FORBIDDEN");
      }

      // Check if there are any responses (for editing restrictions in future iterations)
      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { questionId },
      });

      // For G1, we allow full editing. G4 will implement restrictions based on hasResponses
      // Future: if hasResponses, prevent type changes and deletions

      // Build update data
      const updateData: {
        questionText?: string;
        isRequired?: boolean;
        helpText?: string | null;
        choices?: string | null;
        orderIndex?: number;
      } = {};

      if (input.questionText !== undefined) {
        updateData.questionText = input.questionText;
      }

      if (input.isRequired !== undefined) {
        updateData.isRequired = input.isRequired;
      }

      if (input.helpText !== undefined) {
        updateData.helpText = input.helpText;
      }

      if (input.choices !== undefined) {
        updateData.choices = JSON.stringify(input.choices);
      }

      if (input.orderIndex !== undefined) {
        updateData.orderIndex = input.orderIndex;
      }

      // Update the question
      const question = await prisma.questionnaireQuestion.update({
        where: { id: questionId },
        data: updateData,
      });

      // Parse choices for response
      let parsedChoices = null;
      if (question.choices) {
        try {
          parsedChoices = JSON.parse(question.choices);
        } catch (error) {
          parsedChoices = null;
        }
      }

      const questionResponse = {
        id: question.id,
        eventId: question.eventId,
        questionText: question.questionText,
        questionType: question.questionType,
        isRequired: question.isRequired,
        helpText: question.helpText,
        orderIndex: question.orderIndex,
        choices: parsedChoices,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
      };

      res.json({ question: questionResponse });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/events/:eventId/questionnaire/:questionId
 * Delete a question
 * Requires: Organizer role
 */
router.delete(
  "/:eventId/questionnaire/:questionId",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId, questionId } = req.params;

      // Check if question exists and belongs to this event
      const existingQuestion = await prisma.questionnaireQuestion.findUnique({
        where: { id: questionId },
      });

      if (!existingQuestion) {
        throw createApiError("Question not found", 404, "QUESTION_NOT_FOUND");
      }

      if (existingQuestion.eventId !== eventId) {
        throw createApiError("Question does not belong to this event", 403, "FORBIDDEN");
      }

      // Check if there are any responses (for editing restrictions in future iterations)
      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { questionId },
      });

      // For G1, we allow deletion. G4 will prevent deletion if hasResponses
      // Future: if hasResponses, throw error preventing deletion

      // Delete the question (cascade will delete responses)
      await prisma.questionnaireQuestion.delete({
        where: { id: questionId },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:eventId/questionnaire/reorder
 * Reorder questions
 * Requires: Organizer role
 */
router.post(
  "/:eventId/questionnaire/reorder",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const { questionIds } = req.body;

      // Validate input
      if (!Array.isArray(questionIds)) {
        throw createApiError("questionIds must be an array", 400, "INVALID_INPUT");
      }

      // Verify all questions belong to this event
      const questions = await prisma.questionnaireQuestion.findMany({
        where: {
          id: { in: questionIds },
          eventId,
        },
      });

      if (questions.length !== questionIds.length) {
        throw createApiError("Some questions not found or don't belong to this event", 400, "INVALID_QUESTION_IDS");
      }

      // Update orderIndex for each question
      const updates = questionIds.map((questionId, index) =>
        prisma.questionnaireQuestion.update({
          where: { id: questionId },
          data: { orderIndex: index },
        })
      );

      await prisma.$transaction(updates);

      // Get updated questions
      const updatedQuestions = await prisma.questionnaireQuestion.findMany({
        where: { eventId },
        orderBy: { orderIndex: "asc" },
      });

      // Parse choices for response
      const questionsWithParsedChoices = updatedQuestions.map((q) => {
        let parsedChoices = null;
        if (q.choices) {
          try {
            parsedChoices = JSON.parse(q.choices);
          } catch (error) {
            parsedChoices = null;
          }
        }
        return {
          id: q.id,
          eventId: q.eventId,
          questionText: q.questionText,
          questionType: q.questionType,
          isRequired: q.isRequired,
          helpText: q.helpText,
          orderIndex: q.orderIndex,
          choices: parsedChoices,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
        };
      });

      res.json({ questions: questionsWithParsedChoices });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
