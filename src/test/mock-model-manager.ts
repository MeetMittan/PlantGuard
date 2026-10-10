import type { VisionModelProvider } from '@/ai/contracts/types';
import { DemoVisionProvider } from '@/ai/providers/demo-provider';
import type * as ModelManagerModule from '@/ai/model-manager/model-manager';
import type * as ImageProcessingModule from '@/services/image-processing/image-processing';

/**
 * TEST ONLY. Component tests swap the production model manager's provider for
 * this explicitly simulated one (the production build always uses the real
 * Transformers.js provider unless demo mode is explicitly configured).
 *
 * Usage (must be top-level in the test file so Vitest hoists it):
 *   vi.mock('@/ai/model-manager/model-manager', (orig) => modelManagerMockFactory(orig));
 */
export const testProvider: { current: VisionModelProvider } = { current: new DemoVisionProvider() };

export async function modelManagerMockFactory(importOriginal: () => Promise<unknown>) {
  const actual = (await importOriginal()) as typeof ModelManagerModule;
  const proxy: VisionModelProvider = {
    get kind() {
      return testProvider.current.kind;
    },
    checkCapabilities: () => testProvider.current.checkCapabilities(),
    getStatus: (manifest) => testProvider.current.getStatus(manifest),
    load: (onProgress) => testProvider.current.load(onProgress),
    cancelLoad: () => testProvider.current.cancelLoad(),
    analyze: (input, options) => testProvider.current.analyze(input, options),
    deleteCache: () => testProvider.current.deleteCache(),
    dispose: () => testProvider.current.dispose(),
  };
  return { ...actual, modelManager: new actual.VisionModelManager({ presetId: null, devicePreference: 'auto' }, () => proxy) };
}

/** Image preparation needs createImageBitmap/canvas, which jsdom lacks. */
export async function imageProcessingMockFactory(importOriginal: () => Promise<unknown>) {
  const actual = (await importOriginal()) as typeof ImageProcessingModule;
  return {
    ...actual,
    prepareImage: async (file: Blob) => {
      if (file instanceof File) actual.validateImageFile(file);
      if (!(await actual.sniffImageSignature(file))) {
        throw new actual.ImageValidationError('unsupported-type', 'This file does not look like a photo.');
      }
      const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' });
      return {
        image: jpeg,
        thumbnail: jpeg,
        width: 768,
        height: 576,
        mimeType: 'image/jpeg' as const,
        byteSize: jpeg.size,
        quality: { meanBrightness: 130, sharpness: 600, minDimension: 768 },
      };
    },
  };
}
