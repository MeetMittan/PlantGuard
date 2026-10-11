/**
 * Verified model presets. Every value below was checked against the Hugging
 * Face Hub API and the installed Transformers.js version — see docs/AI_MODEL.md.
 *
 * Revisions are pinned to exact commits so the downloaded files (and their
 * cache keys) never change underneath a deployed build.
 */

export type ComponentDtype = 'fp32' | 'fp16' | 'q8' | 'int8' | 'uint8' | 'q4' | 'bnb4' | 'q4f16';
export type DtypeMap = Record<string, ComponentDtype>;

export interface ModelPreset {
  id: string;
  label: string;
  modelId: string;
  revision: string;
  dtype: DtypeMap;
  /** Sum of the selected ONNX files' sizes from the Hub API (bytes). */
  approxDownloadBytes: number;
  parameters: string;
  license: { name: string; url: string };
  modelCardUrl: string;
  description: string;
  /** The model is general-purpose; it was not fine-tuned on plant diseases. */
  plantDiseaseFineTuned: false;
}

/**
 * The same dtype map is used for WebGPU and WASM so falling back to WASM never
 * triggers a second multi-hundred-MB download.
 * - q4 (MatMulNBits, fp32 activations) runs on both backends without the
 *   `shader-f16` WebGPU feature that q4f16 needs.
 * - q8 (dynamic int8) token embeddings are 4× smaller than fp32.
 */
const SMOLVLM_DTYPE: DtypeMap = {
  embed_tokens: 'q8',
  vision_encoder: 'q4',
  decoder_model_merged: 'q4',
};

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'smolvlm-500m',
    label: 'SmolVLM 500M (recommended)',
    modelId: 'HuggingFaceTB/SmolVLM-500M-Instruct',
    revision: 'a7da5b986cb59b408707209984f360a5f4ad7e47',
    dtype: SMOLVLM_DTYPE,
    // embed_tokens_quantized 47.3 MB + vision_encoder_q4 66.7 MB + decoder_model_merged_q4 229.1 MB (+ small config/tokenizer files)
    approxDownloadBytes: 346_000_000,
    parameters: '≈507M',
    license: { name: 'Apache-2.0', url: 'https://huggingface.co/HuggingFaceTB/SmolVLM-500M-Instruct' },
    modelCardUrl: 'https://huggingface.co/HuggingFaceTB/SmolVLM-500M-Instruct',
    description: 'Better descriptions of leaf symptoms. Needs roughly 1–1.5 GB of free memory while running.',
    plantDiseaseFineTuned: false,
  },
  {
    id: 'smolvlm-256m',
    label: 'SmolVLM 256M (lite)',
    modelId: 'HuggingFaceTB/SmolVLM-256M-Instruct',
    revision: '7e3e67edbbed1bf9888184d9df282b700a323964',
    dtype: SMOLVLM_DTYPE,
    // embed_tokens_quantized 28.4 MB + vision_encoder_q4 63.8 MB + decoder_model_merged_q4 86.6 MB (+ small config/tokenizer files)
    approxDownloadBytes: 182_000_000,
    parameters: '≈256M',
    license: { name: 'Apache-2.0', url: 'https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct' },
    modelCardUrl: 'https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct',
    description: 'Smaller download for low-storage phones. Noticeably less detailed and less reliable.',
    plantDiseaseFineTuned: false,
  },
];

export const DEFAULT_PRESET_ID = 'smolvlm-500m';

const VALID_DTYPES = new Set<ComponentDtype>(['fp32', 'fp16', 'q8', 'int8', 'uint8', 'q4', 'bnb4', 'q4f16']);

/**
 * Parses VITE_AI_MODEL_DTYPE: either a single dtype ("q4") applied to every
 * component, or "component=dtype" pairs ("embed_tokens=q8,decoder_model_merged=q4").
 */
export function parseDtypeOverride(value: string, base: DtypeMap): DtypeMap {
  const trimmed = value.trim();
  if (!trimmed.includes('=')) {
    if (!VALID_DTYPES.has(trimmed as ComponentDtype)) throw new Error(`Unknown dtype "${trimmed}".`);
    return Object.fromEntries(Object.keys(base).map((key) => [key, trimmed as ComponentDtype]));
  }
  const result: DtypeMap = { ...base };
  for (const pair of trimmed.split(',')) {
    const [component, dtype] = pair.split('=').map((part) => part.trim());
    if (!component || !dtype || !VALID_DTYPES.has(dtype as ComponentDtype)) {
      throw new Error(`Invalid dtype override "${pair}".`);
    }
    result[component] = dtype as ComponentDtype;
  }
  return result;
}

export interface ResolvedModel {
  presetId: string | null;
  label: string;
  modelId: string;
  revision: string;
  dtype: DtypeMap;
  approxDownloadBytes: number | null;
  license: { name: string; url: string } | null;
  modelCardUrl: string;
  description: string;
}

export function findPreset(id: string | null | undefined): ModelPreset | undefined {
  return MODEL_PRESETS.find((preset) => preset.id === id);
}

/**
 * Resolves the model to use: an explicit env override (custom checkpoint) wins,
 * otherwise the user's selected preset, otherwise the default preset.
 */
export function resolveModel(options: {
  selectedPresetId: string | null;
  envModelId?: string | undefined;
  envRevision?: string | undefined;
  envDtype?: string | undefined;
}): ResolvedModel {
  const envPreset = MODEL_PRESETS.find((preset) => preset.modelId === options.envModelId);
  if (options.envModelId && !envPreset) {
    // Custom checkpoint: must be a SmolVLM/Idefics3-compatible ONNX repo (documented).
    return {
      presetId: null,
      label: options.envModelId,
      modelId: options.envModelId,
      revision: options.envRevision ?? 'main',
      dtype: options.envDtype ? parseDtypeOverride(options.envDtype, SMOLVLM_DTYPE) : SMOLVLM_DTYPE,
      approxDownloadBytes: null,
      license: null,
      modelCardUrl: `https://huggingface.co/${options.envModelId}`,
      description: 'Custom checkpoint configured by the deployment.',
    };
  }
  const preset =
    findPreset(options.selectedPresetId) ?? envPreset ?? findPreset(DEFAULT_PRESET_ID) ?? MODEL_PRESETS[0]!;
  return {
    presetId: preset.id,
    label: preset.label,
    modelId: preset.modelId,
    revision: options.envRevision && preset === envPreset ? options.envRevision : preset.revision,
    dtype: options.envDtype ? parseDtypeOverride(options.envDtype, preset.dtype) : preset.dtype,
    approxDownloadBytes: preset.approxDownloadBytes,
    license: preset.license,
    modelCardUrl: preset.modelCardUrl,
    description: preset.description,
  };
}
