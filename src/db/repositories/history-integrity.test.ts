import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../database';
import { jpegBlob, resetDatabase, sampleAssessment } from '@/test/db-helpers';
import { addAssessment, assessmentsForObservation, deleteObservation, observationsForPlant, saveScan, updateObservation } from './observations';
import { createPlant, deletePlant, setPlantArchived } from './plants';
import { careEventsForPlant, careEventsPerDay, createCareEvent } from './care-events';

beforeEach(resetDatabase);

const photo = { label: 'Leaf', context: '', image: jpegBlob(), thumbnail: jpegBlob(), imageWidth: 10, imageHeight: 10 };

describe('saveScan', () => {
  it('saves observation, assessment and a new plant atomically', async () => {
    const result = await saveScan({
      observation: { ...photo, id: 'o1' },
      assessment: sampleAssessment(),
      newPlant: { name: 'Tomato', identificationStatus: 'model-suggested' },
    });
    expect(result.plant).toMatchObject({ name: 'Tomato', identificationStatus: 'model-suggested' });
    expect(result.observation.plantId).toBe(result.plant!.id);
    expect(await db.assessments.where('observationId').equals('o1').count()).toBe(1);
  });

  it('is idempotent per observation id', async () => {
    await saveScan({ observation: { ...photo, id: 'o1' }, assessment: sampleAssessment() });
    const second = await saveScan({ observation: { ...photo, id: 'o1' }, assessment: sampleAssessment() });
    expect(second.alreadySaved).toBe(true);
    expect(await db.observations.count()).toBe(1);
    expect(await db.assessments.count()).toBe(1);
  });

  it('does not link to a plant that no longer exists', async () => {
    const { observation } = await saveScan({ observation: { ...photo, id: 'o1', plantId: 'deleted-plant' }, assessment: null });
    expect(observation.plantId).toBeNull();
  });

  it('reports storage-quota failures with a coded error and stores nothing', async () => {
    const spy = vi.spyOn(db.assessments, 'add').mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    await expect(saveScan({ observation: { ...photo, id: 'o1' }, assessment: sampleAssessment() })).rejects.toMatchObject({ code: 'INSUFFICIENT_STORAGE' });
    spy.mockRestore();
    expect(await db.observations.count()).toBe(0);
  });
});

describe('assessment history', () => {
  it('keeps the old assessment when a rescan adds a new one', async () => {
    const { observation } = await saveScan({ observation: { ...photo, id: 'o1' }, assessment: sampleAssessment('problem', new Date('2026-03-01T10:00:00Z')) });
    const rescan = sampleAssessment('powdery', new Date('2026-03-02T10:00:00Z'));
    const updated = await addAssessment('o1', rescan);
    const history = await assessmentsForObservation('o1');
    expect(history.map((a) => a.id)).toEqual([rescan.id, observation.latestAssessmentId]);
    expect(updated.latestAssessmentId).toBe(rescan.id);
    expect(updated.symptomTags).toContain('powdery_fuzzy');
    expect(history[1]!.promptVersion).toBe('plant-qa-v1');
  });

  it('editing notes or the observation date never changes assessments or createdAt', async () => {
    const { observation } = await saveScan({ observation: { ...photo, id: 'o1' }, assessment: sampleAssessment() });
    const before = await db.assessments.toArray();
    const updated = await updateObservation('o1', { notes: 'Moved to a sunnier window', observedAt: new Date('2026-02-01T08:00:00Z') });
    expect(updated.createdAt).toBe(observation.createdAt);
    expect(updated.observedAt).toBe('2026-02-01T08:00:00.000Z');
    expect(await db.assessments.toArray()).toEqual(before);
  });

  it('deleting an observation removes its assessments', async () => {
    await saveScan({ observation: { ...photo, id: 'o1' }, assessment: sampleAssessment() });
    await addAssessment('o1', sampleAssessment('powdery'));
    await deleteObservation('o1');
    expect(await db.assessments.count()).toBe(0);
  });

  it('lists a plant’s observations by observation time with deterministic ties', async () => {
    const plant = await createPlant({ name: 'Fern' });
    await saveScan({ observation: { ...photo, id: 'b', plantId: plant.id, observedAt: new Date('2026-03-01T10:00:00Z'), createdAt: new Date('2026-03-05T10:00:00Z') }, assessment: null });
    await saveScan({ observation: { ...photo, id: 'a', plantId: plant.id, observedAt: new Date('2026-03-01T10:00:00Z'), createdAt: new Date('2026-03-05T10:00:00Z') }, assessment: null });
    await saveScan({ observation: { ...photo, id: 'c', plantId: plant.id, observedAt: new Date('2026-02-01T10:00:00Z') }, assessment: null });
    expect((await observationsForPlant(plant.id, { order: 'oldest' })).map((o) => o.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('plant deletion and archiving', () => {
  async function seedPlant() {
    const plant = await createPlant({ name: 'Rose' });
    await saveScan({ observation: { ...photo, id: 'o1', plantId: plant.id }, assessment: sampleAssessment() });
    await createCareEvent({ plantId: plant.id, eventType: 'watering', occurredAt: new Date(), notes: '' });
    return plant;
  }

  it('archiving keeps the full history', async () => {
    const plant = await seedPlant();
    await setPlantArchived(plant.id, true);
    expect(await observationsForPlant(plant.id)).toHaveLength(1);
    expect(await careEventsForPlant(plant.id)).toHaveLength(1);
  });

  it('keep-history deletion unlinks observations and keeps their assessments', async () => {
    const plant = await seedPlant();
    await deletePlant(plant.id, 'keep-history');
    expect((await db.observations.get('o1'))?.plantId).toBeNull();
    expect(await db.assessments.count()).toBe(1);
    expect(await db.careEvents.count()).toBe(0);
  });

  it('delete-history removes observations, assessments and care log', async () => {
    const plant = await seedPlant();
    await deletePlant(plant.id, 'delete-history');
    expect(await db.observations.count()).toBe(0);
    expect(await db.assessments.count()).toBe(0);
    expect(await db.plants.count()).toBe(0);
  });
});

describe('care events', () => {
  it('belong to an existing plant, sort newest first and count per local day', async () => {
    const plant = await createPlant({ name: 'Basil' });
    await createCareEvent({ plantId: plant.id, eventType: 'watering', occurredAt: new Date(2026, 2, 10, 23, 30), notes: 'Late watering' });
    await createCareEvent({ plantId: plant.id, eventType: 'note', occurredAt: new Date(2026, 2, 11, 7, 0), notes: 'New leaves' });
    expect((await careEventsForPlant(plant.id)).map((event) => event.eventType)).toEqual(['note', 'watering']);
    const perDay = await careEventsPerDay();
    expect(perDay.get('2026-03-10')).toBe(1); // local day, not UTC
    expect(perDay.get('2026-03-11')).toBe(1);
    await expect(createCareEvent({ plantId: 'missing', eventType: 'watering', occurredAt: new Date(), notes: '' })).rejects.toThrow(/not found/);
  });
});
