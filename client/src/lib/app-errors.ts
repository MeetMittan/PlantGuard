/**
 * Stable application error codes with user-safe messages and recovery actions.
 * UI code switches on `code`, never on message text.
 */
export const APP_ERROR_CODES = [
  'MODEL_NOT_DOWNLOADED',
  'MODEL_ASSETS_MISSING',
  'MODEL_DOWNLOAD_FAILED',
  'MODEL_UNSUPPORTED',
  'MODEL_INITIALIZATION_FAILED',
  'MODEL_BUSY',
  'OUT_OF_MEMORY',
  'INSUFFICIENT_STORAGE',
  'OFFLINE_MODEL_UNAVAILABLE',
  'INFERENCE_FAILED',
  'RESULT_VALIDATION_FAILED',
  'REQUEST_CANCELLED',
  'INVALID_IMAGE',
  'IMAGE_TOO_LARGE',
  'IMAGE_TOO_SMALL',
  'IMAGE_PREPARATION_FAILED',
  'DATABASE_WRITE_FAILED',
  'CONFIGURATION_INVALID',
  'AI_NOT_CONFIGURED',
  'AI_QUOTA_EXCEEDED',
  'AI_TIMEOUT',
  'AI_RATE_LIMITED',
  'AI_PROVIDER_ERROR',
  'AI_SERVICE_UNAVAILABLE',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export type RecoveryAction =
  | 'download-model'
  | 'retry'
  | 'retake-photo'
  | 'free-storage'
  | 'use-lite-model'
  | 'use-cpu'
  | 'go-online'
  | 'none';

interface CatalogueEntry {
  message: string;
  recovery: RecoveryAction;
}

export const ERROR_CATALOGUE: Record<AppErrorCode, CatalogueEntry> = {
  MODEL_NOT_DOWNLOADED: { message: 'The AI model has not been downloaded yet. Download it once while you are online.', recovery: 'download-model' },
  MODEL_ASSETS_MISSING: {
    message: 'Some model files are missing from this browser (it may have cleared storage). Download the model again to repair it.',
    recovery: 'download-model',
  },
  MODEL_DOWNLOAD_FAILED: {
    message: 'The model files could not be downloaded. Check your connection and try again — files that finished downloading are kept.',
    recovery: 'retry',
  },
  MODEL_UNSUPPORTED: {
    message: 'This device or browser cannot run the model with the selected acceleration. Try CPU mode in Settings.',
    recovery: 'use-cpu',
  },
  MODEL_INITIALIZATION_FAILED: { message: 'The model could not be started. Try again, or reload the page.', recovery: 'retry' },
  MODEL_BUSY: { message: 'The model is busy with another task. Wait for it to finish.', recovery: 'none' },
  OUT_OF_MEMORY: {
    message: 'Your device ran out of memory while running the model. Close other tabs or apps, or switch to the lite model.',
    recovery: 'use-lite-model',
  },
  INSUFFICIENT_STORAGE: {
    message: 'There is not enough storage space. Free up space on the device or choose the lite model. Your observations are never deleted to make room.',
    recovery: 'free-storage',
  },
  OFFLINE_MODEL_UNAVAILABLE: {
    message: 'You are offline and the model is not stored on this device. Connect to the internet once to download it.',
    recovery: 'go-online',
  },
  INFERENCE_FAILED: { message: 'The analysis failed. Your photo is kept — try again.', recovery: 'retry' },
  RESULT_VALIDATION_FAILED: {
    message: 'The model’s answers could not be turned into a reliable result. Try again with a clearer photo.',
    recovery: 'retake-photo',
  },
  REQUEST_CANCELLED: { message: 'Cancelled.', recovery: 'none' },
  INVALID_IMAGE: { message: 'This file could not be used as a photo. Choose a JPEG, PNG or WebP image.', recovery: 'retake-photo' },
  IMAGE_TOO_LARGE: { message: 'This photo is larger than 25 MB. Choose a smaller image.', recovery: 'retake-photo' },
  IMAGE_TOO_SMALL: { message: 'This photo is too small to show leaf details. Use a larger photo.', recovery: 'retake-photo' },
  IMAGE_PREPARATION_FAILED: { message: 'The photo could not be prepared for analysis. Try another photo.', recovery: 'retake-photo' },
  DATABASE_WRITE_FAILED: {
    message: 'Saving failed. Your result is still here — try saving again. If storage is full, free up space first.',
    recovery: 'retry',
  },
  CONFIGURATION_INVALID: { message: 'The app configuration is invalid.', recovery: 'none' },
  AI_NOT_CONFIGURED: {
    message: 'The Gemini AI service is not configured on the server. Set GEMINI_API_KEY in the server environment.',
    recovery: 'none',
  },
  AI_QUOTA_EXCEEDED: {
    message: 'Gemini request quota exceeded. Please wait a moment and try again.',
    recovery: 'retry',
  },
  AI_TIMEOUT: {
    message: 'The request to Gemini timed out. Please check your connection and try again.',
    recovery: 'retry',
  },
  AI_RATE_LIMITED: {
    message: 'Scan rate limit reached. Please wait a few minutes before trying another scan.',
    recovery: 'none',
  },
  AI_PROVIDER_ERROR: {
    message: 'The Gemini AI provider encountered an error. Please try again.',
    recovery: 'retry',
  },
  AI_SERVICE_UNAVAILABLE: {
    message: 'The AI backend service is currently unreachable. Make sure the server is running and internet is connected.',
    recovery: 'retry',
  },
};

export interface AppErrorShape {
  code: AppErrorCode;
  message: string;
}

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string = ERROR_CATALOGUE[code].message,
  ) {
    super(message);
    this.name = 'AppError';
  }

  get recovery(): RecoveryAction {
    return ERROR_CATALOGUE[this.code].recovery;
  }
}

export function isQuotaError(error: unknown): boolean {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  return name === 'QuotaExceededError' || /quota/i.test(message) || /QuotaExceeded/.test(message);
}

/** Wraps an IndexedDB write failure in a coded error (quota-aware). */
export function toWriteError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError(isQuotaError(error) ? 'INSUFFICIENT_STORAGE' : 'DATABASE_WRITE_FAILED');
}
