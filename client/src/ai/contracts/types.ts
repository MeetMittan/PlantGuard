import type { AppErrorCode } from '@/lib/app-errors';
import type { AnswerSet } from '../utils/parse-answers';

export type ModelState =
  | 'checking'
  | 'not-downloaded'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'running'
  | 'offline-unavailable'
  | 'unsupported'
  | 'error';

export type InferenceDevice = 'webgpu' | 'wasm';

export interface ModelError {
  code: AppErrorCode;
  message: string;
}

export interface ModelProgress {
  /** 0–100 when the runtime reports total bytes; null when unknown. */
  percent: number | null;
  loadedBytes: number | null;
  totalBytes: number | null;
  /** File currently being fetched, when known. */
  file: string | null;
  /** download = fetching files; initialize = creating inference sessions (no byte progress exists). */
  phase: 'download' | 'initialize';
}

export interface PlantImageInput {
  /** Resized, EXIF-free image. */
  image: Blob;
  /** Optional user-supplied context, e.g. "tomato in a pot, spots appeared last week". */
  context: string;
}

export interface AnalysisStepProgress {
  index: number;
  total: number;
  label: string;
}

export interface AnalyzeOptions {
  signal?: AbortSignal;
  onStep?: (step: AnalysisStepProgress) => void;
}

/** Typed output of one inference request: raw answers + traceability metadata. */
export interface InferenceResult {
  answers: AnswerSet;
  modelId: string;
  modelRevision: string | null;
  promptVersion: string;
  provider: 'transformersjs' | 'demo' | 'gemini';
  device: InferenceDevice | null;
  inferenceMs: number;
}

export interface CapabilityReport {
  webgpu: boolean;
  wasm: boolean;
  cacheApi: boolean;
  secureContext: boolean;
  /** Reason the device cannot run the model, when it cannot. */
  unsupportedReason: string | null;
}

/**
 * Provider abstraction used by VisionModelManager. Implementations must never
 * fabricate a result: failures reject with a coded ModelRuntimeError.
 */
export interface VisionModelProvider {
  readonly kind: 'transformersjs' | 'demo' | 'gemini';
  checkCapabilities(): Promise<CapabilityReport>;
  /**
   * Verifies, without any network access, that every entry of the asset manifest
   * recorded at the last successful initialization is still in the cache.
   * A null/empty manifest means the model was never verified on this device.
   */
  getStatus(manifest: string[] | null): Promise<{ cached: boolean; device: InferenceDevice | null }>;
  /**
   * Downloads (if needed) and initializes the model. Returns the asset manifest
   * (cache entries this model needs) and any expected files missing from the cache.
   */
  load(onProgress: (progress: ModelProgress) => void): Promise<{ device: InferenceDevice; manifest: string[]; missing: string[] }>;
  /** Aborts an in-flight download/initialization. Already-cached files remain. */
  cancelLoad(): Promise<void>;
  analyze(input: PlantImageInput, options?: AnalyzeOptions): Promise<InferenceResult>;
  /** Removes this model's files from the browser cache. */
  deleteCache(): Promise<{ deletedFiles: number }>;
  dispose(): Promise<void>;
}
