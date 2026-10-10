import { useSyncExternalStore } from 'react';
import { isOnline, subscribeConnectivity } from '@/services/connectivity/connectivity';

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeConnectivity(() => onChange()),
    isOnline,
    () => true,
  );
}
