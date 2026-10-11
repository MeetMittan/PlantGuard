import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Flame, Info, ListChecks, Plus, Target, Trash2, Trophy } from 'lucide-react';
import { createCareTask, deleteCareTask } from '@/db/repositories/care';
import { listPlants } from '@/db/repositories/plants';
import type { CareTask } from '@/db/schema';
import { PageHeader } from '@/components/layout/PageFallback';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { ProgressBar, Skeleton } from '@/components/ui/Progress';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/Toaster';
import { CountUp } from '@/components/common/reactbits/CountUp';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { dayKeyToDate } from '@/lib/dates';
import { formatWeekday } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { MilestoneCelebration } from '../components/MilestoneCelebration';
import { StreakCalendar } from '../components/StreakCalendar';
import { TaskChecklist } from '../components/TaskChecklist';
import { useCareData } from '../hooks/useCareData';
import { nextMilestone } from '../services/streaks';

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Describe the task.').max(120, 'Keep it under 120 characters.'),
  kind: z.enum(['water', 'health-check', 'observe', 'custom']),
  plantId: z.string(),
});
type TaskValues = z.infer<typeof taskSchema>;

export default function CarePage() {
  const care = useCareData();
  const { settings, update } = useSettings();
  const toast = useToast();
  const plants = useLiveQuery(() => listPlants(), []);
  const [toDelete, setToDelete] = useState<CareTask | null>(null);
  const plantNames = new Map((plants ?? []).map((plant) => [plant.id, plant.name]));
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskValues>({ resolver: zodResolver(taskSchema), defaultValues: { title: '', kind: 'water', plantId: '' } });

  const onSubmit = async (values: TaskValues) => {
    try {
      await createCareTask({ title: values.title, kind: values.kind, plantId: values.plantId || null });
      reset({ title: '', kind: values.kind, plantId: values.plantId });
      toast.success('Task added');
    } catch (error) {
      toast.error('Could not add the task', errorMessage(error));
    }
  };

  const { streak } = care;
  const milestone = nextMilestone(streak.current);

  return (
    <div>
      <PageHeader title="Care & streaks" description="Small daily care actions add up. Track them here — everything stays on this device." />
      <MilestoneCelebration current={streak.current} />

      <section aria-label="Streak summary" className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Flame className="size-4 text-clay" aria-hidden /> Current streak
          </p>
          <p className="mt-2 font-display text-4xl font-semibold">
            {care.loading ? <Skeleton className="h-10 w-16" /> : <CountUp to={streak.current} />}
            <span className="ml-1 text-base font-normal text-ink-muted">days</span>
          </p>
          <p className="mt-1 text-xs text-ink-subtle">
            {streak.atRisk ? 'Complete today’s goal to keep your streak.' : milestone ? `Next milestone: ${milestone} days` : 'Amazing consistency!'}
          </p>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Trophy className="size-4 text-sun" aria-hidden /> Best streak
          </p>
          <p className="mt-2 font-display text-4xl font-semibold">
            {care.loading ? <Skeleton className="h-10 w-16" /> : <CountUp to={streak.best} />}
            <span className="ml-1 text-base font-normal text-ink-muted">days</span>
          </p>
        </Card>
        <Card className="p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Target className="size-4 text-forest" aria-hidden /> Today
          </p>
          <p className="mt-2 font-display text-4xl font-semibold">
            {streak.todayCount}
            <span className="ml-1 text-base font-normal text-ink-muted">/ {streak.goal}</span>
          </p>
          <ProgressBar className="mt-3" value={Math.min(100, (streak.todayCount / streak.goal) * 100)} label="Daily goal progress" />
          <label className="mt-3 flex items-center justify-between gap-2 text-xs text-ink-muted">
            Daily goal
            <select
              value={settings.dailyGoal}
              onChange={(event) => void update({ dailyGoal: Number(event.target.value) }).catch((error) => toast.error('Goal was not saved', errorMessage(error)))}
              className="rounded-lg border border-line-strong bg-surface-raised px-2 py-1 text-sm text-ink"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'action' : 'actions'}
                </option>
              ))}
            </select>
          </label>
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Today’s checklist" icon={<ListChecks className="size-5" />} description="Each task counts once per day." />
            <CardBody className="pt-2">
              {care.loading ? (
                <Skeleton className="h-24" />
              ) : care.tasks.length ? (
                <>
                  <TaskChecklist tasks={care.tasks} completedToday={care.completedToday} today={care.today} plantNames={plantNames} />
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-ink-muted">Manage tasks</summary>
                    <ul className="mt-2 space-y-1">
                      {care.tasks.map((task) => (
                        <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-surface-muted">
                          <span className="truncate">{task.title}</span>
                          <Button size="sm" variant="ghost" className="text-clay" aria-label={`Delete task ${task.title}`} onClick={() => setToDelete(task)}>
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              ) : (
                <EmptyState
                  className="border-none bg-transparent py-6"
                  icon={<ListChecks className="size-7" />}
                  title="No care tasks yet"
                  description="Add a task below, like watering or a quick health check."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Add a daily task" icon={<Plus className="size-5" />} />
            <CardBody>
              <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
                <Field label="Task" error={errors.title?.message} className="sm:col-span-2">
                  {(props) => <Input {...props} {...register('title')} placeholder="Water the herbs" />}
                </Field>
                <Field label="Type">
                  {(props) => (
                    <Select {...props} {...register('kind')}>
                      <option value="water">Watering</option>
                      <option value="health-check">Health check</option>
                      <option value="observe">Observation</option>
                      <option value="custom">Custom</option>
                    </Select>
                  )}
                </Field>
                <Field label="Plant (optional)">
                  {(props) => (
                    <Select {...props} {...register('plantId')}>
                      <option value="">Any / none</option>
                      {plants?.map((plant) => (
                        <option key={plant.id} value={plant.id}>
                          {plant.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" loading={isSubmitting} icon={<Plus className="size-4" aria-hidden />}>
                    Add task
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Calendar" icon={<CalendarDays className="size-5" />} />
            <CardBody>
              <StreakCalendar activity={care.activity} goal={streak.goal} today={care.today} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Last 7 days" />
            <CardBody>
              <ul className="grid grid-cols-7 gap-1 text-center">
                {care.week.map((day) => (
                  <li key={day.day} className="space-y-1">
                    <span className="block text-xs text-ink-subtle">{formatWeekday(dayKeyToDate(day.day))}</span>
                    <span
                      className={`grid h-10 place-items-center rounded-lg text-sm font-semibold ${day.complete ? 'bg-forest text-on-forest' : 'bg-surface-muted text-ink-muted'}`}
                      aria-label={`${day.count} actions${day.complete ? ', goal met' : ''}`}
                    >
                      {day.count}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink-muted">
                Goal met on {care.week.filter((d) => d.complete).length} of 7 days · {care.week.reduce((sum, d) => sum + d.count, 0)} actions this week.
              </p>
            </CardBody>
          </Card>
          <Card className="p-5 text-sm text-ink-muted">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Info className="size-4" aria-hidden /> How streaks work
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Each completed task counts once per day; each saved observation also counts.</li>
              <li>A day counts when you reach your daily goal ({streak.goal}).</li>
              <li>Missing a day resets the current streak. Today stays open until midnight.</li>
              <li>Days follow your device’s local calendar.</li>
            </ul>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this task?"
        description={`“${toDelete?.title ?? ''}” will be removed from your checklist. Past completions stay in your streak history.`}
        confirmLabel="Delete task"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteCareTask(toDelete.id);
            toast.success('Task deleted');
          } catch (error) {
            toast.error('Could not delete the task', errorMessage(error));
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}
