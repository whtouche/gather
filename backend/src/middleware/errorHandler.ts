import type { Request, Response, NextFunction } from "express";
import type { ApiError } from "../types/index.js";

export function errorHandler(
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("Error:", err);

  const statusCode = "statusCode" in err ? err.statusCode : 500;
  const code = "code" in err ? err.code : "INTERNAL_ERROR";

  res.status(statusCode).json({
    error: {
      message: err.message || "Internal server error",
      code,
    },
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      message: "Not found",
      code: "NOT_FOUND",
    },
  });
}
