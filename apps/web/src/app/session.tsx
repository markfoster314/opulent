import { Auth0Provider, useAuth0, type Auth0ContextInterface } from '@auth0/auth0-react';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { env } from './env';

export type Session = Pick<
  Auth0ContextInterface,
  | 'isAuthenticated'
  | 'isLoading'
  | 'user'
  | 'loginWithRedirect'
  | 'logout'
  | 'getAccessTokenSilently'
>;

const SessionContext = createContext<Session | null>(null);

const mockSession: Session = {
  isAuthenticated: true,
  isLoading: false,
  user: { name: 'Mock User', email: 'mock@example.com', sub: 'mock|user' },
  loginWithRedirect: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  getAccessTokenSilently: (() => Promise.resolve('mock')) as Session['getAccessTokenSilently'],
};

function Auth0Session({ children }: { children: ReactNode }) {
  const auth = useAuth0();
  const value = useMemo<Session>(
    () => ({
      isAuthenticated: auth.isAuthenticated,
      isLoading: auth.isLoading,
      user: auth.user,
      loginWithRedirect: auth.loginWithRedirect,
      logout: auth.logout,
      getAccessTokenSilently: auth.getAccessTokenSilently,
    }),
    [
      auth.isAuthenticated,
      auth.isLoading,
      auth.user,
      auth.loginWithRedirect,
      auth.logout,
      auth.getAccessTokenSilently,
    ],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function AppSession({ children }: { children: ReactNode }) {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
    return <SessionContext.Provider value={mockSession}>{children}</SessionContext.Provider>;
  }

  return (
    <Auth0Provider
      domain={env.auth0Domain}
      clientId={env.auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: env.auth0Audience,
      }}
      useRefreshTokens
      cacheLocation="localstorage"
    >
      <Auth0Session>{children}</Auth0Session>
    </Auth0Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside AppSession');
  return session;
}
