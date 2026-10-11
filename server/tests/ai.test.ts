import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { GeminiService } from '../src/services/gemini.js';
import type { GoogleGenAI } from '@google/genai';

// Valid 1x1 JPEG bytes: FF D8 FF E0 ...
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

describe('AI Routes', () => {
  describe('GET /api/ai/status', () => {
    it('reports not configured when API key is missing', async () => {
      const unconfiguredService = new GeminiService('');
      const app = createApp(unconfiguredService);

      const res = await request(app).get('/api/ai/status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        available: false,
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        configured: false,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/key/i);
    });

    it('reports available and configured when service is initialized', async () => {
      const mockClient = {
        models: {
          generateContent: vi.fn(),
        },
      } as unknown as GoogleGenAI;

      const configuredService = new GeminiService('test-key', 'gemini-3.8-flash', mockClient);
      const app = createApp(configuredService);

      const res = await request(app).get('/api/ai/status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        available: true,
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        configured: true,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/test-key/);
    });
  });

  describe('POST /api/ai/analyze', () => {
    it('returns 503 when AI service is not configured', async () => {
      const unconfiguredService = new GeminiService('');
      const app = createApp(unconfiguredService);

      const res = await request(app)
        .post('/api/ai/analyze')
        .attach('image', VALID_JPEG_BUFFER, { filename: 'leaf.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');
    });

    it('returns 400 when no image is uploaded', async () => {
      const mockClient = { models: { generateContent: vi.fn() } } as unknown as GoogleGenAI;
      const service = new GeminiService('test-key', 'gemini-3.8-flash', mockClient);
      const app = createApp(service);

      const res = await request(app).post('/api/ai/analyze').send({ context: 'some note' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_IMAGE');
    });

    it('returns 400 when uploaded file has invalid signature', async () => {
      const mockClient = { models: { generateContent: vi.fn() } } as unknown as GoogleGenAI;
      const service = new GeminiService('test-key', 'gemini-3.8-flash', mockClient);
      const app = createApp(service);

      const badBytes = Buffer.from('not an image file at all');
      const res = await request(app)
        .post('/api/ai/analyze')
        .attach('image', badBytes, { filename: 'fake.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_IMAGE');
    });

    it('returns 200 with structured inference on successful Gemini response', async () => {
      const mockClient = {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: JSON.stringify({
              isPlant: 'yes',
              plant: 'Tomato',
              health: 'diseased',
              signs: 'Brown spots with yellow halos',
              condition: 'Early blight',
              limitations: ['Single leaf viewed, underside not visible'],
              qualityIssue: 'none',
            }),
          }),
        },
      } as unknown as GoogleGenAI;

      const service = new GeminiService('test-key', 'gemini-3.8-flash', mockClient);
      const app = createApp(service);

      const res = await request(app)
        .post('/api/ai/analyze')
        .field('context', 'spots noticed yesterday')
        .attach('image', VALID_JPEG_BUFFER, { filename: 'tomato.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.inference).toBeDefined();
      expect(res.body.inference.provider).toBe('gemini');
      expect(res.body.inference.modelId).toBe('gemini-3.8-flash');
      expect(res.body.inference.answers).toEqual({
        isPlant: { text: 'Yes.', truncated: false },
        plant: { text: 'Tomato', truncated: false },
        health: { text: 'Diseased.', truncated: false },
        signs: { text: 'Brown spots with yellow halos', truncated: false },
        condition: { text: 'Early blight', truncated: false },
      });
      expect(res.body.limitations).toContain('Single leaf viewed, underside not visible');
      expect(res.body.qualityVerdict).toBe('suitable');
    });

    it('returns 502 when Gemini returns malformed non-JSON', async () => {
      const mockClient = {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: 'I cannot answer in JSON right now.',
          }),
        },
      } as unknown as GoogleGenAI;

      const service = new GeminiService('test-key', 'gemini-3.8-flash', mockClient);
      const app = createApp(service);

      const res = await request(app)
        .post('/api/ai/analyze')
        .attach('image', VALID_JPEG_BUFFER, { filename: 'leaf.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AI_MALFORMED_RESPONSE');
    });

    it('returns 429 when Gemini quota is exhausted', async () => {
      const mockClient = {
        models: {
          generateContent: vi.fn().mockRejectedValue(new Error('Resource has been exhausted (e.g. check quota) 429')),
        },
      } as unknown as GoogleGenAI;

      const service = new GeminiService('test-key', 'gemini-3.8-flash', mockClient);
      const app = createApp(service);

      const res = await request(app)
        .post('/api/ai/analyze')
        .attach('image', VALID_JPEG_BUFFER, { filename: 'leaf.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AI_QUOTA_EXCEEDED');
    });

    it('returns 504 on request timeout', async () => {
      const mockClient = {
        models: {
          generateContent: vi.fn().mockRejectedValue(new Error('The operation was aborted due to timeout')),
        },
      } as unknown as GoogleGenAI;

      const service = new GeminiService('test-key', 'gemini-3.8-flash', mockClient);
      const app = createApp(service);

      const res = await request(app)
        .post('/api/ai/analyze')
        .attach('image', VALID_JPEG_BUFFER, { filename: 'leaf.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(504);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AI_TIMEOUT');
    });

    it('returns 503 when Gemini experiences high demand or temporary outage', async () => {
      const mockClient = {
        models: {
          generateContent: vi.fn().mockRejectedValue(new Error('This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.')),
        },
      } as unknown as GoogleGenAI;

      const service = new GeminiService('test-key', 'gemini-3.8-flash', mockClient);
      const app = createApp(service);

      const res = await request(app)
        .post('/api/ai/analyze')
        .attach('image', VALID_JPEG_BUFFER, { filename: 'leaf.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AI_SERVICE_UNAVAILABLE');
    });
  });
});

