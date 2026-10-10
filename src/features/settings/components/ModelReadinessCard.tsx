import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, BrainCircuit, CheckCircle2, CloudOff, Download, RotateCcw, Square } from 'lucide-react';
import { modelManager, useModelState } from '@/ai/model-manager/useModelManager';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ProgressBar } from '@/components/ui/Progress';
import { useToast } from '@/components/feedback/Toaster';
import { modelStateLabel } from '@/components/feedback/StatusChips';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { formatBytes } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';

/**
 * Model readiness + download controls. Download only starts after an explicit
 * confirmation that states the download size.
 */
export function ModelReadinessCard({ compact = false, className }: { compact?: boolean; className?: string }) {
  const model = useModelState();
  const online = useOnlineStatus();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { state, progress } = model;
  const size = model.model.approxDownloadBytes;

  const startDownload = async () => {
    setConfirmOpen(false);
    try {
      await modelManager.download();
      const current = modelManager.getSnapshot();
      if (current.state === 'ready') {
        if (current.providerKind === 'demo') toast.info('Demo model ready', 'Results are simulated; real inference has not been verified.');
        else if (current.cached) toast.success('AI model ready', 'Model assets are stored locally. Try an offline scan to verify this device.');
        else toast.info('AI ready for this session', 'Some files could not be cached. Free storage, then repair the download before going offline.');
      }
    } catch (error) {
      toast.error('Model download failed', errorMessage(error));
    }
  };

  const icon =
    state === 'ready' ? (
      <CheckCircle2 className="size-5" aria-hidden />
    ) : state === 'error' || state === 'unsupported' ? (
      <AlertTriangle className="size-5" aria-hidden />
    ) : state === 'offline-unavailable' ? (
      <CloudOff className="size-5" aria-hidden />
    ) : (
      <BrainCircuit className="size-5" aria-hidden />
    );

  const description = (() => {
    switch (state) {
      case 'ready':
        return model.providerKind === 'demo'
          ? 'Demo provider active. Results are simulated.'
          : model.cached
            ? `Model files are stored on this device${model.device ? ` · runs on ${model.device === 'webgpu' ? 'GPU (WebGPU)' : 'CPU (WASM)'}` : ''}. Try an offline scan to verify this device.`
            : 'The model is ready for this session, but some files could not be stored. Offline analysis is not ready.';
      case 'not-downloaded':
        return `Download once (${size ? `about ${formatBytes(size, 0)}` : 'size varies'}) while connected. After that, analysis runs on your device, even offline.`;
      case 'offline-unavailable':
        return 'The model has not been downloaded yet, and you are offline. Connect to the internet once to download it.';
      case 'downloading':
        return 'Downloading model files. You can keep using the app.';
      case 'loading':
        return 'Starting the model from local storage…';
      case 'running':
        return 'Analyzing a photo…';
      case 'unsupported':
        return model.error?.message ?? 'This browser cannot run the model.';
      case 'error':
        return model.error?.message ?? 'Something went wrong with the model.';
      default:
        return 'Checking whether the model is stored on this device…';
    }
  })();

  const busy = state === 'downloading' || state === 'loading';
  const percent = progress?.percent ?? null;

  return (
    <section
      aria-labelledby="model-readiness-title"
      className={cn('rounded-card border border-line bg-surface p-5 shadow-card', className)}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            state === 'ready' ? 'bg-forest-soft text-forest' : state === 'error' || state === 'unsupported' ? 'bg-clay-soft text-clay' : 'bg-sun-soft text-sun',
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="model-readiness-title" className="font-sans text-base font-semibold">
            {model.providerKind === 'demo' && state === 'ready' ? 'Demo AI ready' : modelStateLabel(state, model.cached)}
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted" aria-live="polite">
            {description}
          </p>
          {!compact ? <p className="mt-1 text-xs text-ink-subtle">{model.model.label}</p> : null}
        </div>
      </div>

      {busy ? (
        <div className="mt-4 space-y-2">
          <ProgressBar value={state === 'loading' ? null : percent} label="Model download progress" />
          <div className="flex items-center justify-between gap-3 text-xs text-ink-subtle">
            <span>
              {state === 'loading'
                ? 'Initializing…'
                : progress?.loadedBytes != null && progress.totalBytes
                  ? `${formatBytes(progress.loadedBytes)} of ${formatBytes(progress.totalBytes)}`
                  : 'Preparing download…'}
            </span>
            <Button
              size="sm"
              variant="ghost"
              icon={<Square className="size-3.5" aria-hidden />}
              onClick={() =>
                void modelManager.cancel().then(() =>
                  toast.info(
                    state === 'downloading' ? 'Download cancelled' : 'Start-up cancelled',
                    'Files that finished downloading are kept, so the next attempt continues from there.',
                  ),
                )
              }
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {state === 'not-downloaded' ? (
          <Button icon={<Download className="size-4" aria-hidden />} onClick={() => setConfirmOpen(true)} disabled={!online}>
            Download AI model
          </Button>
        ) : null}
        {state === 'error' || (state === 'ready' && !model.cached) ? (
          <Button icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => void startDownload()} disabled={!online && !model.cached}>
            {state === 'ready' ? 'Repair download' : 'Try again'}
          </Button>
        ) : null}
        {compact && state !== 'ready' ? (
          <Link to="/settings#ai-model" className={buttonClasses('ghost', 'md')}>
            Model settings
          </Link>
        ) : null}
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Download the AI model?"
        description={`${model.model.label} · ${size ? `about ${formatBytes(size, 0)}` : 'size unknown'}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Not now
            </Button>
            <Button icon={<Download className="size-4" aria-hidden />} onClick={() => void startDownload()}>
              Download
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
          <li>This is a large download. Use Wi-Fi if you have a limited data plan.</li>
          <li>Files come from Hugging Face and are stored in this browser. Your photos are never uploaded.</li>
          <li>Running the model needs roughly 1–2 GB of free memory. Older phones may be slow or unable to run it.</li>
          <li>Browsers can delete stored data when the device is low on space. PlantGuard will tell you if the model needs downloading again.</li>
        </ul>
      </Dialog>
    </section>
  );
}
