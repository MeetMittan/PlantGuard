import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Registers the service worker and shows a non-blocking prompt when a new app
 * version is waiting. The update is only applied when the user chooses, so an
 * in-progress scan or form is never interrupted by a reload.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for updates hourly while the app stays open.
      if (registration) setInterval(() => void registration.update().catch(() => undefined), 60 * 60 * 1000);
    },
  });

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface-raised p-3 pl-4 shadow-float lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0"
    >
      <p className="flex-1 text-sm text-ink">
        {needRefresh
          ? 'A new version of PlantGuard is available.'
          : 'App screens are cached — PlantGuard will open without a connection.'}
      </p>
      {needRefresh ? (
        <Button size="sm" icon={<RefreshCw className="size-4" aria-hidden />} onClick={() => void updateServiceWorker(true)}>
          Update
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dismiss"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
