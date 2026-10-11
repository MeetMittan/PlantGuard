import { describe, expect, it } from 'vitest';
import type { AssessmentRecord, CareEvent, Observation } from '@/db/schema';
import { sampleAssessment } from '@/test/db-helpers';
import { buildTimeline, compareObservations, FRAMING_CAVEAT } from './timeline';

function observation(id: string, observedAt: string, overrides: Partial<Observation> = {}): Observation {
  return {
    id,
    plantId: 'p1',
    capturedAt: null,
    observedAt,
    createdAt: observedAt,
    updatedAt: observedAt,
    dayKey: observedAt.slice(0, 10),
    label: id,
    context: '',
    notes: '',
    image: new Blob(['x']),
    thumbnail: new Blob(['x']),
    mimeType: 'image/jpeg',
    imageWidth: 10,
    imageHeight: 10,
    imageByteSize: 1,
    captureSource: 'gallery',
    symptomTags: [],
    latestAssessmentId: null,
    healthStatus: 'unassessed',
    plantSuggestion: null,
    location: null,
    placeId: null,
    searchText: '',
    schemaVersion: 3,
    ...overrides,
  };
}

function assessment(id: string, observationId: string, kind: 'problem' | 'healthy' | 'powdery', createdAt: string): AssessmentRecord {
  return { ...sampleAssessment(kind, new Date(createdAt)), id, observationId };
}

const care = (id: string, occurredAt: string, createdAt = occurredAt): CareEvent => ({
  id,
  plantId: 'p1',
  eventType: 'watering',
  occurredAt,
  dayKey: occurredAt.slice(0, 10),
  notes: '',
  values: null,
  createdAt,
});

describe('buildTimeline', () => {
  it('merges observations, re-analyses and care events in one chronology, newest first', () => {
    const o1 = observation('o1', '2026-03-01T09:00:00.000Z', { latestAssessmentId: 'a1b' });
    const o2 = observation('o2', '2026-03-05T09:00:00.000Z');
    const events = buildTimeline(
      [o1, o2],
      [assessment('a1', 'o1', 'problem', '2026-03-01T09:00:00.000Z'), assessment('a1b', 'o1', 'powdery', '2026-03-03T12:00:00.000Z')],
      [care('c1', '2026-03-02T08:00:00.000Z')],
    );
    expect(events.map((event) => `${event.kind}:${event.id}`)).toEqual(['observation:o2', 'reassessment:a1b', 'care:c1', 'observation:o1']);
    const first = events.find((event) => event.id === 'o1');
    expect(first).toMatchObject({ kind: 'observation', assessmentCount: 2 });
    expect(first?.kind === 'observation' && first.assessment?.id).toBe('a1b'); // latest assessment shown, older retained
  });

  it('orders identical times deterministically by creation time, then id', () => {
    const same = '2026-03-01T09:00:00.000Z';
    const events = buildTimeline(
      [observation('b', same, { createdAt: '2026-03-01T09:00:01.000Z' }), observation('a', same, { createdAt: '2026-03-01T09:00:01.000Z' }), observation('c', same, { createdAt: '2026-03-01T09:00:00.000Z' })],
      [],
      [],
      'oldest',
    );
    expect(events.map((event) => event.id)).toEqual(['c', 'a', 'b']);
  });

  it('uses the user-confirmed observation time, not the save time', () => {
    const imported = observation('old', '2025-12-24T10:00:00.000Z', { createdAt: '2026-03-10T10:00:00.000Z' });
    const recent = observation('new', '2026-03-01T10:00:00.000Z');
    expect(buildTimeline([recent, imported], [], [], 'oldest').map((event) => event.id)).toEqual(['old', 'new']);
  });

  it('keeps same-day events across a DST transition in UTC order', () => {
    // 2026-03-29 is the EU spring-forward day; stored instants are UTC and sort correctly.
    const before = observation('before', '2026-03-29T00:30:00.000Z');
    const after = observation('after', '2026-03-29T01:30:00.000Z');
    expect(buildTimeline([after, before], [], [], 'oldest').map((event) => event.id)).toEqual(['before', 'after']);
  });

  it('includes observations saved without an assessment', () => {
    const [event] = buildTimeline([observation('o', '2026-03-01T09:00:00.000Z')], [], []);
    expect(event).toMatchObject({ kind: 'observation', assessment: null, assessmentCount: 0 });
  });
});

