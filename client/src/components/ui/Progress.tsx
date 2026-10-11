import { cn } from '@/lib/utils';

/** Accessible progress bar. `value === null` renders an indeterminate bar. */
export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number | null;
  label: string;
  className?: string;
}) {
  const clamped = value === null ? null : Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped === null ? undefined : Math.round(clamped)}
      aria-valuetext={clamped === null ? 'In progress' : `${Math.round(clamped)}%`}
      className={cn('relative h-2.5 w-full overflow-hidden rounded-full bg-surface-muted', className)}
    >
      {clamped === null ? (
        <div className="absolute inset-y-0 w-1/3 animate-[pg-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-forest" />
      ) : (
        <div
          className="h-full rounded-full bg-gradient-to-r from-moss to-forest transition-[width] duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-surface-muted', className)} />;
}
