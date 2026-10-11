import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { GeminiService } from '../src/services/gemini.js';

describe('GET /api/health', () => {
  const app = createApp(new GeminiService(''));

  it('returns healthy status without leaking secrets', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('service', 'plantguard-api');
    // Ensure no secrets leaked
    expect(JSON.stringify(res.body)).not.toMatch(/api[_-]?key/i);
    expect(JSON.stringify(res.body)).not.toMatch(/gemini/i);
  });
});

