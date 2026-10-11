/// <reference lib="webworker" />
/**
 * Dedicated Web Worker for model download, initialization and inference.
 * Keeps ONNX Runtime work off the UI thread.
 *
 * Transformers.js caches every downloaded file (model weights and the ONNX
 * Runtime WASM binary) in the Cache API bucket "transformers-cache". The app's
 * service worker deliberately does not duplicate these files.
 */
import {
  AutoModelForImageTextToText,
  AutoProcessor,
  InterruptableStoppingCriteria,
  RawImage,
  env,
  type PreTrainedModel,
  type Processor,
  type ProgressInfo,
} from '@huggingface/transformers';
import type { InferenceDevice, ModelProgress } from '../contracts/types';
import type { WorkerCapabilities, WorkerModelConfig, WorkerRequest, WorkerResponse } from '../contracts/worker-protocol';
import { classifyModelError } from '../utils/errors';
import { runAnalysis } from '../utils/run-analysis';

declare const self: DedicatedWorkerGlobalScope;

interface LoadedModel {
  key: string;
  model: PreTrainedModel;
  processor: Processor;
  device: InferenceDevice;
}

let loaded: LoadedModel | null = null;
/** Shared in-flight initialization so concurrent requests never load two copies. */
let loading: { key: string; promise: Promise<LoadedModel> } | null = null;
/** The single analysis allowed at a time. */
let activeAnalysis: { requestId: number; cancelled: boolean } | null = null;
const stopping = new InterruptableStoppingCriteria();

const post = (message: WorkerResponse) => self.postMessage(message);
const configKey = (config: WorkerModelConfig) => `${config.modelId}@${config.revision}:${JSON.stringify(config.dtype)}`;
const defaultRuntimePaths = env.backends.onnx.wasm?.wasmPaths;
const defaultRuntimeUrls = typeof defaultRuntimePaths === 'object'
  ? Object.values(defaultRuntimePaths).filter((url): url is string => typeof url === 'string') : [];
let requiredRuntimeUrls = defaultRuntimeUrls;

function configureEnv(config: WorkerModelConfig) {
  env.allowLocalModels = false;
  // Offline: serve strictly from the cache so a missing file fails fast with a clear
  // "not found locally" error (mapped to MODEL_ASSETS_MISSING) instead of a fetch error.
  env.allowRemoteModels = navigator.onLine !== false;
  env.remoteHost = config.remoteHost;
  // Transformers.js 4.3.1 probes tokenizer metadata without forwarding the
  // revision. Pin the URL template too, so those probes use the same assets
  // as the actual tokenizer and continue to work after an offline reload.
  env.remotePathTemplate = `{model}/resolve/${encodeURIComponent(config.revision)}/`;
  env.useBrowserCache = true;
  env.useWasmCache = true;
  requiredRuntimeUrls = config.wasmBaseUrl
    ? ['mjs', 'wasm'].map((extension) => `${config.wasmBaseUrl!.replace(/\/$/, '')}/ort-wasm-simd-threaded.asyncify.${extension}`)
    : defaultRuntimeUrls;
  if (config.wasmBaseUrl && env.backends.onnx.wasm) {
    const base = config.wasmBaseUrl.endsWith('/') ? config.wasmBaseUrl : `${config.wasmBaseUrl}/`;
    env.backends.onnx.wasm.wasmPaths = {
      mjs: `${base}ort-wasm-simd-threaded.asyncify.mjs`,
      wasm: `${base}ort-wasm-simd-threaded.asyncify.wasm`,
    };
  }
}

async function hasWebGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

async function capabilities(): Promise<WorkerCapabilities> {
  return { webgpu: await hasWebGpu(), wasm: typeof WebAssembly === 'object', cacheApi: typeof caches !== 'undefined' };
}

async function pickDevice(preference: WorkerModelConfig['devicePreference']): Promise<InferenceDevice> {
  if (preference === 'wasm') return 'wasm';
  const gpu = await hasWebGpu();
  if (preference === 'webgpu' && !gpu) throw new Error('WebGPU adapter not supported on this device.');
  return gpu ? 'webgpu' : 'wasm';
}

const CACHE_NAME = 'transformers-cache';
const DTYPE_SUFFIX: Record<string, string> = { fp32: '', fp16: '_fp16', q8: '_quantized', int8: '_int8', uint8: '_uint8', q4: '_q4', bnb4: '_bnb4', q4f16: '_q4f16' };

