import { differenceInCalendarDays } from 'date-fns';
import type { AssessmentRecord, CareEvent, Observation } from '@/db/schema';
import type { AssessmentStatus } from '@/features/diagnosis/schemas/assessment';
import { symptomLabel, type SymptomCode } from '@/features/diagnosis/symptoms';

/**
 * Timeline service (pure, unit-tested).
 *
 * Ordering: by the event's designated time — observation `observedAt`,
 * assessment `createdAt` (rescans), care event `occurredAt` — then by
 * `createdAt`, then `id`, so identical times sort deterministically.
 * All times are stored as ISO-8601 UTC strings and compared as such; they
 * are rendered in the device's local time zone.
 */

export type TimelineEvent =
  | { kind: 'observation'; id: string; at: string; createdAt: string; observation: Observation; assessment: AssessmentRecord | null; assessmentCount: number }
  | { kind: 'reassessment'; id: string; at: string; createdAt: string; observationId: string; assessment: AssessmentRecord }
  | { kind: 'care'; id: string; at: string; createdAt: string; event: CareEvent };

export function compareEvents(a: Pick<TimelineEvent, 'at' | 'createdAt' | 'id'>, b: Pick<TimelineEvent, 'at' | 'createdAt' | 'id'>): number {
  return a.at.localeCompare(b.at) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export function buildTimeline(
  observations: Observation[],
  assessments: AssessmentRecord[],
  careEvents: CareEvent[],
  order: 'newest' | 'oldest' = 'newest',
): TimelineEvent[] {
  const byObservation = new Map<string, AssessmentRecord[]>();
  for (const assessment of assessments) {
    const list = byObservation.get(assessment.observationId) ?? [];
    list.push(assessment);
    byObservation.set(assessment.observationId, list);
  }

  const events: TimelineEvent[] = [];
  for (const observation of observations) {
    const list = (byObservation.get(observation.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const latest = list.find((assessment) => assessment.id === observation.latestAssessmentId) ?? list.at(-1) ?? null;
    events.push({
      kind: 'observation',
      id: observation.id,
      at: observation.observedAt,
      createdAt: observation.createdAt,
      observation,
      assessment: latest,
      assessmentCount: list.length,
    });
    // Later analyses of the same photo appear as their own events; the first one is part of the observation.
    for (const assessment of list.slice(1)) {
      events.push({
        kind: 'reassessment',
        id: assessment.id,
        at: assessment.createdAt,
        createdAt: assessment.createdAt,
        observationId: observation.id,
        assessment,
      });
    }
  }
  for (const event of careEvents) {
    events.push({ kind: 'care', id: event.id, at: event.occurredAt, createdAt: event.createdAt, event });
  }
  events.sort(compareEvents);
  return order === 'newest' ? events.reverse() : events;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface TimelineComparison {
  olderObservationId: string;
  newerObservationId: string;
  olderAssessmentId: string | null;
  newerAssessmentId: string | null;
  daysApart: number;
  sharedTags: SymptomCode[];
  newlyRecordedTags: SymptomCode[];
  notMentionedInNewerTags: SymptomCode[];
  statusChange: { from: AssessmentStatus; to: AssessmentStatus } | null;
  /** False when either side lacks a usable assessment. */
  comparable: boolean;
  /** True when either assessment was itself inconclusive. */
  inconclusive: boolean;
  limitations: string[];
  /** Display sentences generated only from the structured fields above. */
  summary: string[];
}

/** Meta tags that describe the assessment itself, not a symptom; excluded from differences. */
const META_TAGS = new Set<SymptomCode>(['uncertain', 'no_obvious_symptoms']);
const INCONCLUSIVE = new Set<AssessmentStatus>(['insufficient_evidence', 'image_quality_issue', 'not_a_plant', 'analysis_unavailable']);

const STATUS_LABEL: Record<AssessmentStatus, string> = {
  possible_issue: 'possible issue',
  no_obvious_symptoms: 'no obvious symptoms',
  insufficient_evidence: 'insufficient evidence',
  image_quality_issue: 'photo quality issue',
  not_a_plant: 'not a plant',
  analysis_unavailable: 'not analysed',
};

export const FRAMING_CAVEAT =
  'Photos taken at different times usually differ in angle, distance and lighting, so this comparison cannot confirm whether the underlying condition has improved or worsened.';

function tagsOf(assessment: AssessmentRecord | null): SymptomCode[] {
  return assessment ? [...new Set(assessment.visibleFindings.map((finding) => finding.code))].filter((code) => !META_TAGS.has(code)) : [];
}

function sentenceList(codes: SymptomCode[]): string {
  const labels = codes.map((code) => symptomLabel(code).toLowerCase());
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function compareObservations(
  first: { observation: Observation; assessment: AssessmentRecord | null },
  second: { observation: Observation; assessment: AssessmentRecord | null },
): TimelineComparison {
  const [older, newer] =
    compareEvents(
      { at: first.observation.observedAt, createdAt: first.observation.createdAt, id: first.observation.id },
      { at: second.observation.observedAt, createdAt: second.observation.createdAt, id: second.observation.id },
    ) <= 0
      ? [first, second]
      : [second, first];

  const olderTags = tagsOf(older.assessment);
  const newerTags = tagsOf(newer.assessment);
  const shared = olderTags.filter((code) => newerTags.includes(code));
  const added = newerTags.filter((code) => !olderTags.includes(code));
  const notMentioned = olderTags.filter((code) => !newerTags.includes(code));
  const comparable = Boolean(older.assessment && newer.assessment);
  const inconclusive = Boolean(
    (older.assessment && INCONCLUSIVE.has(older.assessment.overallAssessment)) ||
      (newer.assessment && INCONCLUSIVE.has(newer.assessment.overallAssessment)),
  );
  const statusChange =
    older.assessment && newer.assessment && older.assessment.overallAssessment !== newer.assessment.overallAssessment
      ? { from: older.assessment.overallAssessment, to: newer.assessment.overallAssessment }
      : null;

  const limitations: string[] = [FRAMING_CAVEAT];
  if (!older.assessment) limitations.push('The earlier observation has no AI assessment, so its symptoms cannot be compared.');
  if (!newer.assessment) limitations.push('The later observation has no AI assessment, so its symptoms cannot be compared.');
  if (inconclusive) limitations.push('At least one assessment was inconclusive, so missing tags are especially unreliable.');
  if (
    older.assessment &&
    newer.assessment &&
    (older.assessment.modelId !== newer.assessment.modelId || older.assessment.promptVersion !== newer.assessment.promptVersion)
  ) {
    limitations.push('The two assessments were produced by different model or prompt versions.');
  }
  if (!older.observation.image || !newer.observation.image) {
    limitations.push('At least one full-size photo was not kept, so only a thumbnail is available for visual comparison.');
  }
  limitations.push('An AI assessment can miss a real symptom because of framing, lighting or model variability.');

  const summary: string[] = [];
  if (!comparable) {
    summary.push('No comparable assessment data — compare the photos and your notes instead.');
  } else {
    if (shared.length) summary.push(`${capitalize(sentenceList(shared))} ${shared.length === 1 ? 'was' : 'were'} mentioned in both observations.`);
    if (added.length) summary.push(`${capitalize(sentenceList(added))} ${added.length === 1 ? 'was' : 'were'} recorded only in the newer assessment.`);
    if (notMentioned.length) {
      summary.push(
        `${capitalize(sentenceList(notMentioned))} ${notMentioned.length === 1 ? 'was' : 'were'} recorded earlier but not mentioned in the newer assessment — this does not mean ${notMentioned.length === 1 ? 'it has' : 'they have'} gone.`,
      );
    }
    if (!shared.length && !added.length && !notMentioned.length) summary.push('Neither assessment recorded specific symptom tags.');
    if (statusChange) summary.push(`The assessment status changed from “${STATUS_LABEL[statusChange.from]}” to “${STATUS_LABEL[statusChange.to]}”.`);
  }
  summary.push(FRAMING_CAVEAT);

  return {
    olderObservationId: older.observation.id,
    newerObservationId: newer.observation.id,
    olderAssessmentId: older.assessment?.id ?? null,
    newerAssessmentId: newer.assessment?.id ?? null,
    daysApart: Math.abs(differenceInCalendarDays(new Date(newer.observation.observedAt), new Date(older.observation.observedAt))),
    sharedTags: shared,
    newlyRecordedTags: added,
    notMentionedInNewerTags: notMentioned,
    statusChange,
    comparable,
    inconclusive,
    limitations,
    summary,
  };
}
