import Dexie from 'dexie';
import { healthStatusOf, type HealthStatus, type PlantAssessment } from '@/features/diagnosis/schemas/assessment';
import { toDayKey } from '@/lib/dates';
import { AppError, toWriteError } from '@/lib/app-errors';
import { createId, nowIso } from '@/lib/utils';
import { db } from '../database';
import type { AssessmentRecord, CaptureSource, GeoPoint, Observation, Plant } from '../schema';
import { assessmentSearchTerms, buildObservationSearchText } from '../search-text';
import { buildPlant, type PlantInput } from './plants';

export interface NewObservationInput {
  /** Pre-assigned id makes saving idempotent (a repeated tap cannot create a duplicate). */
  id?: string;
  label: string;
  context: string;
  notes?: string;
  plantId?: string | null;
  image: Blob | null;
  thumbnail: Blob | null;
  mimeType?: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  captureSource?: CaptureSource;
  capturedAt?: string | null;
  /** User-chosen observation time; defaults to creation time. */
  observedAt?: Date;
  location?: GeoPoint | null;
  placeId?: string | null;
  /** Injected for tests; defaults to now. */
  createdAt?: Date;
}

function denormalize(observation: Observation, assessment: PlantAssessment | null): Observation {
  const next: Observation = {
    ...observation,
    latestAssessmentId: assessment?.id ?? null,
    healthStatus: healthStatusOf(assessment),
    symptomTags: assessment ? assessment.visibleFindings.map((finding) => finding.code) : [],
    plantSuggestion: assessment?.plantIdentification.suggestedCommonName ?? null,
  };
  next.searchText = buildObservationSearchText({ ...next, extraTerms: assessmentSearchTerms(assessment) });
  return next;
}

function buildObservation(input: NewObservationInput): Observation {
  const created = input.createdAt ?? new Date();
  const observation: Observation = {
    id: input.id ?? createId(),
    plantId: input.plantId ?? null,
    capturedAt: input.capturedAt ?? null,
    observedAt: (input.observedAt ?? created).toISOString(),
    createdAt: created.toISOString(),
    updatedAt: created.toISOString(),
    dayKey: toDayKey(created),
    label: input.label.trim(),
    context: input.context.trim(),
    notes: (input.notes ?? '').trim(),
    image: input.image,
    thumbnail: input.thumbnail,
    mimeType: input.mimeType ?? (input.image ? input.image.type || 'image/jpeg' : null),
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
    imageByteSize: input.image ? input.image.size : null,
    captureSource: input.captureSource ?? 'gallery',
    symptomTags: [],
    latestAssessmentId: null,
    healthStatus: 'unassessed',
    plantSuggestion: null,
    location: input.location ?? null,
    placeId: input.placeId ?? null,
    searchText: '',
    schemaVersion: 3,
  };
  return denormalize(observation, null);
}

export interface SaveScanInput {
  observation: NewObservationInput & { id: string };
  assessment: PlantAssessment | null;
  /** Create this plant in the same transaction and link the observation to it. */
  newPlant?: PlantInput & { id?: string };
}

export interface SaveScanResult {
  observation: Observation;
  plant: Plant | null;
  /** True when this observation id was already saved (e.g. a repeated tap). */
  alreadySaved: boolean;
}

/**
 * Saves an observation, its assessment and (optionally) a new plant in ONE
 * transaction. Idempotent per observation id. Failures throw a coded AppError
 * (DATABASE_WRITE_FAILED or INSUFFICIENT_STORAGE) and nothing partial is stored.
 */
