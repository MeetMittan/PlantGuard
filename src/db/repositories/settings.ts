import { nowIso } from '@/lib/utils';
import { toWriteError } from '@/lib/app-errors';
import { db } from '../database';
import { DEFAULT_SETTINGS, type AppSettings } from '../schema';

export async function getSettings(): Promise<AppSettings> {
  const records = await db.settings.toArray();
  const settings: AppSettings = { ...DEFAULT_SETTINGS };
  for (const record of records) {
    if (record.key in DEFAULT_SETTINGS) {
      (settings as unknown as Record<string, unknown>)[record.key] = record.value;
    }
  }
  return settings;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const entries = Object.entries(patch).filter(([key]) => key in DEFAULT_SETTINGS) as Array<
    [keyof AppSettings, AppSettings[keyof AppSettings]]
  >;
  try {
    await db.settings.bulkPut(entries.map(([key, value]) => ({ key, value })));
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function getMetadata(key: string): Promise<string | number | boolean | null> {
  return (await db.appMetadata.get(key))?.value ?? null;
}

export async function setMetadata(key: string, value: string | number | boolean | null): Promise<void> {
  await db.appMetadata.put({ key, value, updatedAt: nowIso() });
}

export const METADATA_KEYS = {
  lastExportAt: 'lastExportAt',
  persistentStorageRequested: 'persistentStorageRequested',
  lastCelebratedStreak: 'lastCelebratedStreak',
} as const;
