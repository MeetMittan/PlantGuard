import type { AssessmentStatus, Recommendations } from '../schemas/assessment';
import type { SymptomCode } from '../symptoms';

/**
 * Curated, conservative guidance (never model-generated).
 *
 * Rules:
 * - Immediate steps are low-risk and reversible (observe, check, isolate).
 * - No pesticide/fungicide product names, mixing instructions or dosages.
 * - No irreversible actions (e.g. heavy pruning) based on uncertain evidence.
 * - Never claims an action will cure anything.
 */

export const EXPERT_HELP_TEXT =
  'Ask a local agricultural extension service, plant clinic or experienced nursery if symptoms spread quickly, affect a valuable crop or many plants, persist after basic care checks, or before using any chemical treatment.';

const GENERAL_PREVENTION = [
  'Water at the base of the plant, ideally in the morning, so leaves dry quickly.',
  'Give plants enough space for air to move between leaves.',
  'Clean pruning tools between plants.',
  'Clear away fallen, diseased-looking leaves rather than leaving them under the plant.',
];

const RETAKE = [
  'Retake the photo in daylight with one leaf filling most of the frame, in sharp focus.',
  'Include both healthy and affected parts of the leaf, and photograph the underside if you see spots or powder.',
];

const FOLLOW_UP = [
  'Photograph the same leaf again in 3–5 days, in similar light, and compare it in this plant’s timeline.',
  'Note whether symptoms appear on new leaves or on nearby plants.',
];

const SYMPTOM_STEPS: Partial<Record<SymptomCode, string>> = {
  wilting: 'Feel the soil a few centimetres down before watering again — both dry and waterlogged soil can cause wilting.',
  yellowing: 'Check soil moisture, drainage and light first; these are common, easily fixed causes of yellowing.',
  powdery_fuzzy: 'Avoid wetting the leaves when watering and improve airflow around the plant.',
  holes_chewing: 'Look under leaves and around the plant (including after dark) for caterpillars, beetles, slugs or snails.',
  visible_pests: 'Check shoot tips and leaf undersides for insects and sticky honeydew.',
  curling_distortion: 'Check shoot tips and leaf undersides for small sap-feeding insects.',
  brown_dark_spots: 'Note whether spots are mainly on older, lower leaves or spreading to new growth.',
  necrosis: 'Check whether the damage is on the sunniest side or at leaf edges, which points to sun or drought stress.',
  mosaic: 'Keep an eye on new growth for mottling or distortion, and check for insects that spread viruses.',
};

export function recommendationsFor(status: AssessmentStatus, codes: SymptomCode[]): Recommendations {
  switch (status) {
    case 'possible_issue': {
      const specific = [...new Set(codes.map((code) => SYMPTOM_STEPS[code]).filter((step): step is string => Boolean(step)))];
      return {
        immediate: [
          ...specific.slice(0, 3),
          'If it is a potted plant, consider moving it away from other plants until you know more.',
        ],
        followUp: [...FOLLOW_UP, 'If a disease is later confirmed, removing a few badly affected leaves with clean tools can limit spread.'],
        prevention: GENERAL_PREVENTION,
        expertHelp: EXPERT_HELP_TEXT,
      };
    }
    case 'no_obvious_symptoms':
      return {
        immediate: ['No action needed based on this photo. Keep up regular care.'],
        followUp: ['Check the undersides of leaves and the stems, which a single photo may not show.', FOLLOW_UP[1]!],
        prevention: GENERAL_PREVENTION,
        expertHelp: EXPERT_HELP_TEXT,
      };
    case 'image_quality_issue':
      return { immediate: RETAKE, followUp: [], prevention: [], expertHelp: EXPERT_HELP_TEXT };
    case 'not_a_plant':
      return {
        immediate: ['Retake the photo with a leaf or plant clearly in view.'],
        followUp: [],
        prevention: [],
        expertHelp: EXPERT_HELP_TEXT,
      };
    case 'insufficient_evidence':
    case 'analysis_unavailable':
      return {
        immediate: [...RETAKE, 'Add context such as the plant name and when you first noticed the problem.'],
        followUp: FOLLOW_UP,
        prevention: GENERAL_PREVENTION,
        expertHelp: EXPERT_HELP_TEXT,
      };
  }
}
