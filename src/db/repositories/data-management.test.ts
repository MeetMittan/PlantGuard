import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../database';
import { resetDatabase, sampleAssessment } from '@/test/db-helpers';
import { createPlant } from './plants';
import { createObservation, clearObservations } from './observations';
import { createCareEvent } from './care-events';
import { getMetadata, setMetadata, updateSettings } from './settings';
import { clearLocalData } from './data-management';

beforeEach(resetDatabase);

describe('data cleanup and storage recovery', () => {
  it('clears assessments and care events, keeps the model manifest and removes user metadata', async () => {
    const plant = await createPlant({ name: 'Basil' });
    await createObservation({ label: 'Leaf', context: '', plantId: plant.id, assessment: sampleAssessment(), image: null, thumbnail: null, imageWidth: null, imageHeight: null });
    await createCareEvent({ plantId: plant.id, eventType: 'note', notes: 'Checked soil', occurredAt: new Date() });
    await setMetadata('modelManifest:test', '["weight"]');
    await setMetadata('lastCelebratedStreak', 3);
    await clearLocalData();
    expect(await db.assessments.count()).toBe(0);
    expect(await db.careEvents.count()).toBe(0);
    expect(await db.observations.count()).toBe(0);
    expect(await db.plants.count()).toBe(0);
    expect(await getMetadata('modelManifest:test')).toBe('["weight"]');
    expect(await getMetadata('lastCelebratedStreak')).toBeNull();
  });

  it('clearing history removes dangling plant cover links', async () => {
    const plant = await createPlant({ name: 'Basil' });
    await db.plants.update(plant.id, { coverObservationId: 'old-photo' });
    await clearObservations();
    expect((await db.plants.get(plant.id))?.coverObservationId).toBeNull();
  });

  it('settings report quota failure and can be retried after space is freed', async () => {
    const write = vi.spyOn(db.settings, 'bulkPut').mockRejectedValueOnce(new DOMException('Storage full', 'QuotaExceededError'));
    await expect(updateSettings({ theme: 'dark' })).rejects.toMatchObject({ code: 'INSUFFICIENT_STORAGE' });
    expect(await db.settings.get('theme')).toBeUndefined();
    await updateSettings({ theme: 'dark' });
    expect((await db.settings.get('theme'))?.value).toBe('dark');
    write.mockRestore();
  });
});
