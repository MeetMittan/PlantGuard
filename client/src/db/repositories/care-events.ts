import Dexie from 'dexie';
import { toDayKey } from '@/lib/dates';
import { toWriteError } from '@/lib/app-errors';
import { createId, nowIso } from '@/lib/utils';
import { db } from '../database';
import type { CareEvent, CareEventType } from '../schema';

export const CARE_EVENT_TYPES: CareEventType[] = ['watering', 'inspection', 'pruning', 'soil-check', 'fertilizing', 'note', 'other'];

export interface CareEventInput {
  plantId: string;
  eventType: CareEventType;
  occurredAt: Date;
  notes: string;
  values?: Record<string, number | string> | null;
}

export async function createCareEvent(input: CareEventInput): Promise<CareEvent> {
  if (!(await db.plants.get(input.plantId))) throw new Error('Plant not found.');
  if (Number.isNaN(input.occurredAt.getTime())) throw new Error('Invalid date.');
  const event: CareEvent = {
    id: createId(),
    plantId: input.plantId,
    eventType: input.eventType,
    occurredAt: input.occurredAt.toISOString(),
    dayKey: toDayKey(input.occurredAt),
    notes: input.notes.trim().slice(0, 2000),
    values: input.values ?? null,
    createdAt: nowIso(),
  };
  try {
    await db.careEvents.add(event);
  } catch (error) {
    throw toWriteError(error);
  }
  return event;
}

export async function updateCareEvent(id: string, patch: Partial<Pick<CareEventInput, 'eventType' | 'notes' | 'occurredAt'>>): Promise<void> {
  const changes: Partial<CareEvent> = {};
  if (patch.eventType) changes.eventType = patch.eventType;
  if (patch.notes !== undefined) changes.notes = patch.notes.trim().slice(0, 2000);
  if (patch.occurredAt) {
    changes.occurredAt = patch.occurredAt.toISOString();
    changes.dayKey = toDayKey(patch.occurredAt);
  }
  const updated = await db.careEvents.update(id, changes);
  if (!updated) throw new Error('Care entry not found.');
}

export async function deleteCareEvent(id: string): Promise<void> {
  await db.careEvents.delete(id);
}

/** A plant's care events, newest first, via the [plantId+occurredAt] index. */
export async function careEventsForPlant(plantId: string, limit?: number): Promise<CareEvent[]> {
  const collection = db.careEvents
    .where('[plantId+occurredAt]')
    .between([plantId, Dexie.minKey], [plantId, Dexie.maxKey])
    .reverse();
  return limit ? collection.limit(limit).toArray() : collection.toArray();
}

export async function careEventsPerDay(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  await db.careEvents.each((event) => counts.set(event.dayKey, (counts.get(event.dayKey) ?? 0) + 1));
  return counts;
}
