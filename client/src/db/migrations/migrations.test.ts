import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { PlantGuardDatabase } from '../database';
import { LATEST_SCHEMA_VERSION, SCHEMA_VERSIONS } from './index';
import { plantAssessmentSchema } from '@/features/diagnosis/schemas/assessment';

const names: string[] = [];
const dbName = () => {
  const name = `migration-test-${Math.random().toString(36).slice(2)}`;
  names.push(name);
  return name;
};

afterEach(async () => {
  await Promise.all(names.splice(0).map((name) => Dexie.delete(name)));
});

const legacyObservation = (overrides: Record<string, unknown> = {}) => ({
  id: 'obs-1',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  dayKey: '2026-01-01',
  plantId: 'plant-1',
  label: 'Old Rose',
  context: '',
  notes: 'Black spots',
  assessment: null,
  healthStatus: 'unassessed',
  image: null,
  thumbnail: null,
  imageWidth: null,
  imageHeight: null,
  location: null,
  placeId: null,
  ...overrides,
});

const legacyAssessment = {
  schemaVersion: 1,
  plantIdentification: 'Rose',
  plantIdentificationCertainty: null,
  overallAssessment: 'possible-problem',
  possibleConditions: [{ name: 'Black spot', explanation: 'x', supportingObservations: [], certaintyLabel: null, certaintySource: 'model-self-reported' }],
  visibleSigns: ['Black spots', 'Yellowing'],
  reasoningSummary: '',
  recommendedNextSteps: [],
  preventionGuidance: [],
  whenToSeekExpertHelp: '',
  guidanceSource: 'plantguard-curated',
  limitations: ['x'],
  parseWarnings: [],
  rawModelOutput: 'signs: Black spots, yellowing.',
  modelId: 'HuggingFaceTB/SmolVLM-500M-Instruct',
  modelRevision: 'abc',
  provider: 'transformersjs',
  promptVersion: 'plant-qa-v1',
  assessedAt: '2026-01-01T10:00:00.000Z',
  inferenceMs: 1200,
};

describe('database migrations', () => {
  it('has strictly increasing versions', () => {
    const versions = SCHEMA_VERSIONS.map((v) => v.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(LATEST_SCHEMA_VERSION).toBe(versions.at(-1));
  });

  it('upgrades v1 data to the latest schema and backfills searchText without losing records', async () => {
    const name = dbName();
    const v1 = new PlantGuardDatabase(name, SCHEMA_VERSIONS.filter((v) => v.version === 1));
    await v1.open();
    await v1.table('observations').add(legacyObservation());
    v1.close();

    const latest = new PlantGuardDatabase(name);
    await latest.open();
    expect(latest.verno).toBe(LATEST_SCHEMA_VERSION);
    const migrated = await latest.observations.get('obs-1');
    expect(migrated?.label).toBe('Old Rose');
    expect(migrated?.searchText).toContain('old rose');
    expect(migrated?.searchText).toContain('black spots');
    latest.close();
  });

  it('moves embedded v2 assessments into the assessments table and upgrades plants (v2 → v3)', async () => {
    const name = dbName();
    const v2 = new PlantGuardDatabase(name, SCHEMA_VERSIONS.filter((v) => v.version <= 2));
    await v2.open();
    await v2.table('observations').bulkAdd([
      legacyObservation({ assessment: legacyAssessment, healthStatus: 'concern' }),
      legacyObservation({ id: 'obs-2', label: 'No analysis' }),
    ]);
    await v2.table('plants').add({
      id: 'plant-1',
      name: 'Rose',
      species: 'Rosa',
      cover: null,
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-02T09:00:00.000Z',
      notes: '',
      care: { sunlight: 'unknown', wateringIntervalDays: null, notes: '' },
      reminder: null,
      archived: 1,
    });
    v2.close();

    const latest = new PlantGuardDatabase(name);
    await latest.open();
    const observation = await latest.observations.get('obs-1');
    expect(observation).toMatchObject({
      observedAt: '2026-01-01T10:00:00.000Z',
      latestAssessmentId: 'obs-1-a1',
      healthStatus: 'concern',
      plantSuggestion: 'Rose',
      schemaVersion: 3,
    });
    expect(observation?.symptomTags).toEqual(['brown_dark_spots', 'yellowing']);
    expect(observation && 'assessment' in observation).toBe(false);

    const assessments = await latest.assessments.toArray();
    expect(assessments).toHaveLength(1);
    expect(plantAssessmentSchema.safeParse(assessments[0]).success).toBe(true);
    expect(assessments[0]).toMatchObject({ observationId: 'obs-1', overallAssessment: 'possible_issue', createdAt: legacyAssessment.assessedAt });

    expect(await latest.observations.get('obs-2')).toMatchObject({ latestAssessmentId: null, healthStatus: 'unassessed' });

    const plant = await latest.plants.get('plant-1');
    expect(plant).toMatchObject({ scientificName: 'Rosa', identificationStatus: 'user-entered', archivedAt: '2026-01-02T09:00:00.000Z' });
    expect(plant && 'species' in plant).toBe(false);
    latest.close();
  });
});
