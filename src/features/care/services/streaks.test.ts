import { describe, expect, it } from 'vitest';
import { shiftDayKey, toDayKey, dayKeyDiff, dayKeyRange } from '@/lib/dates';
import { bestStreak, calculateStreak, countByDay, mergeActivity, nextMilestone, reachedMilestone, weeklySummary } from './streaks';

const activity = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe('calculateStreak', () => {
  it('counts consecutive qualifying days ending today', () => {
    const result = calculateStreak(activity({ '2026-03-10': 1, '2026-03-11': 2, '2026-03-12': 1 }), '2026-03-12', 1);
    expect(result.current).toBe(3);
    expect(result.todayComplete).toBe(true);
    expect(result.atRisk).toBe(false);
  });

  it('keeps yesterday’s streak while today is still in progress', () => {
    const result = calculateStreak(activity({ '2026-03-10': 1, '2026-03-11': 1 }), '2026-03-12', 1);
    expect(result.current).toBe(2);
    expect(result.todayComplete).toBe(false);
    expect(result.atRisk).toBe(true);
  });

  it('breaks the streak after a missed day (no grace days)', () => {
    const result = calculateStreak(activity({ '2026-03-08': 1, '2026-03-09': 1, '2026-03-11': 1 }), '2026-03-12', 1);
    expect(result.current).toBe(1);
    expect(result.best).toBe(2);
  });

  it('returns zero when neither today nor yesterday qualifies', () => {
    expect(calculateStreak(activity({ '2026-03-09': 3 }), '2026-03-12', 1).current).toBe(0);
  });

  it('requires the daily goal to be met', () => {
    const data = activity({ '2026-03-11': 1, '2026-03-12': 2 });
    expect(calculateStreak(data, '2026-03-12', 2).current).toBe(1);
    expect(calculateStreak(data, '2026-03-12', 1).current).toBe(2);
  });

  it('treats invalid goals as at least 1', () => {
    expect(calculateStreak(activity({ '2026-03-12': 1 }), '2026-03-12', 0).goal).toBe(1);
  });

  it('crosses month and year boundaries', () => {
    const result = calculateStreak(activity({ '2025-12-30': 1, '2025-12-31': 1, '2026-01-01': 1 }), '2026-01-01', 1);
    expect(result.current).toBe(3);
  });

  it('handles leap days', () => {
    const result = calculateStreak(activity({ '2028-02-28': 1, '2028-02-29': 1, '2028-03-01': 1 }), '2028-03-01', 1);
    expect(result.current).toBe(3);
  });

  it('ignores future-dated activity for the best streak', () => {
    const data = activity({ '2026-03-12': 1, '2026-03-20': 1, '2026-03-21': 1, '2026-03-22': 1 });
    expect(bestStreak(data, 1, '2026-03-12')).toBe(1);
  });
});

describe('daylight saving time and date boundaries', () => {
  it('computes whole calendar days across DST transitions', () => {
    // EU spring-forward (2026-03-29) and US (2026-03-08); differences must stay whole days in any zone.
    expect(dayKeyDiff('2026-03-28', '2026-03-30')).toBe(2);
    expect(dayKeyDiff('2026-03-07', '2026-03-09')).toBe(2);
    expect(dayKeyDiff('2026-10-24', '2026-10-26')).toBe(2);
    expect(shiftDayKey('2026-03-29', 1)).toBe('2026-03-30');
    expect(shiftDayKey('2026-11-01', -1)).toBe('2026-10-31');
    expect(dayKeyRange('2026-03-27', '2026-03-31')).toHaveLength(5);
  });

  it('keeps a streak across a DST change', () => {
    const result = calculateStreak(activity({ '2026-03-28': 1, '2026-03-29': 1, '2026-03-30': 1 }), '2026-03-30', 1);
    expect(result.current).toBe(3);
  });

  it('uses local time, not UTC, for day keys', () => {
    // 23:30 local on Jan 5 must be Jan 5 regardless of the UTC offset.
    expect(toDayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(toDayKey(new Date(2026, 0, 6, 0, 5))).toBe('2026-01-06');
  });
});

describe('activity helpers', () => {
  it('merges care completions and observations per day', () => {
    const completions = countByDay([{ d: '2026-03-12' }, { d: '2026-03-12' }], (x) => x.d);
    const observations = new Map([['2026-03-12', 1], ['2026-03-11', 1]]);
    const merged = mergeActivity(completions, observations);
    expect(merged.get('2026-03-12')).toBe(3);
    expect(merged.get('2026-03-11')).toBe(1);
  });

  it('builds a 7-day summary ending today', () => {
    const week = weeklySummary(activity({ '2026-03-12': 2, '2026-03-06': 1 }), '2026-03-12', 2);
    expect(week).toHaveLength(7);
    expect(week[0]!.day).toBe('2026-03-06');
    expect(week[6]).toEqual({ day: '2026-03-12', count: 2, complete: true });
    expect(week[0]!.complete).toBe(false);
  });

  it('reports milestones', () => {
    expect(nextMilestone(0)).toBe(3);
    expect(nextMilestone(7)).toBe(14);
    expect(nextMilestone(400)).toBeNull();
    expect(reachedMilestone(7)).toBe(7);
    expect(reachedMilestone(8)).toBeNull();
  });
});
