import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { env } from '../config/index.js';
import { AppServerError } from '../errors.js';

export const geminiResponseSchema = z.object({
  isPlant: z.enum(['yes', 'no', 'unclear']).default('unclear'),
  plant: z.string().nullable().default(null),
  health: z.enum(['healthy', 'diseased', 'unclear']).default('unclear'),
  signs: z.string().default('none'),
  condition: z.string().nullable().default(null),
  limitations: z.array(z.string()).default([]),
  qualityIssue: z.enum(['none', 'blurry', 'too_dark', 'too_bright', 'too_small']).default('none'),
});

export type GeminiStructuredResponse = z.infer<typeof geminiResponseSchema>;

export interface GeminiAnalysisResult {
  inference: {
    answers: {
      isPlant: { text: string; truncated: boolean };
      plant: { text: string; truncated: boolean };
      health: { text: string; truncated: boolean };
      signs: { text: string; truncated: boolean };
      condition: { text: string; truncated: boolean };
    };
    modelId: string;
    modelRevision: string | null;
    promptVersion: string;
    provider: 'gemini';
    device: null;
    inferenceMs: number;
  };
  limitations: string[];
  qualityVerdict: 'suitable' | 'blurry' | 'too_dark' | 'too_bright' | 'too_small';
}

const SYSTEM_INSTRUCTIONS = `You are a botanical and plant health specialist assistant for PlantGuard AI.
Analyze the user's photograph with scientific rigor and care.

CRITICAL RULES:
1. Observations vs Inferences:
   - Distinguish directly visible symptoms (e.g. spots, yellowing, holes, wilting, powdery mildew, necrotic lesions) from inferred causes.
   - Describe only what is visually evident in this image.
2. Plant Identification:
   - Only suggest a common plant name when visually supportable. If not obvious or inconclusive, return null or "unknown".
3. Health Assessment:
   - If the leaf is healthy and clean, set health to "healthy" and signs to "none".
   - If symptoms of disease, pests, or nutrient stress are visible, set health to "diseased".
   - If the photo is too blurry or ambiguous to tell, set health to "unclear".
4. Non-Plant Photos:
   - If the photo does not depict a plant or leaf, set isPlant to "no", health to "unclear", signs to "none", condition to null, and plant to null.
5. Potential Causes:
   - Express potential causes strictly as possibilities, NEVER as confirmed diagnoses. A photograph alone cannot verify a disease.
   - If healthy or unknown, condition must be null or "unknown".
   - Never provide chemical pesticide recipes, dosages, or guaranteed cure promises.
6. Honest Uncertainty:
   - Never fabricate numerical confidence scores, percentages, or probability ratings.
   - Note visual limitations (blur, poor lighting, only partial leaf shown) in the limitations array.

Return ONLY a valid JSON object matching this structure:
{
  "isPlant": "yes" | "no" | "unclear",
  "plant": "Common plant name" | null,
  "health": "healthy" | "diseased" | "unclear",
  "signs": "Factual description of visible leaf symptoms or 'none'",
  "condition": "Name of possible condition or cause" | null,
  "limitations": ["List of photo limitations and diagnostic uncertainties"],
  "qualityIssue": "none" | "blurry" | "too_dark" | "too_bright" | "too_small"
}`;

export class GeminiService {
  private client: GoogleGenAI | null = null;
  private readonly modelName: string;

