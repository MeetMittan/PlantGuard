/// <reference lib="webworker" />
import { ImageValidationError, prepareImage } from './image-core';

declare const self: DedicatedWorkerGlobalScope;
self.onmessage = async (event: MessageEvent<{ file: File | Blob; maxDimension: number }>) => {
  try {
    self.postMessage({ image: await prepareImage(event.data.file, event.data.maxDimension) });
  } catch (error) {
    self.postMessage({ error: { code: error instanceof ImageValidationError ? error.code : 'decode-failed', message: error instanceof Error ? error.message : 'Image processing failed.' } });
  }
};
