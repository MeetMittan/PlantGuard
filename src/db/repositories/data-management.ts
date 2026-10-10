import { db } from '../database';
import { toWriteError } from '@/lib/app-errors';

/** Clear user data atomically, retaining model manifests for weights kept in Cache API. */
export async function clearLocalData(): Promise<void> {
  try {
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.filter((table) => table.name !== 'appMetadata').map((table) => table.clear()));
      await db.appMetadata.filter((record) => !record.key.startsWith('modelManifest:') && !record.key.startsWith('modelVerified:')).delete();
    });
  } catch (error) {
    throw toWriteError(error);
  }
}
