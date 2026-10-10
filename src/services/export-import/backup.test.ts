import { beforeEach, describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { db } from '@/db/database';
import { createObservation } from '@/db/repositories/observations';
import { completeCareTask, createCareTask } from '@/db/repositories/care';
import { createPlant } from '@/db/repositories/plants';
import { jpegBlob, resetDatabase, sampleAssessment } from '@/test/db-helpers';
import { applyBackup, BackupError, createBackup, parseBackupFile } from './backup';

beforeEach(resetDatabase);

async function seed() {
  const plant = await createPlant({
    name: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    identificationStatus: 'user-entered',
    notes: '',
    care: { sunlight: 'full-sun', wateringIntervalDays: 2, notes: '' },
    reminder: { enabled: true, kind: 'water', intervalDays: 2 },
  });
  await createObservation({
    label: 'Leaf',
    context: '',
    plantId: plant.id,
    assessment: sampleAssessment(),
    image: jpegBlob(),
    thumbnail: jpegBlob(),
    imageWidth: 10,
    imageHeight: 10,
    location: { lat: 12.9, lng: 77.6, accuracy: 10 },
  });
  const task = await createCareTask({ title: 'Water', kind: 'water', plantId: plant.id });
  await completeCareTask(task, new Date(2026, 2, 12));
}

describe('export', () => {
  it('produces a JSON backup that validates and round-trips', async () => {
    await seed();
    const { blob, filename, manifest } = await createBackup({ includePhotos: false, appVersion: '0.1.0', now: new Date('2026-03-12T00:00:00Z') });
    expect(filename).toBe('plantguard-backup-2026-03-12.json');
    expect(manifest.data.observations[0]!.imageFile).toBeNull();

    const parsed = await parseBackupFile(blob);
    expect(parsed.summary).toMatchObject({ observations: 1, plants: 1, careTasks: 1, careCompletions: 1, photos: 0 });

    await resetDatabase();
    const result = await applyBackup(parsed, 'merge');
    expect(result.added).toBe(5); // observation, assessment, plant, task, completion
    expect(await db.observations.count()).toBe(1);
    expect((await db.observations.toArray())[0]!.searchText).toContain('brown spots');
  });

  it('produces a ZIP backup with photos', async () => {
    await seed();
    const { blob, filename } = await createBackup({ includePhotos: true, appVersion: '0.1.0' });
    expect(filename).toMatch(/\.zip$/);
    const parsed = await parseBackupFile(blob);
    expect(parsed.summary.photos).toBe(2);
    await resetDatabase();
    await applyBackup(parsed, 'merge');
    const restored = (await db.observations.toArray())[0]!;
    expect(restored.image).toBeInstanceOf(Blob);
    expect(restored.thumbnail).toBeInstanceOf(Blob);
  });
});

describe('import validation', () => {
  it('rejects non-backup JSON, empty files and invalid records', async () => {
    await expect(parseBackupFile(new Blob([]))).rejects.toThrow(/empty/);
    await expect(parseBackupFile(new Blob(['{"hello":1}']))).rejects.toThrow(/not a PlantGuard backup/);
    await expect(parseBackupFile(new Blob(['not json']))).rejects.toThrow(/not valid JSON/);
    const bad = {
      format: 'plantguard-backup',
      version: 1,
      exportedAt: '2026-03-12T00:00:00.000Z',
      appVersion: '0.1.0',
      includesPhotos: false,
      data: { observations: [{ id: 'x' }], plants: [], careTasks: [], careCompletions: [], savedPlaces: [], settings: {} },
    };
    await expect(parseBackupFile(new Blob([JSON.stringify(bad)]))).rejects.toBeInstanceOf(BackupError);
  });

  it('rejects backups from a newer format version', async () => {
    const future = JSON.stringify({ format: 'plantguard-backup', version: 99 });
    await expect(parseBackupFile(new Blob([future]))).rejects.toThrow(/newer version/);
  });

  it('ignores unexpected files inside a ZIP (no executable content is read)', async () => {
    await seed();
    const { manifest } = await createBackup({ includePhotos: false, appVersion: '0.1.0' });
    const zipped = zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest)),
      'evil.html': strToU8('<script>alert(1)</script>'),
      'images/fake.jpg': strToU8('not really a jpeg'),
    });
    const parsed = await parseBackupFile(new Blob([zipped as BlobPart]));
    expect(parsed.files.size).toBe(0);
  });
});

describe('import modes', () => {
  it('merge skips duplicates and keeps existing data', async () => {
    await seed();
    const { blob } = await createBackup({ includePhotos: false, appVersion: '0.1.0' });
    const parsed = await parseBackupFile(blob);
    const result = await applyBackup(parsed, 'merge');
    expect(result.added).toBe(0);
    expect(result.skippedDuplicates).toBe(5);
    expect(await db.observations.count()).toBe(1);
  });

  it('replace clears existing data first', async () => {
    await seed();
    const { blob } = await createBackup({ includePhotos: false, appVersion: '0.1.0' });
    const parsed = await parseBackupFile(blob);
    await createCareTask({ title: 'Extra local task', kind: 'custom' });
    await applyBackup(parsed, 'replace');
    expect((await db.careTasks.toArray()).map((t) => t.title)).toEqual(['Water']);
  });

  it('rolls back everything if the import fails part-way', async () => {
    await seed();
    const { blob } = await createBackup({ includePhotos: false, appVersion: '0.1.0' });
    const parsed = await parseBackupFile(blob);
    // Two completions for the same task/day with different ids would violate the unique index.
    parsed.manifest.data.careCompletions.push({ ...parsed.manifest.data.careCompletions[0]!, id: 'dup' });
    await resetDatabase();
    await createCareTask({ title: 'Pre-existing', kind: 'custom' });
    // Inject a failure: a plant record that violates the primary key during bulkAdd.
    parsed.manifest.data.plants.push({ ...parsed.manifest.data.plants[0]! });
    await expect(applyBackup(parsed, 'replace')).rejects.toThrow();
    // Existing data survives because the transaction rolled back.
    expect((await db.careTasks.toArray()).map((t) => t.title)).toEqual(['Pre-existing']);
    expect(await db.observations.count()).toBe(0);
  });
});
