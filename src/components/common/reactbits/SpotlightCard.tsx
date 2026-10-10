/**
 * Adapted from React Bits "SpotlightCard" (https://reactbits.dev, src/ts-tailwind/Components/SpotlightCard).
 * Copyright (c) 2026 David Haz — MIT + Commons Clause License Condition v1.0.
 *
 * PlantGuard changes: colours come from the design tokens (so light/dark themes
 * work automatically), the ambient/grain/beam options were removed, and the
 * effect is skipped entirely under prefers-reduced-motion. The spotlight is
 * purely decorative (aria-hidden) and never intercepts pointer events.
 */
import { useEffect, useRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function falloff(color: string, softness: number): string {
  const soft = clamp(softness, 0, 1);
  const core = (1 - soft) ** 1.5 * 0.85;
  const stop = (alpha: number, at: number) =>
    `color-mix(in srgb, ${color} ${(alpha * 100).toFixed(2)}%, transparent) ${(at * 100).toFixed(2)}%`;
  const list = [stop(1, 0)];
  for (let i = 0; i <= 14; i += 1) {
    const t = core + ((1 - core) * i) / 14;
    const g = (t - core) / (1 - core);
    const smooth = 1 - g * g * (3 - 2 * g);
    const glow = Math.exp(-4.6 * g * g) * (1 - g ** 6);
    list.push(stop(smooth + (glow - smooth) * soft, t));
  }
  return list.join(', ');
}

export interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
  intensity?: number;
  spotlightSize?: number;
}

export function SpotlightCard({
  children,
  className,
  spotlightColor = 'var(--pg-moss)',
  intensity = 0.22,
  spotlightSize = 260,
  ...rest
}: SpotlightCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const light = lightRef.current;
    if (!root || !light) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const stops = falloff(spotlightColor, 0.7);
    const state = { x: 0, y: 0, tx: 0, ty: 0, presence: 0, target: 0 };
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const follow = 1 - Math.exp(-dt / 0.08);
      state.x += (state.tx - state.x) * follow;
      state.y += (state.ty - state.y) * follow;
      state.presence += (state.target - state.presence) * (1 - Math.exp(-dt / (state.target ? 0.1 : 0.3)));
      if (Math.abs(state.target - state.presence) < 0.002) state.presence = state.target;
      light.style.background = `radial-gradient(circle ${spotlightSize}px at ${state.x.toFixed(1)}px ${state.y.toFixed(1)}px, ${stops})`;
      light.style.opacity = String(state.presence * intensity);
      const moving = Math.abs(state.tx - state.x) > 0.1 || Math.abs(state.ty - state.y) > 0.1;
      if (moving || state.presence !== state.target) raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const onMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      state.tx = event.clientX - rect.left;
      state.ty = event.clientY - rect.top;
      if (state.presence < 0.02) {
        state.x = state.tx;
        state.y = state.ty;
      }
      state.target = 1;
      wake();
    };
    const onLeave = () => {
      state.target = 0;
      wake();
    };

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
    };
  }, [spotlightColor, intensity, spotlightSize]);

  return (
    <div
      ref={rootRef}
      className={cn('relative isolate overflow-hidden rounded-card border border-line bg-surface shadow-card', className)}
      {...rest}
    >
      <span ref={lightRef} aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0" />
      {children}
    </div>
  );
}
