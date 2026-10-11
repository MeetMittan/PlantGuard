import rateLimit from 'express-rate-limit';
import { env } from '../config/index.js';
import type { ServerErrorResponse } from '../errors.js';

export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.',
      status: 429,
    },
  } satisfies ServerErrorResponse,
  validate: {
    trustProxy: false,
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
      status: 429,
    },
  } satisfies ServerErrorResponse,
  validate: {
    trustProxy: false,
  },
});

export const aiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AI_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AI_RATE_LIMITED',
      message: 'Rate limit exceeded. Please wait a few minutes before analyzing another plant.',
      status: 429,
    },
  } satisfies ServerErrorResponse,
  validate: {
    trustProxy: false,
  },
});
