import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fitWithin, ImageValidationError, sniffImageSignature, validateImageFile } from './image-processing';

const file = (type: string, size: number) => ({ type, size, name: 'x' });

describe('validateImageFile', () => {
  it('accepts common photo formats', () => {
    expect(() => validateImageFile(file('image/jpeg', 1000))).not.toThrow();
    expect(() => validateImageFile(file('image/webp', 1000))).not.toThrow();
  });

  it('rejects unsupported types, empty files and oversize files', () => {
    expect(() => validateImageFile(file('application/pdf', 1000))).toThrow(ImageValidationError);
    expect(() => validateImageFile(file('image/svg+xml', 1000))).toThrow(/Unsupported/);
    expect(() => validateImageFile(file('image/jpeg', 0))).toThrow(/empty/);
    expect(() => validateImageFile(file('image/jpeg', 26 * 1024 * 1024))).toThrow(/25 MB/);
  });
});

describe('sniffImageSignature', () => {
  it('accepts a real JPEG fixture', async () => {
    const bytes = readFileSync('tests/fixtures/tomato-early-blight.jpg');
    expect(await sniffImageSignature(new Blob([bytes]))).toBe(true);
  });

  it('rejects a text file renamed to .jpg', async () => {
    const bytes = readFileSync('tests/fixtures/not-an-image.jpg');
    expect(await sniffImageSignature(new Blob([bytes], { type: 'image/jpeg' }))).toBe(false);
  });

  it('recognises PNG and WebP headers', async () => {
    expect(await sniffImageSignature(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])]))).toBe(true);
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
    expect(await sniffImageSignature(new Blob([webp]))).toBe(true);
  });
});

describe('fitWithin', () => {
  it('scales down preserving aspect ratio and never upscales', () => {
    expect(fitWithin(4000, 3000, 768)).toEqual({ width: 768, height: 576 });
    expect(fitWithin(3000, 4000, 768)).toEqual({ width: 576, height: 768 });
    expect(fitWithin(400, 300, 768)).toEqual({ width: 400, height: 300 });
  });

  it('rejects invalid dimensions', () => {
    expect(() => fitWithin(0, 100, 768)).toThrow(ImageValidationError);
  });
});

