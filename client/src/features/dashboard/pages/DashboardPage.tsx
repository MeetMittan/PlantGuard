import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, CalendarCheck, Flame, Leaf, ScanLine, Sprout, Trophy } from 'lucide-react';
import { observationStats, recentObservations } from '@/db/repositories/observations';
import { listPlants } from '@/db/repositories/plants';
import { useModelState } from '@/ai/model-manager/useModelManager';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Progress';
import { EmptyState } from '@/components/feedback/EmptyState';
import { HealthBadge } from '@/components/common/HealthBadge';
import { ObservationThumb } from '@/components/common/ObservationThumb';
import { CountUp } from '@/components/common/reactbits/CountUp';
import { SpotlightCard } from '@/components/common/reactbits/SpotlightCard';
import { ModelReadinessCard } from '@/features/settings/components/ModelReadinessCard';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { TaskChecklist } from '@/features/care/components/TaskChecklist';
import { useCareData } from '@/features/care/hooks/useCareData';
import { nextMilestone } from '@/features/care/services/streaks';
import { formatDateTime } from '@/lib/format';
import { dayKeyToDate } from '@/lib/dates';

const WeeklyActivityChart = lazy(() => import('@/components/charts/WeeklyActivityChart'));

const ENCOURAGEMENTS = [
  'Look at the underside of a leaf today — many problems start there.',
  'Morning watering at the soil line keeps leaves dry and healthier.',
  'A quick daily look catches problems while they are still small.',
  'Clean tools between plants to avoid spreading disease.',
  'Notice how new growth looks — it tells you how a plant is doing now.',
  'Good airflow between plants is one of the simplest ways to prevent fungal problems.',
  'Fallen, spotted leaves are best removed rather than left in the bed.',
];

function greeting(hour: number) {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatTile({ label, value, icon, hint }: { label: string; value: number | undefined; icon: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-ink-muted">
        <span className="text-forest" aria-hidden>
          {icon}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold text-ink">
        {value === undefined ? <Skeleton className="h-8 w-12" /> : <CountUp to={value} />}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p> : null}
    </Card>
  );
}

export function DashboardPage() {
  const { settings } = useSettings();
  const model = useModelState();
  const stats = useLiveQuery(observationStats, []);
  const recent = useLiveQuery(() => recentObservations(4), []);
  const plants = useLiveQuery(() => listPlants(), []);
  const care = useCareData();
  const now = new Date();
  const tip = ENCOURAGEMENTS[Math.floor(dayKeyToDate(care.today).getTime() / 86_400_000) % ENCOURAGEMENTS.length]!;
  const plantNames = new Map((plants ?? []).map((plant) => [plant.id, plant.name]));
  const firstUse = stats?.total === 0 && care.tasks.length === 0 && !care.loading;
  const milestone = nextMilestone(care.streak.current);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-forest">{greeting(now.getHours())}{settings.displayName ? `, ${settings.displayName}` : ''}</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Your plants, at a glance</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">{tip}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <SpotlightCard className="p-6 sm:p-7">
          <div className="flex h-full flex-col justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-soft px-3 py-1 text-xs font-medium text-forest-strong dark:text-forest">
                <Leaf className="size-3.5" aria-hidden /> Private, on-device analysis
              </span>
              <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Check a leaf</h2>
              <p className="mt-2 max-w-md text-ink-muted">
                Take a photo of a leaf. The AI describes what it sees and possible causes — without your photo leaving this device.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink to="/scan" size="lg" icon={<ScanLine className="size-5" aria-hidden />}>
                Scan a plant
              </ButtonLink>
              {model.state !== 'ready' ? (
                <ButtonLink to="/settings#ai-model" size="lg" variant="secondary">
                  Set up AI
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </SpotlightCard>
        <ModelReadinessCard compact />
      </div>

      {firstUse ? (
        <EmptyState
          icon={<Sprout className="size-7" />}
          title="Welcome to your garden journal"
          description="Start by scanning a leaf, adding a plant to My Garden, or creating a daily care task. Everything you record stays on this device."
          action={
            <>
              <ButtonLink to="/scan" icon={<ScanLine className="size-4" aria-hidden />}>
                First scan
              </ButtonLink>
              <ButtonLink to="/garden" variant="secondary">
                Add a plant
              </ButtonLink>
              <ButtonLink to="/care" variant="secondary">
                Create a care task
              </ButtonLink>
            </>
          }
        />
      ) : null}

      <section aria-label="Statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Observations" value={stats?.total} icon={<ScanLine className="size-4" />} />
        <StatTile label="Plants identified" value={stats?.identifiedPlants} icon={<Leaf className="size-4" />} hint="Distinct names suggested by AI" />
        <StatTile
          label="Current streak"
          value={care.loading ? undefined : care.streak.current}
          icon={<Flame className="size-4" />}
          hint={care.streak.atRisk ? 'Do a care action today to keep it' : milestone ? `Next milestone: ${milestone} days` : undefined}
        />
        <StatTile label="Best streak" value={care.loading ? undefined : care.streak.best} icon={<Trophy className="size-4" />} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="This week"
            description={`Care actions per day · goal ${care.streak.goal}`}
            icon={<CalendarCheck className="size-5" />}
          />
          <CardBody>
            <Suspense fallback={<Skeleton className="h-44" />}>
              <WeeklyActivityChart week={care.week} goal={care.streak.goal} />
            </Suspense>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Today’s care"
            description={care.streak.todayComplete ? 'Daily goal reached — nice work.' : `${care.streak.todayCount} of ${care.streak.goal} actions done`}
            action={
              <Link to="/care" className="text-sm font-medium text-forest hover:underline">
                Manage
              </Link>
            }
          />
          <CardBody className="pt-2">
            {care.tasks.length ? (
              <TaskChecklist tasks={care.tasks.slice(0, 5)} completedToday={care.completedToday} today={care.today} plantNames={plantNames} />
            ) : (
              <p className="py-4 text-sm text-ink-muted">
                No care tasks yet. <Link to="/care" className="font-medium text-forest underline">Create one</Link> — saved observations also count toward your streak.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent scans"
          action={
            <Link to="/history" className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
              All history <ArrowRight className="size-4" aria-hidden />
            </Link>
          }
        />
        <CardBody>
          {recent === undefined ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : recent.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {recent.map((observation) => (
                <li key={observation.id}>
                  <Link
                    to={`/history/${observation.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-line p-2.5 transition-colors hover:bg-surface-muted"
                  >
                    <ObservationThumb blob={observation.thumbnail} alt="" className="size-16 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {observation.label || observation.plantSuggestion || 'Unnamed plant'}
                      </p>
                      <p className="text-xs text-ink-subtle">{formatDateTime(observation.createdAt)}</p>
                      <div className="mt-1">
                        <HealthBadge status={observation.healthStatus} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No scans yet. Your saved observations will appear here.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
