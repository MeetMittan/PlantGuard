import { apiClient } from '@/lib/api/client';
import type {
  AnalyzeOptions,
  CapabilityReport,
  InferenceDevice,
  InferenceResult,
  ModelProgress,
  PlantImageInput,
  VisionModelProvider,
} from '../contracts/types';
import { ModelRuntimeError } from '../utils/errors';
import { isOnline } from '@/services/connectivity/connectivity';
import type { AppErrorCode } from '@/lib/app-errors';
import axios from 'axios';

export const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';

interface ServerStatusResponse {
  available: boolean;
  provider: string;
  model: string;
  configured: boolean;
}

interface ServerAnalyzeResponse {
  success: boolean;
  inference: InferenceResult;
  limitations?: string[];
  qualityVerdict?: string;
  error?: {
    code: string;
    message: string;
    status: number;
    details?: string;
  };
}

export class GeminiVisionProvider implements VisionModelProvider {
  readonly kind = 'gemini' as const;
  private cancelLoadController: AbortController | null = null;

  async checkCapabilities(): Promise<CapabilityReport> {
    return {
      webgpu: false,
      wasm: false,
      cacheApi: typeof caches !== 'undefined',
      secureContext: typeof window !== 'undefined' ? window.isSecureContext : true,
      unsupportedReason: null,
    };
  }

  async getStatus(_manifest: string[] | null): Promise<{ cached: boolean; device: InferenceDevice | null }> {
    const online = isOnline();
    return { cached: online, device: null };
  }

  async load(onProgress: (progress: ModelProgress) => void): Promise<{
    device: InferenceDevice;
    manifest: string[];
    missing: string[];
  }> {
    if (!isOnline()) {
      throw new ModelRuntimeError({
        code: 'OFFLINE_MODEL_UNAVAILABLE',
        message: 'You are offline. Google Gemini cloud analysis requires an active internet connection.',
      });
    }

    onProgress({
      percent: 50,
      loadedBytes: 50,
      totalBytes: 100,
      file: 'Checking AI service connectivity...',
      phase: 'download',
    });

    const controller = new AbortController();
    this.cancelLoadController = controller;

    try {
      const res = await apiClient.get<ServerStatusResponse>('/ai/status', {
        signal: controller.signal,
      });

      const data = res.data;
      if (!data.configured) {
        throw new ModelRuntimeError({
          code: 'AI_NOT_CONFIGURED',
          message:
            'The backend server is running, but GEMINI_API_KEY is not configured. Please set the API key in the server .env.',
        });
      }

      onProgress({
        percent: 100,
        loadedBytes: 100,
        totalBytes: 100,
        file: 'Gemini service ready',
        phase: 'initialize',
      });

      return {
        device: null as unknown as InferenceDevice,
        manifest: ['gemini-cloud-service'],
        missing: [],
      };
    } catch (err: unknown) {
      if (err instanceof ModelRuntimeError) throw err;
      if (axios.isCancel(err) || (err instanceof Error && err.name === 'AbortError')) {
        throw new ModelRuntimeError({ code: 'REQUEST_CANCELLED', message: 'Connection cancelled.' });
      }

      throw new ModelRuntimeError({
        code: 'AI_SERVICE_UNAVAILABLE',
        message:
          'Could not reach the Gemini backend API. Please make sure the Express server is running on the configured port.',
      });
    } finally {
      this.cancelLoadController = null;
    }
  }

  async cancelLoad(): Promise<void> {
    this.cancelLoadController?.abort();
  }

  async analyze(input: PlantImageInput, options: AnalyzeOptions = {}): Promise<InferenceResult> {
    if (!isOnline()) {
      throw new ModelRuntimeError({
        code: 'OFFLINE_MODEL_UNAVAILABLE',
        message: 'Cannot run cloud scan while offline. Connect to the internet or save this photo to scan later.',
      });
    }

    options.onStep?.({ index: 0, total: 4, label: 'Preparing image securely...' });

    const formData = new FormData();
    formData.append('image', input.image, 'plant.jpg');
    if (input.context && input.context.trim()) {
      formData.append('context', input.context.trim());
    }

    options.onStep?.({ index: 1, total: 4, label: 'Uploading to Gemini backend...' });

    let data: ServerAnalyzeResponse;
    try {
      const response = await apiClient.post<ServerAnalyzeResponse>('/ai/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: options.signal,
      });
      data = response.data;
    } catch (err: unknown) {
      if (axios.isCancel(err) || (err instanceof Error && err.name === 'AbortError')) {
        throw new ModelRuntimeError({ code: 'REQUEST_CANCELLED', message: 'Analysis cancelled.' });
      }

      if (axios.isAxiosError(err) && err.response?.data) {
        const errorData = err.response.data as ServerAnalyzeResponse;
        const serverCode = errorData.error?.code as AppErrorCode | undefined;
        const validCodes: AppErrorCode[] = [
          'AI_NOT_CONFIGURED',
          'AI_QUOTA_EXCEEDED',
          'AI_TIMEOUT',
          'AI_RATE_LIMITED',
          'AI_PROVIDER_ERROR',
          'AI_SERVICE_UNAVAILABLE',
          'INVALID_IMAGE',
          'IMAGE_TOO_LARGE',
          'IMAGE_TOO_SMALL',
        ];

        const mappedCode: AppErrorCode =
          serverCode && validCodes.includes(serverCode)
            ? serverCode
            : 'AI_PROVIDER_ERROR';

        throw new ModelRuntimeError({
          code: mappedCode,
          message:
            errorData.error?.message ||
            'Failed to analyze plant image with Gemini. Please try again.',
        });
      }

      throw new ModelRuntimeError({
        code: 'AI_SERVICE_UNAVAILABLE',
        message:
          'Failed to reach the AI backend service. Please check your internet connection or verify the server is running.',
      });
    }

    options.onStep?.({ index: 2, total: 4, label: 'Analyzing with Google Gemini...' });

    if (!data.success || !data.inference) {
      throw new ModelRuntimeError({
        code: 'AI_PROVIDER_ERROR',
        message: 'Invalid response received from the Gemini backend.',
      });
    }

    options.onStep?.({ index: 3, total: 4, label: 'Finalizing diagnosis...' });

    return data.inference;
  }

  async deleteCache(): Promise<{ deletedFiles: number }> {
    return { deletedFiles: 0 };
  }

  async dispose(): Promise<void> {
    this.cancelLoadController?.abort();
  }
}
