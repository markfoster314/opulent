import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { DevConsole } from '@opulent/devtools';
import { createRoot } from 'react-dom/client';
import { theme } from '@/theme';

export function mountDevConsole({
  apiBaseUrl,
  mockOnly,
}: {
  apiBaseUrl: string;
  mockOnly: boolean;
}) {
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element');

  createRoot(container).render(
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <DevConsole apiBaseUrl={apiBaseUrl} mockOnly={mockOnly} />
    </ThemeProvider>,
  );
}
