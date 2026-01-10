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

      // Check if any responses exist for this event (for G4 editing restrictions)
      const hasAnyResponses = await prisma.questionnaireResponse.findFirst({
        where: { eventId },
      });

      // For each question, check if it has responses (for G4 UI warnings)
      const questionIds = questions.map(q => q.id);
      const responseCounts = questionIds.length > 0
        ? await prisma.questionnaireResponse.groupBy({
            by: ['questionId'],
            where: {
              questionId: { in: questionIds },
            },
            _count: {
              id: true,
            },
          })
        : [];
      const responseCountMap = new Map(
        responseCounts.map(rc => [rc.questionId, rc._count.id])
      );

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
          responseCount: responseCountMap.get(q.id) || 0,
        };
      });

      res.json({
        questions: questionsWithParsedChoices,
        hasAnyResponses: !!hasAnyResponses,
      });
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

      // G4: Check if responses exist - new questions must be optional (per REQ-INV-024)
      const hasAnyResponses = await prisma.questionnaireResponse.findFirst({
        where: { eventId },
      });

      if (hasAnyResponses && input.isRequired) {
        throw createApiError(
          "Cannot add required questions after responses have been submitted. New questions must be optional.",
          400,
          "CANNOT_ADD_REQUIRED_QUESTION_WITH_RESPONSES"
        );
      }

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

      // Check if there are any responses (for editing restrictions per REQ-INV-024)
      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { questionId },
      });

      // G4: Implement editing restrictions when responses exist
      if (hasResponses) {
        // Allow changing question text and help text (these don't affect data integrity)

        // Cannot change to required if currently optional (could invalidate existing responses)
        if (input.isRequired === true && !existingQuestion.isRequired) {
          throw createApiError(
            "Cannot make a question required after responses have been submitted",
            400,
            "CANNOT_MAKE_REQUIRED_WITH_RESPONSES"
          );
        }

        // Cannot change choices (could invalidate existing responses)
        if (input.choices !== undefined) {
          throw createApiError(
            "Cannot change choices after responses have been submitted",
            400,
            "CANNOT_CHANGE_CHOICES_WITH_RESPONSES"
          );
        }
      }

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

      // Check if there are any responses (per REQ-INV-024)
      const hasResponses = await prisma.questionnaireResponse.findFirst({
        where: { questionId },
      });

      // G4: Prevent deletion if responses exist (per REQ-INV-024)
      if (hasResponses) {
        throw createApiError(
          "Cannot delete a question that has responses. This would lose user data.",
          400,
          "CANNOT_DELETE_QUESTION_WITH_RESPONSES"
        );
      }

      // Delete the question
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

/**
 * GET /api/events/:eventId/questionnaire/responses
 * Get user's questionnaire responses for an event
 * Requires: Authentication
 */
