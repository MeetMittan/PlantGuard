import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database';
import { jpegBlob, resetDatabase, sampleAssessment } from '@/test/db-helpers';
import {
  createObservation,
  deleteObservation,
  getObservation,
  observationStats,
  queryObservations,
  updateObservation,
} from './observations';
import { createPlant, deletePlant, listPlants, setPlantArchived } from './plants';
import { allCompletions, completeCareTask, createCareTask, uncompleteCareTask } from './care';
import { createPlace, deletePlace, listPlaces } from './places';
import { getSettings, updateSettings } from './settings';

beforeEach(resetDatabase);

const baseObservation = {
  label: 'Balcony tomato',
  context: 'spots after rain',
  image: jpegBlob(),
  thumbnail: jpegBlob(),
  imageWidth: 640,
  imageHeight: 480,
};

describe('observations repository', () => {
  it('creates, reads, updates and deletes', async () => {
    const created = await createObservation({ ...baseObservation, assessment: sampleAssessment() });
    expect(created.healthStatus).toBe('concern');
    expect(created.searchText).toContain('brown spots');

    const updated = await updateObservation(created.id, { notes: 'Removed two leaves' });
    expect(updated.notes).toBe('Removed two leaves');
    expect(updated.searchText).toContain('removed two leaves');

    await deleteObservation(created.id);
    expect(await getObservation(created.id)).toBeUndefined();
  });

  it('stores the local day key at creation time', async () => {
    const created = await createObservation({ ...baseObservation, assessment: null, createdAt: new Date(2026, 2, 12, 23, 45) });
    expect(created.dayKey).toBe('2026-03-12');
    expect(created.healthStatus).toBe('unassessed');
  });

  it('filters, searches, sorts and paginates', async () => {
    await createObservation({ ...baseObservation, label: 'Rose', assessment: sampleAssessment('healthy'), createdAt: new Date(2026, 2, 1) });
    await createObservation({ ...baseObservation, label: 'Tomato A', assessment: sampleAssessment(), createdAt: new Date(2026, 2, 5) });
    await createObservation({ ...baseObservation, label: 'Tomato B', assessment: sampleAssessment(), createdAt: new Date(2026, 2, 9) });

    expect((await queryObservations()).items.map((o) => o.label)).toEqual(['Tomato B', 'Tomato A', 'Rose']);
    expect((await queryObservations({ sort: 'oldest' })).items[0]!.label).toBe('Rose');
    expect((await queryObservations({ status: 'healthy' })).total).toBe(1);
    expect((await queryObservations({ search: 'TOMATO' })).total).toBe(2);
    expect((await queryObservations({ search: 'early blight' })).total).toBe(2);
    expect((await queryObservations({ fromDay: '2026-03-04', toDay: '2026-03-06' })).items.map((o) => o.label)).toEqual(['Tomato A']);
    const page = await queryObservations({ limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(3);
  });

  it('computes statistics from stored records only', async () => {
    await createObservation({ ...baseObservation, assessment: sampleAssessment(), createdAt: new Date(2026, 2, 5) });
    await createObservation({ ...baseObservation, assessment: sampleAssessment(), createdAt: new Date(2026, 2, 5) });
    await createObservation({ ...baseObservation, assessment: sampleAssessment('healthy'), createdAt: new Date(2026, 2, 6) });
    const stats = await observationStats();
    expect(stats.total).toBe(3);
    expect(stats.identifiedPlants).toBe(2);
    expect(stats.byStatus.concern).toBe(2);
    expect(stats.perDay.get('2026-03-05')).toBe(2);
  });
});

describe('plants repository', () => {
  const input = { name: ' Basil ', species: '', notes: '', care: { sunlight: 'full-sun' as const, wateringIntervalDays: 2, notes: '' }, reminder: null };

  it('creates trimmed plants, archives them and hides archived by default', async () => {
    const plant = await createPlant(input);
    expect(plant.name).toBe('Basil');
    await setPlantArchived(plant.id, true);
    expect((await db.plants.get(plant.id))?.archivedAt).not.toBeNull();
    expect(await listPlants()).toHaveLength(0);
    expect(await listPlants({ includeArchived: true })).toHaveLength(1);
  });

  it('unlinks observations and tasks when a plant is deleted', async () => {
    const plant = await createPlant(input);
    const observation = await createObservation({ ...baseObservation, assessment: null, plantId: plant.id });
    const task = await createCareTask({ title: 'Water basil', kind: 'water', plantId: plant.id });
    await deletePlant(plant.id);
    expect((await getObservation(observation.id))?.plantId).toBeNull();
    expect((await db.careTasks.get(task.id))?.plantId).toBeNull();
  });
});

describe('care repository', () => {
  it('counts a task once per local day even if completed twice', async () => {
    const task = await createCareTask({ title: 'Water', kind: 'water' });
    const morning = new Date(2026, 2, 12, 8);
    const evening = new Date(2026, 2, 12, 20);
    const first = await completeCareTask(task, morning);
    const second = await completeCareTask(task, evening);
    expect(second.id).toBe(first.id);
    expect(await allCompletions()).toHaveLength(1);

    await completeCareTask(task, new Date(2026, 2, 13, 8));
    expect(await allCompletions()).toHaveLength(2);

    await uncompleteCareTask(task.id, '2026-03-12');
    expect((await allCompletions()).map((c) => c.dayKey)).toEqual(['2026-03-13']);
  });

  it('rejects empty task titles', async () => {
    await expect(createCareTask({ title: '   ', kind: 'custom' })).rejects.toThrow(/required/);
  });

  it('enforces the unique [taskId+dayKey] index at the database level', async () => {
    await db.careCompletions.add({ id: 'a', taskId: 't', dayKey: '2026-03-12', completedAt: new Date().toISOString(), kind: 'water' });
    await expect(
      db.careCompletions.add({ id: 'b', taskId: 't', dayKey: '2026-03-12', completedAt: new Date().toISOString(), kind: 'water' }),
    ).rejects.toThrow();
  });
});

describe('places repository', () => {
  it('validates coordinates and unlinks observations on delete', async () => {
    await expect(createPlace({ name: 'Bad', kind: 'park', lat: 95, lng: 0, notes: '' })).rejects.toThrow(/Latitude/);
    const place = await createPlace({ name: 'Lalbagh', kind: 'garden', lat: 12.95, lng: 77.58, notes: '' });
    const observation = await createObservation({ ...baseObservation, assessment: null, placeId: place.id });
    await deletePlace(place.id);
    expect(await listPlaces()).toHaveLength(0);
    expect((await getObservation(observation.id))?.placeId).toBeNull();
  });
});

describe('settings repository', () => {
  it('returns defaults and persists updates', async () => {
    expect((await getSettings()).dailyGoal).toBe(1);
    await updateSettings({ dailyGoal: 3, theme: 'dark' });
    const settings = await getSettings();
    expect(settings.dailyGoal).toBe(3);
    expect(settings.theme).toBe('dark');
  });
});
