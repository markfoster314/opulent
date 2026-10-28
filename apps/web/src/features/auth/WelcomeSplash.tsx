import { Box, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { palette } from '@/theme';
import { LogoMark } from '@/layout/LogoMark';

const HOLD_MS = 2800;
const FADE_MS = 420;

const riseSx = {
  '@keyframes welcomeRise': {
    '0%': { opacity: 0, transform: 'translateY(12px)' },
    '100%': { opacity: 1, transform: 'none' },
  },
} as const;

interface WelcomeSplashProps {
  /** Called once the splash has faded out, so the page can unmount it. */
  onDone: () => void;
}

/** Owns the whole window and leaves on its own, or at once on any key; reduced motion holds it still. */
export function WelcomeSplash({ onDone }: WelcomeSplashProps) {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), reduced ? 1600 : HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDone, reduced ? 150 : FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, onDone, reduced]);

  // A key is caught on the window because nothing inside the splash can take focus.
  useEffect(() => {
    function leave() {
      setLeaving(true);
    }
    window.addEventListener('keydown', leave);
    return () => window.removeEventListener('keydown', leave);
  }, []);

  return (
    <Box
      role="status"
      aria-live="polite"
      onClick={() => setLeaving(true)}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: (theme) => theme.zIndex.modal + 1,
        display: 'grid',
        placeItems: 'center',
        px: 3,
        bgcolor: palette.background,
        backgroundImage: `radial-gradient(900px 520px at 50% 40%, ${palette.goldWash}, transparent 70%)`,
        opacity: leaving ? 0 : 1,
        transition: reduced ? 'opacity 150ms linear' : `opacity ${FADE_MS}ms ease`,
      }}
    >
      <Stack
        spacing={{ xs: 3, sm: 4 }}
        sx={{
          alignItems: 'center',
          maxWidth: 520,
          textAlign: 'center',
        }}
      >
        <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
          {!reduced && (
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                width: { xs: 220, sm: 280 },
                height: { xs: 220, sm: 280 },
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(184, 134, 11, 0.24) 0%, rgba(184, 134, 11, 0) 62%)',
                animation: 'welcomeHalo 1500ms ease-out 120ms both',
                '@keyframes welcomeHalo': {
                  '0%': { opacity: 0, transform: 'scale(0.7)' },
                  '60%': { opacity: 1, transform: 'scale(1)' },
                  '100%': { opacity: 0.75, transform: 'scale(1.04)' },
                },
              }}
            />
          )}

          <Box
            sx={{
              position: 'relative',
              animation: reduced
                ? 'none'
                : 'welcomeCard 820ms cubic-bezier(0.22, 1, 0.36, 1) 80ms both',
              '@keyframes welcomeCard': {
                '0%': { opacity: 0, transform: 'translateY(26px) scale(0.88) rotate(-7deg)' },
                '100%': { opacity: 1, transform: 'none' },
              },
            }}
          >
            <Box
              sx={{
                // Sway sits on its own element so the entrance keeps its transform.
                animation: reduced ? 'none' : 'welcomeSway 3400ms ease-in-out 900ms infinite',
                '@keyframes welcomeSway': {
                  '0%': { transform: 'rotate(0deg)' },
                  '25%': { transform: 'rotate(3deg)' },
                  '75%': { transform: 'rotate(-3deg)' },
                  '100%': { transform: 'rotate(0deg)' },
                },
              }}
            >
              <LogoMark
                sx={{
                  width: { xs: 88, sm: 112 },
                  height: { xs: 110, sm: 140 },
                  filter: 'drop-shadow(0 18px 30px rgba(0, 0, 0, 0.55))',
                }}
              />
            </Box>
          </Box>
        </Box>

        <Stack spacing={1}>
          <Typography
            variant="h2"
            sx={{
              ...riseSx,
              overflowWrap: 'anywhere',
              animation: reduced ? 'none' : 'welcomeRise 560ms ease-out 480ms both',
            }}
          >
            Welcome to{' '}
            <Box component="span" sx={{ color: palette.gold }}>
              Opulent Tutor
            </Box>
            .
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
