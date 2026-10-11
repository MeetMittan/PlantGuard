import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-9', className)} aria-hidden>
      <rect width="48" height="48" rx="14" className="fill-forest" />
      <path
        d="M24 38c0-9 2-15 10-21-9 1-15 5-17 12-2-5-1-9 2-13-6 3-8 10-5 17 2 3 5 5 10 5Z"
        className="fill-on-forest"
        opacity="0.95"
      />
      <path d="M24 38c0-6 1-11 6-16" fill="none" strokeWidth="1.8" strokeLinecap="round" className="stroke-forest" />
    </svg>
  );
}

export function Logo({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-lg font-semibold tracking-tight text-ink">{name}</span>
    </span>
  );
}
