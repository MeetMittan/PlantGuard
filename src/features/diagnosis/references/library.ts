import type { SymptomCode } from '../symptoms';

/**
 * Curated offline reference library (version below).
 *
 * Every entry was opened and read by a maintainer on the review date; the
 * summary is our own paraphrase. Pages are LINKED, not redistributed. The AI
 * never produces reference ids — references are attached only by the
 * deterministic matching in `references.ts`. A matched reference provides
 * general background on a symptom or condition; it does not confirm that a
 * specific plant has that condition.
 *
 * Adding an entry: open the page, write a neutral summary, set `reviewedAt`,
 * tag only symptoms the page actually discusses, and add a test.
 */
export const REFERENCE_LIBRARY_VERSION = '2026-10-11';

export type CauseCategory = 'disease' | 'pest' | 'environmental' | 'nutrient' | 'mechanical' | 'unknown';

export interface ReferenceEntry {
  id: string;
  title: string;
  publisher: string;
  url: string;
  topic: string;
  plantGroups: string[];
  symptoms: SymptomCode[];
  /** Lower-case words that link a model-suggested cause name to this entry. */
  conditionKeywords: string[];
  summary: string;
  reviewedAt: string;
  /** Last-updated date stated by the source, when it shows one. */
  sourceUpdated: string | null;
  attribution: string;
}

