import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { allCompletions, listCareTasks } from '@/db/repositories/care';
import { observationStats } from '@/db/repositories/observations';
import { careEventsPerDay } from '@/db/repositories/care-events';
import type { CareCompletion, CareTask } from '@/db/schema';

import { useSettings } from '@/features/settings/hooks/useSettings';
import { useToday } from '@/hooks/useToday';
import { calculateStreak, countByDay, mergeActivity, weeklySummary, type StreakSummary, type WeekDaySummary } from '../services/streaks';

export interface CareData {
  loading: boolean;
  tasks: CareTask[];
  completions: CareCompletion[];
  completedToday: Set<string>;
  activity: Map<string, number>;
  streak: StreakSummary;
  week: WeekDaySummary[];
  today: string;
}

/** Live care + observation activity, recalculated whenever IndexedDB changes or the day rolls over. */
export function useCareData(): CareData {
  const { settings } = useSettings();
  const today = useToday();
  const tasks = useLiveQuery(listCareTasks, []);
  const completions = useLiveQuery(allCompletions, []);
  const stats = useLiveQuery(observationStats, []);
  const eventsPerDay = useLiveQuery(careEventsPerDay, []);

  return useMemo(() => {
    const safeCompletions = completions ?? [];
    const activity = mergeActivity(countByDay(safeCompletions, (c) => c.dayKey), stats?.perDay ?? new Map(), eventsPerDay ?? new Map());
    return {
      loading: tasks === undefined || completions === undefined || stats === undefined || eventsPerDay === undefined,
      tasks: tasks ?? [],
      completions: safeCompletions,
      completedToday: new Set(safeCompletions.filter((c) => c.dayKey === today).map((c) => c.taskId)),
      activity,
      streak: calculateStreak(activity, today, settings.dailyGoal),
      week: weeklySummary(activity, today, settings.dailyGoal),
      today,
    };
  }, [tasks, completions, stats, eventsPerDay, today, settings.dailyGoal]);
}