  constructor(apiKey?: string, modelName?: string, customClient?: GoogleGenAI) {
    const key = apiKey ?? env.GEMINI_API_KEY;
    this.modelName = modelName ?? env.GEMINI_MODEL;
    if (customClient) {
      this.client = customClient;
    } else if (key && key.trim().length > 5) {
      this.client = new GoogleGenAI({ apiKey: key.trim() });
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  getModelName(): string {
    return this.modelName;
  }

  async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    userContext?: string,
  ): Promise<GeminiAnalysisResult> {
    if (!this.client) {
      throw new AppServerError(
        'AI_NOT_CONFIGURED',
        'Google Gemini API is not configured on the server. Please set GEMINI_API_KEY in the server environment.',
        503,
      );
    }

    const startTime = Date.now();
    const base64Data = imageBuffer.toString('base64');

    const promptParts = [
      { text: SYSTEM_INSTRUCTIONS },
      ...(userContext && userContext.trim()
        ? [
            {
              text: `The user provides this observation note: "${userContext.trim().slice(0, 300)}". Keep this in mind, but base your assessment strictly on what is visible in the photo.`,
            },
          ]
        : []),
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ];

    let rawText: string;
    try {
      // Abort controller for timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

      try {
        const response = await this.client.models.generateContent({
          model: this.modelName,
          contents: [
            {
              role: 'user',
              parts: promptParts,
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });

        rawText = response.text ?? '';
      } finally {
        clearTimeout(timer);
      }
    } catch (err: unknown) {
      if (err instanceof AppServerError) {
        throw err;
      }

      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Gemini Service] API call failed:', errorMsg);
      const isTimeout =
        errorMsg.includes('aborted') ||
        errorMsg.includes('timeout') ||
        (err instanceof Error && err.name === 'AbortError');

      if (isTimeout) {
        throw new AppServerError(
          'AI_TIMEOUT',
          `Gemini API request timed out after ${env.REQUEST_TIMEOUT_MS / 1000} seconds. Please try again.`,
          504,
        );
      }

      // Check for quota or rate limit
      if (/429|quota|rate limit|resource_exhausted/i.test(errorMsg)) {
        throw new AppServerError(
          'AI_QUOTA_EXCEEDED',
          'Gemini API request limit exceeded or quota exhausted. Please try again in a few moments.',
          429,
        );
      }

      // Check for auth errors
      if (/401|403|unauthenticated|permission_denied|api key/i.test(errorMsg)) {
        throw new AppServerError(
          'AI_NOT_CONFIGURED',
          'Gemini API authentication failed. Please verify the server GEMINI_API_KEY configuration.',
          503,
        );
      }

      // Check for bad request / image size
      if (/400|invalid argument|unsupported image/i.test(errorMsg)) {
        throw new AppServerError(
          'INVALID_IMAGE',
          'The image format or dimensions could not be processed by Gemini.',
          400,
        );
      }

      // Check for model availability / deprecation
      if (/404|not found|is not supported|no longer available/i.test(errorMsg)) {
        throw new AppServerError(
          'AI_PROVIDER_ERROR',
          `The configured Gemini model (${this.modelName}) is unavailable or deprecated. Please check GEMINI_MODEL in server configuration.`,
          502,
          errorMsg,
        );
      }

      // Check for temporary high demand or service outage
      if (/503|unavailable|high demand|overloaded/i.test(errorMsg)) {
        throw new AppServerError(
          'AI_SERVICE_UNAVAILABLE',
          'Google Gemini is currently experiencing high demand or temporary unavailability. Please try again in a few moments.',
          503,
          errorMsg,
        );
      }

      throw new AppServerError(
        'AI_PROVIDER_ERROR',
        'Google Gemini encountered an error while processing the plant image. Please try again.',
        502,
        errorMsg,
      );
    }

    if (!rawText || !rawText.trim()) {
      throw new AppServerError(
        'AI_MALFORMED_RESPONSE',
        'Gemini returned an empty response.',
        502,
      );
    }

    let parsedJson: unknown;
    try {
      // Clean possible markdown code fences
      const cleaned = rawText
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsedJson = JSON.parse(cleaned);
    } catch {
      throw new AppServerError(
        'AI_MALFORMED_RESPONSE',
        'Failed to parse JSON response from Gemini.',
        502,
      );
    }

    const validation = geminiResponseSchema.safeParse(parsedJson);
    if (!validation.success) {
      throw new AppServerError(
        'AI_MALFORMED_RESPONSE',
        'Gemini response did not conform to the expected plant assessment schema.',
        502,
      );
    }

    const data = validation.data;
    const durationMs = Date.now() - startTime;

    // Safety filter: sanitize condition name to remove treatment keywords
    let safeCondition = data.condition?.trim() || null;
    if (
      safeCondition &&
      /\b(spray|apply|mix|dilute|dose|dosage|\d+\s?(ml|mg|g|l|oz|%)|fungicide|pesticide|chemical|copper|neem)\b/i.test(
        safeCondition,
      )
    ) {
      safeCondition = null;
    }

    // Format into standard PlantGuard answers
    const answers = {
      isPlant: {
        text: data.isPlant === 'yes' ? 'Yes.' : data.isPlant === 'no' ? 'No.' : 'Unclear.',
        truncated: false,
      },
      plant: {
        text: data.isPlant === 'no' ? 'Unknown.' : (data.plant?.trim() || 'Unknown.'),
        truncated: false,
      },
      health: {
        text:
          data.isPlant === 'no'
            ? 'Unclear.'
            : data.health === 'healthy'
              ? 'Healthy.'
              : data.health === 'diseased'
                ? 'Diseased.'
                : 'Unclear.',
        truncated: false,
      },
      signs: {
        text:
          data.isPlant === 'no'
            ? 'None.'
            : data.health === 'healthy' && (!data.signs || data.signs.toLowerCase() === 'none')
              ? 'None.'
              : (data.signs?.trim() || 'None.'),
        truncated: false,
      },
      condition: {
        text:
          data.isPlant === 'no' || data.health === 'healthy'
            ? 'Unknown.'
            : (safeCondition || 'Unknown.'),
        truncated: false,
      },
    };

    const qualityVerdict =
      data.qualityIssue === 'none' ? 'suitable' : data.qualityIssue;

    return {
      inference: {
        answers,
        modelId: this.modelName,
        modelRevision: null,
        promptVersion: 'gemini-plant-qa-v1',
        provider: 'gemini',
        device: null,
        inferenceMs: durationMs,
      },
      limitations: data.limitations,
      qualityVerdict,
    };
  }
}

export const defaultGeminiService = new GeminiService();

