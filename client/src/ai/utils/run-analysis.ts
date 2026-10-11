import type { AnalysisStepProgress } from '../contracts/types';
import { ANALYSIS_STEPS, BASE_STEP_ORDER, sanitizeContext, type AnalysisStepId } from '../prompts/plant-analysis';
import { isNotAPlant, shouldAskCondition, type AnswerSet } from './parse-answers';
import { ModelRuntimeError } from './errors';

export interface GenerateFn {
  (prompt: string, maxNewTokens: number): Promise<{
    text: string;
    hitTokenLimit: boolean;
    interrupted: boolean;
    inferenceMs: number;
  }>;
}

export interface RunAnalysisOptions {
  context: string;
  generate: GenerateFn;
  isCancelled?: () => boolean;
  onStep?: ((step: AnalysisStepProgress) => void) | undefined;
}

const cancelled = () => new ModelRuntimeError({ code: 'REQUEST_CANCELLED', message: 'Analysis cancelled.' });

/**
 * Runs the plant-analysis question sequence against any text generator and
 * returns the raw answers. Runs inside the inference worker in the browser and
 * directly in Node for `npm run verify:inference` / `npm run eval:model`, so all
 * environments exercise identical logic. Building the application assessment
 * from these answers is the diagnosis feature's job.
 */
export async function runAnalysis({ context, generate, isCancelled, onStep }: RunAnalysisOptions): Promise<{
  answers: AnswerSet;
  inferenceMs: number;
}> {
  const cleanContext = sanitizeContext(context);
  const answers: AnswerSet = {};
  const steps: AnalysisStepId[] = [...BASE_STEP_ORDER];
  let inferenceMs = 0;

  for (let index = 0; index < steps.length; index += 1) {
    if (isCancelled?.()) throw cancelled();
    const step = ANALYSIS_STEPS[steps[index]!];
    onStep?.({ index, total: steps.length, label: step.label });

    const result = await generate(step.question(cleanContext), step.maxNewTokens);
    if (result.interrupted || isCancelled?.()) throw cancelled();
    inferenceMs += result.inferenceMs;
    answers[step.id] = { text: result.text, truncated: result.hitTokenLimit };

    if (step.id === 'isPlant' && isNotAPlant(answers)) break;
    if (index === steps.length - 1 && !steps.includes('condition') && shouldAskCondition(answers)) {
      steps.push('condition');
    }
  }
  return { answers, inferenceMs };
}
