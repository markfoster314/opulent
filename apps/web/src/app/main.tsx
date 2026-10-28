import { Auth0Provider } from '@auth0/auth0-react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApiProvider } from '@/api/ApiProvider';
import { App } from './App';
import { env } from './env';
import { theme } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Card data changes once a day at most, so refetching on every focus is waste.
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <Auth0Provider
      domain={env.auth0Domain}
      clientId={env.auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: env.auth0Audience,
      }}
      // Survives a page refresh, so a shared link does not force a re-login.
      useRefreshTokens
      cacheLocation="localstorage"
    >
      <ApiProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            {/* Follows theme.palette.mode, so dark widgets stay honest if the mode changes. */}
            <CssBaseline enableColorScheme />
            <BrowserRouter>
              <App />
            </BrowserRouter>
            {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
          </ThemeProvider>
        </QueryClientProvider>
      </ApiProvider>
    </Auth0Provider>
  </StrictMode>,
);
