import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ApiClientProvider } from '@/api/ApiProvider';
import { createApiClient } from '@/api/client';
import { theme } from '@/theme';

export function renderWithProviders(
  ui: ReactElement,
  options?: { route?: string } & RenderOptions,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const client = createApiClient(() => Promise.resolve(null));

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiClientProvider client={client}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <MemoryRouter initialEntries={[options?.route ?? '/']}>{children}</MemoryRouter>
          </ThemeProvider>
        </QueryClientProvider>
      </ApiClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
