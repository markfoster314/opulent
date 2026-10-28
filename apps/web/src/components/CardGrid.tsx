import { Box } from '@mui/material';
import type { ReactNode } from 'react';

/** Auto-fill rather than a fixed column count, so one grid fits a phone and a wide window. */
export function CardGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 148px), 1fr))',
        alignItems: 'stretch',
      }}
    >
      {children}
    </Box>
  );
}
