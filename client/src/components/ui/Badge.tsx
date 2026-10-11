import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'forest' | 'sun' | 'clay' | 'sky';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-muted border-line',
  forest: 'bg-forest-soft text-forest-strong border-transparent dark:text-forest',
  sun: 'bg-sun-soft text-sun border-transparent',
  clay: 'bg-clay-soft text-clay border-transparent',
  sky: 'bg-sky-soft text-sky border-transparent',
};

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
