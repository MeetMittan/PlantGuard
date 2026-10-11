import { describe, expect, it } from 'vitest';
import type { InferenceResult } from '@/ai/contracts/types';
import type { AnswerSet } from '@/ai/utils/parse-answers';
import type { QualityMetrics } from '@/services/image-processing/quality';
import { REFERENCE_LIBRARY } from '../references/library';
import { plantAssessmentSchema } from '../schemas/assessment';
import { AssessmentValidationError, buildAssessment } from './assessment-service';

const a = (text: string, truncated = false) => ({ text, truncated });
const GOOD: QualityMetrics = { meanBrightness: 133, sharpness: 666, minDimension: 640 };

const inference = (answers: AnswerSet, overrides: Partial<InferenceResult> = {}): InferenceResult => ({
  answers,
  modelId: 'HuggingFaceTB/SmolVLM-500M-Instruct',
  modelRevision: 'a7da5b9',
  promptVersion: 'plant-qa-v1',
  provider: 'transformersjs',
  device: 'wasm',
  inferenceMs: 6930,
  ...overrides,
});

const build = (answers: AnswerSet, quality: QualityMetrics | null = GOOD, overrides: Partial<InferenceResult> = {}) =>
  buildAssessment({ inference: inference(answers, overrides), quality, now: new Date('2026-03-12T10:00:00Z') });

describe('buildAssessment — valid outputs', () => {
  it('turns real SmolVLM-500M answers into a valid, cautious possible-issue assessment', () => {
    // Recorded from the real model on tests/fixtures/tomato-early-blight.jpg.
    const result = build({ isPlant: a(' Yes.'), plant: a(' Vegetable.'), health: a(' Unclear.'), signs: a(' Brown spots.'), condition: a(' Fusarium.') });
    expect(plantAssessmentSchema.safeParse(result).success).toBe(true);
    expect(result.overallAssessment).toBe('possible_issue');
    expect(result.status).toBe('complete');
    expect(result.visibleFindings.map((f) => f.code)).toEqual(['brown_dark_spots']);
    expect(result.visibleFindings[0]!.evidence).toContain('Brown spots');
    expect(result.plantIdentification).toMatchObject({ suggestedCommonName: 'Vegetable', status: 'model-suggested', suggestedScientificName: null });

    const [model, ...library] = result.possibleCauses;
    expect(model).toMatchObject({ name: 'Fusarium', origin: 'model-suggestion', category: 'disease' });
    expect(model!.uncertainty).toMatch(/often name the wrong condition/);
    expect(library.length).toBeGreaterThan(0);
    expect(library.every((cause) => cause.origin === 'reference-library')).toBe(true);
    expect(library.map((cause) => cause.name)).toContain('Fungal or bacterial leaf spot');
    expect(result.recommendations.immediate.length).toBeGreaterThan(0);
    expect(result.guidanceSource).toBe('plantguard-curated');
  });

  it('returns no_obvious_symptoms only when the model says healthy and reports nothing abnormal', () => {
    const result = build({ isPlant: a('Yes'), plant: a('Basil'), health: a('Healthy'), signs: a('None') });
    expect(result.overallAssessment).toBe('no_obvious_symptoms');
    expect(result.possibleCauses).toEqual([]);
    expect(result.visibleFindings.map((f) => f.code)).toEqual(['no_obvious_symptoms']);
  });

  it('never contains a numeric probability field', () => {
    const json = JSON.stringify(build({ isPlant: a('Yes'), health: a('Diseased'), signs: a('Spots'), condition: a('Blight') }));
    expect(json).not.toMatch(/"(probability|confidence|score)"/);
  });
});

