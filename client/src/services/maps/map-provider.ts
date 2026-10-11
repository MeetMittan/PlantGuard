import { config, type AppConfig } from '@/app/config';

/**
 * Tile provider abstraction. The explorer only depends on this shape, so a
 * different raster tile provider can be configured via environment variables
 * without code changes.
 */
export interface TileProvider {
  url: string;
  attribution: string;
  maxZoom: number;
  /** Whether the provider is the shared OSM Foundation tile service (usage policy applies). */
  isOsmFoundationService: boolean;
}

export function getTileProvider(mapConfig: AppConfig['map'] = config.map): TileProvider {
  const isOsm = /(^|\.)tile\.openstreetmap\.org$/.test(safeHost(mapConfig.tileUrl));
  return {
    url: mapConfig.tileUrl,
    attribution: mapConfig.attribution,
    // The OSMF service serves up to zoom 19.
    maxZoom: isOsm ? Math.min(mapConfig.maxZoom, 19) : mapConfig.maxZoom,
    isOsmFoundationService: isOsm,
  };
}

function safeHost(url: string): string {
  try {
    return new URL(url.replace(/\{[a-z]\}/g, '0')).hostname;
  } catch {
    return '';
  }
}

/** Plain-text attribution for places where HTML must not be rendered. */
export function attributionText(attribution: string): string {
  const doc = new DOMParser().parseFromString(attribution, 'text/html');
  return doc.body.textContent?.trim() ?? '';
}
