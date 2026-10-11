import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ImageOff, Info, Minus, Plus, Repeat } from 'lucide-react';
import type { AssessmentRecord, Observation } from '@/db/schema';
import { PageHeader } from '@/components/layout/PageFallback';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Progress';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { AssessmentStatusBadge } from '@/features/diagnosis/components/AssessmentStatusBadge';
import { symptomLabel, type SymptomCode } from '@/features/diagnosis/symptoms';
import { formatDateTime } from '@/lib/format';
import { usePlantTimeline } from '../hooks/usePlantTimeline';
import { compareObservations } from '../services/timeline';

function latestAssessment(observation: Observation, assessments: AssessmentRecord[]): AssessmentRecord | null {
  const own = assessments.filter((assessment) => assessment.observationId === observation.id);
  return own.find((assessment) => assessment.id === observation.latestAssessmentId) ?? own.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

function Side({ title, observation, assessment }: { title: string; observation: Observation; assessment: AssessmentRecord | null }) {
  // Full photo only on this screen; fall back to the thumbnail, then to a clear missing state.
  const url = useObjectUrl(observation.image ?? observation.thumbnail);
  return (
    <Card className="overflow-hidden">
      <div className="bg-surface-muted">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" aria-label={`Open the ${title.toLowerCase()} photo in full`}>
            <img src={url} alt={`${title} photo, observed ${formatDateTime(observation.observedAt)}`} className="aspect-[4/3] w-full object-contain" />
          </a>
        ) : (
          <div className="grid aspect-[4/3] place-items-center text-sm text-ink-subtle">
            <span className="flex flex-col items-center gap-2">
              <ImageOff className="size-8" aria-hidden /> Photo unavailable
            </span>
          </div>
        )}
      </div>
      <CardBody className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
        <p className="font-medium">{formatDateTime(observation.observedAt)}</p>
        {!observation.image && observation.thumbnail ? <p className="text-xs text-ink-subtle">Only a small thumbnail was kept.</p> : null}
        {assessment ? <AssessmentStatusBadge status={assessment.overallAssessment} /> : <p className="text-sm text-ink-subtle">No AI assessment</p>}
        {assessment?.visibleFindings.length ? (
          <ul className="list-disc pl-5 text-sm text-ink-muted">
            {assessment.visibleFindings.map((finding) => (
              <li key={finding.code}>{finding.label}</li>
            ))}
          </ul>
        ) : null}
        {observation.notes ? <p className="text-sm text-ink-muted">Your notes: {observation.notes}</p> : null}
        <Link to={`/history/${observation.id}`} className="text-xs font-medium text-forest underline">
          Open observation
        </Link>
      </CardBody>
    </Card>
  );
}

function TagList({ icon, title, codes, empty }: { icon: React.ReactNode; title: string; codes: SymptomCode[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>{icon}</span>
        {title}
      </p>
      {codes.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {codes.map((code) => (
            <li key={code} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs">
              {symptomLabel(code)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-subtle">{empty}</p>
      )}
    </div>
  );
}

export default function ComparePage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const timeline = usePlantTimeline(id);
  const observations = timeline.observations;

  // Defaults: the selected ids if valid and different, otherwise the two most recent observations.
  const byId = useMemo(() => new Map(observations.map((observation) => [observation.id, observation])), [observations]);
  const requestedB = params.get('b');
  const requestedA = params.get('a');
  const b = (requestedB && byId.get(requestedB)) || observations[0];
  const a = (requestedA && requestedA !== b?.id && byId.get(requestedA)) || observations.find((observation) => observation.id !== b?.id);

  if (timeline.loading) return <Skeleton className="h-72" />;
  if (!timeline.plant) {
    return <EmptyState icon={<ArrowLeft className="size-7" />} title="Plant not found" description="It may have been deleted." action={<ButtonLink to="/garden">Back to My Garden</ButtonLink>} />;
  }
  if (!a || !b) {
    return (
      <EmptyState
        icon={<Repeat className="size-7" />}
        title="Two observations needed"
        description="Scan this plant at least twice to compare observations."
        action={<ButtonLink to={`/scan?plantId=${timeline.plant.id}`}>Scan this plant</ButtonLink>}
      />
    );
  }

  const comparison = compareObservations(
    { observation: a, assessment: latestAssessment(a, timeline.assessments) },
    { observation: b, assessment: latestAssessment(b, timeline.assessments) },
  );
  const older = byId.get(comparison.olderObservationId)!;
  const newer = byId.get(comparison.newerObservationId)!;

  const select = (key: 'a' | 'b', value: string) => {
    const next = new URLSearchParams(params);
    next.set('a', key === 'a' ? value : a.id);
    next.set('b', key === 'b' ? value : b.id);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <Link to={`/garden/${timeline.plant.id}/timeline`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Timeline
      </Link>
      <PageHeader title="Compare observations" description={`${timeline.plant.name} · ${comparison.daysApart} day${comparison.daysApart === 1 ? '' : 's'} apart`} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {(['a', 'b'] as const).map((key) => (
          <label key={key} className="text-sm">
            <span className="mb-1 block font-medium">{key === 'a' ? 'First observation' : 'Second observation'}</span>
            <Select value={key === 'a' ? a.id : b.id} onChange={(event) => select(key, event.target.value)}>
              {observations
                .filter((observation) => observation.id !== (key === 'a' ? b.id : a.id))
                .map((observation) => (
                  <option key={observation.id} value={observation.id}>
                    {formatDateTime(observation.observedAt)}
                    {observation.label ? ` — ${observation.label}` : ''}
                  </option>
                ))}
            </Select>
          </label>
        ))}
      </div>

      {/* Side by side on wide screens, stacked on phones. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Side title="Earlier" observation={older} assessment={latestAssessment(older, timeline.assessments)} />
        <Side title="Later" observation={newer} assessment={latestAssessment(newer, timeline.assessments)} />
      </div>

      <Card className="mt-4">
        <CardHeader title="What changed in the recorded symptoms" description="Based only on the stored assessments of these two observations." />
        <CardBody className="space-y-4" aria-live="polite">
          <div className="grid gap-3 md:grid-cols-3">
            <TagList icon={<Repeat className="size-4" />} title="Mentioned in both" codes={comparison.sharedTags} empty="None" />
            <TagList icon={<Plus className="size-4" />} title="Only in the later assessment" codes={comparison.newlyRecordedTags} empty="None" />
            <TagList
              icon={<Minus className="size-4" />}
              title="Not mentioned in the later assessment"
              codes={comparison.notMentionedInNewerTags}
              empty="None"
            />
          </div>
          <div className="space-y-1 text-sm">
            {comparison.summary.map((sentence) => (
              <p key={sentence}>{sentence}</p>
            ))}
          </div>
          <div className="rounded-2xl bg-surface-muted p-4 text-sm text-ink-muted">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Info className="size-4" aria-hidden /> Limits of this comparison
            </p>
            <ul className="mt-1 list-disc pl-5">
              {comparison.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