describe('buildAssessment — uncertain, unknown and unsuitable inputs', () => {
  it('handles an unknown plant', () => {
    const result = build({ isPlant: a('Yes'), plant: a('Unknown'), health: a('Healthy'), signs: a('None') });
    expect(result.plantIdentification).toMatchObject({ suggestedCommonName: null, status: 'unknown' });
  });

  it('returns not_a_plant for non-plant photos, without plant details or causes', () => {
    const result = build({ isPlant: a('No.') });
    expect(result.overallAssessment).toBe('not_a_plant');
    expect(result.visibleFindings).toEqual([]);
    expect(result.possibleCauses).toEqual([]);
    expect(result.plantIdentification.suggestedCommonName).toBeNull();
  });

  it('returns image_quality_issue for a poor photo with no clear findings', () => {
    const dark: QualityMetrics = { meanBrightness: 20, sharpness: 15, minDimension: 640 };
    const result = build({ isPlant: a('Yes'), health: a('Unclear'), signs: a('None') }, dark);
    expect(result.overallAssessment).toBe('image_quality_issue');
    expect(result.photoQuality.verdict).toBe('too_dark');
    expect(result.recommendations.immediate.join(' ')).toMatch(/Retake/);
  });

  it('keeps a possible issue on a poor photo but adds the quality limitation', () => {
    const blurry: QualityMetrics = { meanBrightness: 130, sharpness: 10, minDimension: 640 };
    const result = build({ isPlant: a('Yes'), health: a('Diseased'), signs: a('Yellowing') }, blurry);
    expect(result.overallAssessment).toBe('possible_issue');
    expect(result.limitations[0]).toMatch(/Photo quality check/);
  });

  it('returns insufficient_evidence for hedged or unparseable answers and marks the result partial', () => {
    const result = build({ isPlant: a('Yes'), plant: a('Unknown'), health: a('blorp'), signs: a('None') });
    expect(result.overallAssessment).toBe('insufficient_evidence');
    expect(result.status).toBe('partial');
    expect(result.validationIssues.join(' ')).toMatch(/could not be interpreted/);
  });

  it('flags truncated output as partial', () => {
    const result = build({ isPlant: a('Yes'), health: a('Diseased'), signs: a('Brown spots along the', true) });
    expect(result.status).toBe('partial');
    expect(result.validationIssues.join(' ')).toMatch(/length limit/);
  });

  it('discards echoed example symptoms (recorded SmolVLM-256M output) and records "uncertain"', () => {
    const result = build({
      isPlant: a(' Yes.'),
      plant: a(' Raspberry.'),
      health: a(' Disease.'),
      signs: a(' Brown spots, yellowing, black circles/holes, wilting, mold or white powder.'),
      condition: a(' Brown rotted leaves.'),
    });
    expect(result.visibleFindings.map((f) => f.code)).toEqual(['uncertain']);
    expect(result.validationIssues.join(' ')).toMatch(/repeated the example symptoms/);
    expect(result.overallAssessment).toBe('possible_issue');
  });

  it('does not trust "healthy" when symptoms are also described', () => {
    const result = build({ isPlant: a('Yes'), health: a('Healthy'), signs: a('Yellowing and brown spots') });
    expect(result.overallAssessment).toBe('possible_issue');
    expect(result.validationIssues.join(' ')).toMatch(/extra caution/);
  });

  it('maps unrecognised symptom phrases to "other" instead of dropping them', () => {
    const result = build({ isPlant: a('Yes'), health: a('Diseased'), signs: a('Strange silvery sheen') });
    expect(result.visibleFindings[0]).toMatchObject({ code: 'other', caveat: expect.stringMatching(/Could not be matched/) });
  });
});

describe('buildAssessment — references and safety', () => {
  it('attaches only references from the curated library', () => {
    const result = build({ isPlant: a('Yes'), health: a('Diseased'), signs: a('White powdery patches'), condition: a('Powdery mildew') });
    const known = new Set(REFERENCE_LIBRARY.map((ref) => ref.id));
    expect(result.referenceIds.length).toBeGreaterThan(0);
    expect(result.referenceIds.every((id) => known.has(id))).toBe(true);
    expect(result.possibleCauses[0]!.referenceIds).toContain('rhs-powdery-mildews');
  });

  it('leaves a model hypothesis without references when the library has no match', () => {
    const result = build({ isPlant: a('Yes'), health: a('Diseased'), signs: a('Spots'), condition: a('Zebra syndrome') });
    expect(result.possibleCauses[0]).toMatchObject({ name: 'Zebra syndrome', origin: 'model-suggestion', referenceIds: [] });
  });

  it('drops treatment instructions from the model and never prescribes chemicals or doses', () => {
    const result = build({ isPlant: a('Yes'), health: a('Diseased'), signs: a('Spots'), condition: a('Spray 10 ml fungicide weekly') });
    expect(result.possibleCauses.some((cause) => cause.origin === 'model-suggestion')).toBe(false);
    expect(result.validationIssues.join(' ')).toMatch(/treatment instructions/);
    const guidance = [...result.recommendations.immediate, ...result.recommendations.followUp, ...result.recommendations.prevention].join(' ');
    expect(guidance).not.toMatch(/\b(ml|mg|dose|dosage|fungicide|pesticide|insecticide|spray with)\b/i);
  });

  it('caps causes at four with unique ids', () => {
    const result = build({
      isPlant: a('Yes'),
      health: a('Diseased'),
      signs: a('Yellowing, brown spots, holes, curling, wilting, white powder, insects'),
      condition: a('Leaf spot'),
    });
    expect(result.possibleCauses.length).toBeLessThanOrEqual(4);
    expect(new Set(result.possibleCauses.map((cause) => cause.id)).size).toBe(result.possibleCauses.length);
  });

  it('throws AssessmentValidationError instead of returning an invalid record', () => {
    expect(() => build({ isPlant: a('Yes'), health: a('Healthy'), signs: a('None') }, GOOD, { modelId: '' })).toThrow(AssessmentValidationError);
  });

  it('renders markup in model answers as plain data', () => {
    const result = build({ isPlant: a('Yes'), plant: a('<img src=x onerror=alert(1)>'), health: a('Healthy'), signs: a('None') });
    expect(result.plantIdentification.suggestedCommonName).toContain('<img');
  });
});
