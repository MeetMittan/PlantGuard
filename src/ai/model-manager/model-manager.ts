import { config } from '@/app/config';
import type { DevicePreference } from '@/db/schema';
import { getMetadata, setMetadata } from '@/db/repositories/settings';
import { ERROR_CATALOGUE } from '@/lib/app-errors';
import { isOnline, subscribeConnectivity } from '@/services/connectivity/connectivity';
import { hasRoomFor, requestPersistentStorage } from '@/services/storage/storage';
import type {
  AnalysisStepProgress,
  CapabilityReport,
  InferenceResult,
  ModelError,
  ModelProgress,
  ModelState,
  PlantImageInput,
  VisionModelProvider,
} from '../contracts/types';
import { DemoVisionProvider, DEMO_MODEL_ID } from '../providers/demo-provider';
import { TransformersVisionProvider } from '../providers/transformers-provider';
import { classifyModelError, ModelRuntimeError } from '../utils/errors';
import { resolveModel, type ResolvedModel } from './presets';

export interface ModelManagerState {
  state: ModelState;
  model: ResolvedModel;
  providerKind: 'transformersjs' | 'demo';
  device: 'webgpu' | 'wasm' | null;
  /** Every required file is in the browser cache (verified via the runtime, not assumed). */
  cached: boolean;
  /** The model is initialized in the worker's memory (this session). */
  inMemory: boolean;
  /**
   * When the model last initialized successfully from fully cached files on this
   * device — the evidence that offline inference works here. Null if never.
   */
  verifiedAt: string | null;
  progress: ModelProgress | null;
  analysisStep: AnalysisStepProgress | null;
  capabilities: CapabilityReport | null;
  error: ModelError | null;
  /** Last initialization failure, kept after the state recovers (for diagnostics). */
  lastInitError: ModelError | null;
}

export interface ManagerSelection {
  presetId: string | null;
  devicePreference: DevicePreference;
}

type ProviderFactory = (model: ResolvedModel, selection: ManagerSelection) => VisionModelProvider;

const defaultFactory: ProviderFactory = (model, selection) =>
  config.ai.provider === 'demo'
    ? new DemoVisionProvider()
    : new TransformersVisionProvider({
        modelId: model.modelId,
        revision: model.revision,
        dtype: model.dtype,
        remoteHost: config.ai.remoteHost,
        wasmBaseUrl: config.ai.wasmBaseUrl ?? null,
        devicePreference: selection.devicePreference,
      });

function resolveFor(selection: ManagerSelection): ResolvedModel {
  const model = resolveModel({
    selectedPresetId: selection.presetId,
    envModelId: config.ai.modelId,
    envRevision: config.ai.modelRevision,
    envDtype: config.ai.modelDtype,
  });
  return config.ai.provider === 'demo'
    ? { ...model, presetId: null, label: 'Demo provider (simulated results)', modelId: DEMO_MODEL_ID, approxDownloadBytes: 0 }
    : model;
}

const modelKey = (model: ResolvedModel) => `${model.modelId}@${model.revision}:${JSON.stringify(model.dtype)}`;
const verifiedKey = (model: ResolvedModel) => `modelVerified:${modelKey(model)}`;
const manifestKey = (model: ResolvedModel) => `modelManifest:${modelKey(model)}`;

async function readManifest(model: ResolvedModel): Promise<string[] | null> {
  const raw = await getMetadata(manifestKey(model)).catch(() => null);
  if (typeof raw !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string') ? parsed : null;
  } catch {
    return null;
  }
}
const err = (code: ModelError['code'], message = ERROR_CATALOGUE[code].message): ModelError => ({ code, message });

/**
 * Single source of truth for model lifecycle state. UI components subscribe via
 * useModelState(); they never talk to a provider directly.
 *
 * - ready: all files verified in cache → analysis can run offline (the model is
 *   initialized from cache on first use; `inMemory` says whether that happened).
 * - not-downloaded: files missing, network available → user may download.
 * - offline-unavailable: files missing and the device is offline.
 */
export class VisionModelManager {
  private provider: VisionModelProvider;
  private selection: ManagerSelection;
  private listeners = new Set<() => void>();
  private snapshot: ModelManagerState;
  private analyzing: AbortController | null = null;
  private loadPromise: Promise<void> | null = null;
  private refreshToken = 0;

