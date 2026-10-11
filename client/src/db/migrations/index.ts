import type { Transaction } from 'dexie';
import { upgradeLegacyAssessment, legacyAssessmentV1Schema } from '@/features/diagnosis/schemas/legacy-v1';
import { healthStatusOf, type PlantAssessment } from '@/features/diagnosis/schemas/assessment';
import { assessmentSearchTerms, buildObservationSearchText } from '../search-text';

/**
 * Versioned IndexedDB schema definitions.
 *
 * Rules:
 * - Never edit a released version's `stores` or `upgrade`; add a new version.
 * - Only list indexed fields in `stores`; other properties are stored as-is.
 * - Upgrades run inside Dexie's versionchange transaction, so a failure rolls
 *   the whole upgrade back and the previous data remains intact.
 */
export interface SchemaVersion {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => Promise<void>;
  description: string;
}

/** Frozen copy of the v2 search-text builder (observations still embedded their assessment then). */
function legacySearchTextV2(observation: Record<string, unknown>): string {
  const parts: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) parts.push(value.trim());
  };
  push(observation.label);
  push(observation.notes);
  push(observation.context);
  const assessment = observation.assessment as
    | { plantIdentification?: unknown; possibleConditions?: Array<{ name?: unknown }>; visibleSigns?: unknown[] }
    | null
    | undefined;
  if (assessment) {
    push(assessment.plantIdentification);
    assessment.possibleConditions?.forEach((condition) => push(condition?.name));
    assessment.visibleSigns?.forEach(push);
  }
  return parts.join(' • ').toLowerCase();
}

export const SCHEMA_VERSIONS: SchemaVersion[] = [
  {
    version: 1,
    description: 'Initial local-first schema.',
    stores: {
      observations: 'id, createdAt, dayKey, plantId, healthStatus, placeId',
      plants: 'id, name, createdAt, archived',
      careTasks: 'id, kind, plantId, archived, createdAt',
      careCompletions: 'id, &[taskId+dayKey], taskId, dayKey',
      savedPlaces: 'id, name, kind, createdAt',
      settings: 'key',
      appMetadata: 'key',
    },
  },
  {
    version: 2,
    description: 'Add denormalized searchText to observations for fast local search.',
    stores: {
      observations: 'id, createdAt, dayKey, plantId, healthStatus, placeId',
    },
    upgrade: async (tx) => {
      await tx
        .table('observations')
        .toCollection()
        .modify((observation: Record<string, unknown>) => {
          observation.searchText = legacySearchTextV2(observation);
        });
    },
  },
  {
    version: 3,
    description:
      'Separate assessments table (many per observation), care events, observation timeline fields, plant identification status.',
    stores: {
      observations: 'id, createdAt, observedAt, dayKey, plantId, healthStatus, placeId, latestAssessmentId, [plantId+observedAt]',
      assessments: 'id, observationId, createdAt, [observationId+createdAt]',
      careEvents: 'id, plantId, occurredAt, dayKey, [plantId+occurredAt]',
    },
    upgrade: async (tx) => {
      // Read → transform → write, all inside the version-change transaction:
      // any failure rolls back both tables and leaves the v2 data untouched.
      const observations = (await tx.table('observations').toArray()) as Array<Record<string, unknown>>;
      const newAssessments: PlantAssessment[] = [];
      for (const observation of observations) {
        const legacy = legacyAssessmentV1Schema.safeParse(observation.assessment);
        let upgraded: PlantAssessment | null = null;
        if (legacy.success) {
          upgraded = upgradeLegacyAssessment(legacy.data, {
            id: `${String(observation.id)}-a1`,
            observationId: String(observation.id),
          });
          newAssessments.push(upgraded);
        }
        {
          const image = observation.image as Blob | null | undefined;
          observation.observedAt = observation.createdAt;
          observation.capturedAt = null;
          observation.mimeType = image ? image.type || 'image/jpeg' : null;
          observation.imageByteSize = image ? image.size : null;
          observation.captureSource = 'gallery';
          observation.latestAssessmentId = upgraded?.id ?? null;
          observation.symptomTags = upgraded ? upgraded.visibleFindings.map((finding) => finding.code) : [];
          observation.plantSuggestion = upgraded?.plantIdentification.suggestedCommonName ?? null;
          observation.healthStatus = healthStatusOf(upgraded);
          observation.schemaVersion = 3;
          observation.searchText = buildObservationSearchText({
            ...observation,
            extraTerms: assessmentSearchTerms(upgraded),
          });
          delete observation.assessment;
        }
      }
      if (newAssessments.length) await tx.table('assessments').bulkAdd(newAssessments);
      if (observations.length) await tx.table('observations').bulkPut(observations);
      await tx
        .table('plants')
        .toCollection()
        .modify((plant: Record<string, unknown>) => {
          const species = typeof plant.species === 'string' ? plant.species : '';
          plant.scientificName = species;
          plant.commonName = '';
          plant.identificationStatus = species ? 'user-entered' : 'unknown';
          plant.coverObservationId = null;
          plant.archivedAt = plant.archived ? plant.updatedAt : null;
          delete plant.species;
        });
    },
  },
];

export const LATEST_SCHEMA_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1]!.version;
