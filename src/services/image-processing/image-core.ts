/**
 * Local image preparation. Nothing here uploads data anywhere.
 *
 * Privacy: images are decoded and re-encoded through a canvas. Re-encoding
 * produces a fresh JPEG without the original EXIF block (camera model, GPS
 * coordinates, timestamps), so stored photos never retain that metadata.
 * Orientation is applied during decode (`imageOrientation: 'from-image'`) so
 * the pixels are upright before the metadata is discarded.
 */

import { computeQualityMetrics, QUALITY_SAMPLE_SIZE, toGrayscale, type QualityMetrics } from './quality';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
export const MAX_INPUT_FILE_BYTES = 25 * 1024 * 1024;
export const THUMBNAIL_DIMENSION = 320;
/** Below this, leaf details are unusable for the model (it encodes images at 512 px). */
export const MIN_IMAGE_DIMENSION = 128;
const JPEG_QUALITY = 0.86;
const THUMBNAIL_QUALITY = 0.72;

export type ImageValidationErrorCode = 'unsupported-type' | 'too-large' | 'too-small' | 'empty' | 'decode-failed';

export class ImageValidationError extends Error {
  constructor(
    public readonly code: ImageValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

export function validateImageFile(file: Pick<File, 'type' | 'size' | 'name'>): void {
  if (file.size === 0) throw new ImageValidationError('empty', 'This file is empty.');
  if (file.size > MAX_INPUT_FILE_BYTES) {
    throw new ImageValidationError('too-large', 'This photo is larger than 25 MB. Please choose a smaller image.');
  }
  const type = file.type.toLowerCase();
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type)) {
    throw new ImageValidationError(
      'unsupported-type',
      `Unsupported file type${type ? ` (${type})` : ''}. Please use a JPEG, PNG or WebP photo.`,
    );
  }
}

/** Checks the first bytes so a renamed non-image file is rejected before decoding. */
export async function sniffImageSignature(blob: Blob): Promise<boolean> {
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const startsWith = (...bytes: number[]) => bytes.every((byte, index) => header[index] === byte);
  const ascii = (start: number, text: string) =>
    [...text].every((char, index) => header[start + index] === char.charCodeAt(0));
  return (
    startsWith(0xff, 0xd8, 0xff) || // JPEG
    startsWith(0x89, 0x50, 0x4e, 0x47) || // PNG
    (ascii(0, 'RIFF') && ascii(8, 'WEBP')) || // WebP
    ascii(4, 'ftyp') // HEIC/HEIF/AVIF container
  );
}

export function fitWithin(width: number, height: number, maxDimension: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) throw new ImageValidationError('decode-failed', 'The image has invalid dimensions.');
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface PreparedImage {
  /** Resized, EXIF-free JPEG used for analysis and (optionally) storage. */
  image: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
  byteSize: number;
  /** Pixel statistics for the photo-quality heuristic (null if pixels could not be read). */
  quality: QualityMetrics | null;
}

/** Reads a small grayscale sample for quality metrics. Returns null when canvas pixel access fails. */
function sampleQuality(bitmap: ImageBitmap, minDimension: number): QualityMetrics | null {
  try {
    const size = fitWithin(bitmap.width, bitmap.height, QUALITY_SAMPLE_SIZE);
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(size.width, size.height)
        : Object.assign(document.createElement('canvas'), { width: size.width, height: size.height });
    const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const { data } = context.getImageData(0, 0, size.width, size.height);
    return computeQualityMetrics(toGrayscale(data, size.width, size.height), size.width, size.height, minDimension);
  } catch {
    return null;
  }
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageValidationError(
      'decode-failed',
      'This image could not be read. It may be corrupted or in a format this browser cannot open (for example HEIC outside Safari).',
    );
  }
}

async function renderToJpeg(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available.');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed.'))), 'image/jpeg', quality),
  );
}

export async function prepareImage(file: File | Blob, maxDimension: number): Promise<PreparedImage> {
  validateImageFile({ type: file.type, size: file.size, name: file instanceof File ? file.name : 'camera photo' });
  if (!(await sniffImageSignature(file))) {
    throw new ImageValidationError('unsupported-type', 'This file does not look like a photo.');
  }
  const bitmap = await decode(file);
  try {
    if (Math.min(bitmap.width, bitmap.height) < MIN_IMAGE_DIMENSION) {
      throw new ImageValidationError(
        'too-small',
        `This image is only ${bitmap.width} × ${bitmap.height} px. Use a photo at least ${MIN_IMAGE_DIMENSION} px on its shortest side.`,
      );
    }
    const size = fitWithin(bitmap.width, bitmap.height, maxDimension);
    const thumbSize = fitWithin(bitmap.width, bitmap.height, THUMBNAIL_DIMENSION);
    const [image, thumbnail] = await Promise.all([
      renderToJpeg(bitmap, size.width, size.height, JPEG_QUALITY),
      renderToJpeg(bitmap, thumbSize.width, thumbSize.height, THUMBNAIL_QUALITY),
    ]);
    const quality = sampleQuality(bitmap, Math.min(bitmap.width, bitmap.height));
    return { image, thumbnail, width: size.width, height: size.height, mimeType: 'image/jpeg', byteSize: image.size, quality };
  } finally {
    bitmap.close();
  }
}

