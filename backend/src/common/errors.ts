import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", `Route ${req.method} ${req.path} was not found`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({
      error: {
        code: error.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
        message: error.code === "LIMIT_FILE_SIZE" ? "The selected file exceeds the 5 MB limit." : "The file could not be uploaded.",
        requestId: req.requestId,
      },
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request contains invalid data.",
        details: error.issues,
        requestId: req.requestId,
      },
    });
    return;
  }

  const appError = error instanceof AppError
    ? error
    : new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred.");

  if (!(error instanceof AppError)) {
    console.error({ requestId: req.requestId, error });
  }

  res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      requestId: req.requestId,
    },
  });
};
