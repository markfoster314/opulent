import { describe, expect, it, vi } from 'vitest';
import { sessionFor } from './sessionPresets';

const handlers = { onSignIn: vi.fn(), onSignOut: vi.fn() };

describe('session presets', () => {
  it('returns no token when signed out', async () => {
    const session = sessionFor('signedOut', handlers);
    expect(session.isAuthenticated).toBe(false);
    await expect(session.getAccessTokenSilently()).resolves.toBeNull();
  });

  it('returns a token for the returning account', async () => {
    const session = sessionFor('returning', handlers);
    expect(session.isAuthenticated).toBe(true);
    await expect(session.getAccessTokenSilently()).resolves.toBe('mock');
  });

  it('returns a token for a new account', async () => {
    const session = sessionFor('newUser', handlers);
    await expect(session.getAccessTokenSilently()).resolves.toBe('mock-new');
  });

  it('rejects the token when it expired', async () => {
    const session = sessionFor('tokenExpired', handlers);
    await expect(session.getAccessTokenSilently()).rejects.toThrow('Token expired');
  });

  it('stays loading on request', () => {
    expect(sessionFor('loading', handlers).isLoading).toBe(true);
  });

  it('signs in through the handler', async () => {
    await sessionFor('signedOut', handlers).loginWithRedirect();
    expect(handlers.onSignIn).toHaveBeenCalled();
  });

  it('signs out through the handler', async () => {
    await sessionFor('returning', handlers).logout();
    expect(handlers.onSignOut).toHaveBeenCalled();
  });
});
