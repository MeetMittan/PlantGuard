# AI model

PlantGuard runs an open-weight **vision-language model (VLM) locally in the browser** with
[Transformers.js](https://huggingface.co/docs/transformers.js) and ONNX Runtime Web, inside a
dedicated Web Worker. No image is ever sent to a server.

> **Important:** the selected models are **general-purpose** image-and-text models. They were
> **not fine-tuned on plant diseases**. In our own tests they often misidentify plants and name
> the wrong disease, while being reasonably good at describing visible symptoms (e.g. "brown
> spots"). PlantGuard's UI and output schema are designed around that reality.

## Selected checkpoints

| Preset (Settings → AI model) | Checkpoint | Pinned revision | Params | License |
|---|---|---|---|---|
| **SmolVLM 500M** (default) | [`HuggingFaceTB/SmolVLM-500M-Instruct`](https://huggingface.co/HuggingFaceTB/SmolVLM-500M-Instruct) | `a7da5b986cb59b408707209984f360a5f4ad7e47` | ≈507M | Apache-2.0 |
| **SmolVLM 256M** (lite) | [`HuggingFaceTB/SmolVLM-256M-Instruct`](https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct) | `7e3e67edbbed1bf9888184d9df282b700a323964` | ≈256M | Apache-2.0 |

Both repos are public (not gated) and ship official ONNX exports in their `onnx/` folder. SmolVLM
pairs a SigLIP image encoder with a SmolLM2 text decoder; Transformers.js maps the `idefics3`
architecture to `AutoModelForImageTextToText` (verified in
`node_modules/@huggingface/transformers/src/models/registry.js`, v4.3.1).

Revisions are **pinned to commits**: the files a deployed build downloads (and their cache keys)
never change underneath it.

### Quantization and verified download size

PlantGuard loads three ONNX sessions with **per-component dtypes** (`src/ai/model-manager/presets.ts`):

| Component | dtype | 500M file | 256M file |
|---|---|---|---|
| `embed_tokens` | `q8` (`*_quantized.onnx`) | 47.3 MB | 28.4 MB |
| `vision_encoder` | `q4` | 66.7 MB | 63.8 MB |
| `decoder_model_merged` | `q4` | 229.1 MB | 86.6 MB |
| **Total (+ small JSON/tokenizer files)** | | **≈346 MB** | **≈182 MB** |

Sizes come from the Hugging Face Hub API (`/api/models/<id>/tree/main/onnx`) on 2026-10-10.
Why these dtypes:

- `q4` (MatMulNBits with fp32 activations) runs on **both** WebGPU and WASM. `q4f16` is slightly
  smaller but requires the WebGPU `shader-f16` feature and would force a second download for
  the CPU fallback. One dtype map for both devices means **falling back to CPU never re-downloads**.
- `q8` token embeddings are 4× smaller than `fp32` with no observed change in answers.

ONNX Runtime's WASM binary (~26 MB, `ort-wasm-simd-threaded.asyncify.wasm`) is also downloaded
once and cached (see [Download and cache lifecycle](#download-and-cache-lifecycle)).

## Evaluation of PaliGemma 2 (preferred family) — not selected

PaliGemma 2 was evaluated first, as requested:

| Check | Finding |
|---|---|
| ONNX availability | [`onnx-community/paligemma2-3b-pt-224`](https://huggingface.co/onnx-community/paligemma2-3b-pt-224) exists, tagged for Transformers.js (`PaliGemmaForConditionalGeneration`). |
| Size | Smallest working set ≈ **2.3–2.9 GB** (decoder q4f16 1473 MB + embed_tokens int8/fp16 593–1185 MB + vision encoder q4f16 236 MB). |
| Usage | The available ONNX checkpoints are **pretrained (`pt`) mix-free models** that respond to task prefixes such as `caption en`; they are not instruction-tuned and need task-specific fine-tuning to answer structured questions. |
| License | Gemma Terms of Use (additional use restrictions). |
| Device fit | ≥2.3 GB download and ~3B parameters are impractical for ordinary Android phones and many laptops in a browser. |

Conclusion: PaliGemma 2 is too large for a useful mobile browser experience and is not
instruction-following without fine-tuning. SmolVLM-Instruct (500M/256M) is the closest
compatible, open-weight, instruction-following VLM with official ONNX weights that plausibly runs
on ordinary devices. Other candidates checked via the Hub API:

| Candidate | Why not default |
|---|---|
| `onnx-community/gemma-4-E2B-it-ONNX` (Apache-2.0) | Much more capable, but ≈3.2 GB at q4f16 (decoder 1.5 GB + embeddings 1.6 GB). A good future "large" preset for desktops — see ROADMAP. |
| `onnx-community/Qwen2-VL-2B-Instruct` (Apache-2.0) | ≈1.5–2.7 GB depending on dtype. |
| `onnx-community/FastVLM-0.5B-ONNX` | Apple AMLR license (research-only restrictions). |
| `onnx-community/LFM2-VL-450M-ONNX` | LFM Open License (custom terms). |

No paid or remote model is used, and the app never silently falls back to one.

## Measured behaviour (honest results)

Real inference was run with `npm run verify:inference` (ONNX Runtime for Node, CPU, laptop) on the
committed fixture `tests/fixtures/tomato-early-blight.jpg` (a tomato leaf with early blight;
attribution in `tests/fixtures/ATTRIBUTION.md`), plus ad-hoc probes during prompt design:

| Question | SmolVLM-500M | SmolVLM-256M | Correct answer |
|---|---|---|---|
| Plant or leaf in photo? | Yes | Yes | Yes |
| Which plant? | "Vegetable" / "Maple" | "Raspberry" | Tomato |
| Healthy or diseased? | "Unclear" | "Disease" | Diseased |
| Visible symptoms | "Brown spots" ✔ | *echoed the example list from the question* | Brown concentric lesions |
| Likely cause | "Fusarium" ✘ | "Brown rotted leaves" | Early blight (*Alternaria solani*) |
| Total time (5 questions, CPU) | ≈6.9 s | ≈8.4 s | — |

Additional probe observations (500M): a synthetic non-plant image was correctly answered "No";
a powdery-mildew leaf was described as "a white artificial leaf" with no symptoms (missed);
image tiling (`do_image_splitting: true`) was ~10× slower with no accuracy gain, so it is disabled.

What this means for users (and is stated in the UI):

- Treat **visible signs** as the most useful output.
- Plant names and disease names are **guesses**, frequently wrong.
- No calibrated confidence exists. The models do not report certainty; PlantGuard therefore
  shows "Certainty not reported" instead of inventing a number.

## Browser and device constraints

| Requirement | Notes |
|---|---|
| Secure context (HTTPS or `localhost`) | Needed for the Cache API, Workers and camera. |
| WebAssembly | Required (CPU path). Available in all current browsers. |
| WebGPU | Optional acceleration when a usable adapter is detected. Support and driver compatibility vary; untested browsers/devices are not certified. The worker falls back to WASM automatically if WebGPU session creation fails (unless the user forced WebGPU). |
| Storage | ≈350 MB (500M) / ≈210 MB (256M) incl. ORT WASM. The app checks `navigator.storage.estimate()` before downloading and requests persistent storage. |
| Memory | Roughly 1–1.5 GB free RAM for 500M while running; less for 256M. Low-memory phones may crash the worker — the app catches this and suggests the lite model. |
| Speed | Device-dependent. Recorded CPU fixture timings are examples, not a physical-phone performance guarantee. |

We have **not** measured performance on every device class. Do not advertise universal support.

## Download and cache lifecycle

1. Initial readiness checks read the saved asset manifest and Cache API without downloading or probing remote metadata. Model download requires an explicit user action.
2. Transformers.js loads pinned q8/q4 assets in the vision worker, reporting download/initialization progress.
3. Model metadata, selected ONNX files and exact runtime JS/WASM assets belong to transformers-cache, not the service-worker precache.
4. Cancel download terminates the worker, rejects pending requests and waits for the state to settle. Completed files are reused on retry.
5. A ready in-memory model with missing cache writes is session-only. Repair download disposes it and reloads to retry caching after space is freed.
6. On reload/re-check, every required manifest entry must exist. Missing entries clear offline readiness; a cached model still needs initialization and a successful inference on the target device.
7. Delete removes the selected revision's model entries; the shared runtime and user observations are kept.

Transformers.js 4.3.1 tokenizer detection probes main without passing revision. The worker pins env.remotePathTemplate as well as from_pretrained options, avoiding an unpinned probe and its offline failure. Required tokenizer/processor metadata and runtime entries are checked explicitly, not inferred from weight availability alone.

## Verification scope for this implementation

The real Node CPU check on 11 October 2026 completed the pinned 500M prompt sequence in about 6.9 seconds. It described Brown spots but suggested Fusarium for an early-blight fixture. This establishes working local inference, not diagnostic accuracy. Detailed browser verification and remaining physical-device limits are recorded in IMPLEMENTATION_REPORT.md and TESTING.md.

npm run test:real-browser uses production worker code and identical pinned files streamed from .model-cache into the original download URLs, then disconnects the browser and reloads. This distinguishes actual local inference from demo tests, without treating fixture delivery as live-CDN availability. No mobile GPU, Safari, Firefox, or physical-camera compatibility is implied by Chromium emulation.

## Using a different model

Any **SmolVLM/Idefics3-compatible** ONNX repo that Transformers.js can load with
`AutoModelForImageTextToText` + `AutoProcessor` and whose `onnx/` folder contains
`embed_tokens`, `vision_encoder` and `decoder_model_merged` files in the chosen dtypes:

```env
VITE_AI_MODEL_ID=your-org/your-smolvlm-finetune
VITE_AI_MODEL_REVISION=<commit-hash>
VITE_AI_MODEL_DTYPE=embed_tokens=q8,vision_encoder=q4,decoder_model_merged=q4
```

Then verify it before deploying:

```bash
npm run verify:model                      # checks the env config + that files exist on the Hub
VERIFY_PRESET=smolvlm-500m npm run verify:inference   # real inference for a built-in preset
```

A plant-disease **fine-tune** of SmolVLM would be the most impactful improvement (see ROADMAP).
Models with a different architecture (e.g. Gemma 4, Qwen2-VL) need a new provider class or
changes to `vision.worker.ts` (processor call and chat template), not just an env change.

## Troubleshooting inference

| Symptom | Likely cause / fix |
|---|---|
| "The model files could not be downloaded" | Offline, captive portal, or `huggingface.co` blocked. Already-downloaded files are kept; retry. |
| "Not enough storage space" | Free space, choose the lite model, or enable persistent storage. |
| "Your device ran out of memory" | Close tabs, use the lite model, or try CPU mode. |
| WebGPU errors | Settings → Acceleration → *CPU only*. |
| Very slow analysis | Expected with WASM on phones. The UI shows step progress and allows cancel. |
| Odd or repetitive answers | Known small-model behaviour; the parser flags echoes, truncation and contradictions as "Notes about this result". |

See also [AI_PROMPTS.md](AI_PROMPTS.md) and [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Sources

- SmolVLM-500M-Instruct model card (license, intended use, limitations): https://huggingface.co/HuggingFaceTB/SmolVLM-500M-Instruct
- SmolVLM-256M-Instruct model card: https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct
- PaliGemma 2 ONNX conversion: https://huggingface.co/onnx-community/paligemma2-3b-pt-224
- Transformers.js documentation: https://huggingface.co/docs/transformers.js
- Transformers.js v4 release notes: https://github.com/huggingface/transformers.js/releases/tag/4.0.0
- Hugging Face Hub API (file listings used for sizes): `https://huggingface.co/api/models/<id>/tree/main/onnx`
