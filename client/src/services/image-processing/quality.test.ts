import { describe, expect, it } from 'vitest';
import { computeQualityMetrics, evaluateQuality, toGrayscale } from './quality';

function image(width: number, height: number, pixel: (x: number, y: number) => number) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = pixel(x, y);
      const o = (y * width + x) * 4;
      rgba[o] = v;
      rgba[o + 1] = v;
      rgba[o + 2] = v;
      rgba[o + 3] = 255;
    }
  }
  return toGrayscale(rgba, width, height);
}

describe('photo quality heuristic', () => {
  it('measures brightness and detail', () => {
    const flat = computeQualityMetrics(image(64, 64, () => 128), 64, 64, 640);
    expect(flat.meanBrightness).toBe(128);
    expect(flat.sharpness).toBe(0);
    const checker = computeQualityMetrics(image(64, 64, (x, y) => ((x + y) % 2 ? 230 : 30)), 64, 64, 640);
    expect(checker.sharpness).toBeGreaterThan(1000);
  });

  it('classifies photos (thresholds calibrated on fixture variants, see docs)', () => {
    expect(evaluateQuality({ meanBrightness: 133, sharpness: 666, minDimension: 640 }).verdict).toBe('suitable');
    expect(evaluateQuality({ meanBrightness: 133, sharpness: 16.7, minDimension: 640 }).verdict).toBe('blurry');
    expect(evaluateQuality({ meanBrightness: 26, sharpness: 18, minDimension: 640 }).verdict).toBe('too_dark');
    expect(evaluateQuality({ meanBrightness: 241, sharpness: 1500, minDimension: 640 }).verdict).toBe('too_bright');
    expect(evaluateQuality({ meanBrightness: 133, sharpness: 666, minDimension: 200 }).verdict).toBe('too_small');
    expect(evaluateQuality(null)).toEqual({ verdict: 'unknown', issues: [] });
  });

  it('reports every issue found', () => {
    expect(evaluateQuality({ meanBrightness: 20, sharpness: 5, minDimension: 100 }).issues).toHaveLength(3);
  });
});
