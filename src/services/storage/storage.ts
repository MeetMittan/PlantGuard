export interface StorageEstimateInfo {
  supported: boolean;
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
}

export async function getStorageEstimate(): Promise<StorageEstimateInfo> {
  const manager = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!manager?.estimate) return { supported: false, usage: null, quota: null, persisted: null };
  try {
    const [estimate, persisted] = await Promise.all([
      manager.estimate(),
      manager.persisted ? manager.persisted() : Promise.resolve(null),
    ]);
    return { supported: true, usage: estimate.usage ?? null, quota: estimate.quota ?? null, persisted };
  } catch {
    return { supported: false, usage: null, quota: null, persisted: null };
  }
}

/**
 * Asks the browser to protect site data from automatic eviction. Browsers may
 * deny silently (Chrome uses engagement heuristics, Safari may ignore it), so
 * the result is reported to the user rather than assumed.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  const manager = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!manager?.persist) return null;
  try {
    if (manager.persisted && (await manager.persisted())) return true;
    return await manager.persist();
  } catch {
    return null;
  }
}

/** Returns true if there is likely room for `bytes` more data (with a safety margin). */
export async function hasRoomFor(bytes: number): Promise<boolean | null> {
  const estimate = await getStorageEstimate();
  if (estimate.quota === null || estimate.usage === null) return null;
  return estimate.quota - estimate.usage > bytes * 1.2;
}
