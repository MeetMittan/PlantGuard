import { z } from 'zod';
import { symptomCodeSchema } from '../symptoms';

/**
 * Application-owned plant assessment (assessmentSchemaVersion 2).
 * Full field reference: docs/ASSESSMENT_SCHEMA.md.
 *
 * Semantics that the UI must respect:
 * - `visibleFindings` are things the model *described as visible*. They are
 *   kept separate from `possibleCauses`, which are hypotheses.
 * - Causes with origin `model-suggestion` come from the model; causes with
 *   origin `reference-library` are curated general causes associated with a
 *   symptom tag. Neither is a confirmed diagnosis.
 * - There is no numeric probability anywhere. The models used do not provide
 *   calibrated confidence.
 * - `recommendations` are curated, conservative text (never model-generated).
 * - `referenceIds` only ever come from the offline reference library.
 */
export const ASSESSMENT_SCHEMA_VERSION = 2 as const;

export const assessmentStatusSchema = z.enum([
  'possible_issue',
  'no_obvious_symptoms',
  'insufficient_evidence',
  'image_quality_issue',
  'not_a_plant',
  'analysis_unavailable',
]);
export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;

const text = (max: number) => z.string().trim().max(max);

export const photoQualitySchema = z.object({
  verdict: z.enum(['suitable', 'too_dark', 'too_bright', 'blurry', 'too_small', 'unknown']),
  issues: z.array(text(200)).max(5),
  metrics: z
    .object({
      meanBrightness: z.number().min(0).max(255),
      sharpness: z.number().min(0),
      minDimension: z.number().int().nonnegative(),
    })
    .nullable(),
  method: z.literal('pixel-heuristic'),
});
export type PhotoQuality = z.infer<typeof photoQualitySchema>;

export const plantIdentificationSchema = z.object({
  suggestedCommonName: text(120).min(1).nullable(),
  /** Never filled by the current models — kept for future fine-tuned models that justify it. */
  suggestedScientificName: text(160).min(1).nullable(),
  alternatives: z.array(text(120).min(1)).max(3),
  status: z.enum(['model-suggested', 'unknown']),
  uncertaintyNote: text(400),
});
export type PlantIdentification = z.infer<typeof plantIdentificationSchema>;

export const visibleFindingSchema = z.object({
  code: symptomCodeSchema,
  label: text(80).min(1),
  description: text(300).min(1),
  evidence: text(300).min(1),
  caveat: text(300).nullable(),
});
export type VisibleFinding = z.infer<typeof visibleFindingSchema>;

export const causeCategorySchema = z.enum(['disease', 'pest', 'environmental', 'nutrient', 'mechanical', 'unknown']);

export const possibleCauseSchema = z.object({
  id: text(80).min(1),
  name: text(120).min(1),
  category: causeCategorySchema,
  origin: z.enum(['model-suggestion', 'reference-library']),
  rationale: text(500).min(1),
  supportingFindings: z.array(symptomCodeSchema).max(8),
  uncertainty: text(400).min(1),
  distinguishingChecks: z.array(text(240).min(1)).max(5),
  referenceIds: z.array(text(80).min(1)).max(4),
});
export type PossibleCause = z.infer<typeof possibleCauseSchema>;

export const recommendationsSchema = z.object({
  immediate: z.array(text(300).min(1)).max(6),
  followUp: z.array(text(300).min(1)).max(6),
  prevention: z.array(text(300).min(1)).max(6),
  expertHelp: text(600).min(1),
});
export type Recommendations = z.infer<typeof recommendationsSchema>;

export const assessmentProviderSchema = z.enum(['transformersjs', 'demo']);
export type AssessmentProvider = z.infer<typeof assessmentProviderSchema>;

export const plantAssessmentSchema = z
  .object({
    id: z.string().min(1).max(100),
    /** Null until the observation is saved. */
    observationId: z.string().min(1).max(100).nullable(),
    assessmentSchemaVersion: z.literal(ASSESSMENT_SCHEMA_VERSION),
    /** `partial` when some answers were unusable and fields were left empty. */
    status: z.enum(['complete', 'partial']),
    overallAssessment: assessmentStatusSchema,
    photoQuality: photoQualitySchema,
    plantIdentification: plantIdentificationSchema,
    visibleFindings: z.array(visibleFindingSchema).max(12),
    possibleCauses: z.array(possibleCauseSchema).max(4),
    recommendations: recommendationsSchema,
    referenceIds: z.array(text(80).min(1)).max(10),
    guidanceSource: z.literal('plantguard-curated'),
    limitations: z.array(text(400).min(1)).min(1).max(8),
    validationIssues: z.array(text(300)).max(12),
    /** The short raw answers to the fixed questions (no image data), for transparency. */
    modelAnswers: z.string().max(1500),
    modelId: z.string().min(1).max(200),
    modelRevision: z.string().max(80).nullable(),
    promptVersion: z.string().min(1).max(40),
    provider: assessmentProviderSchema,
    runtimeInfo: z.object({ device: z.enum(['webgpu', 'wasm']).nullable() }),
    createdAt: z.iso.datetime(),
    inferenceDurationMs: z.number().int().nonnegative().nullable(),
  })
  .superRefine((value, ctx) => {
    const ids = value.possibleCauses.map((cause) => cause.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['possibleCauses'], message: 'Duplicate cause ids.' });
    }
    if (value.overallAssessment === 'not_a_plant' && value.possibleCauses.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['possibleCauses'], message: 'A non-plant photo cannot have plant causes.' });
    }
  });

export type PlantAssessment = z.infer<typeof plantAssessmentSchema>;

/** Coarse status used for indexing, filtering and badges. */
export type HealthStatus = 'healthy' | 'concern' | 'unclear' | 'unassessed';

export function healthStatusOf(assessment: Pick<PlantAssessment, 'overallAssessment'> | null | undefined): HealthStatus {
  if (!assessment) return 'unassessed';
  switch (assessment.overallAssessment) {
    case 'no_obvious_symptoms':
      return 'healthy';
    case 'possible_issue':
      return 'concern';
    case 'analysis_unavailable':
      return 'unassessed';
    default:
      return 'unclear';
  }
}

export const AI_DISCLAIMER =
  'AI-generated estimate from an on-device general-purpose vision model. It is not a diagnosis and may be wrong.';