describe('compareObservations', () => {
  const older = observation('o1', '2026-03-01T09:00:00.000Z');
  const newer = observation('o2', '2026-03-08T09:00:00.000Z');

  it('computes shared, new and not-mentioned tags from stored assessments, whatever the argument order', () => {
    const comparison = compareObservations(
      { observation: newer, assessment: assessment('a2', 'o2', 'powdery', newer.observedAt) },
      { observation: older, assessment: assessment('a1', 'o1', 'problem', older.observedAt) },
    );
    expect(comparison.olderObservationId).toBe('o1');
    expect(comparison.daysApart).toBe(7);
    expect(comparison.sharedTags).toEqual(['brown_dark_spots']);
    expect(comparison.newlyRecordedTags).toEqual(['powdery_fuzzy']);
    expect(comparison.notMentionedInNewerTags).toEqual(['yellowing']);
    expect(comparison.comparable).toBe(true);
    expect(comparison.summary.join(' ')).toMatch(/Brown or dark spots was mentioned in both observations/);
    expect(comparison.summary.join(' ')).toMatch(/does not mean it has gone/);
    expect(comparison.summary.at(-1)).toBe(FRAMING_CAVEAT);
  });

  it('reports status changes without any severity or recovery score', () => {
    const comparison = compareObservations(
      { observation: older, assessment: assessment('a1', 'o1', 'problem', older.observedAt) },
      { observation: newer, assessment: assessment('a2', 'o2', 'healthy', newer.observedAt) },
    );
    expect(comparison.statusChange).toEqual({ from: 'possible_issue', to: 'no_obvious_symptoms' });
    expect(Object.keys(comparison).join(' ')).not.toMatch(/score|severity|recovery|percent/i);
    const claims = comparison.summary.filter((sentence) => sentence !== FRAMING_CAVEAT).join(' ');
    expect(claims).not.toMatch(/recover|improv|worse|better|healed|%/i);
  });

  it('handles a missing older or newer assessment', () => {
    const missingOlder = compareObservations(
      { observation: older, assessment: null },
      { observation: newer, assessment: assessment('a2', 'o2', 'problem', newer.observedAt) },
    );
    expect(missingOlder.comparable).toBe(false);
    expect(missingOlder.summary[0]).toMatch(/No comparable assessment data/);
    expect(missingOlder.limitations.join(' ')).toMatch(/earlier observation has no AI assessment/);
    const missingNewer = compareObservations({ observation: older, assessment: assessment('a1', 'o1', 'problem', older.observedAt) }, { observation: newer, assessment: null });
    expect(missingNewer.limitations.join(' ')).toMatch(/later observation has no AI assessment/);
  });

  it('flags inconclusive assessments and missing full photos', () => {
    const inconclusive = { ...assessment('a2', 'o2', 'healthy', newer.observedAt), overallAssessment: 'insufficient_evidence' as const };
    const comparison = compareObservations(
      { observation: { ...older, image: null }, assessment: assessment('a1', 'o1', 'problem', older.observedAt) },
      { observation: newer, assessment: inconclusive },
    );
    expect(comparison.inconclusive).toBe(true);
    expect(comparison.limitations.join(' ')).toMatch(/inconclusive/);
    expect(comparison.limitations.join(' ')).toMatch(/only a thumbnail/);
  });

  it('notes when assessments come from different model or prompt versions', () => {
    const comparison = compareObservations(
      { observation: older, assessment: { ...assessment('a1', 'o1', 'problem', older.observedAt), promptVersion: 'plant-qa-v0' } },
      { observation: newer, assessment: assessment('a2', 'o2', 'problem', newer.observedAt) },
    );
    expect(comparison.limitations.join(' ')).toMatch(/different model or prompt versions/);
  });
});
