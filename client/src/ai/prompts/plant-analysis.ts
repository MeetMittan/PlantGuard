/**
 * Plant analysis prompt sequence (documented in docs/AI_PROMPTS.md).
 *
 * Small on-device vision-language models (~0.25–0.5B parameters) do not
 * reliably follow multi-field templates or JSON schemas — in testing,
 * SmolVLM-500M echoed a line template back verbatim and produced JSON with the
 * wrong structure. They do answer short, focused questions well. PlantGuard
 * therefore asks a few constrained questions and assembles the structured,
 * validated assessment in application code.
 */

export const PROMPT_VERSION = 'plant-qa-v1';

export type AnalysisStepId = 'isPlant' | 'plant' | 'health' | 'signs' | 'condition';

export interface AnalysisStep {
  id: AnalysisStepId;
  label: string;
  maxNewTokens: number;
  question: (context: string) => string;
}

/** Bounded, single-line user context so it can't dominate or restructure the prompt. */
export function sanitizeContext(context: string): string {
  return context
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["“”]/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 200);
}

const withContext = (context: string, question: string) =>
  context ? `The person who took the photo says: "${context}". ${question}` : question;

export const ANALYSIS_STEPS: Record<AnalysisStepId, AnalysisStep> = {
  isPlant: {
    id: 'isPlant',
    label: 'Checking the photo shows a plant',
    maxNewTokens: 8,
    question: () => 'Is there a plant or leaf in this photo? Answer yes or no.',
  },
  plant: {
    id: 'plant',
    label: 'Identifying the plant',
    maxNewTokens: 16,
    question: (context) =>
      withContext(
        context,
        'What kind of plant is this? Answer with the common plant name only. If you cannot tell, answer unknown.',
      ),
  },
  health: {
    id: 'health',
    label: 'Assessing leaf health',
    maxNewTokens: 8,
    question: () => 'Does this leaf look healthy or diseased? Answer with one word: healthy, diseased, or unclear.',
  },
  signs: {
    id: 'signs',
    label: 'Describing visible signs',
    maxNewTokens: 48,
    question: () =>
      'Describe the visible symptoms on the leaf, such as spots, yellowing, holes, wilting, mold or white powder. Answer in one short sentence. If there are none, answer none.',
  },
  condition: {
    id: 'condition',
    label: 'Considering possible causes',
    maxNewTokens: 24,
    question: (context) =>
      withContext(
        context,
        'Which plant disease or problem most likely causes these symptoms? Answer with the name only. If you cannot tell, answer unknown.',
      ),
  },
};

/** Steps always asked, in order. `condition` is only asked when a problem is suspected. */
export const BASE_STEP_ORDER: AnalysisStepId[] = ['isPlant', 'plant', 'health', 'signs'];
