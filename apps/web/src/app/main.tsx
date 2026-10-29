import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApiProvider } from '@/api/ApiProvider';
import { theme } from '@/theme';
import { App } from './App';
import { env, loadPublicEnv } from './env';
import { AppSession } from './session';

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

async function start() {
  await loadPublicEnv();

  if (import.meta.env.DEV && window.location.pathname === '/__dev') {
    const { mountDevConsole } = await import('../devtools/mount');
    mountDevConsole({
      apiBaseUrl: env.apiBaseUrl,
      mockOnly: import.meta.env.VITE_USE_MOCKS === 'true',
    });
    return;
  }

  if (import.meta.env.DEV) {
    const { startDevAgent } = await import('../devtools/boot');
    await startDevAgent(queryClient);
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element');

  createRoot(container).render(
    <StrictMode>
      <AppSession>
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
      </AppSession>
    </StrictMode>,
  );
}

void start().catch((error: unknown) => {
  const container = document.getElementById('root');
  const message = error instanceof Error ? error.message : 'The app could not start';
  if (container) container.textContent = message;
});
