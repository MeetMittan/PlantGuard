import { config } from '@/app/config';
import { getSettings } from '@/db/repositories/settings';

/** Network-free verification of the deployed app inventory in Workbox's precache. */
export async function checkAppCache(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || typeof caches === 'undefined') return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.active) return false;
    const names = (await caches.keys()).filter((name) => name.startsWith('workbox-precache'));
    for (const name of names) {
      const cache = await caches.open(name);
      const inventory = await cache.match(new URL(`${config.basePath}offline-assets.json`, location.origin), { ignoreSearch: true });
      if (!inventory) continue;
      const files: unknown = await inventory.json();
      if (!Array.isArray(files) || !files.includes('index.html') || !files.every((file) => typeof file === 'string')) continue;
      const hits = await Promise.all(files.map((file: string) => cache.match(new URL(`${config.basePath}${file}`, location.origin), { ignoreSearch: true }).then(Boolean)));
      if (hits.every(Boolean)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function checkLocalDatabase(): Promise<boolean> {
  try {
    await getSettings();
    return true;
  } catch {
    return false;
  }
}
