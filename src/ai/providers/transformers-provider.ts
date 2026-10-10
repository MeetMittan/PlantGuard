import type {
  AnalyzeOptions,
  CapabilityReport,
  InferenceDevice,
  InferenceResult,
  ModelError,
  ModelProgress,
  PlantImageInput,
  VisionModelProvider,
} from '../contracts/types';
import {
  TERMINAL_RESPONSES,
  type WorkerAnalysisResult,
  type WorkerCapabilities,
  type WorkerModelConfig,
  type WorkerModelStatus,
  type WorkerRequest,
  type WorkerResponse,
} from '../contracts/worker-protocol';
import { PROMPT_VERSION } from '../prompts/plant-analysis';
import { ModelRuntimeError } from '../utils/errors';

type RequestBody = WorkerRequest extends infer R ? (R extends WorkerRequest ? Omit<R, 'requestId'> : never) : never;

interface Pending {
  resolve: (response: WorkerResponse) => void;
  reject: (error: ModelRuntimeError) => void;
  onMessage?: (response: WorkerResponse) => void;
}

/**
 * Main-thread proxy for vision.worker.ts. Runs a real open-weight
 * vision-language model locally via Transformers.js + ONNX Runtime Web.
 * Images never leave the device: the worker only fetches model files.
 */
export class TransformersVisionProvider implements VisionModelProvider {
  readonly kind = 'transformersjs' as const;
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor(
    private readonly config: WorkerModelConfig,
    private readonly createWorker: () => Worker = () =>
      new Worker(new URL('../workers/vision.worker.ts', import.meta.url), { type: 'module', name: 'plantguard-vision' }),
  ) {}

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => this.handle(event.data));
    worker.addEventListener('error', (event) => {
      // A crashed worker (e.g. killed for memory) rejects everything in flight.
      this.failAll({
        code: 'OUT_OF_MEMORY',
        message: `The AI worker stopped unexpectedly${event.message ? ` (${event.message})` : ''}. Reload the page and try again, or use the lite model.`,
      });
      this.worker = null;
    });
    this.worker = worker;
    return worker;
  }

  private handle(response: WorkerResponse) {
    const pending = this.pending.get(response.requestId);
    if (!pending) return; // Stale response from a terminated or finished request.
    if (!TERMINAL_RESPONSES.has(response.type)) {
      pending.onMessage?.(response);
      return;
    }
    this.pending.delete(response.requestId);
    if (response.type === 'ERROR') pending.reject(new ModelRuntimeError(response.error));
    else if (response.type === 'REQUEST_CANCELLED') pending.reject(new ModelRuntimeError({ code: 'REQUEST_CANCELLED', message: 'Cancelled.' }));
    else pending.resolve(response);
  }

  private failAll(error: ModelError) {
    for (const pending of this.pending.values()) pending.reject(new ModelRuntimeError(error));
    this.pending.clear();
  }

  private send(body: RequestBody, onMessage?: (response: WorkerResponse) => void): { requestId: number; done: Promise<WorkerResponse> } {
    const worker = this.ensureWorker();
    const requestId = this.nextId++;
    const done = new Promise<WorkerResponse>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject, ...(onMessage ? { onMessage } : {}) });
    });
    worker.postMessage({ ...body, requestId } as WorkerRequest);
    return { requestId, done };
  }

  async checkCapabilities(): Promise<CapabilityReport> {
    const secureContext = typeof window === 'undefined' || window.isSecureContext !== false;
    if (typeof Worker === 'undefined') {
      return { webgpu: false, wasm: false, cacheApi: false, secureContext, unsupportedReason: 'This browser does not support Web Workers.' };
    }
    const response = await this.send({ type: 'CHECK_CAPABILITIES' }).done;
    const caps = (response as { capabilities: WorkerCapabilities }).capabilities;
    let unsupportedReason: string | null = null;
    if (!caps.wasm) unsupportedReason = 'This browser does not support WebAssembly, which the model needs.';
    else if (!caps.cacheApi || !secureContext)
      unsupportedReason = 'Model storage needs a secure (HTTPS) connection and the Cache API, which are unavailable here.';
    return { ...caps, secureContext, unsupportedReason };
  }

  async getStatus(manifest: string[] | null): Promise<{ cached: boolean; device: InferenceDevice | null }> {
    const response = await this.send({ type: 'CHECK_MODEL_STATUS', config: this.config, manifest }).done;
    const { cached, device } = (response as { status: WorkerModelStatus }).status;
    return { cached, device };
  }

  async load(onProgress: (progress: ModelProgress) => void): Promise<{ device: InferenceDevice; manifest: string[]; missing: string[] }> {
    const response = await this.send({ type: 'INITIALIZE_MODEL', config: this.config }, (message) => {
      if (message.type === 'DOWNLOAD_PROGRESS' || message.type === 'INITIALIZATION_PROGRESS') onProgress(message.progress);
    }).done;
    const ready = response as { device: InferenceDevice; manifest: string[]; missing: string[] };
    return { device: ready.device, manifest: ready.manifest, missing: ready.missing };
  }

  /**
   * Download cancellation: Transformers.js has no abort API for downloads, so
   * the worker is terminated. Files fully downloaded so far stay in the cache
   * (partial files are never written), so a retry resumes with what remains.
   */
  async cancelLoad(): Promise<void> {
    this.worker?.terminate();
    this.worker = null;
    this.failAll({ code: 'REQUEST_CANCELLED', message: 'Download cancelled.' });
  }

  async analyze(input: PlantImageInput, options: AnalyzeOptions = {}): Promise<InferenceResult> {
    const { signal, onStep } = options;
    if (signal?.aborted) throw new ModelRuntimeError({ code: 'REQUEST_CANCELLED', message: 'Analysis cancelled.' });
    const request = this.send({ type: 'ANALYZE_IMAGE', image: input.image, context: input.context }, (message) => {
      if (message.type === 'ANALYSIS_PROGRESS') onStep?.(message.step);
    });
    const onAbort = () => void this.send({ type: 'CANCEL_REQUEST', targetRequestId: request.requestId }).done.catch(() => undefined);
    signal?.addEventListener('abort', onAbort);
    try {
      const response = await request.done;
      const result = (response as { result: WorkerAnalysisResult }).result;
      return {
        answers: result.answers,
        inferenceMs: result.inferenceMs,
        device: result.device,
        modelId: this.config.modelId,
        modelRevision: this.config.revision,
        promptVersion: PROMPT_VERSION,
        provider: 'transformersjs',
      };
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async deleteCache(): Promise<{ deletedFiles: number }> {
    const response = await this.send({ type: 'DELETE_MODEL_CACHE', config: this.config }).done;
    return { deletedFiles: (response as { deletedFiles: number }).deletedFiles };
  }

  async dispose(): Promise<void> {
    if (!this.worker) return;
    await this.send({ type: 'DISPOSE_MODEL' }).done.catch(() => undefined);
    this.worker?.terminate();
    this.worker = null;
  }
}
