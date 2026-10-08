import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { palette } from '../theme';

const steps = [
  {
    title: 'Build your binder',
    body: 'Search any Magic card and add it with its finish and condition. Your binder is the list of what you will trade.',
  },
  {
    title: 'Share one link',
    body: 'Send friends a link. They do not need an account to look, and a private binder stays private until you share it.',
  },
  {
    title: 'See the overlap',
    body: 'When a friend opens your binder while signed in, we show exactly which cards on their want list you are holding.',
  },
];

export function HomePage() {
  const { isAuthenticated, loginWithRedirect } = useAuth0();

  return (
    <Stack spacing={{ xs: 4, sm: 6 }}>
      <Stack spacing={2.5} sx={{ maxWidth: 720 }}>
        <Typography variant="h1">
          Your trade binder,{' '}
          <Box component="span" sx={{ color: palette.gold }}>
            one link away
          </Box>
          .
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
          Opulent Tutor turns the pile of cards you are willing to trade into a shareable binder,
          then finds the overlap with what your friends are hunting for.
        </Typography>

        <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
          {isAuthenticated ? (
            <Button component={RouterLink} to="/binders" variant="contained" size="large">
              Open my binders
            </Button>
          ) : (
            <Button variant="contained" size="large" onClick={() => void loginWithRedirect()}>
              Create your binder
            </Button>
          )}
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        }}
      >
        {steps.map((step, index) => (
          <Paper key={step.title} sx={{ p: 3 }}>
            <Typography variant="overline" sx={{ color: palette.gold }}>
              Step {index + 1}
            </Typography>
            <Typography variant="h3" sx={{ mt: 0.5, mb: 1 }}>
              {step.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {step.body}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}
