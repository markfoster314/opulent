import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BODY_MAX_BYTES, limitBody } from './app';
import type { AppEnv } from './lib/context';
import { zValidator } from './lib/validate';
import { requireAuth } from './middleware/auth';
import { onError, onNotFound } from './middleware/error';

function testApp() {
  const app = new Hono<AppEnv>();
  app.use('*', limitBody);
  app.post('/limited', requireAuth, (c) => c.json({ ok: true }));
  app.notFound(onNotFound);
  app.onError(onError);
  return app;
}

describe('http edges', () => {
  it('returns not_found for an unknown route', async () => {
    const response = await testApp().request('/missing');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'not_found' },
    });
  });

  it('returns unauthorized when the bearer token is missing', async () => {
    const response = await testApp().request('/limited', { method: 'POST' });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'unauthorized' },
    });
  });

  it('returns bad_request when the body is over the cap', async () => {
    const response = await testApp().request('/limited', {
      method: 'POST',
      body: 'x'.repeat(BODY_MAX_BYTES + 1),
      headers: { 'content-type': 'text/plain' },
    });
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'bad_request', message: 'Request is too large' },
    });
  });

  it('returns bad_request when the query fails validation', async () => {
    const app = testApp();
    app.get('/search', zValidator('query', z.object({ q: z.string().min(1) })), (c) =>
      c.json({ q: c.req.valid('query').q }),
    );
    const response = await app.request('/search');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'bad_request', message: 'Request validation failed' },
    });
  });
});
