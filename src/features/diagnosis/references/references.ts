import type { SymptomCode } from '../symptoms';
import { CAUSE_TEMPLATES, REFERENCE_LIBRARY, type CauseTemplate, type ReferenceEntry } from './library';

/**
 * Deterministic reference matching. References are attached only when a
 * library entry explicitly lists the symptom tag, or when a model-suggested
 * cause name contains one of the entry's condition keywords. The model never
 * chooses or invents references.
 */

export function referencesForCondition(name: string): ReferenceEntry[] {
  const text = name.toLowerCase();
  return REFERENCE_LIBRARY.filter((entry) => entry.conditionKeywords.some((keyword) => text.includes(keyword)));
}

/** Cause templates relevant to the observed abnormal tags, best overlap first. */
export function causeTemplatesFor(codes: SymptomCode[], limit: number): Array<{ template: CauseTemplate; matched: SymptomCode[] }> {
  const set = new Set(codes);
  return CAUSE_TEMPLATES.map((template) => ({ template, matched: template.symptoms.filter((code) => set.has(code)) }))
    .filter(({ matched }) => matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || CAUSE_TEMPLATES.indexOf(a.template) - CAUSE_TEMPLATES.indexOf(b.template))
    .slice(0, limit);
}

/** Template whose topic matches a model-suggested name (used to borrow distinguishing checks). */
export function templateForCondition(name: string): CauseTemplate | undefined {
  const refs = new Set(referencesForCondition(name).map((entry) => entry.id));
  return CAUSE_TEMPLATES.find((template) => template.referenceIds.some((id) => refs.has(id)));
}
