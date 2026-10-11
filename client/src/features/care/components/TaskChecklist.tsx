import { Check, Droplets, Eye, HeartPulse, ListChecks } from 'lucide-react';
import { completeCareTask, uncompleteCareTask } from '@/db/repositories/care';
import type { CareTask, CareTaskKind } from '@/db/schema';
import { useToast } from '@/components/feedback/Toaster';
import { cn, errorMessage } from '@/lib/utils';

export const TASK_KIND_META: Record<CareTaskKind, { label: string; icon: React.ReactNode }> = {
  water: { label: 'Watering', icon: <Droplets className="size-4" aria-hidden /> },
  'health-check': { label: 'Health check', icon: <HeartPulse className="size-4" aria-hidden /> },
  observe: { label: 'Observation', icon: <Eye className="size-4" aria-hidden /> },
  custom: { label: 'Custom', icon: <ListChecks className="size-4" aria-hidden /> },
};

/** Today's tasks as accessible checkboxes. Completion is idempotent per local day. */
export function TaskChecklist({
  tasks,
  completedToday,
  today,
  plantNames,
}: {
  tasks: CareTask[];
  completedToday: Set<string>;
  today: string;
  plantNames?: Map<string, string>;
}) {
  const toast = useToast();

  const toggle = async (task: CareTask, done: boolean) => {
    try {
      if (done) await uncompleteCareTask(task.id, today);
      else await completeCareTask(task);
    } catch (error) {
      toast.error('Could not update the task', errorMessage(error));
    }
  };

  return (
    <ul className="divide-y divide-line">
      {tasks.map((task) => {
        const done = completedToday.has(task.id);
        const meta = TASK_KIND_META[task.kind];
        const plantName = task.plantId ? plantNames?.get(task.plantId) : undefined;
        return (
          <li key={task.id}>
            <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={done}
                onChange={() => void toggle(task, done)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-lg border-2 transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-focus',
                  done ? 'border-forest bg-forest text-on-forest' : 'border-line-strong bg-surface-raised text-transparent',
                )}
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-medium', done ? 'text-ink-muted line-through' : 'text-ink')}>{task.title}</span>
                <span className="flex items-center gap-1 text-xs text-ink-subtle">
                  {meta.icon}
                  {meta.label}
                  {plantName ? ` · ${plantName}` : ''}
                  {done ? ' · done today' : ''}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
