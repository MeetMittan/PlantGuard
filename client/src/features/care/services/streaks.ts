import { dayKeyDiff, lastNDays, shiftDayKey, type DayKey } from '@/lib/dates';

/**
 * Streak rules (documented in docs/REQUIREMENTS.md#care-streaks):
 *
 * 1. A day's *care actions* = distinct care tasks completed that local day
 *    + observations saved that local day + plant care-log entries that day. A task completed twice on the same
 *    day counts once (enforced by a unique [taskId+dayKey] index).
 * 2. A day *qualifies* when its care actions >= the configured daily goal (min 1).
 * 3. The current streak is the run of consecutive qualifying days ending today.
 *    If today has not qualified yet, the run ending yesterday is still shown as
 *    current — today is "in progress" until midnight, not missed.
 * 4. Any missed day breaks the streak. There is no grace-day policy.
 * 5. All days are the device's local calendar days (see src/lib/dates.ts).
 */

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365] as const;

export type ActivityByDay = ReadonlyMap<DayKey, number>;

export interface StreakSummary {
  current: number;
  best: number;
  todayCount: number;
  todayComplete: boolean;
  /** True when today hasn't qualified yet but yesterday's streak can still continue. */
  atRisk: boolean;
  goal: number;
}

export function mergeActivity(...sources: Array<ReadonlyMap<DayKey, number>>): Map<DayKey, number> {
  const merged = new Map<DayKey, number>();
  for (const source of sources) {
    for (const [day, count] of source) merged.set(day, (merged.get(day) ?? 0) + count);
  }
  return merged;
}

export function countByDay<T>(items: readonly T[], dayOf: (item: T) => DayKey): Map<DayKey, number> {
  const counts = new Map<DayKey, number>();
  for (const item of items) {
    const day = dayOf(item);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

function qualifies(activity: ActivityByDay, day: DayKey, goal: number): boolean {
  return (activity.get(day) ?? 0) >= goal;
}

export function calculateStreak(activity: ActivityByDay, today: DayKey, dailyGoal: number): StreakSummary {
  const goal = Math.max(1, Math.floor(dailyGoal));
  const todayCount = activity.get(today) ?? 0;
  const todayComplete = todayCount >= goal;

  let current = 0;
  let cursor = todayComplete ? today : shiftDayKey(today, -1);
  while (qualifies(activity, cursor, goal)) {
    current += 1;
    cursor = shiftDayKey(cursor, -1);
  }

  return {
    current,
    best: Math.max(current, bestStreak(activity, goal, today)),
    todayCount,
    todayComplete,
    atRisk: !todayComplete && current > 0,
    goal,
  };
}

/** Longest run of consecutive qualifying days, ignoring any future-dated days. */
export function bestStreak(activity: ActivityByDay, goal: number, today: DayKey): number {
  const days = [...activity.keys()].filter((day) => day <= today && qualifies(activity, day, goal)).sort();
  let best = 0;
  let run = 0;
  let previous: DayKey | null = null;
  for (const day of days) {
    run = previous !== null && dayKeyDiff(previous, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

export function nextMilestone(current: number): number | null {
  return STREAK_MILESTONES.find((milestone) => milestone > current) ?? null;
}

/** Milestone reached exactly today (used to trigger a one-off celebration). */
export function reachedMilestone(current: number): number | null {
  return (STREAK_MILESTONES as readonly number[]).includes(current) ? current : null;
}

export interface WeekDaySummary {
  day: DayKey;
  count: number;
  complete: boolean;
}

export function weeklySummary(activity: ActivityByDay, today: DayKey, goal: number): WeekDaySummary[] {
  return lastNDays(today, 7).map((day) => {
    const count = activity.get(day) ?? 0;
    return { day, count, complete: count >= Math.max(1, goal) };
  });
}