export const REFERENCE_LIBRARY: ReferenceEntry[] = [
  {
    id: 'ucipm-leaf-spot-causes',
    title: 'Some Causes of Leaf Spots',
    publisher: 'UC Statewide IPM Program, University of California',
    url: 'https://ipm.ucanr.edu/home-and-landscape/some-causes-of-leaf-spots/',
    topic: 'Leaf spots: infectious and non-infectious causes',
    plantGroups: ['general'],
    symptoms: ['brown_dark_spots', 'necrosis', 'holes_chewing'],
    conditionKeywords: ['leaf spot', 'spot', 'blight', 'anthracnose', 'rust', 'septoria', 'alternaria', 'fusarium', 'bacterial', 'fungal', 'fungus', 'scab', 'shot hole'],
    summary:
      'Lists fungal and bacterial leaf spot diseases (e.g. anthracnose, rusts, Septoria leaf spot, bacterial blight), pests and viruses, as well as non-infectious causes such as sunburn, water deficiency, mineral problems, air pollution and pesticide injury.',
    reviewedAt: '2026-10-11',
    sourceUpdated: null,
    attribution: 'Linked resource © Regents of the University of California. Not redistributed.',
  },
  {
    id: 'ucipm-houseplant-problems',
    title: 'Houseplant Problems',
    publisher: 'UC Statewide IPM Program, University of California',
    url: 'https://ipm.ucanr.edu/home-and-landscape/houseplant-problems/',
    topic: 'Wilting, yellowing, brown tips and sunburn on houseplants',
    plantGroups: ['houseplants', 'general'],
    symptoms: ['wilting', 'yellowing', 'necrosis', 'brown_dark_spots'],
    conditionKeywords: ['overwater', 'underwater', 'drought', 'sunburn', 'scorch', 'root rot', 'salt'],
    summary:
      'Wilting is usually from underwatering or excess light, but root decay from overwatering or poor drainage can also cause it — inspect the roots. Yellowing and leaf drop can come from low light, cold, overwatering or poor drainage; brown tips are often linked to fertilizer or salt build-up or soil that is too dry or too wet; sunburn can follow a recent move into stronger light.',
    reviewedAt: '2026-10-11',
    sourceUpdated: '2020-08',
    attribution: 'Linked resource © Regents of the University of California. Not redistributed.',
  },
  {
    id: 'ucipm-water-management',
    title: 'Water Management and Pest Problems',
    publisher: 'UC Statewide IPM Program, University of California',
    url: 'https://ipm.ucanr.edu/home-and-landscape/water-management-and-pest-problems/',
    topic: 'Over- and under-watering symptoms',
    plantGroups: ['general'],
    symptoms: ['wilting', 'yellowing', 'necrosis'],
    conditionKeywords: ['overwater', 'underwater', 'drought', 'water stress', 'root rot', 'phytophthora'],
    summary:
      'Underwatering causes drooping, yellowed or wilted leaves and leaf-edge browning; overwatering excludes oxygen from the soil, leading to root decay and crown problems from pathogens such as Phytophthora.',
    reviewedAt: '2026-10-11',
    sourceUpdated: null,
    attribution: 'Linked resource © Regents of the University of California. Not redistributed.',
  },
  {
    id: 'ucipm-arthropod-signs',
    title: 'Common Signs and Symptoms on Plants Damaged by Pest Insects, Mites, Slugs, and Snails',
    publisher: 'UC Statewide IPM Program, University of California',
    url: 'https://ipm.ucanr.edu/agriculture/floriculture-and-ornamental-nurseries/pest-insects-mites-slugs-and-snails-arthropods-and-the-probable-causes/',
    topic: 'Matching visible damage to pest groups',
    plantGroups: ['ornamentals', 'general'],
    symptoms: ['holes_chewing', 'curling_distortion', 'yellowing', 'visible_pests'],
    conditionKeywords: ['insect', 'pest', 'caterpillar', 'beetle', 'slug', 'snail', 'mite', 'thrips', 'leafhopper', 'whitefly', 'mealybug', 'scale'],
    summary:
      'Chewed or tattered leaves point to leaf-feeding beetles, caterpillars, grasshoppers or slugs and snails; webbing and rolled leaves to leafrollers and webworms; stippled, bleached or yellowed leaves to mites, thrips and other sap feeders; sticky honeydew with sooty mould to aphids, mealybugs, scales or whiteflies.',
    reviewedAt: '2026-10-11',
    sourceUpdated: '2021-03',
    attribution: 'Linked resource © Regents of the University of California. Not redistributed.',
  },
  {
    id: 'ucipm-cucurbit-viruses',
    title: 'Cucurbit Viruses',
    publisher: 'UC Statewide IPM Program, University of California',
    url: 'https://ipm.ucanr.edu/home-and-landscape/cucurbit-viruses/',
    topic: 'Virus symptoms (mottling, mosaic) and insect spread',
    plantGroups: ['cucurbits', 'vegetables'],
    symptoms: ['mosaic', 'yellowing', 'curling_distortion'],
    conditionKeywords: ['virus', 'viral', 'mosaic', 'mottle'],
    summary:
      'Virus infections cause mottled light-green, yellow or white areas, cleared veins, thickened leaves and reduced growth; they spread mainly through sap-feeding insects such as aphids, cucumber beetles and whiteflies.',
    reviewedAt: '2026-10-11',
    sourceUpdated: null,
    attribution: 'Linked resource © Regents of the University of California. Not redistributed.',
  },
  {
    id: 'rhs-powdery-mildews',
    title: 'Powdery mildews',
    publisher: 'Royal Horticultural Society (RHS)',
    url: 'https://www.rhs.org.uk/disease/powdery-mildews',
    topic: 'Powdery mildew symptoms and non-chemical control',
    plantGroups: ['general'],
    symptoms: ['powdery_fuzzy', 'curling_distortion'],
    conditionKeywords: ['powdery mildew', 'mildew', 'powdery'],
    summary:
      'White, dusty patches spread over leaves, flowers and fruit and may distort tissue. Non-chemical measures include removing infected fallen leaves, pruning out infected shoots, growing in airy sunny spots, keeping soil moisture steady, avoiding overhead watering in the evening and choosing resistant cultivars.',
    reviewedAt: '2026-10-11',
    sourceUpdated: null,
    attribution: 'Linked resource © Royal Horticultural Society. Not redistributed.',
  },
  {
    id: 'rhs-chlorosis',
    title: 'Chlorosis',
    publisher: 'Royal Horticultural Society (RHS)',
    url: 'https://www.rhs.org.uk/problems/chlorosis',
    topic: 'Causes of leaf yellowing and how the pattern helps',
    plantGroups: ['general'],
    symptoms: ['yellowing', 'mosaic'],
    conditionKeywords: ['chlorosis', 'deficiency', 'nutrient', 'iron', 'magnesium', 'manganese', 'nitrogen'],
    summary:
      'Yellowing can result from nutrient shortages, viruses, waterlogging, drought, cold, fungal diseases, sap- or root-feeding pests or weedkiller damage, and some yellowing is normal leaf shedding. Yellowing between the veins suggests iron, manganese or magnesium shortage (iron affects the youngest leaves first); mosaic or streaked patterns point towards viruses.',
    reviewedAt: '2026-10-11',
    sourceUpdated: null,
    attribution: 'Linked resource © Royal Horticultural Society. Not redistributed.',
  },
  {
    id: 'rhs-aphids',
    title: 'Aphids',
    publisher: 'Royal Horticultural Society (RHS)',
    url: 'https://www.rhs.org.uk/biodiversity/aphids',
    topic: 'Recognising aphids and their damage',
    plantGroups: ['general'],
    symptoms: ['visible_pests', 'curling_distortion'],
    conditionKeywords: ['aphid', 'greenfly', 'blackfly', 'honeydew', 'sooty mould', 'sooty mold'],
    summary:
      'Aphid colonies are usually visible on shoot tips, buds and the undersides of young leaves. Infested plants may show stunted growth, curled or distorted leaves, sticky honeydew with sooty mould, white shed skins and ants.',
    reviewedAt: '2026-10-11',
    sourceUpdated: null,
    attribution: 'Linked resource © Royal Horticultural Society. Not redistributed.',
  },
];

