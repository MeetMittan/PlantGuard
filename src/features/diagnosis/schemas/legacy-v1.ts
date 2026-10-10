import { z } from 'zod';
import { normalizeSymptoms, isAbnormal, symptomLabel } from '../symptoms';
import { recommendationsFor } from '../services/recommendations';
import { referencesForCondition, templateForCondition } from '../references/references';
import {
  AI_DISCLAIMER,
  ASSESSMENT_SCHEMA_VERSION,
  plantAssessmentSchema,
  type AssessmentStatus,
  type PlantAssessment,
} from './assessment';

/**
 * Assessment format v1 (embedded in observations before database schema v3,
 * and used by backup format v1). Kept only to upgrade old data — never written.
 */
export const legacyAssessmentV1Schema = z.object({
  schemaVersion: z.literal(1),
  plantIdentification: z.string().nullable(),
  plantIdentificationCertainty: z.enum(['low', 'medium', 'high']).nullable(),
  overallAssessment: z.enum(['likely-healthy', 'possible-problem', 'insufficient-evidence', 'not-a-plant']),
  possibleConditions: z
    .array(
      z.object({
        name: z.string(),
        explanation: z.string(),
        supportingObservations: z.array(z.string()),
        certaintyLabel: z.enum(['low', 'medium', 'high']).nullable(),
        certaintySource: z.literal('model-self-reported'),
      }),
    )
    .max(5),
  visibleSigns: z.array(z.string()).max(12),
  reasoningSummary: z.string(),
  recommendedNextSteps: z.array(z.string()),
  preventionGuidance: z.array(z.string()),
  whenToSeekExpertHelp: z.string(),
  guidanceSource: z.literal('plantguard-curated'),
  limitations: z.array(z.string()),
  parseWarnings: z.array(z.string()),
  rawModelOutput: z.string(),
  modelId: z.string(),
  modelRevision: z.string().nullable(),
  provider: z.enum(['transformersjs', 'demo']),
  promptVersion: z.string(),
  assessedAt: z.iso.datetime(),
  inferenceMs: z.number().int().nonnegative().nullable(),
});

export type LegacyAssessmentV1 = z.infer<typeof legacyAssessmentV1Schema>;

const STATUS_MAP: Record<LegacyAssessmentV1['overallAssessment'], AssessmentStatus> = {
  'likely-healthy': 'no_obvious_symptoms',
  'possible-problem': 'possible_issue',
  'insufficient-evidence': 'insufficient_evidence',
  'not-a-plant': 'not_a_plant',
};

/**
 * Converts a v1 assessment into the current schema without inventing data:
 * signs are re-tagged with the taxonomy, the v1 condition becomes a
 * model-suggestion cause, guidance is re-derived from the curated rules, and
 * photo quality is "unknown" (it was never measured).
 */
export function upgradeLegacyAssessment(legacy: LegacyAssessmentV1, ids: { id: string; observationId: string | null }): PlantAssessment {
  const status = STATUS_MAP[legacy.overallAssessment];
  const findings = normalizeSymptoms(legacy.visibleSigns).map(({ code, phrases }) => ({
    code,
    label: symptomLabel(code),
    description: phrases.join('; ').slice(0, 300),
    evidence: `The model described seeing: “${phrases.join('”, “')}”.`.slice(0, 300),
    caveat: code === 'other' ? 'Could not be matched to a known symptom category.' : null,
  }));
  const abnormal = findings.map((f) => f.code).filter(isAbnormal);
  const causes =
    status === 'not_a_plant'
      ? []
      : legacy.possibleConditions.slice(0, 1).map((condition) => ({
          id: 'model-suggestion',
          name: condition.name.slice(0, 120),
          category: 'unknown' as const,
          origin: 'model-suggestion' as const,
          rationale: 'Suggested by the on-device model (recorded with an earlier PlantGuard version).',
          supportingFindings: abnormal,
          uncertainty: 'Named by the on-device model. Small general-purpose models often name the wrong condition.',
          distinguishingChecks: templateForCondition(condition.name)?.distinguishingChecks ?? [
            'Compare with photos in trusted guides, or ask a local expert to look at the plant.',
          ],
          referenceIds: referencesForCondition(condition.name).slice(0, 3).map((ref) => ref.id),
        }));

  return plantAssessmentSchema.parse({
    id: ids.id,
    observationId: ids.observationId,
    assessmentSchemaVersion: ASSESSMENT_SCHEMA_VERSION,
    status: legacy.parseWarnings.length ? 'partial' : 'complete',
    overallAssessment: status,
    photoQuality: { verdict: 'unknown', issues: [], metrics: null, method: 'pixel-heuristic' },
    plantIdentification: {
      suggestedCommonName: legacy.plantIdentification?.slice(0, 120) || null,
      suggestedScientificName: null,
      alternatives: [],
      status: legacy.plantIdentification ? 'model-suggested' : 'unknown',
      uncertaintyNote: 'A guess by a small general-purpose model. It is often wrong.',
    },
    visibleFindings: findings.slice(0, 12),
    possibleCauses: causes,
    recommendations: recommendationsFor(status, findings.map((f) => f.code)),
    referenceIds: [...new Set(causes.flatMap((cause) => cause.referenceIds))],
    guidanceSource: 'plantguard-curated',
    limitations: [AI_DISCLAIMER, 'Recorded with an earlier PlantGuard version; photo quality was not measured.'],
    validationIssues: [...legacy.parseWarnings, 'Upgraded from assessment format v1.'].slice(0, 12),
    modelAnswers: legacy.rawModelOutput.slice(0, 1500),
    modelId: legacy.modelId,
    modelRevision: legacy.modelRevision,
    promptVersion: legacy.promptVersion,
    provider: legacy.provider,
    runtimeInfo: { device: null },
    createdAt: legacy.assessedAt,
    inferenceDurationMs: legacy.inferenceMs,
  });
}
