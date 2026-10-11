import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps, type TooltipValueType } from 'recharts';
import type { WeekDaySummary } from '@/features/care/services/streaks';
import { dayKeyToDate } from '@/lib/dates';
import { formatDate, formatWeekday } from '@/lib/format';

interface Datum {
  day: string;
  label: string;
  count: number;
  complete: boolean;
}

function ChartTooltip({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
  const datum = payload?.[0]?.payload as Datum | undefined;
  if (!active || !datum) return null;
  return (
    <div className="rounded-xl border border-line bg-surface-raised px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-ink">{formatDate(dayKeyToDate(datum.day))}</p>
      <p className="text-ink-muted">
        {datum.count} care {datum.count === 1 ? 'action' : 'actions'}
        {datum.complete ? ' · goal met' : ''}
      </p>
    </div>
  );
}

/**
 * Single-series bar chart of care actions over the last 7 local days.
 * One series → no legend; the card title names it. A dashed reference line
 * marks the daily goal. A visually hidden table provides a non-visual view.
 */
export default function WeeklyActivityChart({ week, goal }: { week: WeekDaySummary[]; goal: number }) {
  const data: Datum[] = week.map((entry) => ({
    day: entry.day,
    label: formatWeekday(dayKeyToDate(entry.day)),
    count: entry.count,
    complete: entry.complete,
  }));
  const max = Math.max(goal, ...data.map((d) => d.count), 1);

  return (
    <div>
      <div className="h-44" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -28 }} barCategoryGap="28%">
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--pg-ink-subtle)', fontSize: 12 }} />
            <YAxis
              allowDecimals={false}
              domain={[0, max]}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: 'var(--pg-ink-subtle)', fontSize: 11 }}
            />
            <ReferenceLine y={goal} stroke="var(--pg-line-strong)" strokeDasharray="4 4" />
            <Tooltip content={ChartTooltip} cursor={{ fill: 'var(--pg-surface-muted)', radius: 6 }} />
            <Bar dataKey="count" fill="var(--pg-chart-mark)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-ink-subtle">Dashed line: daily goal ({goal}).</p>
      <table className="sr-only">
        <caption>Care actions in the last 7 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Care actions</th>
            <th scope="col">Goal met</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{formatDate(dayKeyToDate(d.day))}</td>
              <td>{d.count}</td>
              <td>{d.complete ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
