import { addDays, differenceInCalendarDays, format, isValid, parse, startOfWeek } from 'date-fns';

/**
 * A local calendar day encoded as `yyyy-MM-dd` (e.g. "2026-03-29").
 *
 * All streak and daily-goal logic works on DayKeys derived from the device's
 * local time zone. Never derive a DayKey from `toISOString()`, which is UTC and
 * would shift late-evening activity onto the wrong day.
 */
export type DayKey = string;

const DAY_KEY_FORMAT = 'yyyy-MM-dd';
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toDayKey(date: Date): DayKey {
  return format(date, DAY_KEY_FORMAT);
}

export function todayKey(now: Date = new Date()): DayKey {
  return toDayKey(now);
}

export function isDayKey(value: string): value is DayKey {
  return DAY_KEY_PATTERN.test(value) && isValid(dayKeyToDate(value));
}

/** Local midnight of the given day (DST-safe: date-fns constructs local dates). */
export function dayKeyToDate(key: DayKey): Date {
  return parse(key, DAY_KEY_FORMAT, new Date(2000, 0, 1));
}

export function shiftDayKey(key: DayKey, days: number): DayKey {
  return toDayKey(addDays(dayKeyToDate(key), days));
}

/** Whole calendar days from `a` to `b` (b - a), independent of DST hour shifts. */
export function dayKeyDiff(a: DayKey, b: DayKey): number {
  return differenceInCalendarDays(dayKeyToDate(b), dayKeyToDate(a));
}

/** Inclusive list of day keys, oldest first. */
export function dayKeyRange(start: DayKey, end: DayKey): DayKey[] {
  const days: DayKey[] = [];
  const total = dayKeyDiff(start, end);
  for (let i = 0; i <= total; i += 1) days.push(shiftDayKey(start, i));
  return days;
}

/** The last `count` days ending with `end`, oldest first. */
export function lastNDays(end: DayKey, count: number): DayKey[] {
  return dayKeyRange(shiftDayKey(end, -(count - 1)), end);
}

/** Value for <input type="datetime-local"> in the device's local time zone. */
export function toDateTimeLocal(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function weekStartKey(key: DayKey, weekStartsOn: 0 | 1 = 1): DayKey {
  return toDayKey(startOfWeek(dayKeyToDate(key), { weekStartsOn }));
}

/**
 * A date-time is acceptable for an observation or care entry if it parses and
 * is not in the future relative to `now` (one minute of clock tolerance).
 */
export function isPastOrPresent(value: Date, now: number): boolean {
  return !Number.isNaN(value.getTime()) && value.getTime() <= now + 60_000;
}
