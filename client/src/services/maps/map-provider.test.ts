import { describe, expect, it } from 'vitest';
import { DEFAULT_TILE_ATTRIBUTION, DEFAULT_TILE_URL } from '@/app/config';
import { attributionText, getTileProvider } from './map-provider';

describe('map provider configuration', () => {
  it('uses OpenStreetMap with visible attribution by default', () => {
    const provider = getTileProvider({ tileUrl: DEFAULT_TILE_URL, attribution: DEFAULT_TILE_ATTRIBUTION, maxZoom: 19 });
    expect(provider.isOsmFoundationService).toBe(true);
    expect(attributionText(provider.attribution)).toMatch(/OpenStreetMap contributors/);
    expect(provider.attribution).toContain('openstreetmap.org/copyright');
  });

  it('caps zoom at the OSM tile service maximum', () => {
    expect(getTileProvider({ tileUrl: DEFAULT_TILE_URL, attribution: 'x', maxZoom: 22 }).maxZoom).toBe(19);
  });

  it('supports custom providers', () => {
    const provider = getTileProvider({ tileUrl: 'https://tiles.example.com/{z}/{x}/{y}.png', attribution: '© Example', maxZoom: 20 });
    expect(provider.isOsmFoundationService).toBe(false);
    expect(provider.maxZoom).toBe(20);
  });
});
