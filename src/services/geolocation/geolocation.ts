import type { GeoPoint } from '@/db/schema';

export type GeolocationErrorCode = 'unsupported' | 'insecure-context' | 'permission-denied' | 'unavailable' | 'timeout' | 'disabled';

export class GeolocationError extends Error {
  constructor(
    public readonly code: GeolocationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GeolocationError';
  }
}

const MESSAGES: Record<GeolocationErrorCode, string> = {
  unsupported: 'This browser does not support location access.',
  'insecure-context': 'Location is only available over HTTPS (or on localhost).',
  'permission-denied':
    'Location permission was denied. You can allow it in your browser’s site settings, or add places manually.',
  unavailable: 'Your position could not be determined. Check that location services are on and try again.',
  timeout: 'Getting your location took too long. Try again outdoors or with a better signal.',
  disabled: 'Location features are disabled in this deployment.',
};

export function geolocationErrorFromCode(code: number): GeolocationError {
  // GeolocationPositionError codes: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
  if (code === 1) return new GeolocationError('permission-denied', MESSAGES['permission-denied']);
  if (code === 3) return new GeolocationError('timeout', MESSAGES.timeout);
  return new GeolocationError('unavailable', MESSAGES.unavailable);
}

/**
 * Requests the current position. Must only be called from an explicit user
 * action (button press) — the app never requests location on page load.
 */
export function getCurrentPosition(options: { enabled: boolean; timeoutMs?: number }): Promise<GeoPoint> {
  if (!options.enabled) return Promise.reject(new GeolocationError('disabled', MESSAGES.disabled));
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return Promise.reject(new GeolocationError('insecure-context', MESSAGES['insecure-context']));
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new GeolocationError('unsupported', MESSAGES.unsupported));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        }),
      (error) => reject(geolocationErrorFromCode(error.code)),
      { enableHighAccuracy: true, timeout: options.timeoutMs ?? 15000, maximumAge: 60_000 },
    );
  });
}
