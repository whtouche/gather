import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { createApiError } from "../types/index.js";
import { prisma } from "../utils/db.js";

/**
 * Middleware to require authentication.
 * Extracts the session token from the Authorization header and validates it.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw createApiError("Authorization header required", 401, "UNAUTHORIZED");
    }

    const token = authHeader.substring(7);

    if (!token) {
      throw createApiError("Invalid authorization token", 401, "UNAUTHORIZED");
    }

    // Find the session and include the user
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      throw createApiError("Invalid session", 401, "UNAUTHORIZED");
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      throw createApiError("Session expired", 401, "SESSION_EXPIRED");
    }

    // Update last active timestamp
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    // Attach user and session info to request
    req.user = session.user;
    req.sessionId = session.id;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware.
 * Attaches user to request if valid token is provided, but doesn't require it.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.substring(7);

    if (!token) {
      return next();
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (session && session.expiresAt > new Date()) {
      req.user = session.user;
      req.sessionId = session.id;

      // Update last active timestamp
      await prisma.session.update({
        where: { id: session.id },
        data: { lastActiveAt: new Date() },
      });
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors, just continue without user
    next();
  }
}
