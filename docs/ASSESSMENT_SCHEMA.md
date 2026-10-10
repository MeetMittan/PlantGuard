# Assessment schema

The authoritative Zod schema is src/features/diagnosis/schemas/assessment.ts.
Assessment schema **2**, IndexedDB schema **3** and backup version **2** are independent.

| Field | Meaning |
|---|---|
| id, observationId | Assessment identity; observation link is null until saved. |
| status | complete or partial; usable output can still be uncertain. |
| overallAssessment | possible_issue, no_obvious_symptoms, insufficient_evidence, image_quality_issue, not_a_plant, analysis_unavailable. |
| photoQuality | Pixel heuristic verdict, issues and optional brightness/sharpness/dimension metrics. |
| plantIdentification | Suggested common name or null, optional scientific name, alternatives, model-suggested/unknown status and uncertainty note. |
| visibleFindings | Up to 12 symptom codes, labels, descriptions, model-described evidence and caveats. |
| possibleCauses | Up to four hypotheses with category, model-suggestion/reference-library origin, rationale, supporting codes, uncertainty and checks. |
| recommendations | Curated immediate steps, follow-up, prevention and expert-help guidance. |
| referenceIds | IDs in the bundled curated library; no generated citations. |
| guidanceSource | Always plantguard-curated. |
| limitations, validationIssues | User-visible caveats and parser warnings. |
| modelAnswers | Raw answers, at most 1500 characters, rendered as escaped text. |
| modelId, modelRevision, promptVersion, provider | Provenance retained with every historical assessment. Demo output is labeled. |
| runtimeInfo, inferenceDurationMs, createdAt | Backend, measured duration when available, ISO timestamp. |

The schema bounds strings/arrays, validates dates/enums, rejects duplicate cause IDs and rejects plant causes for non-plant results. buildAssessment also validates reference IDs against the curated library. Tests: assessment-service.test.ts and diagnosis-library.test.ts.

Visible findings are model descriptions, not independently verified facts. Causes are hypotheses. There is no probability, certainty percentage, severity score or recovery score. Unknown and inconclusive outcomes remain uncertain. Symptom comparison uses code-set differences; omission later is not proof a symptom disappeared.

saveScan stores observation and assessment atomically. addAssessment appends; older assessments stay intact. Legacy assessments are converted conservatively during the v3 migration, discarding unsupported certainty.
