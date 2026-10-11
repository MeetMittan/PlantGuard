import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { GeminiService } from '../src/services/gemini.js';

describe('Security & Middleware', () => {
  const app = createApp(new GeminiService(''));

  it('includes Helmet security headers', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers).toHaveProperty('x-dns-prefetch-control');
    expect(res.headers).toHaveProperty('x-frame-options');
    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
  });

  it('allows configured origin in CORS', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('blocks disallowed origin in CORS', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://malicious-site.example.com');

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/CORS/);
  });
});

