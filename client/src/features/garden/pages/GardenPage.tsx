import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, BellRing, Plus, Sprout } from 'lucide-react';
import { db } from '@/db/database';
import { createPlant, listPlants } from '@/db/repositories/plants';
import { PageHeader } from '@/components/layout/PageFallback';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Progress';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/Toaster';
import { ObservationThumb } from '@/components/common/ObservationThumb';
import { useToday } from '@/hooks/useToday';
import { pluralize } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { PlantForm, toPlantInput } from '../components/PlantForm';
import { reminderStatus } from '../services/reminders';

export default function GardenPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const today = useToday();
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const plants = useLiveQuery(() => listPlants({ includeArchived: showArchived }), [showArchived]);
  // Lightweight per-plant summaries; avoids loading full-size photos.
  const summaries = useLiveQuery(async () => {
    const [observations, tasks, completions] = await Promise.all([
      db.observations.where('plantId').notEqual('').toArray(),
      db.careTasks.toArray(),
      db.careCompletions.toArray(),
    ]);
    return { observations, tasks, completions };
  }, []);

  return (
    <div>
      <PageHeader
        title="My Garden"
        description="Plants you care for, with their observations and reminders."
        action={
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
            Add plant
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <Switch checked={showArchived} onChange={setShowArchived} label="Show archived plants" />
      </div>

      {plants === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : plants.length === 0 ? (
        <EmptyState
          icon={<Sprout className="size-7" />}
          title={showArchived ? 'No plants yet' : 'Your garden is empty'}
          description="Add the plants you look after to link observations, track care and set simple reminders."
          action={
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
              Add your first plant
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plants.map((plant) => {
            const observations = summaries?.observations.filter((o) => o.plantId === plant.id) ?? [];
            const taskIds = new Set(summaries?.tasks.filter((t) => t.plantId === plant.id).map((t) => t.id));
            const completions = summaries?.completions.filter((c) => taskIds.has(c.taskId)) ?? [];
            const reminder = reminderStatus(plant, today, completions, observations);
            const latestThumb = observations.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.thumbnail ?? null;
            return (
              <li key={plant.id}>
                <Link
                  to={`/garden/${plant.id}`}
                  className="block overflow-hidden rounded-card border border-line bg-surface shadow-card transition-colors hover:border-line-strong"
                >
                  <ObservationThumb blob={plant.cover ?? latestThumb} alt="" className="aspect-[16/10] w-full" />
                  <div className="space-y-2 p-4">
                    <div>
                      <p className="font-display text-lg font-semibold">{plant.name}</p>
                      {plant.commonName || plant.scientificName ? <p className="text-sm text-ink-muted">{plant.commonName || <i>{plant.scientificName}</i>}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge>{pluralize(observations.length, 'observation')}</Badge>
                      {reminder?.due ? (
                        <Badge tone="sun" icon={<BellRing className="size-3.5" aria-hidden />}>
                          {reminder.kind === 'water' ? 'Watering due' : 'Check-up due'}
                        </Badge>
                      ) : null}
                      {plant.archived ? (
                        <Badge icon={<Archive className="size-3.5" aria-hidden />}>Archived</Badge>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add a plant">
        <PlantForm
          submitLabel="Add plant"
          onCancel={() => setAdding(false)}
          onSubmit={async (values) => {
            try {
              const plant = await createPlant(toPlantInput(values));
              setAdding(false);
              toast.success(`${plant.name} added`);
              navigate(`/garden/${plant.id}`);
            } catch (error) {
              toast.error('Could not add the plant', errorMessage(error));
            }
          }}
        />
      </Dialog>
    </div>
  );
}