export async function saveScan(input: SaveScanInput): Promise<SaveScanResult> {
  try {
    return await db.transaction('rw', [db.observations, db.assessments, db.plants], async () => {
      const existing = await db.observations.get(input.observation.id);
      if (existing) return { observation: existing, plant: null, alreadySaved: true };

      let plant: Plant | null = null;
      let plantId = input.observation.plantId ?? null;
      if (input.newPlant) {
        plant = buildPlant(input.newPlant);
        await db.plants.add(plant);
        plantId = plant.id;
      } else if (plantId && !(await db.plants.get(plantId))) {
        plantId = null; // The selected plant was deleted meanwhile; save unlinked rather than dangling.
      }

      let observation = buildObservation({ ...input.observation, plantId });
      if (input.assessment) {
        const record: AssessmentRecord = { ...input.assessment, observationId: observation.id };
        await db.assessments.add(record);
        observation = denormalize(observation, record);
      }
      await db.observations.add(observation);
      return { observation, plant, alreadySaved: false };
    });
  } catch (error) {
    throw toWriteError(error);
  }
}

/** Convenience used by tests and imports: save without the scan wrapper. */
export async function createObservation(input: NewObservationInput & { assessment?: PlantAssessment | null }): Promise<Observation> {
  const id = input.id ?? createId();
  const { observation } = await saveScan({ observation: { ...input, id }, assessment: input.assessment ?? null });
  return observation;
}

/** Adds a new assessment (e.g. a rescan). Earlier assessments are never modified. */
export async function addAssessment(observationId: string, assessment: PlantAssessment): Promise<Observation> {
  try {
    return await db.transaction('rw', [db.observations, db.assessments], async () => {
      const observation = await db.observations.get(observationId);
      if (!observation) throw new AppError('DATABASE_WRITE_FAILED', 'This observation no longer exists.');
      const record: AssessmentRecord = { ...assessment, observationId };
      await db.assessments.add(record);
      const next = denormalize({ ...observation, updatedAt: nowIso() }, record);
      await db.observations.put(next);
      return next;
    });
  } catch (error) {
    throw toWriteError(error);
  }
}

export type ObservationPatch = Partial<Pick<Observation, 'label' | 'notes' | 'plantId' | 'placeId'>> & { observedAt?: Date };

/** Updates user-authored fields only. AI assessments are never touched. */
export async function updateObservation(id: string, patch: ObservationPatch): Promise<Observation> {
  try {
    return await db.transaction('rw', [db.observations, db.assessments, db.plants], async () => {
      const existing = await db.observations.get(id);
      if (!existing) throw new AppError('DATABASE_WRITE_FAILED', 'This observation no longer exists.');
      if (patch.plantId && !(await db.plants.get(patch.plantId))) {
        throw new AppError('DATABASE_WRITE_FAILED', 'The selected plant no longer exists.');
      }
      const { observedAt, ...rest } = patch;
      const next: Observation = {
        ...existing,
        ...rest,
        ...(observedAt ? { observedAt: observedAt.toISOString() } : {}),
        updatedAt: nowIso(),
      };
      const latest = next.latestAssessmentId ? await db.assessments.get(next.latestAssessmentId) : undefined;
      next.searchText = buildObservationSearchText({ ...next, extraTerms: assessmentSearchTerms(latest) });
      await db.observations.put(next);
      return next;
    });
  } catch (error) {
    throw toWriteError(error);
  }
}

/** Deletes an observation together with its assessments (and its image Blobs). */
export async function deleteObservation(id: string): Promise<void> {
  await db.transaction('rw', [db.observations, db.assessments, db.plants], async () => {
    await db.assessments.where('observationId').equals(id).delete();
    await db.plants.where('id').above('').filter((plant) => plant.coverObservationId === id).modify({ coverObservationId: null });
    await db.observations.delete(id);
  });
}

export async function getObservation(id: string): Promise<Observation | undefined> {
  return db.observations.get(id);
}

export async function getAssessment(id: string): Promise<AssessmentRecord | undefined> {
  return db.assessments.get(id);
}