  constructor(
    selection: ManagerSelection = { presetId: null, devicePreference: 'auto' },
    private readonly factory: ProviderFactory = defaultFactory,
  ) {
    this.selection = selection;
    const model = resolveFor(selection);
    this.provider = factory(model, selection);
    this.snapshot = {
      state: 'checking',
      model,
      providerKind: this.provider.kind,
      device: null,
      cached: false,
      inMemory: false,
      verifiedAt: null,
      progress: null,
      analysisStep: null,
      capabilities: null,
      error: null,
      lastInitError: null,
    };
    subscribeConnectivity(() => {
      if (!this.snapshot.cached && !this.isBusy()) void this.refresh();
    });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private set(patch: Partial<ModelManagerState>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private isBusy() {
    return ['downloading', 'loading', 'running'].includes(this.snapshot.state);
  }

  /** Applies the user's model/device selection, recreating the provider if it changed. */
  async configure(selection: ManagerSelection): Promise<void> {
    const changed =
      selection.presetId !== this.selection.presetId || selection.devicePreference !== this.selection.devicePreference;
    if (!changed && this.snapshot.state !== 'checking') return;
    if (changed) {
      if (this.isBusy()) await this.cancel();
      await this.provider.dispose();
      this.selection = selection;
      const model = resolveFor(selection);
      this.provider = this.factory(model, selection);
      this.set({ model, providerKind: this.provider.kind, inMemory: false, device: null, error: null, progress: null, verifiedAt: null });
    }
    await this.refresh();
  }

  /** Re-verifies capabilities and cache state without downloading anything. */
  async refresh(): Promise<void> {
    const token = ++this.refreshToken;
    if (!this.isBusy()) this.set({ state: 'checking' });
    try {
      const capabilities = this.snapshot.capabilities ?? (await this.provider.checkCapabilities());
      if (token !== this.refreshToken) return;
      if (capabilities.unsupportedReason) {
        this.set({ state: 'unsupported', capabilities, error: err('MODEL_UNSUPPORTED', capabilities.unsupportedReason) });
        return;
      }
      const manifest = await readManifest(this.snapshot.model);
      const status = await this.provider.getStatus(manifest);
      const verified = await getMetadata(verifiedKey(this.snapshot.model)).catch(() => null);
      if (token !== this.refreshToken || this.isBusy()) return;
      this.set({
        capabilities,
        cached: status.cached,
        // If files were evicted, the next analysis must go through load() again
        // (the worker reuses an already-initialized model, so this is cheap).
        inMemory: status.cached ? this.snapshot.inMemory : false,
        verifiedAt: status.cached && typeof verified === 'string' ? verified : null,
        device: status.device,
        state: status.cached ? 'ready' : isOnline() ? 'not-downloaded' : 'offline-unavailable',
        error: null,
      });
    } catch (error) {
      if (token !== this.refreshToken) return;
      this.set({ state: 'error', error: classifyModelError(error) });
    }
  }

  /** Downloads (if needed) and initializes the model. Must be triggered by a user action. */
  async download(): Promise<void> {
    if (this.isBusy()) return;
    const needsNetwork = !this.snapshot.cached;
    if (needsNetwork && !isOnline()) {
      this.set({ state: 'offline-unavailable', error: err('OFFLINE_MODEL_UNAVAILABLE') });
      return;
    }
    const bytes = this.snapshot.model.approxDownloadBytes;
    if (needsNetwork && bytes && (await hasRoomFor(bytes)) === false) {
      this.set({ state: 'error', error: err('INSUFFICIENT_STORAGE') });
      return;
    }
    if (needsNetwork) void requestPersistentStorage();
    // Retry incomplete cache writes even when this session's model still works.
    if (needsNetwork && this.snapshot.inMemory) {
      await this.provider.dispose();
      this.set({ inMemory: false });
    }
    await this.ensureLoaded();
  }

  /** Initializes once; concurrent callers share the same in-flight load. */
  private ensureLoaded(): Promise<void> {
    if (this.snapshot.inMemory) return Promise.resolve();
    this.loadPromise ??= this.load().finally(() => {
      this.loadPromise = null;
    });
    return this.loadPromise;
  }

  private async load(): Promise<void> {
    const fromCache = this.snapshot.cached;
    this.set({
      state: fromCache ? 'loading' : 'downloading',
      error: null,
      progress: { percent: null, loadedBytes: null, totalBytes: null, file: null, phase: fromCache ? 'initialize' : 'download' },
    });
    try {
      const { device, manifest, missing } = await this.provider.load((progress) => {
        this.set({ progress, state: progress.phase === 'initialize' ? 'loading' : this.snapshot.state });
      });
      // The model works now; offline readiness is claimed only if every expected
      // file is verifiably in the cache (e.g. a full quota can prevent caching).
      const fullyCached = missing.length === 0 && manifest.length > 0;
      let verifiedAt: string | null = null;
      if (fullyCached) {
        verifiedAt = new Date().toISOString();
        await setMetadata(manifestKey(this.snapshot.model), JSON.stringify(manifest)).catch(() => undefined);
        await setMetadata(verifiedKey(this.snapshot.model), verifiedAt).catch(() => undefined);
      }
      this.set({
        state: 'ready',
        cached: fullyCached,
        inMemory: true,
        device,
        progress: null,
        verifiedAt,
        error: fullyCached
          ? null
          : { code: 'INSUFFICIENT_STORAGE', message: 'The model is running, but not all files could be stored, so it will not work offline. Free up storage and download again.' },
      });
    } catch (error) {
      const detail = classifyModelError(error);
      if (detail.code === 'REQUEST_CANCELLED') {
        // Leave the busy state first, otherwise refresh() would treat the manager as still downloading.
        this.set({ state: 'checking', inMemory: false, progress: null, error: null });
        await this.refresh();
        return;
      }
      this.set({ inMemory: false, progress: null });
      // Distinguish "files missing" from other failures when we expected a cached model.
      const finalError =
        fromCache && (detail.code === 'MODEL_DOWNLOAD_FAILED' || detail.code === 'OFFLINE_MODEL_UNAVAILABLE')
          ? err('MODEL_ASSETS_MISSING')
          : detail;
      this.set({ state: 'error', error: finalError, lastInitError: finalError });
      throw new ModelRuntimeError(finalError);
    }
  }

  async cancel(): Promise<void> {
    this.analyzing?.abort();
    if (this.snapshot.state === 'running') {
      return;
    }
    if (this.snapshot.state === 'downloading' || this.snapshot.state === 'loading') {
      await this.provider.cancelLoad();
      await this.loadPromise?.catch(() => undefined);
    }
  }

  canAnalyze(): boolean {
    return this.snapshot.state === 'ready';
  }

  /**
   * Runs one analysis. Only one may run at a time (a second call fails with
   * MODEL_BUSY), so repeated taps cannot start duplicate inferences.
   */
  async analyze(input: PlantImageInput): Promise<InferenceResult> {
    if (this.snapshot.state === 'running') throw new ModelRuntimeError(err('MODEL_BUSY'));
    if (this.snapshot.state !== 'ready') {
      throw new ModelRuntimeError(
        this.snapshot.state === 'offline-unavailable' ? err('OFFLINE_MODEL_UNAVAILABLE') : err('MODEL_NOT_DOWNLOADED'),
      );
    }
    const controller = new AbortController();
    this.analyzing = controller;
    try {
      await this.ensureLoaded();
      if (controller.signal.aborted) throw new ModelRuntimeError(err('REQUEST_CANCELLED'));
      this.set({ state: 'running', analysisStep: null, error: null });
      return await this.provider.analyze(input, {
        signal: controller.signal,
        onStep: (analysisStep) => this.set({ analysisStep }),
      });
    } catch (error) {
      const detail = classifyModelError(error, 'inference');
      // A memory crash kills the worker; the model must be re-initialized next time.
      if (detail.code === 'OUT_OF_MEMORY') this.set({ inMemory: false });
      throw new ModelRuntimeError(detail);
    } finally {
      this.analyzing = null;
      if ((this.snapshot.state as ModelState) === 'running') this.set({ state: 'ready', analysisStep: null });
    }
  }

  async deleteCachedModel(): Promise<number> {
    if (this.isBusy()) await this.cancel();
    if (this.snapshot.state === 'running') throw new ModelRuntimeError(err('MODEL_BUSY'));
    const { deletedFiles } = await this.provider.deleteCache();
    await setMetadata(verifiedKey(this.snapshot.model), null).catch(() => undefined);
    await setMetadata(manifestKey(this.snapshot.model), null).catch(() => undefined);
    this.set({ cached: false, inMemory: false, verifiedAt: null });
    await this.refresh();
    return deletedFiles;
  }

  clearError() {
    if (this.snapshot.state === 'error') void this.refresh();
  }
}

export const modelManager = new VisionModelManager();
