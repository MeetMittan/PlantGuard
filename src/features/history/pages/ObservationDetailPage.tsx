import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ExternalLink, GitCompare, History, ImageOff, Loader2, MapPin, RefreshCcw, Save, Trash2 } from 'lucide-react';
import { modelManager, useModelState } from '@/ai/model-manager/useModelManager';
import { ModelRuntimeError } from '@/ai/utils/errors';
import { addAssessment, assessmentsForObservation, deleteObservation, getObservation, updateObservation } from '@/db/repositories/observations';
import { listPlants } from '@/db/repositories/plants';
import type { AssessmentRecord, Observation, Plant } from '@/db/schema';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Progress';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/Toaster';
import { HealthBadge } from '@/components/common/HealthBadge';
import { ObservationThumb } from '@/components/common/ObservationThumb';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { AssessmentReport } from '@/features/diagnosis/components/AssessmentReport';
import { AssessmentStatusBadge } from '@/features/diagnosis/components/AssessmentStatusBadge';
import { buildAssessment } from '@/features/diagnosis/services/assessment-service';
import { config } from '@/app/config';
import { prepareImage } from '@/services/image-processing/image-processing';
import { formatCoordinate, formatDateTime } from '@/lib/format';
import { isPastOrPresent, toDateTimeLocal } from '@/lib/dates';
import { cn, errorMessage } from '@/lib/utils';

