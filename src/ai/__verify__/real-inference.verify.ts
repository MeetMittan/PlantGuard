/// <reference types="node" />
/**
 * MANUAL real-model verification (not part of `npm test` or CI).
 *
 *   npm run verify:inference
 *   VERIFY_PRESET=smolvlm-256m VERIFY_IMAGE=path/to/leaf.jpg npm run verify:inference
 *
 * Downloads the configured preset (~180–350 MB) into ./.model-cache on first
 * run, then runs the app's real prompt sequence (runAnalysis) and the real
 * assessment service against the real model with ONNX Runtime for Node (CPU).
 * Browser specifics (WebGPU, Cache API, worker, offline) are covered by the
 * in-app Model diagnostics page and docs/TESTING.md.
 */
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { AutoModelForImageTextToText, AutoProcessor, RawImage, env } from '@huggingface/transformers';
import { findPreset, DEFAULT_PRESET_ID } from '../model-manager/presets';
import { PROMPT_VERSION } from '../prompts/plant-analysis';
import { runAnalysis, type GenerateFn } from '../utils/run-analysis';
import { buildAssessment } from '@/features/diagnosis/services/assessment-service';
import { plantAssessmentSchema } from '@/features/diagnosis/schemas/assessment';
import { computeQualityMetrics, QUALITY_SAMPLE_SIZE, toGrayscale, type QualityMetrics } from '@/services/image-processing/quality';

const presetId = process.env.VERIFY_PRESET ?? DEFAULT_PRESET_ID;
const imagePath = path.resolve(process.env.VERIFY_IMAGE ?? 'tests/fixtures/tomato-early-blight.jpg');
const context = process.env.VERIFY_CONTEXT ?? '';

/** Same heuristic as the browser, computed from sharp's raw pixels. */
export async function qualityOf(file: string): Promise<QualityMetrics> {
  const meta = await sharp(file).metadata();
  const { data, info } = await sharp(file)
    .resize(QUALITY_SAMPLE_SIZE, QUALITY_SAMPLE_SIZE, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return computeQualityMetrics(toGrayscale(new Uint8Array(data), info.width, info.height), info.width, info.height, Math.min(meta.width ?? 0, meta.height ?? 0));
}

/** Loads a preset with the same options as the browser worker and returns a GenerateFn bound to one image. */
export async function loadNodeModel(presetKey: string) {
  const preset = findPreset(presetKey);
  if (!preset) throw new Error(`Unknown preset "${presetKey}".`);
  env.cacheDir = path.resolve('.model-cache');
  env.remotePathTemplate = `{model}/resolve/${encodeURIComponent(preset.revision)}/`;
  const processor = await AutoProcessor.from_pretrained(preset.modelId, { revision: preset.revision });
  const model = await AutoModelForImageTextToText.from_pretrained(preset.modelId, { revision: preset.revision, dtype: preset.dtype });
  const generatorFor = async (file: string): Promise<GenerateFn> => {
    const image = await RawImage.read(file);
    return async (prompt, maxNewTokens) => {
      const messages = [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: prompt }] }];
      const chat = processor.apply_chat_template(messages as never, { add_generation_prompt: true });
      const inputs = await processor(chat, [image], { do_image_splitting: false });
      const started = Date.now();
      const output = (await model.generate({ ...inputs, max_new_tokens: maxNewTokens, do_sample: false, repetition_penalty: 1.1 })) as {
        dims: number[];
        slice: (...args: unknown[]) => unknown;
      };
      const promptLength = (inputs.input_ids as { dims: number[] }).dims.at(-1) ?? 0;
      const generated = (output.dims.at(-1) ?? promptLength) - promptLength;
      const [text = ''] = processor.batch_decode(output.slice(null, [promptLength, null]) as never, { skip_special_tokens: true });
      return { text, hitTokenLimit: generated >= maxNewTokens, interrupted: false, inferenceMs: Date.now() - started };
    };
  };
  return { preset, model, generatorFor };
}

describe(`real inference: ${presetId}`, () => {
  it('downloads the pinned checkpoint, runs the prompt sequence and produces a valid assessment', async () => {
    const { preset, model, generatorFor } = await loadNodeModel(presetId);
    const { answers, inferenceMs } = await runAnalysis({
      context,
      generate: await generatorFor(imagePath),
      onStep: (step) => console.log(`  step ${step.index + 1}/${step.total}: ${step.label}`),
    });
    const assessment = buildAssessment({
      inference: { answers, inferenceMs, modelId: preset.modelId, modelRevision: preset.revision, promptVersion: PROMPT_VERSION, provider: 'transformersjs', device: null },
      quality: await qualityOf(imagePath),
    });

    console.log('\nRaw answers:', JSON.stringify(answers, null, 2));
    console.log('\nAssessment:', JSON.stringify({ ...assessment, recommendations: '[curated]' }, null, 2));

    expect(plantAssessmentSchema.safeParse(assessment).success).toBe(true);
    expect(assessment.modelId).toBe(preset.modelId);
    expect(assessment.modelAnswers.length).toBeGreaterThan(0);
    await model.dispose();
  }, 30 * 60 * 1000);
});
