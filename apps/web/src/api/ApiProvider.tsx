import { useAuth0 } from '@auth0/auth0-react';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { env } from '../env';
import { createApiClient, type ApiClient } from './client';

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const client = useMemo(
    () =>
      createApiClient(async () => {
        if (!isAuthenticated) return null;
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: { audience: env.auth0Audience },
          });
          return token ?? null;
        } catch {
          // Expired session. Treated as anonymous so public pages still render.
          return null;
        }
      }),
    [getAccessTokenSilently, isAuthenticated],
  );

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApi must be used inside an ApiProvider');
  return client;
}
