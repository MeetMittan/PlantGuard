import { toWriteError } from '@/lib/app-errors';
import { createId, nowIso } from '@/lib/utils';
import { db } from '../database';
import type { CarePreferences, IdentificationStatus, Plant, PlantReminder } from '../schema';

export interface PlantInput {
  name: string;
  commonName?: string;
  scientificName?: string;
  identificationStatus?: IdentificationStatus;
  notes?: string;
  care?: CarePreferences;
  reminder?: PlantReminder | null;
  cover?: Blob | null;
  coverObservationId?: string | null;
}

const DEFAULT_CARE: CarePreferences = { sunlight: 'unknown', wateringIntervalDays: null, notes: '' };

export function buildPlant(input: PlantInput & { id?: string }, now = nowIso()): Plant {
  const name = input.name.trim();
  if (!name) throw new Error('A plant needs a name.');
  return {
    id: input.id ?? createId(),
    name,
    commonName: (input.commonName ?? '').trim(),
    scientificName: (input.scientificName ?? '').trim(),
    identificationStatus: input.identificationStatus ?? 'unknown',
    notes: (input.notes ?? '').trim(),
    care: input.care ?? DEFAULT_CARE,
    reminder: input.reminder ?? null,
    cover: input.cover ?? null,
    coverObservationId: input.coverObservationId ?? null,
    createdAt: now,
    updatedAt: now,
    archived: 0,
    archivedAt: null,
  };
}

export async function createPlant(input: PlantInput): Promise<Plant> {
  const plant = buildPlant(input);
  try {
    await db.plants.add(plant);
  } catch (error) {
    throw toWriteError(error);
  }
  return plant;
}

export async function updatePlant(id: string, patch: Partial<PlantInput>): Promise<void> {
  const changes: Partial<Plant> = { ...patch, updatedAt: nowIso() };
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error('A plant needs a name.');
    changes.name = patch.name.trim();
  }
  if (patch.scientificName !== undefined) changes.scientificName = patch.scientificName.trim();
  if (patch.commonName !== undefined) changes.commonName = patch.commonName.trim();
  const updated = await db.plants.update(id, changes);
  if (!updated) throw new Error('Plant not found.');
}

/** Archiving keeps the plant and its full history; it is hidden from the default list. */
export async function setPlantArchived(id: string, archived: boolean): Promise<void> {
  const now = nowIso();
  const updated = await db.plants.update(id, { archived: archived ? 1 : 0, archivedAt: archived ? now : null, updatedAt: now });
  if (!updated) throw new Error('Plant not found.');
}

export type PlantDeleteMode = 'keep-history' | 'delete-history';

/**
 * Deletes a plant in one transaction.
 * - keep-history: observations stay in History (unlinked); care events for the plant are removed.
 * - delete-history: also deletes its observations, their assessments and photos.
 * Care tasks are unlinked in both cases.
 */
export async function deletePlant(id: string, mode: PlantDeleteMode = 'keep-history'): Promise<void> {
  await db.transaction('rw', [db.plants, db.observations, db.assessments, db.careTasks, db.careEvents], async () => {
    if (mode === 'delete-history') {
      const observationIds = (await db.observations.where('plantId').equals(id).primaryKeys()) as string[];
      if (observationIds.length) {
        await db.assessments.where('observationId').anyOf(observationIds).delete();
        await db.observations.bulkDelete(observationIds);
      }
    } else {
      await db.observations.where('plantId').equals(id).modify({ plantId: null });
    }
    await db.careEvents.where('plantId').equals(id).delete();
    await db.careTasks.where('plantId').equals(id).modify({ plantId: null });
    await db.plants.delete(id);
  });
}

export async function getPlant(id: string): Promise<Plant | undefined> {
  return db.plants.get(id);
}

export async function listPlants(options: { includeArchived?: boolean } = {}): Promise<Plant[]> {
  const plants = options.includeArchived
    ? await db.plants.toArray()
    : await db.plants.where('archived').equals(0).toArray();
  return plants.sort((a, b) => a.name.localeCompare(b.name));
}
