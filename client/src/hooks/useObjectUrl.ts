import { useEffect } from 'react';

/**
 * Ref-counted object URLs. Each Blob gets one URL shared by every component
 * showing it; the URL is revoked shortly after the last user unmounts. The
 * short delay makes this safe under React StrictMode (which unmounts and
 * remounts effects in development) and for quick list re-renders.
 */
interface Entry {
  url: string;
  refs: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const REVOKE_DELAY_MS = 2000;
const entries = new Map<Blob, Entry>();

function scheduleRevoke(blob: Blob, entry: Entry) {
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    if (entry.refs === 0) {
      URL.revokeObjectURL(entry.url);
      entries.delete(blob);
    }
  }, REVOKE_DELAY_MS);
}

function entryFor(blob: Blob): Entry {
  let entry = entries.get(blob);
  if (!entry) {
    entry = { url: URL.createObjectURL(blob), refs: 0, timer: null };
    entries.set(blob, entry);
    // Revoke if no component ever commits with this URL.
    scheduleRevoke(blob, entry);
  }
  return entry;
}

export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const url = blob ? entryFor(blob).url : null;

  useEffect(() => {
    if (!blob) return undefined;
    const entry = entryFor(blob);
    entry.refs += 1;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    return () => {
      entry.refs -= 1;
      if (entry.refs === 0) scheduleRevoke(blob, entry);
    };
  }, [blob]);

  return url;
}

/** Test helper: number of live object URLs. */
export function liveObjectUrlCount(): number {
  return entries.size;
}
