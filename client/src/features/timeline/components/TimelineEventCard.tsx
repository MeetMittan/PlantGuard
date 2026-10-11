import { Link } from 'react-router';
import { Droplets, Eye, FileText, Flower2, NotebookPen, RefreshCcw, Scissors, Shovel, Sprout } from 'lucide-react';
import type { CareEventType } from '@/db/schema';
import { ObservationThumb } from '@/components/common/ObservationThumb';
import { AssessmentStatusBadge } from '@/features/diagnosis/components/AssessmentStatusBadge';
import { symptomLabel } from '@/features/diagnosis/symptoms';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TimelineEvent } from '../services/timeline';
import { CARE_EVENT_LABELS } from './CareEventForm';

const CARE_ICONS: Record<CareEventType, React.ReactNode> = {
  watering: <Droplets className="size-4" aria-hidden />,
  inspection: <Eye className="size-4" aria-hidden />,
  pruning: <Scissors className="size-4" aria-hidden />,
  'soil-check': <Shovel className="size-4" aria-hidden />,
  fertilizing: <Flower2 className="size-4" aria-hidden />,
  note: <NotebookPen className="size-4" aria-hidden />,
  other: <Sprout className="size-4" aria-hidden />,
};

export function TimelineEventCard({
  event,
  selectable,
  selected,
  onToggleSelect,
}: {
  event: TimelineEvent;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (observationId: string) => void;
}) {
  if (event.kind === 'care') {
    return (
      <div className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-soft text-sky">{CARE_ICONS[event.event.eventType]}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{CARE_EVENT_LABELS[event.event.eventType]}</p>
          <p className="text-xs text-ink-subtle">{formatDateTime(event.at)} · logged by you</p>
          {event.event.notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{event.event.notes}</p> : null}
        </div>
      </div>
    );
  }

  if (event.kind === 'reassessment') {
    return (
      <div className="flex gap-3 rounded-2xl border border-dashed border-line p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-ink-muted">
          <RefreshCcw className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Photo re-analysed</p>
          <p className="text-xs text-ink-subtle">{formatDateTime(event.at)}</p>
          <div className="mt-1">
            <AssessmentStatusBadge status={event.assessment.overallAssessment} />
          </div>
          <Link to={`/history/${event.observationId}`} className="mt-1 inline-block text-xs font-medium text-forest underline">
            View observation
          </Link>
        </div>
      </div>
    );
  }

  const { observation, assessment } = event;
  const tags = assessment?.visibleFindings.map((finding) => finding.code).filter((code) => code !== 'uncertain' && code !== 'no_obvious_symptoms') ?? [];
  return (
    <div className={cn('flex gap-3 rounded-2xl border bg-surface p-3', selected ? 'border-forest ring-2 ring-forest/30' : 'border-line')}>
      <ObservationThumb blob={observation.thumbnail} alt="" className="size-20 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to={`/history/${observation.id}`} className="text-sm font-semibold hover:underline">
            {observation.label || 'Observation'}
          </Link>
          {selectable ? (
            <label className="flex items-center gap-1.5 text-xs text-ink-muted">
              <input type="checkbox" checked={selected} onChange={() => onToggleSelect?.(observation.id)} />
              Compare
            </label>
          ) : null}
        </div>
        <p className="text-xs text-ink-subtle">Observed {formatDateTime(observation.observedAt)}</p>
        {assessment ? <AssessmentStatusBadge status={assessment.overallAssessment} /> : <p className="text-xs text-ink-subtle">Saved without AI analysis</p>}
        {tags.length ? <p className="text-xs text-ink-muted">Recorded: {tags.map(symptomLabel).join(', ')}</p> : null}
        {observation.notes ? (
          <p className="flex items-start gap-1 text-xs text-ink-muted">
            <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {observation.notes}
          </p>
        ) : null}
        {event.assessmentCount > 1 ? <p className="text-xs text-ink-subtle">{event.assessmentCount} assessments of this photo</p> : null}
      </div>
    </div>
  );
}
