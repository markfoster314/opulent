import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import type { AuthPreset } from '@opulent/devtools/state';
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { env } from './env';
import { sessionFor, type Session } from './sessionPresets';

export type { AuthPreset, Session };

const SessionContext = createContext<Session | null>(null);

let override: AuthPreset | null = null;
const overrideListeners = new Set<() => void>();

export function setAuthOverride(next: AuthPreset | null): void {
  if (override === next) return;
  override = next;
  for (const listener of overrideListeners) listener();
}

export function currentAuthPreset(): AuthPreset | null {
  return override;
}

export function subscribeAuthOverride(listener: () => void): () => void {
  overrideListeners.add(listener);
  return () => {
    overrideListeners.delete(listener);
  };
}

function useAuthOverride(): AuthPreset | null {
  return useSyncExternalStore(
    subscribeAuthOverride,
    () => override,
    () => override,
  );
}

const sessionHandlers = {
  onSignIn: () => setAuthOverride('newUser'),
  onSignOut: () => setAuthOverride('signedOut'),
};

const devMocks = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

function useDevSession(): Session {
  const preset = useAuthOverride();
  return useMemo(() => sessionFor(preset ?? 'returning', sessionHandlers), [preset]);
}

function Auth0Session({ children, devSession }: { children: ReactNode; devSession: Session }) {
  const auth = useAuth0();
  const preset = useAuthOverride();
  const real = useMemo<Session>(
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
  return (
    <SessionContext.Provider value={preset ? devSession : real}>{children}</SessionContext.Provider>
  );
}

export function AppSession({ children }: { children: ReactNode }) {
  const devSession = useDevSession();

  if (devMocks) {
    return <SessionContext.Provider value={devSession}>{children}</SessionContext.Provider>;
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
      <Auth0Session devSession={devSession}>{children}</Auth0Session>
    </Auth0Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside AppSession');
  return session;
}
