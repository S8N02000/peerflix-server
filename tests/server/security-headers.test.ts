import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';

describe('HTTP Security Headers and Error Handling', () => {
  const app = createApp({ enableLogging: false });

  it('should not return wildcard Access-Control-Allow-Origin: *', async () => {
    const res = await request(app).get('/torrents');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should include X-Content-Type-Options: nosniff header', async () => {
    const res = await request(app).get('/torrents');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should return clean JSON on internal error without leaking stack trace', async () => {
    const res = await request(app).get('/test-error');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toBe('An internal error occurred on the server');
    expect(res.body.stack).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });
});
