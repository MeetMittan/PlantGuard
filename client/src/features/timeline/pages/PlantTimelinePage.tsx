import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, GitCompare, History, NotebookPen, ScanLine } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageFallback';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Progress';
import { EmptyState } from '@/components/feedback/EmptyState';
import { CareEventDialog } from '../components/CareEventForm';
import { TimelineEventCard } from '../components/TimelineEventCard';
import { usePlantTimeline } from '../hooks/usePlantTimeline';

const PAGE = 30;

export default function PlantTimelinePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const timeline = usePlantTimeline(id);
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  if (timeline.loading) return <Skeleton className="h-72" />;
  if (!timeline.plant) {
    return (
      <EmptyState
        icon={<ArrowLeft className="size-7" />}
        title="Plant not found"
        description="It may have been deleted."
        action={<ButtonLink to="/garden">Back to My Garden</ButtonLink>}
      />
    );
  }

  const plant = timeline.plant;
  const toggle = (observationId: string) =>
    setSelected((current) =>
      current.includes(observationId) ? current.filter((value) => value !== observationId) : [...current.slice(-1), observationId],
    );

  return (
    <div>
      <Link to={`/garden/${plant.id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> {plant.name}
      </Link>
      <PageHeader
        title={`${plant.name} — timeline`}
        description="Observations, re-analyses and your care log in one chronological history (newest first)."
        action={
          <>
            <ButtonLink to={`/scan?plantId=${plant.id}`} icon={<ScanLine className="size-4" aria-hidden />}>
              Scan again
            </ButtonLink>
            <Button variant="secondary" icon={<NotebookPen className="size-4" aria-hidden />} onClick={() => setLogOpen(true)}>
              Add care log
            </Button>
          </>
        }
      />

      {timeline.observations.length >= 2 ? (
        <div className="sticky top-14 z-20 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur lg:top-2" aria-live="polite">
          <p className="text-sm text-ink-muted">
            {selected.length === 2 ? 'Two observations selected.' : `Select two observations to compare (${selected.length}/2).`}
          </p>
          <Button
            size="sm"
            icon={<GitCompare className="size-4" aria-hidden />}
            disabled={selected.length !== 2}
            onClick={() => navigate(`/garden/${plant.id}/compare?a=${selected[0]}&b=${selected[1]}`)}
          >
            Compare
          </Button>
        </div>
      ) : null}

      {timeline.events.length === 0 ? (
        <EmptyState
          icon={<History className="size-7" />}
          title="No history yet"
          description="Scan this plant or add a care log entry to start its timeline."
          action={
            <ButtonLink to={`/scan?plantId=${plant.id}`} icon={<ScanLine className="size-4" aria-hidden />}>
              Scan this plant
            </ButtonLink>
          }
        />
      ) : (
        <>
          <ol className="relative space-y-3 border-l-2 border-line pl-5" aria-label={`${plant.name} timeline`}>
            {timeline.events.slice(0, limit).map((event) => (
              <li key={`${event.kind}-${event.id}`} className="relative">
                <span aria-hidden className="absolute -left-[27px] top-5 size-3 rounded-full border-2 border-surface bg-forest" />
                <TimelineEventCard
                  event={event}
                  selectable={event.kind === 'observation' && timeline.observations.length >= 2}
                  selected={event.kind === 'observation' && selected.includes(event.id)}
                  onToggleSelect={toggle}
                />
              </li>
            ))}
          </ol>
          {timeline.events.length > limit ? (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((current) => current + PAGE)}>
                Show earlier entries ({timeline.events.length - limit} more)
              </Button>
            </div>
          ) : null}
        </>
      )}

      <CareEventDialog plantId={plant.id} open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}
