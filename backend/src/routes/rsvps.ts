import { Router } from "express";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { createApiError } from "../types/index.js";
import { prisma } from "../utils/db.js";
import { requireAuth } from "../middleware/auth.js";
import { computeEventState } from "../utils/eventState.js";
import { notifyNextOnWaitlist } from "./waitlist.js";

const router = Router();

// =============================================================================
// Types
// =============================================================================

type RSVPResponseType = "YES" | "NO" | "MAYBE";

interface RSVPInput {
  response: RSVPResponseType;
  questionnaireResponses?: Record<string, unknown>;
}

// =============================================================================
// Validation helpers
// =============================================================================

function validateRSVPInput(input: unknown): RSVPInput {
  if (!input || typeof input !== "object") {
    throw createApiError("Invalid request body", 400, "INVALID_INPUT");
  }

  const data = input as Record<string, unknown>;

  if (!data.response || typeof data.response !== "string") {
    throw createApiError("Response is required", 400, "MISSING_RESPONSE");
  }

  const validResponses: RSVPResponseType[] = ["YES", "NO", "MAYBE"];
  if (!validResponses.includes(data.response as RSVPResponseType)) {
    throw createApiError(
      "Invalid response. Must be YES, NO, or MAYBE",
      400,
      "INVALID_RESPONSE"
    );
  }

  // Validate questionnaireResponses if provided
  if (data.questionnaireResponses !== undefined) {
    if (typeof data.questionnaireResponses !== "object" || data.questionnaireResponses === null) {
      throw createApiError("Questionnaire responses must be an object", 400, "INVALID_QUESTIONNAIRE_RESPONSES");
    }
  }

  return {
    response: data.response as RSVPResponseType,
    questionnaireResponses: data.questionnaireResponses as Record<string, unknown> | undefined,
  };
}

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Check if the RSVP deadline has passed for an event
 */
function isRsvpDeadlinePassed(event: { rsvpDeadline: Date | null }): boolean {
  if (!event.rsvpDeadline) {
    return false;
  }
  return new Date() > event.rsvpDeadline;
}

/**
 * Notify organizers about RSVP changes
 * For now, this logs to console. In the future, this could send emails/push notifications.
 */
async function notifyOrganizersOfRsvpChange(
  eventId: string,
  userId: string,
  response: RSVPResponseType,
  isUpdate: boolean
): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      creator: { select: { displayName: true } },
      eventRoles: {
        where: { role: "ORGANIZER" },
        include: { user: { select: { id: true, displayName: true } } },
      },
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });

  if (!event || !user) return;

  const action = isUpdate ? "changed their RSVP to" : "RSVP'd";
  const message = `[RSVP Notification] ${user.displayName} ${action} ${response} for event "${event.title}"`;

  // Log notification (placeholder for future notification system)
  console.log(message);

  // In the future, we would create notification records and/or send emails here
  // For example:
  // await prisma.notification.create({ ... });
}

/**
 * Validate and save questionnaire responses
 */
