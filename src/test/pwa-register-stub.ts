import { useState } from 'react';

/** Test stub for 'virtual:pwa-register/react' (the real module only exists in Vite builds). */
export function useRegisterSW() {
  const needRefresh = useState(false);
  const offlineReady = useState(false);
  return { needRefresh, offlineReady, updateServiceWorker: async () => undefined };
}
