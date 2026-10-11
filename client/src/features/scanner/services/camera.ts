export type CameraErrorCode = 'unsupported' | 'insecure-context' | 'permission-denied' | 'no-camera' | 'in-use' | 'unknown';

export class CameraError extends Error {
  constructor(
    public readonly code: CameraErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CameraError';
  }
}

export const CAMERA_MESSAGES: Record<CameraErrorCode, string> = {
  unsupported: 'Live camera preview is not supported in this browser. Use “Choose photo” instead — on phones it can open the camera.',
  'insecure-context': 'The camera only works over HTTPS (or localhost). Use “Choose photo” instead.',
  'permission-denied':
    'Camera permission was denied. Allow camera access in your browser’s site settings, or use “Choose photo”.',
  'no-camera': 'No camera was found on this device. Use “Choose photo” to pick an existing image.',
  'in-use': 'The camera is being used by another app. Close it and try again.',
  unknown: 'The camera could not be started. Use “Choose photo” instead.',
};

export function cameraErrorFrom(error: unknown): CameraError {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  const code: CameraErrorCode =
    name === 'NotAllowedError' || name === 'SecurityError'
      ? 'permission-denied'
      : name === 'NotFoundError' || name === 'OverconstrainedError'
        ? 'no-camera'
        : name === 'NotReadableError' || name === 'AbortError'
          ? 'in-use'
          : 'unknown';
  return new CameraError(code, CAMERA_MESSAGES[code]);
}

/** Opens the rear camera when available. Callers must stop the returned stream's tracks. */
export async function openCamera(): Promise<MediaStream> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    throw new CameraError('insecure-context', CAMERA_MESSAGES['insecure-context']);
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported', CAMERA_MESSAGES.unsupported);
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
  } catch (error) {
    throw cameraErrorFrom(error);
  }
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context || !canvas.width) throw new CameraError('unknown', 'The camera has not produced an image yet. Try again.');
  context.drawImage(video, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new CameraError('unknown', 'Capturing the photo failed.'))), 'image/jpeg', 0.92),
  );
}
