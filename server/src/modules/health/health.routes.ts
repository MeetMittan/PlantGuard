import { Router, type Request, type Response } from 'express';
import { checkDatabaseHealth } from '../../database/connection.js';
import { env } from '../../config/index.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  const aiConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== '');

  const isHealthy = dbHealth.status === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbHealth.status,
      ...(dbHealth.details ? { details: dbHealth.details } : {}),
    },
    ai: {
      configured: aiConfigured,
      model: env.GEMINI_MODEL,
    },
  });
});

export const healthRouter = router;

