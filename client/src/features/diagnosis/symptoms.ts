import { z } from 'zod';

/**
 * Controlled, extensible symptom taxonomy.
 *
 * A tag records something the model *described as visible*; it is not a claim
 * that the symptom indicates any particular disease. Mapping from the model's
 * free-text answer to codes is a deterministic keyword match (see
 * `normalizeSymptoms`) and is documented in docs/ASSESSMENT_SCHEMA.md.
 */
export const SYMPTOM_CODES = [
  'yellowing',
  'brown_dark_spots',
  'holes_chewing',
  'curling_distortion',
  'wilting',
  'powdery_fuzzy',
  'mosaic',
  'necrosis',
  'visible_pests',
  'no_obvious_symptoms',
  'uncertain',
  'other',
] as const;

export const symptomCodeSchema = z.enum(SYMPTOM_CODES);
export type SymptomCode = z.infer<typeof symptomCodeSchema>;

interface SymptomDefinition {
  label: string;
  /** Lower-case keyword patterns matched against the model's description. */
  patterns: RegExp[];
  /** Whether the tag indicates something abnormal (used for status decisions). */
  abnormal: boolean;
}

export const SYMPTOM_TAXONOMY: Record<SymptomCode, SymptomDefinition> = {
  yellowing: {
    label: 'Yellow discoloration',
    patterns: [/\byellow(ing|ed|ish)?\b/, /\bchloro(sis|tic)\b/, /\bpale\b/],
    abnormal: true,
  },
  brown_dark_spots: {
    label: 'Brown or dark spots',
    patterns: [/\bspot(s|ted|ting)?\b/, /\blesions?\b/, /\b(brown|black|dark)\s+(patch|patches|marks?|areas?|circles?|rings?)\b/, /\btarget\b/],
    abnormal: true,
  },
  holes_chewing: {
    label: 'Holes or chewing damage',
    patterns: [/\bholes?\b/, /\bchew(ed|ing)?\b/, /\bbitten\b/, /\bragged\b/, /\beaten\b/],
    abnormal: true,
  },
  curling_distortion: {
    label: 'Curling or distortion',
    patterns: [/\bcurl(ing|ed|s)?\b/, /\bdistort(ed|ion)?\b/, /\bdeformed\b/, /\bpuckered\b/, /\btwisted\b/],
    abnormal: true,
  },
  wilting: {
    label: 'Wilting or drooping',
    patterns: [/\bwilt(ing|ed)?\b/, /\bdroop(ing|y)?\b/, /\blimp\b/],
    abnormal: true,
  },
  powdery_fuzzy: {
    label: 'Powdery or fuzzy surface',
    patterns: [/\bpowder(y)?\b/, /\bmou?ld(y)?\b/, /\bmildew\b/, /\bfuzz(y)?\b/, /\bwhite\s+(coating|patches|film|growth)\b/],
    abnormal: true,
  },
  mosaic: {
    label: 'Mosaic-like discoloration',
    patterns: [/\bmosaic\b/, /\bmottl(ed|ing)\b/, /\bstreak(s|ed|ing)?\b/],
    abnormal: true,
  },
  necrosis: {
    label: 'Dead (necrotic) areas',
    patterns: [/\bnecro(sis|tic)\b/, /\bdead\b/, /\bdry(ing)?\b/, /\bdried\b/, /\bscorch(ed)?\b/, /\bcrisp(y)?\b/, /\brot(ting|ten)?\b/],
    abnormal: true,
  },
  visible_pests: {
    label: 'Visible pests',
    patterns: [/\binsects?\b/, /\bpests?\b/, /\baphids?\b/, /\bmites?\b/, /\bcaterpillars?\b/, /\bbugs?\b/, /\bwebbing\b/],
    abnormal: true,
  },
  no_obvious_symptoms: { label: 'No obvious visible symptoms', patterns: [], abnormal: false },
  uncertain: { label: 'Uncertain', patterns: [], abnormal: false },
  other: { label: 'Other observed abnormality', patterns: [], abnormal: true },
};

export function symptomLabel(code: SymptomCode): string {
  return SYMPTOM_TAXONOMY[code].label;
}

export function isAbnormal(code: SymptomCode): boolean {
  return SYMPTOM_TAXONOMY[code].abnormal;
}

/** Codes matched by one phrase (a phrase may match several, e.g. "brown dry spots"). */
export function codesForPhrase(phrase: string): SymptomCode[] {
  const text = phrase.toLowerCase();
  return (Object.keys(SYMPTOM_TAXONOMY) as SymptomCode[]).filter((code) =>
    SYMPTOM_TAXONOMY[code].patterns.some((pattern) => pattern.test(text)),
  );
}

export interface NormalizedSymptom {
  code: SymptomCode;
  /** The model's own words that produced this tag. */
  phrases: string[];
}

/**
 * Maps the model's sign phrases to taxonomy codes, keeping the original words
 * as evidence. Phrases that match nothing become `other` (still shown, never dropped).
 */
export function normalizeSymptoms(phrases: string[]): NormalizedSymptom[] {
  const byCode = new Map<SymptomCode, string[]>();
  for (const phrase of phrases) {
    const codes = codesForPhrase(phrase);
    for (const code of codes.length ? codes : (['other'] as SymptomCode[])) {
      byCode.set(code, [...(byCode.get(code) ?? []), phrase]);
    }
  }
  return [...byCode.entries()].map(([code, matched]) => ({ code, phrases: matched }));
}
