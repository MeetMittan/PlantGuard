import { useState } from 'react';
import { addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { dayKeyRange, dayKeyToDate, toDayKey, type DayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

/**
 * Month calendar of care activity. Goal-met days show a check icon and an
 * accessible label, so the state is never conveyed by colour alone.
 */
export function StreakCalendar({ activity, goal, today }: { activity: Map<DayKey, number>; goal: number; today: DayKey }) {
  const [month, setMonth] = useState(() => startOfMonth(dayKeyToDate(today)));
  const days = dayKeyRange(
    toDayKey(startOfWeek(startOfMonth(month), { weekStartsOn: 1 })),
    toDayKey(endOfWeek(endOfMonth(month), { weekStartsOn: 1 })),
  );
  const weekdays = days.slice(0, 7).map((day) => format(dayKeyToDate(day), 'EEEEE'));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <p className="font-semibold" aria-live="polite">
          {format(month, 'MMMM yyyy')}
        </p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next month"
          disabled={isSameMonth(month, dayKeyToDate(today))}
          onClick={() => setMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      </div>
      <div role="grid" aria-label="Care activity calendar" className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((weekday, index) => (
          <div key={index} role="columnheader" className="pb-1 text-xs font-medium text-ink-subtle" aria-hidden>
            {weekday}
          </div>
        ))}
        {days.map((day) => {
          const date = dayKeyToDate(day);
          const count = activity.get(day) ?? 0;
          const met = count >= goal;
          const inMonth = isSameMonth(date, month);
          const future = day > today;
          return (
            <div
              key={day}
              role="gridcell"
              aria-label={`${format(date, 'PPPP')}: ${count} care ${count === 1 ? 'action' : 'actions'}${met ? ', goal met' : ''}`}
              className={cn(
                'relative grid aspect-square place-items-center rounded-xl text-sm',
                !inMonth && 'opacity-35',
                future && 'text-ink-subtle',
                met ? 'bg-forest text-on-forest font-semibold' : count > 0 ? 'bg-forest-soft text-ink' : 'bg-surface-muted/60 text-ink-muted',
                day === today && 'ring-2 ring-sun ring-offset-2 ring-offset-surface',
              )}
            >
              {format(date, 'd')}
              {met ? <Check className="absolute bottom-0.5 right-0.5 size-3" aria-hidden /> : null}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-subtle">
        <span className="flex items-center gap-1.5">
          <span className="grid size-4 place-items-center rounded bg-forest text-on-forest">
            <Check className="size-3" aria-hidden />
          </span>
          Goal met
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-4 rounded bg-forest-soft" /> Some activity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-4 rounded ring-2 ring-sun" /> Today
        </span>
      </div>
    </div>
  );
}
