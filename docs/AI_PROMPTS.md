# AI prompts and evidence handling

Current prompt: **plant-qa-v1**, src/ai/prompts/plant-analysis.ts.
run-analysis.ts sequences questions; parse-answers.ts interprets them; features/diagnosis/services/assessment-service.ts builds the validated [assessment](ASSESSMENT_SCHEMA.md).

Small SmolVLM models often echo templates or produce unreliable JSON. Application code assembles structured output deterministically from short answers.

| Step | Purpose | Token limit |
|---|---|---|
| isPlant | Plant/leaf? yes or no | 8 |
| plant | Suggested common name or unknown | 16 |
| health | healthy, diseased, unclear | 8 |
| signs | One short sentence describing signs, or none | 48 |
| condition | Possible cause or unknown, only for a concern | 24 |

Each call uses the chat template, image, greedy decoding and repetition penalty 1.1. Image splitting is disabled. The image is decoded once per analysis; prompt/image preprocessing repeats per question. The environment token setting is an upper bound.

Context is capped at 200 characters, collapsed to one line and quoted as a photographer's note. Sanitizing does not guarantee resistance to prompt injection. The model never executes actions, uploads photos or generates treatment instructions.

Negative plant answers stop early. Unknown, hedged, truncated, contradictory or echoed output yields conservative outcomes/warnings. Findings stay separate from cause hypotheses. A healthy answer contradicted by spots cannot hide the concern. Pixel quality heuristics can produce image_quality_issue; they are not calibrated scores.

References and recommendations come from the curated library/services. The model cannot insert citations, chemical dosages or confidence percentages. Every saved assessment retains model, commit, provider and prompt version. Raw answers are bounded, rendered as text.

The real 500M CPU check on the early-blight fixture answered Vegetable / Unclear / Brown spots / Fusarium. This proves inference mechanics, not disease accuracy. The guessed cause remains explicitly unconfirmed.

Tests cover echoes, truncation, contradictions, non-plants, unknowns, hostile markup, reference validation and safe recommendations. See [TESTING.md](TESTING.md).
