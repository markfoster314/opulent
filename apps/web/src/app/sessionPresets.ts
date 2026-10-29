import type { Auth0ContextInterface } from '@auth0/auth0-react';
import type { AuthPreset } from '@opulent/devtools/state';

export type Session = Pick<
  Auth0ContextInterface,
  | 'isAuthenticated'
  | 'isLoading'
  | 'user'
  | 'loginWithRedirect'
  | 'logout'
  | 'getAccessTokenSilently'
>;

export interface SessionHandlers {
  onSignIn: () => void;
  onSignOut: () => void;
}

const mockUser = {
  name: 'Mock User',
  email: 'mock@example.com',
  sub: 'mock|user',
} as Session['user'];

const newUser = {
  name: 'New User',
  email: 'new@example.com',
  sub: 'mock|new',
} as Session['user'];

function token(value: string | null): Session['getAccessTokenSilently'] {
  return (() => Promise.resolve(value)) as Session['getAccessTokenSilently'];
}

const expired = (() =>
  Promise.reject(new Error('Token expired'))) as Session['getAccessTokenSilently'];

/** One preset per state the UI can be in; the token decides what the API client sends. */
export function sessionFor(preset: AuthPreset, handlers: SessionHandlers): Session {
  const loginWithRedirect = () => Promise.resolve(handlers.onSignIn());
  const logout = () => Promise.resolve(handlers.onSignOut());

  switch (preset) {
    case 'signedOut':
      return {
        isAuthenticated: false,
        isLoading: false,
        user: undefined,
        loginWithRedirect,
        logout,
        getAccessTokenSilently: token(null),
      };
    case 'newUser':
      return {
        isAuthenticated: true,
        isLoading: false,
        user: newUser,
        loginWithRedirect,
        logout,
        getAccessTokenSilently: token('mock-new'),
      };
    case 'tokenExpired':
      return {
        isAuthenticated: true,
        isLoading: false,
        user: mockUser,
        loginWithRedirect,
        logout,
        getAccessTokenSilently: expired,
      };
    case 'loading':
      return {
        isAuthenticated: true,
        isLoading: true,
        user: mockUser,
        loginWithRedirect,
        logout,
        getAccessTokenSilently: token('mock'),
      };
    case 'returning':
      return {
        isAuthenticated: true,
        isLoading: false,
        user: mockUser,
        loginWithRedirect,
        logout,
        getAccessTokenSilently: token('mock'),
      };
  }
}
