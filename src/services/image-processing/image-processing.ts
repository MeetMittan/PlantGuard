import { ImageValidationError, prepareImage as prepareLocally, type PreparedImage } from './image-core';

export * from './image-core';

/** Decode, resize, encode and sample pixels away from the UI thread where supported. */
export async function prepareImage(file: File | Blob, maxDimension: number): Promise<PreparedImage> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return prepareLocally(file, maxDimension);
  const worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module', name: 'plantguard-image' });
  try {
    return await new Promise<PreparedImage>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<{ image?: PreparedImage; error?: { code: ImageValidationError['code']; message: string } }>) => {
        if (event.data.image) resolve(event.data.image);
        else if (event.data.error) reject(new ImageValidationError(event.data.error.code, event.data.error.message));
        else reject(new Error('The photo could not be prepared.'));
      };
      worker.onerror = () => reject(new ImageValidationError('decode-failed', 'Photo processing stopped. Try a smaller photo or another browser.'));
      worker.postMessage({ file, maxDimension });
    });
  } finally {
    worker.terminate();
  }
}
