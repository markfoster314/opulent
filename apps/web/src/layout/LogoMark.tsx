import { Box, type SxProps, type Theme } from '@mui/material';
import { palette } from '@/theme';

export function LogoMark({ sx }: { sx?: SxProps<Theme> }) {
  const baseSx = { width: 26, height: 32, flexShrink: 0, display: 'block' };
  const extraSx = (Array.isArray(sx) ? sx : sx ? [sx] : []) as SxProps<Theme>[];
  const mergedSx = [baseSx, ...extraSx] as SxProps<Theme>;

  return (
    <Box component="svg" viewBox="0 0 32 40" aria-hidden sx={mergedSx}>
      <rect
        x="2"
        y="2"
        width="28"
        height="36"
        rx="4"
        fill={palette.gold}
        stroke={palette.background}
        strokeWidth="2"
      />
      <path
        fill={palette.background}
        fillRule="evenodd"
        d="M16 7.6 A4.6 4.6 0 1 0 16 16.8 A4.6 4.6 0 1 0 16 7.6 Z M16 9.8 A2.4 2.4 0 1 0 16 14.6 A2.4 2.4 0 1 0 16 9.8 Z"
      />
      <path fill={palette.background} d="M8.7 19 H23.3 V22.1 H17.7 V31.8 H14.4 V22.1 H8.7 Z" />
    </Box>
  );
}
