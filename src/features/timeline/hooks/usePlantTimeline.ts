import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { careEventsForPlant } from '@/db/repositories/care-events';
import { observationsForPlant } from '@/db/repositories/observations';
import { getPlant } from '@/db/repositories/plants';
import type { AssessmentRecord, CareEvent, Observation, Plant } from '@/db/schema';
import { buildTimeline, type TimelineEvent } from '../services/timeline';

export interface PlantTimelineData {
  loading: boolean;
  plant: Plant | null;
  observations: Observation[];
  assessments: AssessmentRecord[];
  careEvents: CareEvent[];
  events: TimelineEvent[];
}

/**
 * Live timeline for one plant. Queries use the [plantId+observedAt],
 * [plantId+occurredAt] and observationId indexes. Lists render thumbnails only;
 * full photos are loaded when a comparison or detail view needs them.
 */
export function usePlantTimeline(plantId: string): PlantTimelineData {
  const data = useLiveQuery(async () => {
    const plant = (await getPlant(plantId)) ?? null;
    if (!plant) return { plant, observations: [], assessments: [], careEvents: [] };
    const observations = await observationsForPlant(plantId);
    const ids = observations.map((observation) => observation.id);
    const assessments = ids.length ? await db.assessments.where('observationId').anyOf(ids).toArray() : [];
    const careEvents = await careEventsForPlant(plantId);
    return { plant, observations, assessments, careEvents };
  }, [plantId]);

  return useMemo(() => {
    if (!data) return { loading: true, plant: null, observations: [], assessments: [], careEvents: [], events: [] };
    return { loading: false, ...data, events: buildTimeline(data.observations, data.assessments, data.careEvents) };
  }, [data]);
}
