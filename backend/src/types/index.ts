import type { Request } from "express";
import type { User } from "@prisma/client";

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
}

export interface ApiError extends Error {
  statusCode: number;
  code?: string;
}

export function createApiError(
  message: string,
  statusCode: number,
  code?: string
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
