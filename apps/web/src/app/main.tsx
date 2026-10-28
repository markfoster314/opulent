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
import { MockPanel } from './MockPanel';
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

const useMocks = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

async function start() {
  if (useMocks) {
    const { worker } = await import('@/mocks/browser');
    await worker.start({ onUnhandledFrame: 'bypass' });
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
              {useMocks ? <MockPanel /> : null}
              {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
            </ThemeProvider>
          </QueryClientProvider>
        </ApiProvider>
      </AppSession>
    </StrictMode>,
  );
}

void start();
