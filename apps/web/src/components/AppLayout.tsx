import { useAuth0 } from '@auth0/auth0-react';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet } from 'react-router-dom';
import { palette } from '../theme';

export function AppLayout() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, user } = useAuth0();

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky">
        <Toolbar>
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            component={RouterLink}
            to="/"
            sx={{ textDecoration: 'none', color: 'inherit', mr: 3 }}
          >
            <AutoStoriesIcon sx={{ color: palette.gold }} />
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
              Opulent{' '}
              <Box component="span" sx={{ color: palette.gold }}>
                Tutor
              </Box>
            </Typography>
          </Stack>

          {isAuthenticated && (
            <Stack direction="row" spacing={1}>
              <Button component={RouterLink} to="/binders" color="inherit">
                My binders
              </Button>
              <Button component={RouterLink} to="/wants" color="inherit">
                Want list
              </Button>
            </Stack>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {!isLoading && !isAuthenticated && (
            <Button variant="contained" onClick={() => void loginWithRedirect()}>
              Sign in
            </Button>
          )}

          {isAuthenticated && (
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {user?.name ?? user?.email}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => void logout({ logoutParams: { returnTo: window.location.origin } })}
              >
                Sign out
              </Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 5, flexGrow: 1 }}>
        <Outlet />
      </Container>

      <Box
        component="footer"
        sx={{ borderTop: `1px solid ${palette.divider}`, py: 3, textAlign: 'center' }}
      >
        <Typography variant="caption" color="text.secondary">
          Card data and images courtesy of Scryfall. Opulent Tutor is unofficial Fan Content
          permitted under the Wizards of the Coast Fan Content Policy, and is not produced or
          endorsed by Wizards of the Coast or Scryfall.
        </Typography>
      </Box>
    </Box>
  );
}
