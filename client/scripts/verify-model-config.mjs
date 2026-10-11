#!/usr/bin/env node
/**
 * Verifies the configured model(s) against the Hugging Face Hub WITHOUT downloading weights:
 *   - the repo + revision exist and are not gated
 *   - config.json declares a SmolVLM/Idefics3 architecture
 *   - every ONNX file required by the dtype map exists, and reports the total size
 *
 * Usage: npm run verify:model            (reads .env and process.env)
 * Requires Node >= 22.18 / 23.6 (imports the TypeScript presets file with type stripping).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { MODEL_PRESETS, resolveModel } = await import(pathToFileURL(resolve('src/ai/model-manager/presets.ts')).href);

function loadDotEnv() {
  const values = {};
  for (const file of ['.env', '.env.local', '.env.production']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return { ...values, ...process.env };
}

const SUFFIX = { fp32: '', fp16: '_fp16', q8: '_quantized', int8: '_int8', uint8: '_uint8', q4: '_q4', bnb4: '_bnb4', q4f16: '_q4f16' };
const env = loadDotEnv();
const host = (env.VITE_AI_REMOTE_HOST || 'https://huggingface.co/').replace(/\/?$/, '/');

if ((env.VITE_AI_PROVIDER || 'transformersjs') === 'demo') {
  console.warn('⚠  VITE_AI_PROVIDER=demo: this build returns SIMULATED results. Do not deploy it as a real AI app.');
}

const targets = env.VITE_AI_MODEL_ID
  ? [resolveModel({ selectedPresetId: null, envModelId: env.VITE_AI_MODEL_ID, envRevision: env.VITE_AI_MODEL_REVISION || undefined, envDtype: env.VITE_AI_MODEL_DTYPE || undefined })]
  : MODEL_PRESETS.map((preset) => resolveModel({ selectedPresetId: preset.id, envDtype: env.VITE_AI_MODEL_DTYPE || undefined }));

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

let failed = false;
for (const model of targets) {
  console.log(`\n▶ ${model.modelId} @ ${model.revision}`);
  try {
    const info = await getJson(`${host}api/models/${model.modelId}/revision/${model.revision}`);
    if (info.gated) throw new Error('Repository is gated: browsers cannot download it anonymously.');
    const config = await getJson(`${host}${model.modelId}/resolve/${model.revision}/config.json`);
    if (!['idefics3', 'smolvlm'].includes(config.model_type)) {
      throw new Error(`Unsupported architecture "${config.model_type}" (expected idefics3/smolvlm).`);
    }
    const tree = await getJson(`${host}api/models/${model.modelId}/tree/${model.revision}/onnx`);
    const sizes = new Map(tree.map((file) => [file.path, file.lfs?.size ?? file.size ?? 0]));
    let total = 0;
    for (const [component, dtype] of Object.entries(model.dtype)) {
      const base = `onnx/${component}${SUFFIX[dtype]}.onnx`;
      if (!sizes.has(base)) throw new Error(`Missing ${base} (component "${component}", dtype "${dtype}").`);
      const parts = [...sizes.keys()].filter((path) => path === base || path.startsWith(`${base}_data`));
      const bytes = parts.reduce((sum, path) => sum + sizes.get(path), 0);
      total += bytes;
      console.log(`  ✔ ${component.padEnd(22)} ${dtype.padEnd(6)} ${(bytes / 1e6).toFixed(1).padStart(8)} MB`);
    }
    console.log(`  Σ ONNX download ≈ ${(total / 1e6).toFixed(0)} MB · license: ${info.cardData?.license ?? 'see model card'}`);
    if (model.approxDownloadBytes && Math.abs(total - model.approxDownloadBytes) / model.approxDownloadBytes > 0.1) {
      console.warn(`  ⚠ presets.ts approxDownloadBytes (${model.approxDownloadBytes}) differs from the Hub by >10%.`);
    }
  } catch (error) {
    failed = true;
    console.error(`  ✘ ${error.message}`);
  }
}

if (failed) {
  console.error('\nModel configuration check FAILED. Fix the values above before advertising AI analysis.');
  process.exit(1);
}
console.log('\nModel configuration OK.');
