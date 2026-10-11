import express, { type Express } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { generalRateLimiter } from './middleware/rate-limiter.js';
import { httpLogger } from './lib/logger.js';
import { AppServerError } from './errors.js';

import { healthRouter as legacyHealthRouter } from './routes/health.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { plantsRouter } from './modules/plants/plants.routes.js';
import { observationsRouter } from './modules/observations/observations.routes.js';
import { aiRouter, createAiRouter } from './modules/ai/ai.routes.js';
import { careRouter } from './modules/care/care.routes.js';
import { mapsRouter } from './modules/maps/maps.routes.js';
import { connectionsRouter } from './modules/connections/connections.routes.js';
import { sharingRouter } from './modules/sharing/sharing.routes.js';
import { gardensRouter } from './modules/gardens/gardens.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { syncRouter } from './modules/sync/sync.routes.js';
import { storageRouter } from './modules/storage/storage.routes.js';
import { defaultGeminiService, type GeminiService } from './services/gemini.js';

export function createApp(geminiService: GeminiService = defaultGeminiService): Express {
  const app = express();

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  // CORS policy
  app.use(corsMiddleware);

  // HTTP Request logging with Pino & automatic secrets redaction
  app.use(httpLogger);

  // Cookie parsing
  app.use(cookieParser());

  // General rate limiter
  app.use(generalRateLimiter);

  // Body parsing for JSON and URL-encoded payloads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API v1 Endpoints
  const resolvedAiRouter = geminiService === defaultGeminiService ? aiRouter : createAiRouter(geminiService);

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/plants', plantsRouter);
  app.use('/api/v1/observations', observationsRouter);
  app.use('/api/v1/ai', resolvedAiRouter);
  app.use('/api/v1/care', careRouter);
  app.use('/api/v1/maps', mapsRouter);
  app.use('/api/v1/connections', connectionsRouter);
  app.use('/api/v1/sharing', sharingRouter);
  app.use('/api/v1/gardens', gardensRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/sync', syncRouter);
  app.use('/api/v1/storage', storageRouter);

  // Backwards compatibility legacy aliases
  app.use('/api/health', legacyHealthRouter);
  app.use('/api/ai', resolvedAiRouter);

  // Catch-all 404 for undefined endpoints
  app.use((req, _res, next) => {
    next(new AppServerError('NOT_FOUND', `Endpoint not found: ${req.method} ${req.path}`, 404));
  });

  // Global centralized error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
