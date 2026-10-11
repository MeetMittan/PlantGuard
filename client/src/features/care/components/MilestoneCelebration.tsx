import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Trophy, X } from 'lucide-react';
import { getMetadata, METADATA_KEYS, setMetadata } from '@/db/repositories/settings';
import { reachedMilestone } from '../services/streaks';

const LEAVES = Array.from({ length: 10 }, (_, i) => i);

/**
 * Shows a one-off celebration the first time a streak milestone is reached.
 * The message is announced via role="status"; the falling leaves are purely
 * decorative and skipped under prefers-reduced-motion.
 */
export function MilestoneCelebration({ current }: { current: number }) {
  const [milestone, setMilestone] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const reached = reachedMilestone(current);
    if (!reached) return;
    let active = true;
    void getMetadata(METADATA_KEYS.lastCelebratedStreak).then((last) => {
      if (!active || last === reached) return;
      setMilestone(reached);
      void setMetadata(METADATA_KEYS.lastCelebratedStreak, reached);
    });
    return () => {
      active = false;
    };
  }, [current]);

  return (
    <AnimatePresence>
      {milestone ? (
        <motion.div
          role="status"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="relative mb-5 overflow-hidden rounded-card bg-forest p-5 text-on-forest shadow-float"
        >
          {!reduceMotion
            ? LEAVES.map((i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="pointer-events-none absolute top-0 text-lg"
                  style={{ left: `${8 + i * 9}%` }}
                  initial={{ y: -20, opacity: 0, rotate: 0 }}
                  animate={{ y: 120, opacity: [0, 1, 0], rotate: 120 + i * 20 }}
                  transition={{ duration: 2.2, delay: i * 0.12, ease: 'easeOut' }}
                >
                  🍃
                </motion.span>
              ))
            : null}
          <div className="relative flex items-center gap-4">
            <Trophy className="size-10 shrink-0" aria-hidden />
            <div className="flex-1">
              <p className="font-display text-2xl font-semibold">{milestone}-day streak!</p>
              <p className="text-sm opacity-90">You have cared for your plants {milestone} days in a row.</p>
            </div>
            <button type="button" onClick={() => setMilestone(null)} aria-label="Dismiss celebration" className="rounded-full p-1 hover:bg-white/10">
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
