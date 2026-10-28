import { keyframes } from '@emotion/react';
import { Box } from '@mui/material';
import { palette } from '@/theme';

/** Travels to the far side, then the animation reverses so the shine comes back. */
const foilSweep = keyframes`
  0% { background-position: 120% 0; }
  100% { background-position: -20% 0; }
`;

/** Shine-only layer; the Scryfall scan stays untouched underneath. */
export function FoilSheen() {
  const motion = {
    backgroundSize: '240% 100%',
    backgroundRepeat: 'no-repeat',
    animation: `${foilSweep} 8s ease-in-out infinite alternate`,
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
      backgroundPosition: '40% 0',
    },
  };

  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(115deg, transparent 28%, ${palette.foilShine} 46%, transparent 64%)`,
          mixBlendMode: 'screen',
          opacity: 0.4,
          ...motion,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(105deg, transparent 30%, ${palette.foilWarm} 48%, ${palette.foilCool} 56%, transparent 74%)`,
          mixBlendMode: 'soft-light',
          opacity: 0.55,
          ...motion,
        }}
      />
    </Box>
  );
}
