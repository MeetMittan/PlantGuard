import type { DtypeMap } from '../model-manager/presets';
import type { AnswerSet } from '../utils/parse-answers';
import type { AnalysisStepProgress, InferenceDevice, ModelError, ModelProgress } from './types';

/**
 * Typed message protocol between TransformersVisionProvider (main thread) and
 * vision.worker.ts. Every request carries a `requestId`; every response echoes
 * it, so a result from an old or cancelled request can never be mistaken for
 * a newer one. Progress messages exist only for stages the runtime can measure.
 */

export interface WorkerModelConfig {
  modelId: string;
  revision: string;
  dtype: DtypeMap;
  remoteHost: string;
  wasmBaseUrl: string | null;
  devicePreference: 'auto' | 'webgpu' | 'wasm';
}

export type WorkerRequest =
  | { requestId: number; type: 'CHECK_CAPABILITIES' }
  | { requestId: number; type: 'CHECK_MODEL_STATUS'; config: WorkerModelConfig; manifest: string[] | null }
  | { requestId: number; type: 'INITIALIZE_MODEL'; config: WorkerModelConfig }
  | { requestId: number; type: 'ANALYZE_IMAGE'; image: Blob; context: string }
  | { requestId: number; type: 'CANCEL_REQUEST'; targetRequestId: number }
  | { requestId: number; type: 'DELETE_MODEL_CACHE'; config: WorkerModelConfig }
  | { requestId: number; type: 'DISPOSE_MODEL' };

export interface WorkerCapabilities {
  webgpu: boolean;
  wasm: boolean;
  cacheApi: boolean;
}

export interface WorkerModelStatus {
  cached: boolean;
  device: InferenceDevice | null;
  initialized: boolean;
}

export interface WorkerAnalysisResult {
  answers: AnswerSet;
  inferenceMs: number;
  device: InferenceDevice;
}

export type WorkerResponse =
  | { requestId: number; type: 'CAPABILITIES'; capabilities: WorkerCapabilities }
  | { requestId: number; type: 'MODEL_STATUS'; status: WorkerModelStatus }
  | { requestId: number; type: 'DOWNLOAD_PROGRESS'; progress: ModelProgress }
  | { requestId: number; type: 'INITIALIZATION_PROGRESS'; progress: ModelProgress }
  | { requestId: number; type: 'MODEL_READY'; device: InferenceDevice; manifest: string[]; missing: string[] }
  | { requestId: number; type: 'ANALYSIS_PROGRESS'; step: AnalysisStepProgress }
  | { requestId: number; type: 'ANALYSIS_RESULT'; result: WorkerAnalysisResult }
  | { requestId: number; type: 'REQUEST_CANCELLED' }
  | { requestId: number; type: 'CACHE_DELETED'; deletedFiles: number }
  | { requestId: number; type: 'DISPOSED' }
  | { requestId: number; type: 'ERROR'; error: ModelError };

/** Response types that end a request (anything else is intermediate progress). */
export const TERMINAL_RESPONSES = new Set<WorkerResponse['type']>([
  'CAPABILITIES',
  'MODEL_STATUS',
  'MODEL_READY',
  'ANALYSIS_RESULT',
  'REQUEST_CANCELLED',
  'CACHE_DELETED',
  'DISPOSED',
  'ERROR',
]);
