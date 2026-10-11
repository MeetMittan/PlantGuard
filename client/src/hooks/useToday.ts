import { useEffect, useState } from 'react';
import { todayKey, type DayKey } from '@/lib/dates';

/**
 * The current local day key, updated when the date rolls over (checked every
 * minute and when the tab becomes visible again, e.g. after overnight sleep).
 */
export function useToday(): DayKey {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const check = () => setToday((current) => (current === todayKey() ? current : todayKey()));
    const interval = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}
