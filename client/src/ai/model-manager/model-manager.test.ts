import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapabilityReport, InferenceResult, ModelProgress, PlantImageInput, VisionModelProvider } from '../contracts/types';
import { ModelRuntimeError } from '../utils/errors';
import { VisionModelManager } from './model-manager';
import { resetDatabase } from '@/test/db-helpers';

const MANIFEST = ['https://huggingface.co/m/resolve/r/config.json', 'https://huggingface.co/m/resolve/r/onnx/decoder_model_merged_q4.onnx'];

class FakeProvider implements VisionModelProvider {
  readonly kind = 'transformersjs' as const;
  /** Simulated Cache API contents. */
  stored = new Set<string>();
  capabilities: CapabilityReport = { webgpu: false, wasm: true, cacheApi: true, secureContext: true, unsupportedReason: null };
  loadCalls = 0;
  loadImpl = async (onProgress: (p: ModelProgress) => void) => {
    onProgress({ percent: 50, loadedBytes: 50, totalBytes: 100, file: null, phase: 'download' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    MANIFEST.forEach((url) => this.stored.add(url));
    return { device: 'wasm' as const, manifest: MANIFEST, missing: [] as string[] };
  };
  analyzeImpl = async (): Promise<InferenceResult> => ({
    answers: { isPlant: { text: 'Yes', truncated: false } },
    modelId: 'm',
    modelRevision: 'r',
    promptVersion: 'plant-qa-v1',
    provider: 'transformersjs',
    device: 'wasm',
    inferenceMs: 1,
  });
  checkCapabilities = async () => this.capabilities;
  getStatus = async (manifest: string[] | null) => ({
    cached: Boolean(manifest?.length) && manifest!.every((url) => this.stored.has(url)),
    device: 'wasm' as const,
  });
  load = (onProgress: (p: ModelProgress) => void) => {
    this.loadCalls += 1;
    return this.loadImpl(onProgress);
  };
  cancelLoad = vi.fn(async () => undefined);
  analyze = (_input: PlantImageInput) => this.analyzeImpl();
  deleteCache = vi.fn(async () => {
    const count = this.stored.size;
    this.stored.clear();
    return { deletedFiles: count };
  });
  dispose = vi.fn(async () => undefined);
}

const input = { image: new Blob(['x'], { type: 'image/jpeg' }), context: '' };

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

describe('VisionModelManager state transitions', () => {
  let provider: FakeProvider;
  let manager: VisionModelManager;

  beforeEach(async () => {
    await resetDatabase();
    setOnline(true);
    provider = new FakeProvider();
    manager = new VisionModelManager({ presetId: null, devicePreference: 'auto' }, () => provider);
  });

  it('starts as checking, then reports not-downloaded without downloading anything', async () => {
    expect(manager.getSnapshot().state).toBe('checking');
    await manager.refresh();
    expect(manager.getSnapshot().state).toBe('not-downloaded');
    expect(provider.loadCalls).toBe(0);
  });

  it('reports offline-unavailable when the model is missing and the device is offline', async () => {
    setOnline(false);
    await manager.refresh();
    expect(manager.getSnapshot().state).toBe('offline-unavailable');
  });

  it('goes not-downloaded → downloading → ready and records a verified manifest', async () => {
    await manager.refresh();
    const states: string[] = [];
    manager.subscribe(() => states.push(manager.getSnapshot().state));
    await manager.download();
    expect(states).toContain('downloading');
    expect(manager.getSnapshot()).toMatchObject({ state: 'ready', cached: true, inMemory: true, device: 'wasm' });
    expect(manager.getSnapshot().verifiedAt).not.toBeNull();
  });

  it('establishes offline readiness from real asset availability, not a flag (works offline after reload)', async () => {
    await manager.refresh();
    await manager.download();
    // Simulate an app reload while offline: new manager, same stored files and metadata.
    setOnline(false);
    const reloaded = new VisionModelManager({ presetId: null, devicePreference: 'auto' }, () => provider);
    await reloaded.refresh();
    expect(reloaded.getSnapshot()).toMatchObject({ state: 'ready', cached: true, inMemory: false });
  });

  it('reports missing assets after storage eviction', async () => {
    await manager.refresh();
    await manager.download();
    provider.stored.delete(MANIFEST[1]!);
    await manager.refresh();
    expect(manager.getSnapshot()).toMatchObject({ state: 'not-downloaded', cached: false, inMemory: false });
  });

  it('does not claim offline readiness when some files could not be cached', async () => {
    provider.loadImpl = async () => ({ device: 'wasm' as const, manifest: MANIFEST.slice(0, 1), missing: [MANIFEST[1]!] });
    await manager.refresh();
    await manager.download();
    expect(manager.getSnapshot()).toMatchObject({ state: 'ready', inMemory: true, cached: false, verifiedAt: null });
    expect(manager.getSnapshot().error?.code).toBe('INSUFFICIENT_STORAGE');
  });

  it('reports unsupported devices without attempting a download', async () => {
    provider.capabilities = { ...provider.capabilities, wasm: false, unsupportedReason: 'No WebAssembly' };
    await manager.refresh();
    expect(manager.getSnapshot()).toMatchObject({ state: 'unsupported', error: { code: 'MODEL_UNSUPPORTED', message: 'No WebAssembly' } });
  });

  it('repairs incomplete caching instead of reusing the in-memory model', async () => {
    const original = provider.loadImpl;
    provider.loadImpl = async () => ({ device: 'wasm', manifest: MANIFEST.slice(0, 1), missing: [MANIFEST[1]!] });
    await manager.refresh();
    await manager.download();
    expect(manager.getSnapshot().cached).toBe(false);
    provider.loadImpl = original;
    await manager.download();
    expect(provider.dispose).toHaveBeenCalledOnce();
    expect(provider.loadCalls).toBe(2);
    expect(manager.getSnapshot()).toMatchObject({ cached: true, inMemory: true, state: 'ready' });
  });

  it('surfaces coded download errors and allows retry', async () => {
    await manager.refresh();
    const original = provider.loadImpl;
    provider.loadImpl = async () => {
      throw new ModelRuntimeError({ code: 'MODEL_DOWNLOAD_FAILED', message: 'offline' });
    };
    await expect(manager.download()).rejects.toBeInstanceOf(ModelRuntimeError);
    expect(manager.getSnapshot()).toMatchObject({ state: 'error', error: { code: 'MODEL_DOWNLOAD_FAILED' }, lastInitError: { code: 'MODEL_DOWNLOAD_FAILED' } });
    provider.loadImpl = original;
    await manager.download();
    expect(manager.getSnapshot().state).toBe('ready');
  });

  it('recovers cleanly when a download is cancelled', async () => {
    await manager.refresh();
    provider.loadImpl = async () => {
      throw new ModelRuntimeError({ code: 'REQUEST_CANCELLED', message: 'Download cancelled.' });
    };
    await manager.download();
    expect(manager.getSnapshot()).toMatchObject({ state: 'not-downloaded', error: null, progress: null });
  });

  it('shares one initialization between concurrent callers (no duplicate model copies)', async () => {
    await manager.refresh();
    await Promise.all([manager.download(), manager.download()]);
    expect(provider.loadCalls).toBe(1);
  });

  it('refuses analysis until ready, rejects a concurrent analysis, then returns to ready', async () => {
    await manager.refresh();
    await expect(manager.analyze(input)).rejects.toMatchObject({ detail: { code: 'MODEL_NOT_DOWNLOADED' } });
    await manager.download();
    let release!: () => void;
    provider.analyzeImpl = () =>
      new Promise((resolve) => {
        release = () =>
          resolve({ answers: {}, modelId: 'm', modelRevision: 'r', promptVersion: 'p', provider: 'transformersjs', device: 'wasm', inferenceMs: 1 });
      });
    const first = manager.analyze(input);
    await vi.waitFor(() => expect(manager.getSnapshot().state).toBe('running'));
    await expect(manager.analyze(input)).rejects.toMatchObject({ detail: { code: 'MODEL_BUSY' } });
    release();
    await first;
    expect(manager.getSnapshot().state).toBe('ready');
  });

  it('marks the model as not in memory after a memory crash', async () => {
    await manager.refresh();
    await manager.download();
    provider.analyzeImpl = async () => {
      throw new ModelRuntimeError({ code: 'OUT_OF_MEMORY', message: 'oom' });
    };
    await expect(manager.analyze(input)).rejects.toMatchObject({ detail: { code: 'OUT_OF_MEMORY' } });
    expect(manager.getSnapshot()).toMatchObject({ state: 'ready', inMemory: false });
  });

  it('deletes cached files and returns to not-downloaded', async () => {
    await manager.refresh();
    await manager.download();
    expect(await manager.deleteCachedModel()).toBe(2);
    expect(manager.getSnapshot()).toMatchObject({ state: 'not-downloaded', cached: false, inMemory: false, verifiedAt: null });
  });
});
