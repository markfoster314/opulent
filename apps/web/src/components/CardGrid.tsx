import { Box } from '@mui/material';
import type { ReactNode } from 'react';

/**
 * Responsive card wall. Uses CSS grid with auto-fill rather than a fixed column
 * count, so the same component works for a 6-card phone view and a wide desktop.
 */
export function CardGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 148px), 1fr))',
      }}
    >
      {children}
    </Box>
  );
}
