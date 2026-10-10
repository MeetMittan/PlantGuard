import type {
  AnalyzeOptions,
  CapabilityReport,
  InferenceDevice,
  InferenceResult,
  ModelProgress,
  PlantImageInput,
  VisionModelProvider,
} from '../contracts/types';
import { PROMPT_VERSION } from '../prompts/plant-analysis';
import { ModelRuntimeError } from '../utils/errors';
import type { AnswerSet } from '../utils/parse-answers';

export const DEMO_MODEL_ID = 'plantguard-demo (simulated, not real AI)';
const DEMO_FLAG_KEY = 'plantguard:demo-model-downloaded';

/** Demo-only persistence so the simulated "download" survives reloads like a real cache. */
function readFlag(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function writeFlag(value: boolean) {
  try {
    if (value) localStorage.setItem(DEMO_FLAG_KEY, '1');
    else localStorage.removeItem(DEMO_FLAG_KEY);
  } catch {
    // Storage unavailable (private mode): the demo simply forgets after reload.
  }
}

const a = (text: string) => ({ text, truncated: false });

/**
 * DEMO / TEST ONLY. Returns deterministic, clearly labelled scripted answers so
 * the UI and end-to-end tests can run without a model download. It never looks
 * at the image. The answers go through the same assessment service as real
 * model output. It can only be enabled with VITE_AI_PROVIDER=demo AND
 * VITE_ENABLE_DEMO_MODE=true, and the UI shows a persistent banner when active.
 *
 * Context keywords select the scripted answers:
 * - "healthy"   → healthy leaf, no symptoms
 * - "not plant" → not a plant
 * - "powdery"   → white powdery patches and brown spots
 * - "fail"      → simulated inference error
 * - otherwise   → brown spots with yellow edges, suggested "Early blight"
 */
export class DemoVisionProvider implements VisionModelProvider {
  readonly kind = 'demo' as const;
  private downloaded = readFlag();

  async checkCapabilities(): Promise<CapabilityReport> {
    return { webgpu: false, wasm: true, cacheApi: true, secureContext: true, unsupportedReason: null };
  }

  async getStatus(_manifest: string[] | null): Promise<{ cached: boolean; device: InferenceDevice | null }> {
    return { cached: this.downloaded, device: 'wasm' };
  }

  private cancelled = false;

  async load(onProgress: (progress: ModelProgress) => void): Promise<{ device: InferenceDevice; manifest: string[]; missing: string[] }> {
    this.cancelled = false;
    // Slow enough (≈1.5 s) that the Cancel button can be exercised in demos and tests.
    for (const percent of [10, 25, 40, 55, 70, 85, 100]) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (this.cancelled) throw new ModelRuntimeError({ code: 'REQUEST_CANCELLED', message: 'Download cancelled.' });
      onProgress({ percent, loadedBytes: percent * 1000, totalBytes: 100_000, file: 'demo', phase: 'download' });
    }
    this.downloaded = true;
    writeFlag(true);
    return { device: 'wasm', manifest: ['demo://simulated-model'], missing: [] };
  }

  async cancelLoad(): Promise<void> {
    this.cancelled = true;
  }

  async analyze(input: PlantImageInput, options: AnalyzeOptions = {}): Promise<InferenceResult> {
    const context = input.context.toLowerCase();
    options.onStep?.({ index: 0, total: 1, label: 'Running simulated demo analysis' });
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (options.signal?.aborted) throw new ModelRuntimeError({ code: 'REQUEST_CANCELLED', message: 'Analysis cancelled.' });
    if (context.includes('fail')) {
      throw new ModelRuntimeError({ code: 'INFERENCE_FAILED', message: 'Simulated demo failure (the context contained "fail").' });
    }

    let answers: AnswerSet;
    if (context.includes('not plant')) {
      answers = { isPlant: a('No.') };
    } else if (context.includes('healthy')) {
      answers = { isPlant: a('Yes.'), plant: a('Basil.'), health: a('Healthy.'), signs: a('None.') };
    } else if (context.includes('powdery')) {
      answers = {
        isPlant: a('Yes.'),
        plant: a('Tomato.'),
        health: a('Diseased.'),
        signs: a('White powdery patches and brown spots.'),
        condition: a('Powdery mildew.'),
      };
    } else {
      answers = {
        isPlant: a('Yes.'),
        plant: a('Tomato.'),
        health: a('Diseased.'),
        signs: a('Brown spots with yellow edges.'),
        condition: a('Early blight.'),
      };
    }
    return {
      answers,
      modelId: DEMO_MODEL_ID,
      modelRevision: null,
      promptVersion: PROMPT_VERSION,
      provider: 'demo',
      device: 'wasm',
      inferenceMs: 0,
    };
  }

  async deleteCache(): Promise<{ deletedFiles: number }> {
    const had = this.downloaded;
    this.downloaded = false;
    writeFlag(false);
    return { deletedFiles: had ? 1 : 0 };
  }

  async dispose(): Promise<void> {}
}