async function validateAndSaveQuestionnaireResponses(
  eventId: string,
  userId: string,
  responses: Record<string, unknown>,
  rsvpResponse: RSVPResponseType
): Promise<void> {
  // Get all questions for this event
  const questions = await prisma.questionnaireQuestion.findMany({
    where: { eventId },
  });

  // If no questions exist, nothing to validate
  if (questions.length === 0) {
    return;
  }

  const questionsMap = new Map(questions.map(q => [q.id, q]));
  const responseEntries = Object.entries(responses);

  // Validate all question IDs exist
  for (const [questionId] of responseEntries) {
    if (!questionsMap.has(questionId)) {
      throw createApiError(`Question ${questionId} not found`, 400, "INVALID_QUESTION_ID");
    }
  }

  // Check required questions are answered (only for YES responses)
  if (rsvpResponse === "YES") {
    const requiredQuestions = questions.filter(q => q.isRequired);
    for (const question of requiredQuestions) {
      if (responses[question.id] === undefined || responses[question.id] === null || responses[question.id] === "") {
        throw createApiError(
          `Required question "${question.questionText}" must be answered`,
          400,
          "REQUIRED_QUESTION_MISSING"
        );
      }
    }
  }

  // Validate response values based on question type
  for (const [questionId, responseValue] of responseEntries) {
    const question = questionsMap.get(questionId)!;

    // Skip empty optional responses
    if (!question.isRequired && (responseValue === undefined || responseValue === null || responseValue === "")) {
      continue;
    }

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
  if (responseEntries.length > 0) {
    await Promise.all(
      responseEntries.map(([questionId, responseValue]) => {
        // Skip empty optional responses
        const question = questionsMap.get(questionId)!;
        if (!question.isRequired && (responseValue === undefined || responseValue === null || responseValue === "")) {
          return Promise.resolve();
        }

        return prisma.questionnaireResponse.upsert({
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
        });
      })
    );
  }
}

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /api/events/:id/rsvp
 * Submit or update RSVP for an event (requires authentication)
 */
router.post(
  "/:id/rsvp",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;
      const input = validateRSVPInput(req.body);

      // Get the event to check if it exists and validate deadline
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          state: true,
          dateTime: true,
          endDateTime: true,
          rsvpDeadline: true,
          capacity: true,
        },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Compute the current state based on time
      const computedState = computeEventState({
        state: event.state,
        dateTime: event.dateTime,
        endDateTime: event.endDateTime,
        rsvpDeadline: event.rsvpDeadline,
      });

      // Check if event is in a valid state for RSVPs
      if (computedState === "DRAFT") {
        throw createApiError(
          "Cannot RSVP to a draft event",
          400,
          "EVENT_NOT_PUBLISHED"
        );
      }

      if (computedState === "CANCELLED") {
        throw createApiError(
          "Cannot RSVP to a cancelled event",
          400,
          "EVENT_CANCELLED"
        );
      }

      if (computedState === "COMPLETED") {
        throw createApiError(
          "Cannot RSVP to a completed event",
          400,
          "EVENT_COMPLETED"
        );
      }

      if (computedState === "ONGOING") {
        throw createApiError(
          "Cannot RSVP to an event that has already started",
          400,
          "EVENT_ONGOING"
        );
      }

      // Check if RSVPs are closed (RSVP deadline passed but event hasn't started)
      if (computedState === "CLOSED") {
        throw createApiError(
          "RSVP deadline has passed. Please contact the organizer if you need to change your RSVP.",
          400,
          "RSVP_DEADLINE_PASSED"
        );
      }

      // Check capacity if responding YES
      if (input.response === "YES" && event.capacity) {
        const currentYesCount = await prisma.rSVP.count({
          where: {
            eventId,
            response: "YES",
            userId: { not: userId }, // Exclude current user in case they're updating
          },
        });

        // Get current user's RSVP to see if they're already a YES
        const existingRsvpForCapacity = await prisma.rSVP.findUnique({
          where: { eventId_userId: { eventId, userId } },
          select: { response: true },
        });

        // If at capacity and user isn't already a YES, check waitlist or reject
        if (currentYesCount >= event.capacity && existingRsvpForCapacity?.response !== "YES") {
          // Get full event to check waitlist status
          const fullEvent = await prisma.event.findUnique({
            where: { id: eventId },
            select: { waitlistEnabled: true },
          });

          if (fullEvent?.waitlistEnabled) {
            throw createApiError(
              "Event is at capacity. You can join the waitlist instead.",
              400,
              "EVENT_AT_CAPACITY_WAITLIST_AVAILABLE"
            );
          } else {
            throw createApiError(
              "Event is at capacity",
              400,
              "EVENT_AT_CAPACITY"
            );
          }
        }
      }

      // Check if RSVP already exists (for notification purposes)
      const existingRsvp = await prisma.rSVP.findUnique({
        where: { eventId_userId: { eventId, userId } },
        select: { response: true },
      });

      const isUpdate = !!existingRsvp;
      const responseChanged = existingRsvp?.response !== input.response;

      // Upsert the RSVP and reset needsReconfirmation flag
      const rsvp = await prisma.rSVP.upsert({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
        create: {
          eventId,
          userId,
          response: input.response,
          needsReconfirmation: false,
        },
        update: {
          response: input.response,
          needsReconfirmation: false,
        },
      });

      // Notify organizers if this is a new RSVP or a change
      if (!isUpdate || responseChanged) {
        await notifyOrganizersOfRsvpChange(eventId, userId, input.response, isUpdate);
      }

      // Save questionnaire responses if provided
      if (input.questionnaireResponses && Object.keys(input.questionnaireResponses).length > 0) {
        await validateAndSaveQuestionnaireResponses(
          eventId,
          userId,
          input.questionnaireResponses,
          input.response
        );
      }

      // If user changed from YES to something else, notify next person on waitlist
      if (existingRsvp?.response === "YES" && input.response !== "YES") {
        // Check if event has waitlist enabled and capacity
        const eventWithWaitlist = await prisma.event.findUnique({
          where: { id: eventId },
          select: { capacity: true, waitlistEnabled: true },
        });

        if (eventWithWaitlist?.capacity && eventWithWaitlist?.waitlistEnabled) {
          await notifyNextOnWaitlist(eventId);
        }
      }

      res.status(isUpdate ? 200 : 201).json({
        rsvp: {
          id: rsvp.id,
          eventId: rsvp.eventId,
          userId: rsvp.userId,
          response: rsvp.response,
          createdAt: rsvp.createdAt.toISOString(),
          updatedAt: rsvp.updatedAt.toISOString(),
        },
        message: isUpdate
          ? "RSVP updated successfully"
          : "RSVP submitted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/events/:id/rsvp
 * Get user's current RSVP for an event (requires authentication)
 */
router.get(
  "/:id/rsvp",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;

      // Check if event exists
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          state: true,
          dateTime: true,
          endDateTime: true,
          rsvpDeadline: true,
        },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Compute the current state
      const computedState = computeEventState({
        state: event.state,
        dateTime: event.dateTime,
        endDateTime: event.endDateTime,
        rsvpDeadline: event.rsvpDeadline,
      });

      // Can modify only if event is in PUBLISHED state
      const canModify = computedState === "PUBLISHED";
      const deadlinePassed = isRsvpDeadlinePassed(event);

      // Get user's RSVP
      const rsvp = await prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
      });

      if (!rsvp) {
        res.status(200).json({
          rsvp: null,
          canModify,
          deadlinePassed,
          eventState: computedState,
          rsvpDeadline: event.rsvpDeadline?.toISOString() || null,
        });
        return;
      }

      res.status(200).json({
        rsvp: {
          id: rsvp.id,
          eventId: rsvp.eventId,
          userId: rsvp.userId,
          response: rsvp.response,
          createdAt: rsvp.createdAt.toISOString(),
          updatedAt: rsvp.updatedAt.toISOString(),
        },
        canModify,
        deadlinePassed,
        eventState: computedState,
        rsvpDeadline: event.rsvpDeadline?.toISOString() || null,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/events/:id/rsvp
 * Remove RSVP for an event (requires authentication)
 */
router.delete(
  "/:id/rsvp",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const userId = req.user!.id;

      // Check if event exists
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          state: true,
          dateTime: true,
          endDateTime: true,
          rsvpDeadline: true,
        },
      });

      if (!event) {
        throw createApiError("Event not found", 404, "EVENT_NOT_FOUND");
      }

      // Compute the current state
      const computedState = computeEventState({
        state: event.state,
        dateTime: event.dateTime,
        endDateTime: event.endDateTime,
        rsvpDeadline: event.rsvpDeadline,
      });

      // Can only modify RSVP for PUBLISHED events
      if (computedState !== "PUBLISHED") {
        throw createApiError(
          "Cannot modify RSVP. The event is no longer accepting RSVP changes.",
          400,
          "RSVP_MODIFICATIONS_CLOSED"
        );
      }

      // Check if RSVP exists
      const existingRsvp = await prisma.rSVP.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
      });

      if (!existingRsvp) {
        throw createApiError("RSVP not found", 404, "RSVP_NOT_FOUND");
      }

      // Store the response before deleting for waitlist logic
      const wasYes = existingRsvp.response === "YES";

      // Delete the RSVP
      await prisma.rSVP.delete({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
      });

      // Notify organizers
      console.log(
        `[RSVP Notification] User ${userId} removed their RSVP for event ${eventId}`
      );

      // If user was a YES, notify next person on waitlist
      if (wasYes) {
        const eventWithWaitlist = await prisma.event.findUnique({
          where: { id: eventId },
          select: { capacity: true, waitlistEnabled: true },
        });

        if (eventWithWaitlist?.capacity && eventWithWaitlist?.waitlistEnabled) {
          await notifyNextOnWaitlist(eventId);
        }
      }

      res.status(200).json({
        message: "RSVP removed successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
