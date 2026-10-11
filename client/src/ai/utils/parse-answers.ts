import type { AnalysisStepId } from '../prompts/plant-analysis';

/**
 * Low-level parsing of the short free-text answers produced by the model.
 * Everything here is deterministic and unit-tested (parse-answers.test.ts).
 * Turning parsed answers into an application assessment happens in
 * src/features/diagnosis/services/assessment-service.ts.
 */

export interface StepAnswer {
  text: string;
  /** Generation stopped at the token limit, so the answer may be cut off. */
  truncated: boolean;
}

export type AnswerSet = Partial<Record<AnalysisStepId, StepAnswer>>;

const UNKNOWN_PATTERN =
  /^(unknown|unsure|not sure|unclear|n\/a|none|no idea|i (do not|don't|cannot|can't) (know|tell|say|determine)|cannot (tell|determine|be determined)|it is (unclear|not clear|unknown))\b/i;

const PROBLEM_SIGN_PATTERN =
  /\b(spots?|spotted|spotting|lesions?|yellow(ing|ed)?|brown(ing|ed)?|black(ened)?|holes?|wilt(ing|ed)?|mou?ld|mildew|powder(y)?|rot(ting|ten)?|blight|rust|curl(ing|ed)?|necro(sis|tic)|chlorosis|chlorotic|dry|dried|scorch(ed)?|white patches?|fungus|fungal|pests?|insects?|damage(d)?|disease(d)?|discolou?r(ation|ed)?|dead|dying)\b/i;

/** Treatment instructions, product types or quantities: never shown as a "cause". */
const TREATMENT_PATTERN =
  /\b(spray|apply|mix|dilute|dose|dosage|\d+\s?(ml|mg|g|l|oz|%)|fungicide|pesticide|insecticide|herbicide|chemical|copper sulfate|neem)\b/i;

/** Names too generic to count as an identification. */
const GENERIC_PLANT_NAMES = /^(a |the )?(plant|leaf|leaves|green leaf|tree|flower|shrub|bush|weed|vegetation|foliage)$/i;

/** Cleans a raw answer: whitespace, wrapping quotes, trailing punctuation, length. */
export function normalizeAnswer(text: string, maxLength = 300): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^(answer|a)\s*:\s*/i, '')
    .replace(/[.!]+$/g, '')
    .trim()
    .slice(0, maxLength);
}

export function parseYesNo(text: string): 'yes' | 'no' | null {
  const value = normalizeAnswer(text).toLowerCase();
  if (/^(yes|yeah|yep|there is|it is|it's|a (plant|leaf))\b/.test(value)) return 'yes';
  if (/^(no|nope|there is no|it is not|it's not|not a)\b/.test(value)) return 'no';
  return null;
}

export type HealthAnswer = 'healthy' | 'diseased' | 'unclear';

export function parseHealth(text: string): HealthAnswer | null {
  const value = normalizeAnswer(text).toLowerCase();
  if (!value) return null;
  if (/\b(unclear|unsure|not sure|cannot tell|can't tell|unknown|hard to tell)\b/.test(value)) return 'unclear';
  if (/\b(unhealthy|diseased|disease|sick|infected|damaged|dying|not healthy)\b/.test(value)) return 'diseased';
  if (/\bhealthy\b/.test(value)) return 'healthy';
  return null;
}

export interface ParsedName {
  value: string | null;
  warning: string | null;
}

/** A short name (plant or condition), or null for "unknown"-style and run-on answers. */
export function parseName(text: string): ParsedName {
  const value = normalizeAnswer(text, 200);
  if (!value || UNKNOWN_PATTERN.test(value)) return { value: null, warning: null };
  const firstClause = value.split(/[.;\n]/)[0]!.trim();
  if (firstClause.split(/\s+/).length > 8) {
    return { value: null, warning: 'The model gave a long answer instead of a name, so it was not used.' };
  }
  const cleaned = firstClause.replace(/^((it is|this is|it's|a|an|the)\s+)+/i, '').trim();
  if (!cleaned) return { value: null, warning: null };
  return { value: cleaned.charAt(0).toUpperCase() + cleaned.slice(1), warning: null };
}

export function parsePlantName(text: string): ParsedName {
  const parsed = parseName(text);
  if (parsed.value && GENERIC_PLANT_NAMES.test(parsed.value)) {
    return { value: null, warning: 'The model only answered with a generic word, so no plant name was suggested.' };
  }
  return parsed;
}

/** Cause names that contain treatment instructions are discarded (safety). */
export function parseConditionName(text: string): ParsedName {
  if (TREATMENT_PATTERN.test(text)) {
    return { value: null, warning: 'The model’s answer contained treatment instructions, which PlantGuard does not show.' };
  }
  return parseName(text);
}

/** Splits a symptom description into short sign phrases. */
export function parseSigns(text: string): string[] {
  const value = normalizeAnswer(text, 400);
  if (!value || isNoneAnswer(value)) return [];
  const parts = value
    .split(/[;,]|\band\b|\bwith\b/i)
    .map((part) =>
      part
        .replace(/^(the (leaf|leaves|plant) (has|have|shows?|is|are)|there (is|are)|it (has|shows?)|i see|i can see)\s+/i, '')
        .trim(),
    )
    .filter((part) => part.length > 1);
  const unique: string[] = [];
  for (const part of parts) {
    const phrase = part.charAt(0).toUpperCase() + part.slice(1, 160);
    if (!unique.some((existing) => existing.toLowerCase() === phrase.toLowerCase())) unique.push(phrase);
  }
  return unique.slice(0, 8);
}

export function isNoneAnswer(text: string): boolean {
  return /^(none|no (visible )?symptoms?|nothing|there are no|no signs?|0)\b/i.test(normalizeAnswer(text));
}

/** Example terms used in the "signs" question (see prompts/plant-analysis.ts). */
const SIGN_EXAMPLE_TERMS = ['spot', 'yellow', 'hole', 'wilt', 'mold', 'powder'];

/**
 * Small models sometimes repeat the examples from the question instead of
 * describing the photo (observed with SmolVLM-256M). An answer containing most
 * of the example terms is treated as an echo, not as observations.
 */
export function isEchoOfExamples(text: string): boolean {
  const value = text.toLowerCase();
  return SIGN_EXAMPLE_TERMS.filter((term) => value.includes(term)).length >= 4;
}

export function hasProblemSigns(signs: string[]): boolean {
  return signs.some((sign) => PROBLEM_SIGN_PATTERN.test(sign));
}

/** Whether to ask the follow-up "condition" question after the base steps. */
export function shouldAskCondition(answers: AnswerSet): boolean {
  if (answers.isPlant && parseYesNo(answers.isPlant.text) === 'no') return false;
  const health = answers.health ? parseHealth(answers.health.text) : null;
  const signs = answers.signs && !isEchoOfExamples(answers.signs.text) ? parseSigns(answers.signs.text) : [];
  return health === 'diseased' || hasProblemSigns(signs);
}

/** Whether to stop after the first step because the photo isn't a plant. */
export function isNotAPlant(answers: AnswerSet): boolean {
  return Boolean(answers.isPlant && parseYesNo(answers.isPlant.text) === 'no');
}

/** Bounded transcript of the answers for transparency (no image data). */
export function formatAnswers(answers: AnswerSet): string {
  return (Object.entries(answers) as Array<[AnalysisStepId, StepAnswer]>)
    .map(([step, answer]) => `${step}: ${answer.text.trim()}${answer.truncated ? ' [cut off]' : ''}`)
    .join('\n')
    .slice(0, 1500);
}
