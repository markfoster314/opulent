import { afterEach, describe, expect, it, vi } from 'vitest';

const keys = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'AUTH0_DOMAIN',
  'AUTH0_AUDIENCE',
  'CORS_ORIGIN',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'WEB_ORIGIN',
] as const;

const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
});

describe('getEnv', () => {
  it('reads the required settings and splits origins', async () => {
    process.env.AUTH0_DOMAIN = 'example.auth0.com';
    process.env.AUTH0_AUDIENCE = 'https://api.example.com';
    process.env.CORS_ORIGIN = 'http://localhost:5173, http://127.0.0.1:5173';
    const { getEnv } = await import('./env');
    const env = getEnv();
    expect(env.AUTH0_DOMAIN).toBe('example.auth0.com');
    expect(env.corsOrigins).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
    expect(getEnv()).toBe(env);
  });

  it('throws when a required setting is missing', async () => {
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_AUDIENCE;
    const { getEnv } = await import('./env');
    expect(() => getEnv()).toThrow(/AUTH0_DOMAIN/);
  });
});
