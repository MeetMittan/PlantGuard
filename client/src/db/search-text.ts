import { SYMPTOM_CODES, symptomLabel, type SymptomCode } from '@/features/diagnosis/symptoms';

/** Builds the lower-cased search string stored on each observation (schema v3+). */
export function buildObservationSearchText(observation: {
  label?: unknown;
  notes?: unknown;
  context?: unknown;
  plantSuggestion?: unknown;
  symptomTags?: unknown;
  extraTerms?: string[];
}): string {
  const parts: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) parts.push(value.trim());
  };
  push(observation.label);
  push(observation.notes);
  push(observation.context);
  push(observation.plantSuggestion);
  if (Array.isArray(observation.symptomTags)) {
    for (const tag of observation.symptomTags) {
      if ((SYMPTOM_CODES as readonly string[]).includes(tag)) push(symptomLabel(tag as SymptomCode));
    }
  }
  observation.extraTerms?.forEach(push);
  return parts.join(' • ').toLowerCase();
}

/** Extra search terms from an assessment: cause names plus the model's own words for each finding. */
export function assessmentSearchTerms(assessment: { possibleCauses: Array<{ name: string }>; visibleFindings: Array<{ description: string }> } | null | undefined): string[] {
  if (!assessment) return [];
  return [...assessment.possibleCauses.map((cause) => cause.name), ...assessment.visibleFindings.map((finding) => finding.description)];
}
