import { Link } from 'react-router';
import { AlertTriangle, BrainCircuit, CheckCircle2, CloudOff, Download, Loader2, Wifi } from 'lucide-react';
import { useModelState } from '@/ai/model-manager/useModelManager';
import type { ModelState } from '@/ai/contracts/types';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

export function OnlineChip({ className }: { className?: string }) {
  const online = useOnlineStatus();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        online ? 'border-line bg-surface text-ink-muted' : 'border-transparent bg-sun-soft text-sun',
        className,
      )}
    >
      {online ? <Wifi className="size-3.5" aria-hidden /> : <CloudOff className="size-3.5" aria-hidden />}
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

const MODEL_LABELS: Record<ModelState, string> = {
  checking: 'Checking AI…',
  'not-downloaded': 'AI not downloaded',
  downloading: 'Downloading AI…',
  loading: 'Starting AI…',
  ready: 'AI ready offline',
  running: 'Analyzing…',
  'offline-unavailable': 'AI needs internet once',
  unsupported: 'AI unsupported here',
  error: 'AI error',
};

export function modelStateLabel(state: ModelState, cached = true): string {
  if (state === 'ready' && !cached) return 'AI ready for this session';
  return MODEL_LABELS[state];
}

export function ModelChip({ className }: { className?: string }) {
  const model = useModelState();
  const { state } = model;
  const tone =
    state === 'ready'
      ? 'bg-forest-soft text-forest-strong dark:text-forest'
      : state === 'error' || state === 'unsupported'
        ? 'bg-clay-soft text-clay'
        : state === 'not-downloaded' || state === 'offline-unavailable'
          ? 'bg-sun-soft text-sun'
          : 'bg-sky-soft text-sky';
  const icon =
    state === 'ready' ? (
      <CheckCircle2 className="size-3.5" aria-hidden />
    ) : state === 'error' || state === 'unsupported' ? (
      <AlertTriangle className="size-3.5" aria-hidden />
    ) : state === 'not-downloaded' ? (
      <Download className="size-3.5" aria-hidden />
    ) : state === 'offline-unavailable' ? (
      <CloudOff className="size-3.5" aria-hidden />
    ) : state === 'checking' ? (
      <BrainCircuit className="size-3.5" aria-hidden />
    ) : (
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
    );
  const percent = state === 'downloading' && model.progress?.percent != null ? ` ${Math.round(model.progress.percent)}%` : '';
  return (
    <Link
      to="/settings#ai-model"
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium hover:brightness-95', tone, className)}
    >
      {icon}
      <span>
        {model.providerKind === 'demo' && state === 'ready' ? 'Demo AI ready' : modelStateLabel(state, model.cached)}
        {percent}
      </span>
    </Link>
  );
}
