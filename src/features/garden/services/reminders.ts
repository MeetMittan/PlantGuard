import type { CareCompletion, Observation, Plant } from '@/db/schema';
import { dayKeyDiff, type DayKey } from '@/lib/dates';

export interface ReminderStatus {
  due: boolean;
  /** Days since the last relevant action, or null if never done. */
  daysSince: number | null;
  kind: 'water' | 'observe';
  intervalDays: number;
}

/**
 * In-app reminder evaluation. Reminders are computed when the app is open;
 * PlantGuard does not schedule background notifications (browser support for
 * that is inconsistent, especially on iOS and when the app is closed).
 *
 * - water: last completion of a "water" task linked to this plant
 * - observe: last observation linked to this plant
 */
export function reminderStatus(
  plant: Plant,
  today: DayKey,
  plantCompletions: CareCompletion[],
  plantObservations: Observation[],
): ReminderStatus | null {
  if (!plant.reminder?.enabled || plant.archived) return null;
  const { kind, intervalDays } = plant.reminder;
  const days =
    kind === 'water'
      ? plantCompletions.filter((completion) => completion.kind === 'water').map((completion) => completion.dayKey)
      : plantObservations.map((observation) => observation.dayKey);
  const last = days.sort().at(-1) ?? null;
  const daysSince = last ? dayKeyDiff(last, today) : null;
  return { due: daysSince === null || daysSince >= intervalDays, daysSince, kind, intervalDays };
}
