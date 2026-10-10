import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { DemoVisionProvider } from '@/ai/providers/demo-provider';
import { db } from '@/db/database';
import { assessmentsForObservation, getObservation, observationsForPlant, saveScan } from '@/db/repositories/observations';
import { createPlant } from '@/db/repositories/plants';
import { buildAssessment } from '@/features/diagnosis/services/assessment-service';
import { plantAssessmentSchema } from '@/features/diagnosis/schemas/assessment';
import { compareObservations } from '@/features/timeline/services/timeline';
import { sniffImageSignature, validateImageFile } from '@/services/image-processing/image-processing';
import { computeQualityMetrics, toGrayscale } from '@/services/image-processing/quality';
import { resetDatabase } from '@/test/db-helpers';

/**
 * Integration test of the shared domain pipeline (spec §12.4), using the
 * deterministic test provider (never shipped as real AI). Decoding pixels needs
 * a browser canvas, so the quality metrics are computed from a synthetic pixel
 * buffer through the same pure functions the browser uses.
 */
describe('capture → analyse → save → rescan → compare', () => {
  beforeEach(resetDatabase);

  it('runs the full local-first sequence', async () => {
    // 1–2. Database + a saved plant
    const plant = await createPlant({ name: 'Balcony tomato', identificationStatus: 'user-entered' });

    // 3–4. Select and validate/prepare a test image
    const bytes = readFileSync('tests/fixtures/tomato-early-blight.jpg');
    const file = new File([bytes], 'leaf.jpg', { type: 'image/jpeg' });
    validateImageFile(file);
    expect(await sniffImageSignature(file)).toBe(true);
    const pixels = new Uint8ClampedArray(64 * 64 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 37) % 255));
    const quality = computeQualityMetrics(toGrayscale(pixels, 64, 64), 64, 64, 640);

    // 5–6. Run the test provider and validate the assessment
    const provider = new DemoVisionProvider();
    await provider.load(() => undefined);
    const first = buildAssessment({ inference: await provider.analyze({ image: file, context: '' }), quality, now: new Date('2026-03-01T10:00:00Z') });
    expect(plantAssessmentSchema.safeParse(first).success).toBe(true);

    // 7–8. Save and retrieve
    await saveScan({
      observation: { id: 'obs-1', label: 'Week 1', context: '', plantId: plant.id, image: file, thumbnail: file, imageWidth: 640, imageHeight: 640, observedAt: new Date('2026-03-01T10:00:00Z') },
      assessment: first,
    });
    const saved = await getObservation('obs-1');
    expect(saved).toMatchObject({ plantId: plant.id, latestAssessmentId: first.id, healthStatus: 'concern' });

    // 10. A second observation of the same plant a week later
    const second = buildAssessment({ inference: await provider.analyze({ image: file, context: 'powdery' }), quality, now: new Date('2026-03-08T10:00:00Z') });
    await saveScan({
      observation: { id: 'obs-2', label: 'Week 2', context: 'powdery', plantId: plant.id, image: file, thumbnail: file, imageWidth: 640, imageHeight: 640, observedAt: new Date('2026-03-08T10:00:00Z') },
      assessment: second,
    });

    // 11–12. Compare and verify historical records + symptom differences
    const [newer, older] = await observationsForPlant(plant.id);
    expect([older!.id, newer!.id]).toEqual(['obs-1', 'obs-2']);
    const [olderAssessment] = await assessmentsForObservation('obs-1');
    const [newerAssessment] = await assessmentsForObservation('obs-2');
    const comparison = compareObservations({ observation: older!, assessment: olderAssessment! }, { observation: newer!, assessment: newerAssessment! });
    expect(comparison.sharedTags).toEqual(['brown_dark_spots']);
    expect(comparison.newlyRecordedTags).toEqual(['powdery_fuzzy']);
    expect(comparison.notMentionedInNewerTags).toEqual(['yellowing']);
    expect(await db.assessments.count()).toBe(2);
    expect(olderAssessment!.id).toBe(first.id); // historical assessment intact
  });
});
