# Roadmap

Items below are **not implemented**. They are listed so nothing is mistaken for an existing feature.

## AI quality

- **Plant-disease fine-tune** of SmolVLM (e.g. on PlantVillage/PlantDoc-style data with
  licence-compatible images), exported to ONNX and offered as a preset. This is the most
  impactful improvement — the current models are general-purpose.
- **Large desktop preset** (e.g. `onnx-community/gemma-4-E2B-it-ONNX`, ≈3.2 GB) behind a clear
  size warning; needs a provider variant for its processor/chat template.
- Evaluation harness with a small labelled image set to measure accuracy per preset.
- Optional **Ollama provider** for desktop development (separately running local service; never
  presented as browser-native).

## Features

- Nearby park discovery (online-only; e.g. Overpass API with throttling, caching and attribution).
- Browser notifications for reminders where supported (opt-in; honest about platform limits).
- Multiple photos per observation (top/underside), photo comparison over time.
- Localisation (UI strings) beyond date/number formatting.
- Optional, opt-in cloud backup/sync with authentication and deletion controls.

## Engineering

- Strict Content-Security-Policy validated against real inference.
- Self-hosting script for the ORT WASM on hosts without a 25 MiB limit.
- Lighthouse/axe checks in CI; visual regression screenshots.
- Virtualised history list for very large collections (current: incremental "show more").
