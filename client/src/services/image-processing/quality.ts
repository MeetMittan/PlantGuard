/**
 * Heuristic photo-quality check (pure functions, unit-tested).
 *
 * This is NOT a learned quality model. It flags photos that are very dark,
 * washed out, small, or lack fine detail (likely blurred), using:
 * - mean luminance of a downscaled grayscale copy, and
 * - variance of a 3×3 Laplacian (a standard focus measure).
 * Thresholds were calibrated on the repository fixtures (sharp, blurred and
 * darkened versions of the same leaf) and are deliberately lenient: they warn,
 * they never block analysis. See docs/ASSESSMENT_SCHEMA.md#photo-quality.
 */

export const QUALITY_SAMPLE_SIZE = 256;

export const QUALITY_THRESHOLDS = {
  tooDarkBelow: 45,
  tooBrightAbove: 225,
  blurryBelow: 60,
  tooSmallBelow: 320,
} as const;

export interface QualityMetrics {
  meanBrightness: number;
  sharpness: number;
  minDimension: number;
}

/** Converts RGBA pixels to luminance (Rec. 601 weights). */
export function toGrayscale(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    gray[i] = 0.299 * rgba[o]! + 0.587 * rgba[o + 1]! + 0.114 * rgba[o + 2]!;
  }
  return gray;
}

export function computeQualityMetrics(gray: Float32Array, width: number, height: number, minDimension: number): QualityMetrics {
  let sum = 0;
  for (let i = 0; i < gray.length; i += 1) sum += gray[i]!;
  const meanBrightness = gray.length ? sum / gray.length : 0;

  // Variance of the Laplacian over interior pixels.
  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const lap = gray[i - width]! + gray[i + width]! + gray[i - 1]! + gray[i + 1]! - 4 * gray[i]!;
      lapSum += lap;
      lapSqSum += lap * lap;
      count += 1;
    }
  }
  const lapMean = count ? lapSum / count : 0;
  const sharpness = count ? lapSqSum / count - lapMean * lapMean : 0;
  return {
    meanBrightness: Math.round(meanBrightness * 10) / 10,
    sharpness: Math.round(sharpness * 10) / 10,
    minDimension,
  };
}

export type QualityVerdict = 'suitable' | 'too_dark' | 'too_bright' | 'blurry' | 'too_small' | 'unknown';

export interface QualityEvaluation {
  verdict: QualityVerdict;
  issues: string[];
}

export function evaluateQuality(metrics: QualityMetrics | null): QualityEvaluation {
  if (!metrics) return { verdict: 'unknown', issues: [] };
  const issues: Array<[QualityVerdict, string]> = [];
  if (metrics.minDimension < QUALITY_THRESHOLDS.tooSmallBelow) {
    issues.push(['too_small', 'The photo is small, so fine details such as tiny spots may be lost.']);
  }
  if (metrics.meanBrightness < QUALITY_THRESHOLDS.tooDarkBelow) {
    issues.push(['too_dark', 'The photo looks very dark. Try again in daylight or brighter light.']);
  } else if (metrics.meanBrightness > QUALITY_THRESHOLDS.tooBrightAbove) {
    issues.push(['too_bright', 'The photo looks washed out. Avoid direct glare or flash.']);
  }
  if (metrics.sharpness < QUALITY_THRESHOLDS.blurryBelow) {
    issues.push(['blurry', 'The photo looks blurry or lacks detail. Hold steady and tap to focus on the leaf.']);
  }
  return { verdict: issues[0]?.[0] ?? 'suitable', issues: issues.map(([, message]) => message) };
}
