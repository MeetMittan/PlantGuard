import { describe, expect, it } from 'vitest';
import { ConfigError, DEFAULT_TILE_ATTRIBUTION, DEFAULT_TILE_URL, parseConfig } from './config';

const meta = { appVersion: '1.2.3', basePath: '/' };

describe('parseConfig', () => {
  it('applies validated defaults for an empty environment', () => {
    const config = parseConfig({}, meta);
    expect(config.appName).toBe('PlantGuard AI');
    expect(config.locale).toBe('en-IN');
    expect(config.ai.provider).toBe('gemini');
    expect(config.ai.maxImageDimension).toBe(768);
    expect(config.ai.maxNewTokens).toBe(160);
    expect(config.ai.remoteHost).toBe('https://huggingface.co/');
    expect(config.map.tileUrl).toBe(DEFAULT_TILE_URL);
    expect(config.map.attribution).toBe(DEFAULT_TILE_ATTRIBUTION);
    expect(config.features.geolocation).toBe(true);
    expect(config.appVersion).toBe('1.2.3');
  });

  it('allows selecting transformersjs provider explicitly', () => {
    const config = parseConfig({ VITE_AI_PROVIDER: 'transformersjs' }, meta);
    expect(config.ai.provider).toBe('transformersjs');
  });

  it('parses numbers and booleans', () => {
    const config = parseConfig({ VITE_AI_MAX_IMAGE_DIMENSION: '1024', VITE_ENABLE_GEOLOCATION: 'false', VITE_MAP_MAX_ZOOM: '17' }, meta);
    expect(config.ai.maxImageDimension).toBe(1024);
    expect(config.features.geolocation).toBe(false);
    expect(config.map.maxZoom).toBe(17);
  });

  it('rejects out-of-range numbers', () => {
    expect(() => parseConfig({ VITE_AI_MAX_IMAGE_DIMENSION: '99999' }, meta)).toThrow(ConfigError);
    expect(() => parseConfig({ VITE_AI_MAX_NEW_TOKENS: 'abc' }, meta)).toThrow(/VITE_AI_MAX_NEW_TOKENS/);
  });

  it('rejects invalid URLs and locales', () => {
    expect(() => parseConfig({ VITE_AI_REMOTE_HOST: 'not a url' }, meta)).toThrow(ConfigError);
    expect(() => parseConfig({ VITE_DEFAULT_LOCALE: 'not_a_locale!!' }, meta)).toThrow(ConfigError);
  });

  it('requires both flags before allowing the simulated demo provider', () => {
    expect(() => parseConfig({ VITE_AI_PROVIDER: 'demo' }, meta)).toThrow(/VITE_ENABLE_DEMO_MODE/);
    expect(parseConfig({ VITE_AI_PROVIDER: 'demo', VITE_ENABLE_DEMO_MODE: 'true' }, meta).ai.provider).toBe('demo');
  });

  it('rejects unknown providers', () => {
    expect(() => parseConfig({ VITE_AI_PROVIDER: 'openai' }, meta)).toThrow(ConfigError);
  });

  it('requires attribution for custom tile providers', () => {
    expect(() => parseConfig({ VITE_MAP_TILE_URL: 'https://tiles.example.com/{z}/{x}/{y}.png' }, meta)).toThrow(/ATTRIBUTION/);
    const config = parseConfig(
      { VITE_MAP_TILE_URL: 'https://tiles.example.com/{z}/{x}/{y}.png', VITE_MAP_ATTRIBUTION: '© Example' },
      meta,
    );
    expect(config.map.attribution).toBe('© Example');
  });

  it('normalises the model host with a trailing slash', () => {
    expect(parseConfig({ VITE_AI_REMOTE_HOST: 'https://models.example.com' }, meta).ai.remoteHost).toBe('https://models.example.com/');
  });
});
