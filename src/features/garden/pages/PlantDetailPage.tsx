import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, ArrowLeft, BellRing, GitCompare, History, ImagePlus, NotebookPen, Pencil, Plus, ScanLine, Sun, Trash2 } from 'lucide-react';
import { config } from '@/app/config';
import { db } from '@/db/database';
import { createCareTask } from '@/db/repositories/care';
import { deletePlant, setPlantArchived, updatePlant, type PlantDeleteMode } from '@/db/repositories/plants';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Progress';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/Toaster';
import { ObservationThumb } from '@/components/common/ObservationThumb';
import { useToday } from '@/hooks/useToday';
import { prepareImage } from '@/services/image-processing/image-processing';
import { AssessmentStatusBadge } from '@/features/diagnosis/components/AssessmentStatusBadge';
import { CareEventDialog, CARE_EVENT_LABELS } from '@/features/timeline/components/CareEventForm';
import { usePlantTimeline } from '@/features/timeline/hooks/usePlantTimeline';
import { formatDate, formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { IDENTIFICATION_LABELS, PlantForm, plantToFormValues, toPlantInput } from '../components/PlantForm';
import { reminderStatus } from '../services/reminders';

const SUNLIGHT_LABEL = { 'full-sun': 'Full sun', 'partial-shade': 'Partial shade', shade: 'Shade', unknown: 'Light not set' } as const;

export default function PlantDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const today = useToday();
  const coverInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<PlantDeleteMode>('keep-history');
  const [deleting, setDeleting] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const timeline = usePlantTimeline(id);
  const completions = useLiveQuery(async () => {
    const taskIds = (await db.careTasks.where('plantId').equals(id).primaryKeys()) as string[];
    return taskIds.length ? db.careCompletions.where('taskId').anyOf(taskIds).toArray() : [];
  }, [id]);

  if (timeline.loading) return <Skeleton className="h-72" />;
  const plant = timeline.plant;
  if (!plant) {
    return (
      <EmptyState
        icon={<ArrowLeft className="size-7" />}
        title="Plant not found"
        description="It may have been deleted."
        action={<ButtonLink to="/garden">Back to My Garden</ButtonLink>}
      />
    );
  }

  const observations = timeline.observations; // newest first
  const latest = observations[0];
  const latestAssessment = latest ? timeline.assessments.find((assessment) => assessment.id === latest.latestAssessmentId) ?? null : null;
  const coverObservation = observations.find((observation) => observation.id === plant.coverObservationId) ?? latest;
  const reminder = reminderStatus(plant, today, completions ?? [], observations);
  const recentCare = timeline.careEvents.slice(0, 3);

  const setCover = async (file: File) => {
    try {
      const prepared = await prepareImage(file, config.ai.maxImageDimension);
      await updatePlant(plant.id, { cover: prepared.thumbnail });
      toast.success('Cover photo updated');
    } catch (error) {
      toast.error('Could not use that photo', errorMessage(error));
    }
  };

  const addTask = async (kind: 'water' | 'observe') => {
    try {
      await createCareTask({ title: kind === 'water' ? `Water ${plant.name}` : `Check ${plant.name}`, kind, plantId: plant.id });
      toast.success('Daily care task added', 'Find it under Care & streaks.');
    } catch (error) {
      toast.error('Could not add the task', errorMessage(error));
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deletePlant(plant.id, deleteMode);
      toast.success('Plant deleted');
      navigate('/garden', { replace: true });
    } catch (error) {
      toast.error('Could not delete the plant', errorMessage(error));
      setDeleting(false);
    }
  };

  return (
    <div>
      <Link to="/garden" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> My Garden
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card className="overflow-hidden">
          <ObservationThumb blob={plant.cover ?? coverObservation?.thumbnail ?? null} alt={plant.name} className="aspect-[4/3] w-full" />
          <CardBody className="space-y-4">
            <div>
              <h1 className="text-3xl font-semibold">{plant.name}</h1>
              {plant.commonName || plant.scientificName ? (
                <p className="text-ink-muted">
                  {plant.commonName}
                  {plant.commonName && plant.scientificName ? ' · ' : ''}
                  {plant.scientificName ? <i>{plant.scientificName}</i> : null}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-ink-subtle">Identity: {IDENTIFICATION_LABELS[plant.identificationStatus]}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-subtle">Added</dt>
                <dd>{formatDate(plant.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Last observation</dt>
                <dd>{latest ? formatDate(latest.observedAt) : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Observations</dt>
                <dd>{observations.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Latest assessment</dt>
                <dd>{latestAssessment ? <AssessmentStatusBadge status={latestAssessment.overallAssessment} /> : '—'}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-1.5">
              <Badge icon={<Sun className="size-3.5" aria-hidden />}>{SUNLIGHT_LABEL[plant.care.sunlight]}</Badge>
              {plant.care.wateringIntervalDays ? <Badge>Water every {plant.care.wateringIntervalDays} days</Badge> : null}
              {plant.archived ? <Badge icon={<Archive className="size-3.5" aria-hidden />}>Archived {plant.archivedAt ? formatDate(plant.archivedAt) : ''}</Badge> : null}
            </div>
            {reminder ? (
              <p className={`flex items-start gap-2 rounded-xl p-3 text-sm ${reminder.due ? 'bg-sun-soft text-sun' : 'bg-surface-muted text-ink-muted'}`}>
                <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {reminder.kind === 'water' ? 'Watering' : 'Check-up'} every {reminder.intervalDays} days ·{' '}
                  {reminder.daysSince === null ? 'not recorded yet' : reminder.due ? `due (last ${reminder.daysSince} days ago)` : `last ${reminder.daysSince === 0 ? 'today' : `${reminder.daysSince} days ago`}`}. Shown
                  while the app is open; no background notifications.
                </span>
              </p>
            ) : null}
            {plant.notes ? <p className="whitespace-pre-wrap text-sm text-ink-muted">{plant.notes}</p> : null}
            <input
              ref={coverInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void setCover(file);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button size="sm" variant="secondary" icon={<ImagePlus className="size-4" aria-hidden />} onClick={() => coverInput.current?.click()}>
                Cover photo
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={plant.archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
                onClick={() => void setPlantArchived(plant.id, !plant.archived)}
              >
                {plant.archived ? 'Restore' : 'Archive'}
              </Button>
              <Button size="sm" variant="ghost" className="text-clay" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody className="flex flex-wrap gap-2">
              <ButtonLink to={`/scan?plantId=${plant.id}`} icon={<ScanLine className="size-4" aria-hidden />}>
                Scan this plant again
              </ButtonLink>
              <Button variant="secondary" icon={<NotebookPen className="size-4" aria-hidden />} onClick={() => setLogOpen(true)}>
                Add care log
              </Button>
              <ButtonLink to={`/garden/${plant.id}/timeline`} variant="secondary" icon={<History className="size-4" aria-hidden />}>
                Full timeline
              </ButtonLink>
              {observations.length >= 2 ? (
                <ButtonLink to={`/garden/${plant.id}/compare`} variant="secondary" icon={<GitCompare className="size-4" aria-hidden />}>
                  Compare latest two
                </ButtonLink>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent observations" />
            <CardBody>
              {observations.length ? (
                <ul className="space-y-2">
                  {observations.slice(0, 5).map((observation) => {
                    const assessment = timeline.assessments.find((a) => a.id === observation.latestAssessmentId);
                    return (
                      <li key={observation.id}>
                        <Link to={`/history/${observation.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-muted">
                          <ObservationThumb blob={observation.thumbnail} alt="" className="size-14 shrink-0 rounded-lg" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{formatDateTime(observation.observedAt)}</p>
                            {assessment ? <AssessmentStatusBadge status={assessment.overallAssessment} /> : <p className="text-xs text-ink-subtle">No analysis</p>}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">No observations yet. Scan this plant to start its history.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent care" description="Your own log entries. They add context; they are not evidence of recovery." />
            <CardBody className="space-y-3">
              {recentCare.length ? (
                <ul className="space-y-2 text-sm">
                  {recentCare.map((event) => (
                    <li key={event.id} className="rounded-xl border border-line p-2.5">
                      <span className="font-medium">{CARE_EVENT_LABELS[event.eventType]}</span>
                      <span className="text-ink-subtle"> · {formatDateTime(event.occurredAt)}</span>
                      {event.notes ? <p className="text-ink-muted">{event.notes}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">No care logged yet.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="subtle" icon={<Plus className="size-4" aria-hidden />} onClick={() => void addTask('water')}>
                  Daily watering task
                </Button>
                <Button size="sm" variant="subtle" icon={<Plus className="size-4" aria-hidden />} onClick={() => void addTask('observe')}>
                  Daily check-up task
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title={`Edit ${plant.name}`}>
        <PlantForm
          initial={plantToFormValues(plant)}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            try {
              await updatePlant(plant.id, toPlantInput(values));
              setEditing(false);
              toast.success('Plant updated');
            } catch (error) {
              toast.error('Could not save changes', errorMessage(error));
            }
          }}
        />
      </Dialog>

      <CareEventDialog plantId={plant.id} open={logOpen} onClose={() => setLogOpen(false)} />

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${plant.name}?`}
        description="Consider archiving instead — it hides the plant but keeps its full history."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void remove()} loading={deleting}>
              {deleteMode === 'delete-history' ? 'Delete plant and history' : 'Delete plant'}
            </Button>
          </>
        }
      >
        <fieldset className="space-y-3 text-sm">
          <legend className="sr-only">What to delete</legend>
          <label className="flex gap-2">
            <input type="radio" name="delete-mode" checked={deleteMode === 'keep-history'} onChange={() => setDeleteMode('keep-history')} />
            <span>
              <span className="font-medium">Delete the plant, keep its observations</span> — {observations.length} observation(s) stay in History, unlinked. Its care log entries are removed.
            </span>
          </label>
          <label className="flex gap-2">
            <input type="radio" name="delete-mode" checked={deleteMode === 'delete-history'} onChange={() => setDeleteMode('delete-history')} />
            <span>
              <span className="font-medium text-clay">Delete the plant and its entire history</span> — also permanently deletes {observations.length} observation(s), their photos and AI assessments, and its care log.
            </span>
          </label>
        </fieldset>
      </Dialog>
    </div>
  );
}
