import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeolocationError, geolocationErrorFromCode, getCurrentPosition } from './geolocation';

afterEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

function mockGeolocation(impl: (success: PositionCallback, failure: PositionErrorCallback) => void) {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: vi.fn(impl) } });
}

describe('geolocation', () => {
  it('maps browser error codes to typed, user-facing errors', () => {
    expect(geolocationErrorFromCode(1).code).toBe('permission-denied');
    expect(geolocationErrorFromCode(2).code).toBe('unavailable');
    expect(geolocationErrorFromCode(3).code).toBe('timeout');
  });

  it('does nothing when the feature is disabled', async () => {
    await expect(getCurrentPosition({ enabled: false })).rejects.toMatchObject({ code: 'disabled' });
  });

  it('reports unsupported browsers', async () => {
    await expect(getCurrentPosition({ enabled: true })).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('resolves coordinates on success', async () => {
    mockGeolocation((success) => success({ coords: { latitude: 12.97, longitude: 77.59, accuracy: 15 } } as GeolocationPosition));
    await expect(getCurrentPosition({ enabled: true })).resolves.toEqual({ lat: 12.97, lng: 77.59, accuracy: 15 });
  });

  it('reports permission denial', async () => {
    mockGeolocation((_success, failure) => failure({ code: 1, message: 'denied' } as GeolocationPositionError));
    const error = await getCurrentPosition({ enabled: true }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GeolocationError);
    expect((error as GeolocationError).message).toMatch(/site settings/);
  });
});
