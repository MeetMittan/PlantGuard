import { ERROR_CATALOGUE, type AppErrorCode } from '@/lib/app-errors';
import type { ModelError } from '../contracts/types';

/**
 * Maps raw runtime errors (ONNX Runtime, fetch, Cache API, worker) to stable
 * application error codes. `phase` decides the fallback code.
 */
export function classifyModelError(error: unknown, phase: 'load' | 'inference' = 'load'): ModelError {
  if (error instanceof ModelRuntimeError) return error.detail;
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const text = raw.toLowerCase();

  let code: AppErrorCode = phase === 'load' ? 'MODEL_INITIALIZATION_FAILED' : 'INFERENCE_FAILED';
  if (text.includes('aborterror') || text.includes('cancel')) code = 'REQUEST_CANCELLED';
  else if (text.includes('not found locally') || text.includes('allowremotemodels=false')) code = 'MODEL_ASSETS_MISSING';
  else if (text.includes('quotaexceeded') || text.includes('quota') || text.includes('no space')) code = 'INSUFFICIENT_STORAGE';
  else if (
    text.includes('out of memory') ||
    text.includes('bad_alloc') ||
    text.includes('array buffer allocation') ||
    text.includes('memory access out of bounds') ||
    text.includes('rangeerror')
  )
    code = 'OUT_OF_MEMORY';
  else if (
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('network error') ||
    text.includes('load failed') ||
    text.includes('err_internet') ||
    text.includes('could not locate file')
  )
    code = typeof navigator !== 'undefined' && navigator.onLine === false ? 'OFFLINE_MODEL_UNAVAILABLE' : 'MODEL_DOWNLOAD_FAILED';
  else if (text.includes('webgpu') && (text.includes('not supported') || text.includes('adapter'))) code = 'MODEL_UNSUPPORTED';

  const known = code !== 'MODEL_INITIALIZATION_FAILED' && code !== 'INFERENCE_FAILED';
  return {
    code,
    message: known ? ERROR_CATALOGUE[code].message : `${ERROR_CATALOGUE[code].message} (${raw.slice(0, 200)})`,
  };
}

/** Error carrying a classified ModelError (e.g. across the worker boundary). */
export class ModelRuntimeError extends Error {
  constructor(public readonly detail: ModelError) {
    super(detail.message);
    this.name = 'ModelRuntimeError';
  }
}
