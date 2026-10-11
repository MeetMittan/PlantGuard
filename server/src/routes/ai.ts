import { Router, type Request, type Response, type NextFunction } from 'express';
import { defaultGeminiService, type GeminiService } from '../services/gemini.js';
import { uploadSingleImage } from '../middleware/upload.js';
import { aiRateLimiter } from '../middleware/rate-limiter.js';
import { AppServerError } from '../errors.js';

export function createAiRouter(geminiService: GeminiService = defaultGeminiService): Router {
  const router = Router();

  /**
   * GET /api/ai/status
   * Reports whether server-side AI configuration is available, without returning secrets.
   */
  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      available: geminiService.isAvailable(),
      provider: 'gemini',
      model: geminiService.getModelName(),
      configured: geminiService.isAvailable(),
    });
  });

  /**
   * POST /api/ai/analyze
   * Accepts multipart/form-data with 'image' file and optional 'context' text.
   * Analyzes leaf with Gemini and returns structured inference.
   */
  router.post(
    '/analyze',
    aiRateLimiter,
    uploadSingleImage,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!geminiService.isAvailable()) {
          throw new AppServerError(
            'AI_NOT_CONFIGURED',
            'Gemini AI analysis is not configured on this server. Please set GEMINI_API_KEY in the backend environment.',
            503,
          );
        }

        const file = req.file;
        if (!file || !file.buffer) {
          throw new AppServerError('INVALID_IMAGE', 'No image file provided.', 400);
        }

        const rawContext = req.body?.context;
        const context =
          typeof rawContext === 'string'
            ? rawContext.trim().slice(0, 300)
            : undefined;

        const result = await geminiService.analyzeImage(file.buffer, file.mimetype, context);

        res.json({
          success: true,
          inference: result.inference,
          limitations: result.limitations,
          qualityVerdict: result.qualityVerdict,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const aiRouter = createAiRouter();