/** All assessments for an observation, newest first. */
export async function assessmentsForObservation(observationId: string): Promise<AssessmentRecord[]> {
  const records = await db.assessments
    .where('[observationId+createdAt]')
    .between([observationId, Dexie.minKey], [observationId, Dexie.maxKey])
    .toArray();
  return records.reverse();
}

export async function clearObservations(): Promise<void> {
  await db.transaction('rw', [db.observations, db.assessments, db.plants], async () => {
    await db.assessments.clear();
    await db.observations.clear();
    await db.plants.toCollection().modify({ coverObservationId: null });
  });
}

export interface ObservationQuery {
  search?: string;
  status?: HealthStatus | 'all';
  plantId?: string | null;
  fromDay?: string;
  toDay?: string;
  sort?: 'newest' | 'oldest';
  offset?: number;
  limit?: number;
}

export interface ObservationPage {
  items: Observation[];
  total: number;
}

/**
 * Filters observations using the createdAt index for ordering. Images are
 * loaded only for the returned page, keeping memory bounded for long histories.
 */
export async function queryObservations(query: ObservationQuery = {}): Promise<ObservationPage> {
  const search = query.search?.trim().toLowerCase() ?? '';
  const status = query.status ?? 'all';
  let collection = db.observations.orderBy('createdAt');
  if (query.sort !== 'oldest') collection = collection.reverse();

  const filtered = collection.filter((observation) => {
    if (status !== 'all' && observation.healthStatus !== status) return false;
    if (query.plantId && observation.plantId !== query.plantId) return false;
    if (query.fromDay && observation.dayKey < query.fromDay) return false;
    if (query.toDay && observation.dayKey > query.toDay) return false;
    if (search && !observation.searchText.includes(search)) return false;
    return true;
  });

  const total = await filtered.clone().count();
  const items = await filtered
    .offset(query.offset ?? 0)
    .limit(query.limit ?? 24)
    .toArray();
  return { items, total };
}

export async function recentObservations(limit = 4): Promise<Observation[]> {
  return db.observations.orderBy('createdAt').reverse().limit(limit).toArray();
}

/**
 * A plant's observations ordered by observedAt (newest first by default), via
 * the [plantId+observedAt] index. Ties are broken by createdAt, then id.
 */
export async function observationsForPlant(
  plantId: string,
  options: { order?: 'newest' | 'oldest'; limit?: number } = {},
): Promise<Observation[]> {
  const items = await db.observations
    .where('[plantId+observedAt]')
    .between([plantId, Dexie.minKey], [plantId, Dexie.maxKey])
    .toArray();
  items.sort(
    (a, b) => a.observedAt.localeCompare(b.observedAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  if (options.order !== 'oldest') items.reverse();
  return options.limit ? items.slice(0, options.limit) : items;
}

export async function countObservationsForPlant(plantId: string): Promise<number> {
  return db.observations.where('plantId').equals(plantId).count();
}

export async function observationsWithLocation(): Promise<Observation[]> {
  const all = await db.observations.orderBy('createdAt').reverse().toArray();
  return all.filter((observation) => observation.location !== null);
}

export interface ObservationStats {
  total: number;
  identifiedPlants: number;
  byStatus: Record<HealthStatus, number>;
  /** Count of observations per local day key. */
  perDay: Map<string, number>;
}

export async function observationStats(): Promise<ObservationStats> {
  const byStatus: Record<HealthStatus, number> = { healthy: 0, concern: 0, unclear: 0, unassessed: 0 };
  const perDay = new Map<string, number>();
  const identified = new Set<string>();
  let total = 0;
  // Iterate without loading blobs into an array all at once.
  await db.observations.each((observation) => {
    total += 1;
    byStatus[observation.healthStatus] += 1;
    perDay.set(observation.dayKey, (perDay.get(observation.dayKey) ?? 0) + 1);
    if (observation.plantSuggestion) identified.add(observation.plantSuggestion.trim().toLowerCase());
  });
  return { total, identifiedPlants: identified.size, byStatus, perDay };
}