/** URL prefix under which Transformers.js caches this model revision's files. */
const revisionPrefix = (config: WorkerModelConfig) => `${config.remoteHost}${config.modelId}/resolve/${config.revision}/`;
const expectedModelFiles = (config: WorkerModelConfig) => {
  const prefix = revisionPrefix(config);
  return [
    ...Object.entries(config.dtype).map(([component, dtype]) => `${prefix}onnx/${component}${DTYPE_SUFFIX[dtype] ?? ''}.onnx`),
    ...['config.json', 'tokenizer.json', 'tokenizer_config.json', 'preprocessor_config.json', 'processor_config.json'].map((file) => `${prefix}${file}`),
    ...requiredRuntimeUrls,
  ];
};

/**
 * Asset manifest: every cache entry this model revision uses (config, tokenizer,
 * processor and ONNX files) plus the ONNX Runtime WASM files. Built right after a
 * successful initialization, when all of them have just been read from the cache.
 *
 * Why not ModelRegistry.is_cached? In Transformers.js 4.3.1 it resolves the file
 * list for the "main" revision and issues network requests for tokenizer and
 * processor metadata, so it reports pinned-revision models as missing offline.
 */
async function buildManifest(config: WorkerModelConfig): Promise<{ manifest: string[]; missing: string[] }> {
  if (typeof caches === 'undefined') return { manifest: [], missing: ['Cache API unavailable'] };
  const cache = await caches.open(CACHE_NAME);
  const urls = (await cache.keys()).map((request) => request.url);
  const prefix = revisionPrefix(config);
  const manifest = urls.filter((url) => url.startsWith(prefix) || requiredRuntimeUrls.includes(url));
  const missing = expectedModelFiles(config).filter((url) => !manifest.includes(url));
  return { manifest, missing };
}

/** Network-free readiness check: every manifest entry must still be in the cache. */
async function modelStatus(config: WorkerModelConfig, manifest: string[] | null) {
  configureEnv(config);
  const device = await pickDevice(config.devicePreference).catch(() => null);
  let cached = false;
  if (manifest?.length && expectedModelFiles(config).every((url) => manifest.includes(url)) && typeof caches !== 'undefined') {
    const cache = await caches.open(CACHE_NAME);
    const hits = await Promise.all(manifest.map((url) => cache.match(url).then(Boolean, () => false)));
    cached = hits.every(Boolean);
  }
  return { cached, device, initialized: loaded?.key === configKey(config) };
}

/** Deletes exactly this model revision's cached files (the shared ORT runtime is kept). */
async function deleteModelFiles(config: WorkerModelConfig): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  const cache = await caches.open(CACHE_NAME);
  const prefix = revisionPrefix(config);
  const targets = (await cache.keys()).filter((request) => request.url.startsWith(prefix));
  const results = await Promise.all(targets.map((request) => cache.delete(request)));
  return results.filter(Boolean).length;
}

async function loadWithDevice(config: WorkerModelConfig, device: InferenceDevice, requestId: number) {
  const progress_callback = (info: ProgressInfo) => {
    if (info.status === 'progress_total') {
      post({
        requestId,
        type: 'DOWNLOAD_PROGRESS',
        progress: {
          percent: Number.isFinite(info.progress) ? info.progress : null,
          loadedBytes: info.loaded,
          totalBytes: info.total,
          file: null,
          phase: 'download',
        },
      });
    }
  };
  const processor = await AutoProcessor.from_pretrained(config.modelId, { revision: config.revision, progress_callback });
  // Session creation has no measurable progress; report the phase change only.
  const initializing: ModelProgress = { percent: null, loadedBytes: null, totalBytes: null, file: null, phase: 'initialize' };
  const model = await AutoModelForImageTextToText.from_pretrained(config.modelId, {
    revision: config.revision,
    dtype: config.dtype,
    device,
    progress_callback: (info: ProgressInfo) => {
      progress_callback(info);
      if (info.status === 'done' && info.file.endsWith('.onnx')) post({ requestId, type: 'INITIALIZATION_PROGRESS', progress: initializing });
    },
  });
  return { model, processor };
}

function initialize(config: WorkerModelConfig, requestId: number): Promise<LoadedModel> {
  const key = configKey(config);
  if (loaded?.key === key) return Promise.resolve(loaded);
  if (loading?.key === key) return loading.promise;

  const promise = (async () => {
    configureEnv(config);
    if (loaded) {
      await loaded.model.dispose();
      loaded = null;
    }
    const device = await pickDevice(config.devicePreference);
    try {
      loaded = { key, ...(await loadWithDevice(config, device, requestId)), device };
    } catch (error) {
      // WebGPU session creation can fail on some drivers/ops; the same files work on WASM,
      // so retry once on CPU when the user did not explicitly force WebGPU.
      const code = classifyModelError(error).code;
      if (device === 'webgpu' && config.devicePreference === 'auto' && code !== 'MODEL_DOWNLOAD_FAILED' && code !== 'OFFLINE_MODEL_UNAVAILABLE') {
        loaded = { key, ...(await loadWithDevice(config, 'wasm', requestId)), device: 'wasm' };
      } else {
        throw error;
      }
    }
    return loaded;
  })();
  loading = { key, promise };
  return promise.finally(() => {
    if (loading?.promise === promise) loading = null;
  });
}