router.get(
  "/:eventId/questionnaire/responses",
  requireAuth,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const userId = req.user!.id;

      // Check if event exists
      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Get user's responses for this event
      const responses = await prisma.questionnaireResponse.findMany({
        where: {
          eventId,
          userId,
        },
        include: {
          question: true,
        },
      });

      // Parse response data
      const responsesWithParsedData = responses.map((r) => {
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(r.response);
        } catch (error) {
          parsedResponse = null;
        }

        let parsedChoices = null;
        if (r.question.choices) {
          try {
            parsedChoices = JSON.parse(r.question.choices);
          } catch (error) {
            parsedChoices = null;
          }
        }

        return {
          id: r.id,
          questionId: r.questionId,
          eventId: r.eventId,
          userId: r.userId,
          response: parsedResponse,
          question: {
            id: r.question.id,
            questionText: r.question.questionText,
            questionType: r.question.questionType,
            isRequired: r.question.isRequired,
            helpText: r.question.helpText,
            orderIndex: r.question.orderIndex,
            choices: parsedChoices,
          },
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      });

      res.json({ responses: responsesWithParsedData });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/events/:eventId/questionnaire/responses
 * Submit or update questionnaire responses for an event
 * Requires: Authentication
 */
router.post(
  "/:eventId/questionnaire/responses",
  requireAuth,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const userId = req.user!.id;
      const { responses } = req.body;

      // Check if event exists
      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Validate responses input
      if (!responses || typeof responses !== "object") {
        throw createApiError("Responses must be an object mapping questionId to response value", 400, "INVALID_RESPONSES");
      }

      const responseEntries = Object.entries(responses);

      if (responseEntries.length === 0) {
        throw createApiError("At least one response is required", 400, "NO_RESPONSES");
      }

      // Get all questions for this event
      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId },
      });

      const questionsMap = new Map(questions.map(q => [q.id, q]));

      // Validate all question IDs exist
      for (const [questionId] of responseEntries) {
        if (!questionsMap.has(questionId)) {
          throw createApiError(`Question ${questionId} not found`, 400, "INVALID_QUESTION_ID");
        }
      }

      // Check required questions are answered
      const requiredQuestions = questions.filter(q => q.isRequired);
      for (const question of requiredQuestions) {
        if (!responses[question.id]) {
          throw createApiError(
            `Required question "${question.questionText}" must be answered`,
            400,
            "REQUIRED_QUESTION_MISSING"
          );
        }
      }

      // Validate response values based on question type
      for (const [questionId, responseValue] of responseEntries) {
        const question = questionsMap.get(questionId)!;

        // Validate based on question type
        switch (question.questionType) {
          case "SHORT_TEXT":
            if (typeof responseValue !== "string") {
              throw createApiError(`Response for question ${questionId} must be a string`, 400, "INVALID_RESPONSE_TYPE");
            }
            if (responseValue.length > 200) {
              throw createApiError(`Response for question ${questionId} must be 200 characters or less`, 400, "RESPONSE_TOO_LONG");
            }
            break;

          case "LONG_TEXT":
            if (typeof responseValue !== "string") {
              throw createApiError(`Response for question ${questionId} must be a string`, 400, "INVALID_RESPONSE_TYPE");
            }
            if (responseValue.length > 2000) {
              throw createApiError(`Response for question ${questionId} must be 2000 characters or less`, 400, "RESPONSE_TOO_LONG");
            }
            break;

          case "SINGLE_CHOICE":
            if (typeof responseValue !== "string") {
              throw createApiError(`Response for question ${questionId} must be a string`, 400, "INVALID_RESPONSE_TYPE");
            }
            // Validate against available choices
            if (question.choices) {
              const choices = JSON.parse(question.choices);
              if (!choices.includes(responseValue)) {
                throw createApiError(`Response for question ${questionId} must be one of the available choices`, 400, "INVALID_CHOICE");
              }
            }
            break;

          case "MULTIPLE_CHOICE":
            if (!Array.isArray(responseValue)) {
              throw createApiError(`Response for question ${questionId} must be an array`, 400, "INVALID_RESPONSE_TYPE");
            }
            // Validate all choices are valid
            if (question.choices) {
              const choices = JSON.parse(question.choices);
              for (const choice of responseValue) {
                if (!choices.includes(choice)) {
                  throw createApiError(`Response for question ${questionId} contains invalid choice`, 400, "INVALID_CHOICE");
                }
              }
            }
            break;

          case "YES_NO":
            if (typeof responseValue !== "boolean") {
              throw createApiError(`Response for question ${questionId} must be a boolean`, 400, "INVALID_RESPONSE_TYPE");
            }
            break;

          case "NUMBER":
            if (typeof responseValue !== "number") {
              throw createApiError(`Response for question ${questionId} must be a number`, 400, "INVALID_RESPONSE_TYPE");
            }
            break;

          case "DATE":
            if (typeof responseValue !== "string") {
              throw createApiError(`Response for question ${questionId} must be a string (ISO date)`, 400, "INVALID_RESPONSE_TYPE");
            }
            // Validate it's a valid date
            const date = new Date(responseValue);
            if (isNaN(date.getTime())) {
              throw createApiError(`Response for question ${questionId} must be a valid date`, 400, "INVALID_DATE");
            }
            break;
        }
      }

      // Save responses (upsert each one)
      const savedResponses = await Promise.all(
        responseEntries.map(([questionId, responseValue]) =>
          prisma.questionnaireResponse.upsert({
            where: {
              questionId_userId: {
                questionId,
                userId,
              },
            },
            create: {
              questionId,
              eventId,
              userId,
              response: JSON.stringify(responseValue),
            },
            update: {
              response: JSON.stringify(responseValue),
            },
          })
        )
      );

      // Fetch updated responses with questions
      const responsesWithQuestions = await prisma.questionnaireResponse.findMany({
        where: {
          eventId,
          userId,
        },
        include: {
          question: true,
        },
      });

      // Parse response data
      const responsesWithParsedData = responsesWithQuestions.map((r) => {
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(r.response);
        } catch (error) {
          parsedResponse = null;
        }

        let parsedChoices = null;
        if (r.question.choices) {
          try {
            parsedChoices = JSON.parse(r.question.choices);
          } catch (error) {
            parsedChoices = null;
          }
        }

        return {
          id: r.id,
          questionId: r.questionId,
          eventId: r.eventId,
          userId: r.userId,
          response: parsedResponse,
          question: {
            id: r.question.id,
            questionText: r.question.questionText,
            questionType: r.question.questionType,
            isRequired: r.question.isRequired,
            helpText: r.question.helpText,
            orderIndex: r.question.orderIndex,
            choices: parsedChoices,
          },
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      });

      res.status(201).json({
        responses: responsesWithParsedData,
        message: "Questionnaire responses saved successfully"
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:eventId/questionnaire/responses/summary
 * Get summary of all questionnaire responses for an event (organizers only)
 * Includes responses grouped by question and filter by attendee
 * Requires: Organizer role
 */
router.get(
  "/:eventId/questionnaire/responses/summary",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;
      const { userId } = req.query; // Optional filter by specific attendee

      // Get all questions for this event
      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId },
        orderBy: { orderIndex: "asc" },
      });

      // Build where clause for responses
      const responseWhere: {
        eventId: string;
        userId?: string;
      } = { eventId };

      if (userId && typeof userId === "string") {
        responseWhere.userId = userId;
      }

      // Get all responses for this event (or filtered by userId)
      const responses = await prisma.questionnaireResponse.findMany({
        where: responseWhere,
        include: {
          question: true,
        },
      });

      // Get all users who have responded (for user details)
      const userIds = [...new Set(responses.map(r => r.userId))];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          displayName: true,
        },
      });

      const usersMap = new Map(users.map(u => [u.id, u]));

      // Group responses by question
      const responsesByQuestion = questions.map((question) => {
        const questionResponses = responses.filter(r => r.questionId === question.id);

        // Parse choices
        let parsedChoices = null;
        if (question.choices) {
          try {
            parsedChoices = JSON.parse(question.choices);
          } catch (error) {
            parsedChoices = null;
          }
        }

        // Parse all responses and include user info
        const parsedResponses = questionResponses.map(r => {
          let parsedResponse;
          try {
            parsedResponse = JSON.parse(r.response);
          } catch (error) {
            parsedResponse = null;
          }

          const user = usersMap.get(r.userId);

          return {
            userId: r.userId,
            displayName: user?.displayName || "Unknown User",
            response: parsedResponse,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          };
        });

        // Calculate statistics based on question type
        let statistics = {};
        if (question.questionType === "SINGLE_CHOICE" || question.questionType === "MULTIPLE_CHOICE") {
          // Count responses for each choice
          const choiceCounts: Record<string, number> = {};
          parsedResponses.forEach(pr => {
            if (question.questionType === "SINGLE_CHOICE" && typeof pr.response === "string") {
              choiceCounts[pr.response] = (choiceCounts[pr.response] || 0) + 1;
            } else if (question.questionType === "MULTIPLE_CHOICE" && Array.isArray(pr.response)) {
              pr.response.forEach((choice: string) => {
                choiceCounts[choice] = (choiceCounts[choice] || 0) + 1;
              });
            }
          });
          statistics = { choiceCounts };
        } else if (question.questionType === "YES_NO") {
          const yesCount = parsedResponses.filter(pr => pr.response === true).length;
          const noCount = parsedResponses.filter(pr => pr.response === false).length;
          statistics = { yesCount, noCount };
        } else if (question.questionType === "NUMBER") {
          const numbers = parsedResponses
            .map(pr => pr.response)
            .filter((r): r is number => typeof r === "number");
          if (numbers.length > 0) {
            const sum = numbers.reduce((a, b) => a + b, 0);
            const avg = sum / numbers.length;
            const min = Math.min(...numbers);
            const max = Math.max(...numbers);
            statistics = { average: avg, min, max, count: numbers.length };
          }
        }

        return {
          question: {
            id: question.id,
            questionText: question.questionText,
            questionType: question.questionType,
            isRequired: question.isRequired,
            helpText: question.helpText,
            orderIndex: question.orderIndex,
            choices: parsedChoices,
          },
          responseCount: parsedResponses.length,
          responses: parsedResponses,
          statistics,
        };
      });

      res.json({
        questions: responsesByQuestion,
        totalRespondents: userIds.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:eventId/questionnaire/responses/incomplete
 * Get list of attendees who haven't completed the questionnaire (organizers only)
 * Requires: Organizer role
 */
router.get(
  "/:eventId/questionnaire/responses/incomplete",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;

      // Get all questions for this event
      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId },
      });

      // Get all required questions
      const requiredQuestionIds = questions
        .filter(q => q.isRequired)
        .map(q => q.id);

      // Get all attendees who RSVP'd Yes
      const yesRSVPs = await prisma.rSVP.findMany({
        where: {
          eventId,
          response: "YES",
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });

      // For each attendee, check if they've answered all required questions
      const incompleteAttendees = [];

      for (const rsvp of yesRSVPs) {
        // Get responses for this user
        const userResponses = await prisma.questionnaireResponse.findMany({
          where: {
            eventId,
            userId: rsvp.userId,
            questionId: { in: requiredQuestionIds },
          },
          select: {
            questionId: true,
          },
        });

        const answeredQuestionIds = new Set(userResponses.map(r => r.questionId));
        const missingQuestionIds = requiredQuestionIds.filter(
          qId => !answeredQuestionIds.has(qId)
        );

        // If they haven't answered all required questions, they're incomplete
        if (missingQuestionIds.length > 0) {
          const missingQuestions = questions
            .filter(q => missingQuestionIds.includes(q.id))
            .map(q => ({
              id: q.id,
              questionText: q.questionText,
            }));

          incompleteAttendees.push({
            userId: rsvp.user.id,
            displayName: rsvp.user.displayName,
            missingQuestions,
            totalRequired: requiredQuestionIds.length,
            answeredRequired: answeredQuestionIds.size,
          });
        }
      }

      res.json({
        incompleteAttendees,
        totalAttendees: yesRSVPs.length,
        incompleteCount: incompleteAttendees.length,
        requiredQuestionCount: requiredQuestionIds.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:eventId/questionnaire/responses/export
 * Export all questionnaire responses as CSV (organizers only)
 * Requires: Organizer role
 */
router.get(
  "/:eventId/questionnaire/responses/export",
  requireAuth,
  requireEventOrganizer,
  async (req: EventAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;

      // Get event details
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { title: true },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Get all questions for this event
      const questions = await prisma.questionnaireQuestion.findMany({
        where: { eventId },
        orderBy: { orderIndex: "asc" },
      });

      if (questions.length === 0) {
        throw createApiError("No questions found for this event", 404, "NO_QUESTIONS");
      }

      // Get all users who have RSVP'd yes
      const yesRSVPs = await prisma.rSVP.findMany({
        where: {
          eventId,
          response: "YES",
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });

      // Get all responses for this event
      const responses = await prisma.questionnaireResponse.findMany({
        where: { eventId },
        include: {
          question: true,
        },
      });

      // Build CSV header
      const headers = [
        "Display Name",
        "RSVP Status",
        ...questions.map(q => q.questionText),
      ];

      // Build CSV rows
      const rows = yesRSVPs.map(rsvp => {
        const userResponses = responses.filter(r => r.userId === rsvp.userId);
        const responsesMap = new Map(
          userResponses.map(r => [r.questionId, r.response])
        );

        const row = [
          rsvp.user.displayName,
          "Yes",
          ...questions.map(q => {
            const responseJson = responsesMap.get(q.id);
            if (!responseJson) return "";

            try {
              const parsed = JSON.parse(responseJson);
              // Format based on type
              if (Array.isArray(parsed)) {
                return parsed.join("; ");
              } else if (typeof parsed === "boolean") {
                return parsed ? "Yes" : "No";
              } else {
                return String(parsed);
              }
            } catch (error) {
              return "";
            }
          }),
        ];

        return row;
      });

      // Convert to CSV format
      const escapeCSV = (value: string) => {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csvLines = [
        headers.map(escapeCSV).join(","),
        ...rows.map(row => row.map(escapeCSV).join(",")),
      ];

      const csvContent = csvLines.join("\n");

      // Set headers for file download
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="questionnaire-responses-${eventId}.csv"`
      );

      res.send(csvContent);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
