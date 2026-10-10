import { describe, expect, it } from 'vitest';
import { CAUSE_TEMPLATES, REFERENCE_LIBRARY } from './references/library';
import { causeTemplatesFor, referencesForCondition } from './references/references';
import { recommendationsFor } from './services/recommendations';
import { SYMPTOM_CODES, codesForPhrase, normalizeSymptoms } from './symptoms';
import { upgradeLegacyAssessment, type LegacyAssessmentV1 } from './schemas/legacy-v1';
import { plantAssessmentSchema, type AssessmentStatus } from './schemas/assessment';

describe('symptom taxonomy', () => {
  it('maps common descriptions to codes', () => {
    expect(codesForPhrase('Brown spots')).toEqual(['brown_dark_spots']);
    expect(codesForPhrase('yellowing edges')).toEqual(['yellowing']);
    expect(codesForPhrase('White powdery patches')).toContain('powdery_fuzzy');
    expect(codesForPhrase('small holes chewed')).toEqual(['holes_chewing']);
    expect(codesForPhrase('aphids on the underside')).toEqual(['visible_pests']);
  });

  it('keeps the model’s words as evidence and maps unknown phrases to "other"', () => {
    expect(normalizeSymptoms(['Brown spots', 'Silvery sheen'])).toEqual([
      { code: 'brown_dark_spots', phrases: ['Brown spots'] },
      { code: 'other', phrases: ['Silvery sheen'] },
    ]);
  });
});

describe('reference library integrity', () => {
  it('has unique ids, https URLs, review dates and valid symptom tags', () => {
    expect(new Set(REFERENCE_LIBRARY.map((ref) => ref.id)).size).toBe(REFERENCE_LIBRARY.length);
    for (const ref of REFERENCE_LIBRARY) {
      expect(ref.url).toMatch(/^https:\/\//);
      expect(ref.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ref.symptoms.every((code) => (SYMPTOM_CODES as readonly string[]).includes(code))).toBe(true);
    }
  });

  it('cause templates only reference existing library entries', () => {
    const ids = new Set(REFERENCE_LIBRARY.map((ref) => ref.id));
    for (const template of CAUSE_TEMPLATES) {
      expect(template.referenceIds.every((id) => ids.has(id))).toBe(true);
    }
  });

  it('matches references deterministically', () => {
    expect(referencesForCondition('Powdery mildew').map((ref) => ref.id)).toContain('rhs-powdery-mildews');
    expect(referencesForCondition('Something unheard of')).toEqual([]);
    expect(causeTemplatesFor(['powdery_fuzzy'], 3)[0]!.template.key).toBe('powdery-mildew');
    expect(causeTemplatesFor([], 3)).toEqual([]);
  });
});

describe('recommendations', () => {
  const statuses: AssessmentStatus[] = ['possible_issue', 'no_obvious_symptoms', 'insufficient_evidence', 'image_quality_issue', 'not_a_plant', 'analysis_unavailable'];
  it.each(statuses)('are conservative for %s', (status) => {
    const recs = recommendationsFor(status, ['brown_dark_spots', 'powdery_fuzzy', 'holes_chewing']);
    const text = [...recs.immediate, ...recs.followUp, ...recs.prevention, recs.expertHelp].join(' ');
    expect(text).not.toMatch(/\b(\d+\s?(ml|mg|g|%)|dose|dosage|fungicide|pesticide|insecticide|cure|will fix)\b/i);
    expect(recs.expertHelp).toMatch(/extension service|expert|nursery/i);
  });
});

describe('legacy v1 assessments', () => {
  it('upgrade to a valid v2 assessment without inventing data', () => {
    const legacy: LegacyAssessmentV1 = {
      schemaVersion: 1,
      plantIdentification: 'Tomato',
      plantIdentificationCertainty: null,
      overallAssessment: 'possible-problem',
      possibleConditions: [{ name: 'Early blight', explanation: 'x', supportingObservations: [], certaintyLabel: null, certaintySource: 'model-self-reported' }],
      visibleSigns: ['Brown spots'],
      reasoningSummary: '',
      recommendedNextSteps: [],
      preventionGuidance: [],
      whenToSeekExpertHelp: '',
      guidanceSource: 'plantguard-curated',
      limitations: ['x'],
      parseWarnings: [],
      rawModelOutput: 'signs: Brown spots.',
      modelId: 'm',
      modelRevision: null,
      provider: 'transformersjs',
      promptVersion: 'plant-qa-v1',
      assessedAt: '2026-01-01T10:00:00.000Z',
      inferenceMs: 100,
    };
    const upgraded = upgradeLegacyAssessment(legacy, { id: 'a1', observationId: 'o1' });
    expect(plantAssessmentSchema.safeParse(upgraded).success).toBe(true);
    expect(upgraded).toMatchObject({ overallAssessment: 'possible_issue', createdAt: legacy.assessedAt, observationId: 'o1' });
    expect(upgraded.photoQuality.verdict).toBe('unknown');
    expect(upgraded.possibleCauses[0]).toMatchObject({ name: 'Early blight', origin: 'model-suggestion' });
    expect(upgraded.validationIssues).toContain('Upgraded from assessment format v1.');
  });
});