async function analyze(requestId: number, imageBlob: Blob, context: string) {
  if (!loaded) throw Object.assign(new Error('Model not initialized.'), { name: 'NotInitialized' });
  const { model, processor, device } = loaded;
  const state = { requestId, cancelled: false };
  activeAnalysis = state;
  stopping.reset();
  try {
    // Decode once; every question reuses the same image tensor input.
    const image = await RawImage.fromBlob(imageBlob);
    const { answers, inferenceMs } = await runAnalysis({
      context,
      isCancelled: () => state.cancelled,
      onStep: (step) => post({ requestId, type: 'ANALYSIS_PROGRESS', step }),
      generate: async (prompt, maxNewTokens) => {
        const messages = [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: prompt }] }];
        const chat = processor.apply_chat_template(messages as never, { add_generation_prompt: true });
        // A single global image tile (no splitting) keeps memory and latency practical on phones.
        const inputs = await processor(chat, [image], { do_image_splitting: false });
        const started = performance.now();
        const output = (await model.generate({
          ...inputs,
          max_new_tokens: maxNewTokens,
          do_sample: false,
          repetition_penalty: 1.1,
          stopping_criteria: [stopping],
        })) as { dims: number[]; slice: (...args: unknown[]) => unknown };
        const promptLength = (inputs.input_ids as { dims: number[] }).dims.at(-1) ?? 0;
        const generated = Math.max(0, (output.dims.at(-1) ?? promptLength) - promptLength);
        const [text = ''] = processor.batch_decode(output.slice(null, [promptLength, null]) as never, { skip_special_tokens: true });
        return { text, hitTokenLimit: generated >= maxNewTokens, interrupted: stopping.interrupted, inferenceMs: Math.round(performance.now() - started) };
      },
    });
    return { answers, inferenceMs, device };
  } finally {
    if (activeAnalysis === state) activeAnalysis = null;
  }
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  const { requestId } = message;
  try {
    switch (message.type) {
      case 'CHECK_CAPABILITIES':
        post({ requestId, type: 'CAPABILITIES', capabilities: await capabilities() });
        break;
      case 'CHECK_MODEL_STATUS':
        post({ requestId, type: 'MODEL_STATUS', status: await modelStatus(message.config, message.manifest) });
        break;
      case 'INITIALIZE_MODEL': {
        const result = await initialize(message.config, requestId);
        const { manifest, missing } = await buildManifest(message.config);
        post({ requestId, type: 'MODEL_READY', device: result.device, manifest, missing });
        break;
      }
      case 'ANALYZE_IMAGE':
        if (activeAnalysis) {
          post({ requestId, type: 'ERROR', error: { code: 'MODEL_BUSY', message: 'Another analysis is already running.' } });
          break;
        }
        post({ requestId, type: 'ANALYSIS_RESULT', result: await analyze(requestId, message.image, message.context) });
        break;
      case 'CANCEL_REQUEST':
        if (activeAnalysis?.requestId === message.targetRequestId) {
          activeAnalysis.cancelled = true;
          stopping.interrupt();
        }
        post({ requestId, type: 'REQUEST_CANCELLED' });
        break;
      case 'DELETE_MODEL_CACHE': {
        configureEnv(message.config);
        if (loaded?.key === configKey(message.config)) {
          await loaded.model.dispose();
          loaded = null;
        }
        post({ requestId, type: 'CACHE_DELETED', deletedFiles: await deleteModelFiles(message.config) });
        break;
      }
      case 'DISPOSE_MODEL':
        if (loaded) await loaded.model.dispose();
        loaded = null;
        post({ requestId, type: 'DISPOSED' });
        break;
    }
  } catch (error) {
    const detail = classifyModelError(error, message.type === 'ANALYZE_IMAGE' ? 'inference' : 'load');
    if (detail.code === 'REQUEST_CANCELLED') post({ requestId, type: 'REQUEST_CANCELLED' });
    else post({ requestId, type: 'ERROR', error: detail });
  }
});
