import { Router, type Request, type Response, type NextFunction } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../utils/db.js";
import {
  createVerificationCode,
  verifyCode,
  sendVerificationCode,
  generateSessionToken,
  getSessionExpiry,
} from "../utils/verification.js";
import { requireAuth } from "../middleware/auth.js";
import { createApiError, type AuthenticatedRequest } from "../types/index.js";

const router = Router();

// Helper to validate phone number format (basic validation)
function isValidPhone(phone: string): boolean {
  // Allow digits, spaces, dashes, parentheses, and leading +
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^\+?[0-9]{10,15}$/.test(cleaned);
}

// Helper to validate email format (basic validation)
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Helper to normalize phone numbers
function normalizePhone(phone: string): string {
  // Remove all non-digit characters except leading +
  return phone.replace(/[^\d+]/g, "");
}

// Helper to normalize email
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * POST /api/auth/register/start
 * Start registration - send verification code to phone or email
 */
router.post(
  "/register/start",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone, email, displayName } = req.body;

      // Require at least one contact method
      if (!phone && !email) {
        throw createApiError(
          "Phone number or email is required",
          400,
          "MISSING_CONTACT"
        );
      }

      // Require display name
      if (!displayName || typeof displayName !== "string" || displayName.trim().length === 0) {
        throw createApiError("Display name is required", 400, "MISSING_DISPLAY_NAME");
      }

      let normalizedPhone: string | undefined;
      let normalizedEmail: string | undefined;

      // Validate and normalize phone if provided
      if (phone) {
        if (!isValidPhone(phone)) {
          throw createApiError("Invalid phone number format", 400, "INVALID_PHONE");
        }
        normalizedPhone = normalizePhone(phone);

        // Check if phone already registered
        const existingUser = await prisma.user.findUnique({
          where: { phone: normalizedPhone },
        });
        if (existingUser) {
          throw createApiError(
            "Phone number already registered",
            409,
            "PHONE_ALREADY_REGISTERED"
          );
        }
      }

      // Validate and normalize email if provided
      if (email) {
        if (!isValidEmail(email)) {
          throw createApiError("Invalid email format", 400, "INVALID_EMAIL");
        }
        normalizedEmail = normalizeEmail(email);

        // Check if email already registered
        const existingUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (existingUser) {
          throw createApiError(
            "Email already registered",
            409,
            "EMAIL_ALREADY_REGISTERED"
          );
        }
      }

      // Create verification code
      const code = await createVerificationCode({
        phone: normalizedPhone,
        email: normalizedEmail,
        type: "REGISTRATION",
      });

      // Send verification code (logs to console for now)
      if (normalizedPhone) {
        sendVerificationCode(normalizedPhone, code, "phone");
      }
      if (normalizedEmail) {
        sendVerificationCode(normalizedEmail, code, "email");
      }

      res.status(200).json({
        message: "Verification code sent",
        destination: normalizedPhone || normalizedEmail,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/register/verify
 * Verify code and create account
 */
router.post(
  "/register/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone, email, code, displayName, deviceInfo } = req.body;

      if (!phone && !email) {
        throw createApiError(
          "Phone number or email is required",
          400,
          "MISSING_CONTACT"
        );
      }

      if (!code || typeof code !== "string") {
        throw createApiError("Verification code is required", 400, "MISSING_CODE");
      }

      if (!displayName || typeof displayName !== "string" || displayName.trim().length === 0) {
        throw createApiError("Display name is required", 400, "MISSING_DISPLAY_NAME");
      }

      const normalizedPhone = phone ? normalizePhone(phone) : undefined;
      const normalizedEmail = email ? normalizeEmail(email) : undefined;

      // Verify the code
      const verification = await verifyCode({
        phone: normalizedPhone,
        email: normalizedEmail,
        code,
        type: "REGISTRATION",
      });

      if (!verification.valid) {
        throw createApiError("Invalid or expired verification code", 400, "INVALID_CODE");
      }

      // Double-check user doesn't exist (race condition protection)
      if (normalizedPhone) {
        const existing = await prisma.user.findUnique({
          where: { phone: normalizedPhone },
        });
        if (existing) {
          throw createApiError("Phone number already registered", 409, "PHONE_ALREADY_REGISTERED");
        }
      }
      if (normalizedEmail) {
        const existing = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (existing) {
          throw createApiError("Email already registered", 409, "EMAIL_ALREADY_REGISTERED");
        }
      }

      // Create user and session in a transaction
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Create user
        const user = await tx.user.create({
          data: {
            phone: normalizedPhone,
            email: normalizedEmail,
            displayName: displayName.trim(),
          },
        });

        // Create session
        const session = await tx.session.create({
          data: {
            userId: user.id,
            token: generateSessionToken(),
            deviceInfo: deviceInfo || null,
            expiresAt: getSessionExpiry(),
          },
        });

        return { user, session };
      });

      res.status(201).json({
        user: {
          id: result.user.id,
          phone: result.user.phone,
          email: result.user.email,
          displayName: result.user.displayName,
          createdAt: result.user.createdAt,
        },
        token: result.session.token,
        expiresAt: result.session.expiresAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/register/invite/start
 * Start registration via invitation link - send verification code
 * This handles both new users and existing users (merging/login)
 */
router.post(
  "/register/invite/start",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone, email, displayName, inviteToken } = req.body;

      // Require at least one contact method
      if (!phone && !email) {
        throw createApiError(
          "Phone number or email is required",
          400,
          "MISSING_CONTACT"
        );
      }

      // Require display name
      if (!displayName || typeof displayName !== "string" || displayName.trim().length === 0) {
        throw createApiError("Display name is required", 400, "MISSING_DISPLAY_NAME");
      }

      // Require invite token
      if (!inviteToken || typeof inviteToken !== "string") {
        throw createApiError("Invite token is required", 400, "MISSING_INVITE_TOKEN");
      }

      // Validate the invite link exists and is active
      const inviteLink = await prisma.inviteLink.findUnique({
        where: { token: inviteToken },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              state: true,
            },
          },
        },
      });

      if (!inviteLink || !inviteLink.isActive) {
        throw createApiError("Invalid or expired invite link", 400, "INVALID_INVITE_TOKEN");
      }

      // Check if invite link has expired
      if (inviteLink.expiresAt && inviteLink.expiresAt < new Date()) {
        throw createApiError("Invite link has expired", 400, "INVITE_EXPIRED");
      }

      // Check if event is still accepting RSVPs
      if (inviteLink.event.state === "CANCELLED") {
        throw createApiError("This event has been cancelled", 400, "EVENT_CANCELLED");
      }

      let normalizedPhone: string | undefined;
      let normalizedEmail: string | undefined;
      let existingUser = null;

      // Validate and normalize phone if provided
      if (phone) {
        if (!isValidPhone(phone)) {
          throw createApiError("Invalid phone number format", 400, "INVALID_PHONE");
        }
        normalizedPhone = normalizePhone(phone);

        // Check if phone already registered - if so, we'll log them in instead
        existingUser = await prisma.user.findUnique({
          where: { phone: normalizedPhone },
        });
      }

      // Validate and normalize email if provided
      if (email) {
        if (!isValidEmail(email)) {
          throw createApiError("Invalid email format", 400, "INVALID_EMAIL");
        }
        normalizedEmail = normalizeEmail(email);

        // Check if email already registered - if so, we'll log them in instead
        if (!existingUser) {
          existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });
        }
      }

      // If user exists, we'll send them a login code with the invite context
      // so they can be redirected to the event after verification
      if (existingUser) {
        const code = await createVerificationCode({
          phone: normalizedPhone,
          email: normalizedEmail,
          userId: existingUser.id,
          type: "LOGIN",
          inviteToken,
        });

        // Send verification code
        if (normalizedPhone) {
          sendVerificationCode(normalizedPhone, code, "phone");
        }
        if (normalizedEmail) {
          sendVerificationCode(normalizedEmail, code, "email");
        }

        res.status(200).json({
          message: "Verification code sent",
          destination: normalizedPhone || normalizedEmail,
          existingUser: true,
          eventId: inviteLink.event.id,
          eventTitle: inviteLink.event.title,
        });
        return;
      }

      // New user - create registration verification code with invite context
      const code = await createVerificationCode({
        phone: normalizedPhone,
        email: normalizedEmail,
        type: "INVITE_REGISTRATION",
        inviteToken,
      });

      // Send verification code
      if (normalizedPhone) {
        sendVerificationCode(normalizedPhone, code, "phone");
      }
      if (normalizedEmail) {
        sendVerificationCode(normalizedEmail, code, "email");
      }

      res.status(200).json({
        message: "Verification code sent",
        destination: normalizedPhone || normalizedEmail,
        existingUser: false,
        eventId: inviteLink.event.id,
        eventTitle: inviteLink.event.title,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/register/invite/verify
 * Verify code and create account (or log in existing user) via invitation
 */
router.post(
  "/register/invite/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone, email, code, displayName, deviceInfo, inviteToken } = req.body;

      if (!phone && !email) {
        throw createApiError(
          "Phone number or email is required",
          400,
          "MISSING_CONTACT"
        );
      }

      if (!code || typeof code !== "string") {
        throw createApiError("Verification code is required", 400, "MISSING_CODE");
      }

      if (!inviteToken || typeof inviteToken !== "string") {
        throw createApiError("Invite token is required", 400, "MISSING_INVITE_TOKEN");
      }

      const normalizedPhone = phone ? normalizePhone(phone) : undefined;
      const normalizedEmail = email ? normalizeEmail(email) : undefined;

      // First, try to verify as a LOGIN code (for existing users)
      let verification = await verifyCode({
        phone: normalizedPhone,
        email: normalizedEmail,
        code,
        type: "LOGIN",
      });

      // If not a login code, try INVITE_REGISTRATION
      if (!verification.valid) {
        verification = await verifyCode({
          phone: normalizedPhone,
          email: normalizedEmail,
          code,
          type: "INVITE_REGISTRATION",
        });
      }

      if (!verification.valid) {
        throw createApiError("Invalid or expired verification code", 400, "INVALID_CODE");
      }

      // Validate the invite link
      const inviteLink = await prisma.inviteLink.findUnique({
        where: { token: inviteToken },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              dateTime: true,
              location: true,
              state: true,
            },
          },
        },
      });

      if (!inviteLink || !inviteLink.isActive) {
        throw createApiError("Invalid or expired invite link", 400, "INVALID_INVITE_TOKEN");
      }

      // If verification has a userId, this is an existing user logging in
      if (verification.userId) {
        const user = await prisma.user.findUnique({
          where: { id: verification.userId },
        });

        if (!user) {
          throw createApiError("User not found", 404, "USER_NOT_FOUND");
        }

        // Create new session
        const session = await prisma.session.create({
          data: {
            userId: user.id,
            token: generateSessionToken(),
            deviceInfo: deviceInfo || null,
            expiresAt: getSessionExpiry(),
          },
        });

        res.status(200).json({
          user: {
            id: user.id,
            phone: user.phone,
            email: user.email,
            displayName: user.displayName,
            photoUrl: user.photoUrl,
            bio: user.bio,
            location: user.location,
            createdAt: user.createdAt,
          },
          token: session.token,
          expiresAt: session.expiresAt,
          isNewUser: false,
          event: {
            id: inviteLink.event.id,
            title: inviteLink.event.title,
            dateTime: inviteLink.event.dateTime.toISOString(),
            location: inviteLink.event.location,
          },
        });
        return;
      }

      // New user registration
      if (!displayName || typeof displayName !== "string" || displayName.trim().length === 0) {
        throw createApiError("Display name is required", 400, "MISSING_DISPLAY_NAME");
      }

      // Double-check user doesn't exist (race condition protection)
      if (normalizedPhone) {
        const existing = await prisma.user.findUnique({
          where: { phone: normalizedPhone },
        });
        if (existing) {
          throw createApiError("Phone number already registered", 409, "PHONE_ALREADY_REGISTERED");
        }
      }
      if (normalizedEmail) {
        const existing = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (existing) {
          throw createApiError("Email already registered", 409, "EMAIL_ALREADY_REGISTERED");
        }
      }

      // Create user and session in a transaction
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Create user
        const user = await tx.user.create({
          data: {
            phone: normalizedPhone,
            email: normalizedEmail,
            displayName: displayName.trim(),
          },
        });

        // Create session
        const session = await tx.session.create({
          data: {
            userId: user.id,
            token: generateSessionToken(),
            deviceInfo: deviceInfo || null,
            expiresAt: getSessionExpiry(),
          },
        });

        return { user, session };
      });

      res.status(201).json({
        user: {
          id: result.user.id,
          phone: result.user.phone,
          email: result.user.email,
          displayName: result.user.displayName,
          createdAt: result.user.createdAt,
        },
        token: result.session.token,
        expiresAt: result.session.expiresAt,
        isNewUser: true,
        event: {
          id: inviteLink.event.id,
          title: inviteLink.event.title,
          dateTime: inviteLink.event.dateTime.toISOString(),
          location: inviteLink.event.location,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/login/start
 * Start login - send verification code to existing user
 */
router.post(
  "/login/start",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone, email } = req.body;

      if (!phone && !email) {
        throw createApiError(
          "Phone number or email is required",
          400,
          "MISSING_CONTACT"
        );
      }

      let user;
      let normalizedPhone: string | undefined;
      let normalizedEmail: string | undefined;

      // Find user by phone or email
      if (phone) {
        if (!isValidPhone(phone)) {
          throw createApiError("Invalid phone number format", 400, "INVALID_PHONE");
        }
        normalizedPhone = normalizePhone(phone);
        user = await prisma.user.findUnique({
          where: { phone: normalizedPhone },
        });
      } else if (email) {
        if (!isValidEmail(email)) {
          throw createApiError("Invalid email format", 400, "INVALID_EMAIL");
        }
        normalizedEmail = normalizeEmail(email);
        user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
      }

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      // Create verification code linked to the user
      const code = await createVerificationCode({
        phone: normalizedPhone,
        email: normalizedEmail,
        userId: user.id,
        type: "LOGIN",
      });

      // Send verification code (logs to console for now)
      if (normalizedPhone) {
        sendVerificationCode(normalizedPhone, code, "phone");
      }
      if (normalizedEmail) {
        sendVerificationCode(normalizedEmail, code, "email");
      }

      res.status(200).json({
        message: "Verification code sent",
        destination: normalizedPhone || normalizedEmail,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/login/verify
 * Verify code and create session
 */
router.post(
  "/login/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone, email, code, deviceInfo } = req.body;

      if (!phone && !email) {
        throw createApiError(
          "Phone number or email is required",
          400,
          "MISSING_CONTACT"
        );
      }

      if (!code || typeof code !== "string") {
        throw createApiError("Verification code is required", 400, "MISSING_CODE");
      }

      const normalizedPhone = phone ? normalizePhone(phone) : undefined;
      const normalizedEmail = email ? normalizeEmail(email) : undefined;

      // Verify the code
      const verification = await verifyCode({
        phone: normalizedPhone,
        email: normalizedEmail,
        code,
        type: "LOGIN",
      });

      if (!verification.valid || !verification.userId) {
        throw createApiError("Invalid or expired verification code", 400, "INVALID_CODE");
      }

      // Get the user
      const user = await prisma.user.findUnique({
        where: { id: verification.userId },
      });

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      // Create new session
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          token: generateSessionToken(),
          deviceInfo: deviceInfo || null,
          expiresAt: getSessionExpiry(),
        },
      });

      res.status(200).json({
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          displayName: user.displayName,
          photoUrl: user.photoUrl,
          bio: user.bio,
          location: user.location,
          createdAt: user.createdAt,
        },
        token: session.token,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout - invalidate current session
 */
router.post(
  "/logout",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.sessionId;

      if (!sessionId) {
        throw createApiError("No active session", 400, "NO_SESSION");
      }

      // Delete the session
      await prisma.session.delete({
        where: { id: sessionId },
      });

      res.status(200).json({
        message: "Logged out successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get(
  "/me",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw createApiError("User not found", 404, "USER_NOT_FOUND");
      }

      res.status(200).json({
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          displayName: user.displayName,
          photoUrl: user.photoUrl,
          bio: user.bio,
          location: user.location,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
