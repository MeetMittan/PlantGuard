/**
 * Centralized connectivity state.
 *
 * `navigator.onLine === false` reliably means "offline", but `true` only means
 * a network interface exists — not that a given service is reachable. Use
 * `checkReachable()` before operations that need a specific host (e.g. a
 * model download).
 */

type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();
let started = false;

function emit() {
  const online = isOnline();
  listeners.forEach((listener) => listener(online));
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function subscribeConnectivity(listener: Listener): () => void {
  if (!started && typeof window !== 'undefined') {
    window.addEventListener('online', emit);
    window.addEventListener('offline', emit);
    started = true;
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Sends a lightweight no-cors HEAD-like request with a timeout. Resolves true
 * when the host answered at all (opaque responses count), false otherwise.
 */
export async function checkReachable(url: string, timeoutMs = 6000): Promise<boolean> {
  if (!isOnline()) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