export function getReference(id: string): ReferenceEntry | undefined {
  return REFERENCE_LIBRARY.find((entry) => entry.id === id);
}

/**
 * Curated, general cause categories associated with each symptom tag, written
 * from the references above. These are shown as "general causes associated
 * with this symptom" — never as the model's conclusion.
 */
export interface CauseTemplate {
  key: string;
  name: string;
  category: CauseCategory;
  symptoms: SymptomCode[];
  distinguishingChecks: string[];
  referenceIds: string[];
}

export const CAUSE_TEMPLATES: CauseTemplate[] = [
  {
    key: 'infectious-leaf-spot',
    name: 'Fungal or bacterial leaf spot',
    category: 'disease',
    symptoms: ['brown_dark_spots', 'necrosis'],
    distinguishingChecks: [
      'Look for rings, yellow halos or tiny dark dots inside the spots.',
      'Check whether new spots appear on other leaves over the next days.',
      'Note whether spots started on lower, older leaves.',
    ],
    referenceIds: ['ucipm-leaf-spot-causes'],
  },
  {
    key: 'abiotic-scorch',
    name: 'Sunburn, drought or salt damage (non-infectious)',
    category: 'environmental',
    symptoms: ['necrosis', 'brown_dark_spots', 'wilting'],
    distinguishingChecks: [
      'Is the damage mainly on the sunniest side or on leaf tips and edges?',
      'Was the plant recently moved into stronger light?',
      'Check whether the soil dried out completely between waterings.',
    ],
    referenceIds: ['ucipm-houseplant-problems', 'ucipm-leaf-spot-causes'],
  },
  {
    key: 'water-or-root-problem',
    name: 'Watering or root problem',
    category: 'environmental',
    symptoms: ['wilting', 'yellowing'],
    distinguishingChecks: [
      'Feel the soil a few centimetres down: is it soggy or bone dry?',
      'Check the pot drains freely; if practical, look for dark, soft roots.',
      'Does the plant recover within a day after watering dry soil?',
    ],
    referenceIds: ['ucipm-water-management', 'ucipm-houseplant-problems'],
  },
  {
    key: 'nutrient-shortage',
    name: 'Nutrient shortage',
    category: 'nutrient',
    symptoms: ['yellowing'],
    distinguishingChecks: [
      'Is the yellowing between the veins while the veins stay green?',
      'Are the youngest or the oldest leaves affected first?',
    ],
    referenceIds: ['rhs-chlorosis'],
  },
  {
    key: 'powdery-mildew',
    name: 'Powdery mildew',
    category: 'disease',
    symptoms: ['powdery_fuzzy'],
    distinguishingChecks: [
      'Does the white coating wipe off with a finger (mildew often does)?',
      'Is it on the upper leaf surface, in patches that spread?',
    ],
    referenceIds: ['rhs-powdery-mildews'],
  },
  {
    key: 'chewing-pests',
    name: 'Chewing insects, slugs or snails',
    category: 'pest',
    symptoms: ['holes_chewing'],
    distinguishingChecks: [
      'Look for caterpillars, beetles, droppings or slime trails, including at night.',
      'Check for silk webbing or rolled leaves.',
    ],
    referenceIds: ['ucipm-arthropod-signs'],
  },
  {
    key: 'sap-feeding-pests',
    name: 'Aphids or other sap-feeding insects',
    category: 'pest',
    symptoms: ['curling_distortion', 'visible_pests', 'yellowing'],
    distinguishingChecks: [
      'Check shoot tips and leaf undersides for clusters of small insects.',
      'Look for sticky honeydew, black sooty mould or ants on the plant.',
    ],
    referenceIds: ['rhs-aphids', 'ucipm-arthropod-signs'],
  },
  {
    key: 'virus',
    name: 'Virus infection',
    category: 'disease',
    symptoms: ['mosaic', 'curling_distortion'],
    distinguishingChecks: [
      'Is there a mottled or mosaic pattern of light and dark green?',
      'Are new leaves small, thickened or distorted?',
    ],
    referenceIds: ['ucipm-cucurbit-viruses', 'rhs-chlorosis'],
  },
];
