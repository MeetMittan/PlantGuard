import { db } from '@/db/database';
import { syncApi } from '@/services/api/syncApi';
import { isOnline } from '@/services/connectivity/connectivity';
import { getStoredAccessToken } from '@/lib/api/client';

let isSyncing = false;

export async function runSync(): Promise<{ success: boolean; appliedCount?: number }> {
  if (isSyncing) return { success: false };
  if (!isOnline()) return { success: false };
  if (!getStoredAccessToken()) return { success: false };

  isSyncing = true;
  try {
    const lastSyncedAt = localStorage.getItem('plantguard_last_synced_at') || undefined;

    // Collect local entities to send
    const [plants, observations, careTasks, careCompletions, savedPlaces] = await Promise.all([
      db.plants.toArray(),
      db.observations.toArray(),
      db.careTasks.toArray(),
      db.careCompletions.toArray(),
      db.savedPlaces.toArray(),
    ]);

    const outbox: Array<{
      clientId?: string;
      entityType: 'plant' | 'observation' | 'careTask' | 'careCompletion' | 'savedPlace';
      operation: 'create' | 'update' | 'delete';
      payload: any;
    }> = [];

    // Plants
    for (const p of plants) {
      outbox.push({
        clientId: p.id,
        entityType: 'plant',
        operation: 'create',
        payload: {
          name: p.name,
          species: p.scientificName || p.commonName || '',
          notes: p.notes,
          carePreferences: {
            wateringIntervalDays: p.care?.wateringIntervalDays || 7,
          },
        },
      });
    }

    // Observations
    for (const o of observations) {
      outbox.push({
        clientId: o.id,
        entityType: 'observation',
        operation: 'create',
        payload: {
          clientPlantId: o.plantId || undefined,
          notes: o.notes,
          location: o.location ? { latitude: o.location.lat, longitude: o.location.lng } : undefined,
          timestamp: o.observedAt,
        },
      });
    }

    // Care Tasks
    for (const t of careTasks) {
      outbox.push({
        clientId: t.id,
        entityType: 'careTask',
        operation: 'create',
        payload: {
          clientPlantId: t.plantId || undefined,
          type: t.kind === 'water' ? 'watering' : t.kind === 'health-check' ? 'inspection' : 'custom',
          title: t.title,
          frequencyDays: 7,
          isActive: t.archived === 0,
        },
      });
    }

    // Care Completions
    for (const c of careCompletions) {
      outbox.push({
        clientId: c.id,
        entityType: 'careCompletion',
        operation: 'create',
        payload: {
          taskId: c.taskId,
          completedDate: c.dayKey,
        },
      });
    }

    // Saved Places
    for (const sp of savedPlaces) {
      outbox.push({
        clientId: sp.id,
        entityType: 'savedPlace',
        operation: 'create',
        payload: {
          name: sp.name,
          latitude: sp.lat,
          longitude: sp.lng,
          description: sp.notes,
          isPublic: false,
        },
      });
    }

    const result = await syncApi.sync({
      lastSyncedAt,
      outbox: outbox.slice(0, 50),
    });

    if (result.serverVersion) {
      localStorage.setItem('plantguard_last_synced_at', result.serverVersion);
    }

    return {
      success: true,
      appliedCount: result.applied.length,
    };
  } catch (err) {
    console.warn('Sync failed:', err);
    return { success: false };
  } finally {
    isSyncing = false;
  }
}

