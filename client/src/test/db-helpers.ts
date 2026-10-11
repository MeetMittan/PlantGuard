import { db } from '@/db/database';
import type { AnswerSet } from '@/ai/utils/parse-answers';
import type { PlantAssessment } from '@/features/diagnosis/schemas/assessment';
import { buildAssessment } from '@/features/diagnosis/services/assessment-service';

export async function resetDatabase() {
  await Promise.all(db.tables.map((table) => table.clear()));
}

const a = (text: string) => ({ text, truncated: false });

const SCRIPTS: Record<'problem' | 'healthy' | 'powdery', AnswerSet> = {
  problem: { isPlant: a('Yes'), plant: a('Tomato'), health: a('Diseased'), signs: a('Brown spots and yellowing'), condition: a('Early blight') },
  healthy: { isPlant: a('Yes'), plant: a('Basil'), health: a('Healthy'), signs: a('None') },
  powdery: { isPlant: a('Yes'), plant: a('Tomato'), health: a('Diseased'), signs: a('White powdery patches and brown spots'), condition: a('Powdery mildew') },
};

export function sampleAssessment(kind: keyof typeof SCRIPTS = 'problem', at = new Date('2026-03-12T10:00:00Z')): PlantAssessment {
  return buildAssessment({
    inference: {
      answers: SCRIPTS[kind],
      modelId: 'test/model',
      modelRevision: 'r1',
      promptVersion: 'plant-qa-v1',
      provider: 'transformersjs',
      device: 'wasm',
      inferenceMs: 100,
    },
    quality: { meanBrightness: 130, sharpness: 600, minDimension: 640 },
    now: at,
  });
}

/** A minimal valid JPEG header + payload (enough for signature checks). */
export function jpegBlob(): Blob {
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1])], { type: 'image/jpeg' });
}
