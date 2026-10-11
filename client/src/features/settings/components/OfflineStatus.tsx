import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, HardDrive, ShieldCheck, XCircle } from 'lucide-react';
import { useModelState } from '@/ai/model-manager/useModelManager';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { useToast } from '@/components/feedback/Toaster';
import { getStorageEstimate, requestPersistentStorage, type StorageEstimateInfo } from '@/services/storage/storage';
import { formatBytes } from '@/lib/format';
import { checkAppCache, checkLocalDatabase } from '@/services/storage/offline-readiness';

function Check({ ok, label, detail }: { ok: boolean | null; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      {ok === null ? (
        <CircleDashed className="mt-0.5 size-5 shrink-0 text-ink-subtle" aria-hidden />
      ) : ok ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden />
      ) : (
        <XCircle className="mt-0.5 size-5 shrink-0 text-clay" aria-hidden />
      )}
      <div>
        <p className="text-sm font-medium">
          {label}: <span className="font-normal">{ok === null ? 'unknown' : ok ? 'yes' : 'no'}</span>
        </p>
        <p className="text-xs text-ink-subtle">{detail}</p>
      </div>
    </li>
  );
}

async function loadStatus(): Promise<{ storage: StorageEstimateInfo; swActive: boolean; databaseAvailable: boolean }> {
  const [storage, swActive, databaseAvailable] = await Promise.all([getStorageEstimate(), checkAppCache(), checkLocalDatabase()]);
  return { storage, swActive, databaseAvailable };
}

/**
 * Offline readiness based on real checks — not merely "a service worker exists".
 */
export function OfflineStatus() {
  const model = useModelState();
  const toast = useToast();
  const [storage, setStorage] = useState<StorageEstimateInfo | null>(null);
  const [swActive, setSwActive] = useState<boolean | null>(null);
  const [databaseAvailable, setDatabaseAvailable] = useState<boolean | null>(null);

  const refresh = async () => {
    const status = await loadStatus();
    setStorage(status.storage);
    setSwActive(status.swActive);
    setDatabaseAvailable(status.databaseAvailable);
  };

  useEffect(() => {
    let active = true;
    void loadStatus().then((status) => {
      if (!active) return;
      setStorage(status.storage);
      setSwActive(status.swActive);
      setDatabaseAvailable(status.databaseAvailable);
    });
    return () => {
      active = false;
    };
  }, [model.cached]);

  const persist = async () => {
    const granted = await requestPersistentStorage();
    await refresh();
    if (granted) toast.success('Storage protected', 'The browser agreed not to clear PlantGuard data automatically.');
    else toast.info('Request not granted', 'The browser decides this itself, often based on how much you use the site or whether it is installed.');
  };

  const usagePercent = storage?.usage != null && storage.quota ? (storage.usage / storage.quota) * 100 : null;

  return (
    <Card id="offline">
      <CardHeader title="Offline readiness" icon={<ShieldCheck className="size-5" />} />
      <CardBody className="space-y-5">
        <ul className="space-y-3">
          <Check ok={swActive} label="App screens cached" detail="Checks the HTML, route chunks, worker, styles and fonts against the build inventory in the app cache." />
          <Check
            ok={model.providerKind === 'demo' ? null : model.cached}
            label="AI model stored on device"
            detail={model.cached ? 'Verified: every model file is in browser storage.' : 'Download the model while online to analyze offline.'}
          />
          <Check ok={databaseAvailable} label="Local database available" detail="Checks IndexedDB access. Saved observations, plants and care history are stored on this device." />
          <Check
            ok={storage?.persisted ?? null}
            label="Protected from automatic clean-up"
            detail="Without this, the browser may delete stored data (including the model) when the device is low on space."
          />
        </ul>

        <div className="space-y-2">
          <Button size="sm" variant="secondary" onClick={() => void refresh()}>Re-check offline readiness</Button>
          <p className="flex items-center gap-2 text-sm font-medium">
            <HardDrive className="size-4" aria-hidden /> Storage used
          </p>
          {storage?.supported ? (
            <>
              <ProgressBar value={usagePercent} label="Storage used" />
              <p className="text-xs text-ink-subtle">
                {formatBytes(storage.usage)} used of about {formatBytes(storage.quota)} available to this site (browser estimate, includes the AI model).
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-subtle">This browser does not report storage usage.</p>
          )}
          {storage?.persisted === false ? (
            <Button size="sm" variant="secondary" onClick={() => void persist()}>
              Ask browser to keep data
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
