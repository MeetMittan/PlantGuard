# ADR 0002 — Transformers.js + SmolVLM in a Web Worker

- **Status:** Accepted (2026-10-10)

## Context

The brief prefers PaliGemma 2 via Transformers.js/ONNX, running locally, with WebGPU and a WASM
fallback, and forbids silently switching to paid or text-only models.

## Options considered

| Option | Outcome |
|---|---|
| PaliGemma 2 3B (`onnx-community/paligemma2-3b-pt-224`) | ≈2.3–2.9 GB minimum; pretrained task-prefix model (not instruction-tuned); Gemma terms. Rejected for mobile browsers. |
| SmolVLM-500M / 256M Instruct (official ONNX, Apache-2.0) | ≈346 / 182 MB at q8+q4; instruction-following; real inference verified with Transformers.js 4.3. **Chosen.** |
| Gemma 4 E2B, Qwen2-VL-2B | 1.5–3.2 GB; possible future "large" preset. |
| FastVLM, LFM2-VL | Restrictive/custom licences. |
| Ollama / remote API | Not browser-native / not private / may cost money. Not used. |

## Decision

- Use `@huggingface/transformers` (one AI runtime) with `AutoModelForImageTextToText` +
  `AutoProcessor` inside `src/ai/workers/vision.worker.ts`.
- Two pinned presets (500M default, 256M lite); one dtype map for WebGPU and WASM so CPU fallback
  never re-downloads.
- Ask short constrained questions and build the structured assessment in code, because the small
  models failed at template/JSON output in testing.
- Curated (not generated) next-step guidance; no numeric confidence.

## Consequences

- ✅ Private, offline-capable inference on ordinary hardware.
- ⚠ General-purpose models: plant/disease names are often wrong — stated in the UI and docs.
- ⚠ ≈350 MB download and 1–1.5 GB RAM for the default preset; slow on low-end phones.
