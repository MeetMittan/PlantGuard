import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppServerError, type ServerErrorResponse } from '../errors.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/index.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppServerError) {
    logger.warn({ code: err.code, statusCode: err.statusCode, message: err.message }, 'Application error');
    const response: ServerErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        status: err.statusCode,
        ...(err.details ? { details: err.details } : {}),
      },
    };
    return res.status(err.statusCode).json(response);
  }

  if (err instanceof ZodError) {
    logger.warn({ issues: err.issues }, 'Validation error');
    const response: ServerErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload or parameters',
        status: 422,
        details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
    };
    return res.status(422).json(response);
  }

  logger.error({ err }, 'Unhandled server error');

  const response: ServerErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred. Please try again later.',
      status: 500,
      details: env.NODE_ENV === 'development' && err instanceof Error ? err.message : undefined,
    },
  };
  return res.status(500).json(response);
}
