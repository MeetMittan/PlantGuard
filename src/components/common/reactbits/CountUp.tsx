/**
 * Adapted from React Bits "CountUp" (https://reactbits.dev, src/ts-tailwind/TextAnimations/CountUp).
 * Copyright (c) 2026 David Haz — MIT + Commons Clause License Condition v1.0.
 *
 * PlantGuard changes: locale-aware formatting, reduced-motion support (renders the
 * final value immediately), and an accessible final value for screen readers
 * (the animated digits are aria-hidden so they are not announced mid-count).
 */
import { useInView, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';
import { config } from '@/app/config';

interface CountUpProps {
  to: number;
  from?: number;
  delay?: number;
  duration?: number;
  className?: string;
}

export function CountUp({ to, from = 0, delay = 0, duration = 1.2, className = '' }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(from);
  const springValue = useSpring(motionValue, { damping: 20 + 40 * (1 / duration), stiffness: 100 * (1 / duration) });
  const isInView = useInView(ref, { once: true, margin: '0px' });

  const format = useCallback(
    (latest: number) => new Intl.NumberFormat(config.locale, { maximumFractionDigits: 0 }).format(Math.round(latest)),
    [],
  );

  useEffect(() => {
    if (ref.current) ref.current.textContent = format(reduceMotion ? to : from);
  }, [from, to, format, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !isInView) return undefined;
    const timeout = window.setTimeout(() => motionValue.set(to), delay * 1000);
    return () => window.clearTimeout(timeout);
  }, [isInView, motionValue, to, delay, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    return springValue.on('change', (latest: number) => {
      if (ref.current) ref.current.textContent = format(latest);
    });
  }, [springValue, format, reduceMotion]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden />
      <span className="sr-only">{format(to)}</span>
    </span>
  );
}
