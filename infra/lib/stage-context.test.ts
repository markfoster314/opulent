import { describe, expect, it } from 'vitest';
import { resolveStageSettings } from './stage-context';

const prod = {
  auth0Domain: 'tenant.us.auth0.com',
  auth0Audience: 'https://api.opulenttutor.com',
  auth0ClientId: 'spa-client',
  corsOrigin: 'https://opulenttutor.com',
  webOrigin: 'https://opulenttutor.com',
  emailFrom: 'trades@opulenttutor.com',
  resendApiKey: 're_test',
};

describe('resolveStageSettings', () => {
  it('keeps the laptop defaults for a dev synth', () => {
    const settings = resolveStageSettings('dev', () => undefined);
    expect(settings.auth0Domain).toBe('your-tenant.us.auth0.com');
    expect(settings.corsOrigin).toBe('http://localhost:5173');
    expect(settings.webOrigin).toBe('http://localhost:5173');
    expect(settings.resendApiKey).toBe('');
  });

  it('stops a prod synth that still has the laptop settings', () => {
    expect(() => resolveStageSettings('prod', () => undefined)).toThrow(/auth0Domain/);
  });

  it('accepts a prod synth when every public setting is set', () => {
    const settings = resolveStageSettings('prod', (key) => prod[key as keyof typeof prod]);
    expect(settings.webOrigin).toBe('https://opulenttutor.com');
    expect(settings.resendApiKey).toBe('re_test');
  });
});
