import { createId, nowIso } from '@/lib/utils';
import { db } from '../database';
import type { PlaceKind, SavedPlace } from '../schema';

export interface PlaceInput {
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  notes: string;
}

function assertCoordinates(lat: number, lng: number) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90.');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('Longitude must be between -180 and 180.');
}

export async function createPlace(input: PlaceInput): Promise<SavedPlace> {
  assertCoordinates(input.lat, input.lng);
  const place: SavedPlace = { id: createId(), ...input, name: input.name.trim(), notes: input.notes.trim(), createdAt: nowIso() };
  await db.savedPlaces.add(place);
  return place;
}

export async function updatePlace(id: string, patch: Partial<PlaceInput>): Promise<void> {
  if (patch.lat !== undefined || patch.lng !== undefined) {
    const existing = await db.savedPlaces.get(id);
    if (!existing) throw new Error('Place not found.');
    assertCoordinates(patch.lat ?? existing.lat, patch.lng ?? existing.lng);
  }
  await db.savedPlaces.update(id, patch);
}

/** Deletes a place and unlinks observations that referenced it. */
export async function deletePlace(id: string): Promise<void> {
  await db.transaction('rw', [db.savedPlaces, db.observations], async () => {
    await db.observations.where('placeId').equals(id).modify({ placeId: null });
    await db.savedPlaces.delete(id);
  });
}

export async function listPlaces(): Promise<SavedPlace[]> {
  const places = await db.savedPlaces.toArray();
  return places.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