export default function ObservationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const model = useModelState();
  const observation = useLiveQuery(() => getObservation(id).then((o) => o ?? null), [id]);
  const assessments = useLiveQuery(() => assessmentsForObservation(id), [id]);
  const plants = useLiveQuery(() => listPlants({ includeArchived: true }), []);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const imageUrl = useObjectUrl(observation?.image);

  if (observation === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (observation === null) {
    return (
      <EmptyState
        icon={<ArrowLeft className="size-7" />}
        title="Observation not found"
        description="It may have been deleted."
        action={<ButtonLink to="/history">Back to history</ButtonLink>}
      />
    );
  }

  const title = observation.label || observation.plantSuggestion || 'Unnamed plant';
  const plant = plants?.find((p) => p.id === observation.plantId);
  const shown = assessments?.find((a) => a.id === (selectedAssessmentId ?? observation.latestAssessmentId)) ?? assessments?.[0] ?? null;

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteObservation(observation.id);
      toast.success('Observation deleted');
      navigate(plant ? `/garden/${plant.id}` : '/history', { replace: true });
    } catch (error) {
      toast.error('Could not delete the observation', errorMessage(error));
      setDeleting(false);
    }
  };

  const rerun = async () => {
    if (!observation.image) return;
    setRescanning(true);
    try {
      const inference = await modelManager.analyze({ image: observation.image, context: observation.context });
      // Re-measure photo quality from the stored photo (null if it cannot be decoded here).
      const quality = await prepareImage(observation.image, config.ai.maxImageDimension)
        .then((prepared) => prepared.quality)
        .catch(() => null);
      const assessment = buildAssessment({ inference, quality, observationId: observation.id });
      await addAssessment(observation.id, assessment);
      setSelectedAssessmentId(null);
      toast.success('New assessment added', 'The previous assessment is kept in this observation’s history.');
    } catch (error) {
      const message = error instanceof ModelRuntimeError ? error.detail.message : errorMessage(error);
      if (!(error instanceof ModelRuntimeError && error.detail.code === 'REQUEST_CANCELLED')) toast.error('Re-analysis failed', message);
    } finally {
      setRescanning(false);
    }
  };

  return (
    <div>
      <Link to={plant ? `/garden/${plant.id}` : '/history'} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> {plant ? plant.name : 'History'}
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-ink-muted">Observed {formatDateTime(observation.observedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HealthBadge status={observation.healthStatus} />
          {plant ? (
            <>
              <ButtonLink size="sm" variant="secondary" to={`/garden/${plant.id}/timeline`} icon={<History className="size-4" aria-hidden />}>
                Timeline
              </ButtonLink>
              <ButtonLink size="sm" variant="secondary" to={`/garden/${plant.id}/compare?b=${observation.id}`} icon={<GitCompare className="size-4" aria-hidden />}>
                Compare
              </ButtonLink>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt={`Photo of ${title}, observed ${formatDateTime(observation.observedAt)}`} className="aspect-[4/3] w-full bg-surface-muted object-contain" />
            ) : observation.thumbnail ? (
              <ObservationThumb blob={observation.thumbnail} alt={`Thumbnail of ${title}`} className="aspect-[4/3] w-full" />
            ) : (
              <div className="grid aspect-[4/3] place-items-center bg-surface-muted text-ink-subtle">
                <span className="flex flex-col items-center gap-2 text-sm">
                  <ImageOff className="size-8" aria-hidden /> Photo unavailable
                </span>
              </div>
            )}
            <CardBody className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-subtle">
              <span>
                {observation.image
                  ? `Full photo kept (${observation.imageWidth} × ${observation.imageHeight}, metadata removed)`
                  : 'Only a thumbnail was kept for this observation.'}
              </span>
              {imageUrl ? (
                <a href={imageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-forest hover:underline">
                  Open full image <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
            </CardBody>
          </Card>

          <NotesCard
            key={observation.updatedAt}
            observation={observation}
            plants={plants ?? []}
            onDelete={() => setConfirmDelete(true)}
          />
        </div>

        <Card>
          <CardHeader
            title="AI assessment"
            action={
              observation.image ? (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={rescanning ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCcw className="size-4" aria-hidden />}
                  disabled={rescanning || model.state !== 'ready'}
                  onClick={() => void rerun()}
                  title={model.state !== 'ready' ? 'Download the AI model first' : undefined}
                >
                  {rescanning ? 'Analysing…' : 'Re-run analysis'}
                </Button>
              ) : undefined
            }
          />
          <CardBody className="space-y-4">
            {assessments && assessments.length > 1 ? (
              <AssessmentHistory assessments={assessments} selectedId={shown?.id ?? null} latestId={observation.latestAssessmentId} onSelect={setSelectedAssessmentId} />
            ) : null}
            {shown ? (
              <AssessmentReport assessment={shown} />
            ) : (
              <p className="text-sm text-ink-muted">
                This observation was saved without an AI analysis.
                {observation.image ? ' Download the model and use “Re-run analysis” to analyse it.' : ' The full photo was not kept, so it cannot be analysed.'}
              </p>
            )}
            {!observation.image && assessments?.length ? (
              <p className="text-xs text-ink-subtle">Re-analysis needs the full photo, which was not kept for this observation.</p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this observation?"
        description="The photo, all AI assessments of it and your notes will be permanently removed from this device."
        details={<p className="text-sm text-ink-muted">The plant itself and its other observations are not affected. Export a backup first if you might need this.</p>}
        confirmLabel="Delete observation"
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

function AssessmentHistory({
  assessments,
  selectedId,
  latestId,
  onSelect,
}: {
  assessments: AssessmentRecord[];
  selectedId: string | null;
  latestId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {assessments.length} assessments of this photo (each kept as recorded)
      </p>
      <ul className="flex flex-wrap gap-2">
        {assessments.map((assessment) => (
          <li key={assessment.id}>
            <button
              type="button"
              aria-pressed={assessment.id === selectedId}
              onClick={() => onSelect(assessment.id)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left text-xs',
                assessment.id === selectedId ? 'border-forest bg-forest-soft/60' : 'border-line hover:bg-surface-muted',
              )}
            >
              <span className="font-medium">
                {formatDateTime(assessment.createdAt)}
                {assessment.id === latestId ? ' · latest' : ''}
              </span>
              <AssessmentStatusBadge status={assessment.overallAssessment} />
              <span className="text-ink-subtle">Prompt {assessment.promptVersion}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Editable user-authored fields. Keyed by updatedAt so it re-initializes after each save. Never modifies assessments. */
function NotesCard({ observation, plants, onDelete }: { observation: Observation; plants: Plant[]; onDelete: () => void }) {
  const toast = useToast();
  const [label, setLabel] = useState(observation.label);
  const [notes, setNotes] = useState(observation.notes);
  const [plantId, setPlantId] = useState(observation.plantId ?? '');
  const [observedAt, setObservedAt] = useState(toDateTimeLocal(new Date(observation.observedAt)));
  // Captured once (lazy initializer) so render stays pure; used for validation and the picker maximum.
  const [openedAt] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const observedDate = new Date(observedAt);
  const dateValid = isPastOrPresent(observedDate, openedAt);
  const dirty =
    label !== observation.label ||
    notes !== observation.notes ||
    plantId !== (observation.plantId ?? '') ||
    observedAt !== toDateTimeLocal(new Date(observation.observedAt));

  const save = async () => {
    setSaving(true);
    try {
      await updateObservation(observation.id, {
        label: label.trim(),
        notes: notes.trim(),
        plantId: plantId || null,
        ...(observedAt !== toDateTimeLocal(new Date(observation.observedAt)) ? { observedAt: observedDate } : {}),
      });
      toast.success('Changes saved');
    } catch (error) {
      toast.error('Could not save changes', errorMessage(error));
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Your notes" description="Only your own fields — the AI assessment is never changed." />
      <CardBody className="space-y-4">
        <Field label="Name">{(props) => <Input {...props} value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />}</Field>
        <Field label="Notes">{(props) => <Textarea {...props} rows={4} value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} />}</Field>
        <Field label="Plant in My Garden">
          {(props) => (
            <Select {...props} value={plantId} onChange={(e) => setPlantId(e.target.value)}>
              <option value="">Not linked</option>
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name}
                  {plant.archived ? ' (archived)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Observed on" hint={`Saved ${formatDateTime(observation.createdAt)} (unchanged by edits).`} error={dateValid ? undefined : 'Choose a valid date that is not in the future.'}>
          {(props) => <Input {...props} type="datetime-local" value={observedAt} max={toDateTimeLocal(new Date(openedAt))} onChange={(e) => setObservedAt(e.target.value)} />}
        </Field>
        {observation.context ? <p className="text-xs text-ink-subtle">Context given to the AI: “{observation.context}”</p> : null}
        {observation.location ? (
          <p className="flex items-center gap-1 text-xs text-ink-subtle">
            <MapPin className="size-3.5" aria-hidden /> {formatCoordinate(observation.location.lat, observation.location.lng)} ·{' '}
            <Link to="/explore" className="text-forest underline">
              View on map
            </Link>
          </p>
        ) : null}
        <div className="flex flex-wrap justify-between gap-2">
          <Button icon={<Save className="size-4" aria-hidden />} onClick={() => void save()} disabled={!dirty || !dateValid} loading={saving}>
            Save changes
          </Button>
          <Button variant="ghost" className="text-clay" icon={<Trash2 className="size-4" aria-hidden />} onClick={onDelete}>
            Delete
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
