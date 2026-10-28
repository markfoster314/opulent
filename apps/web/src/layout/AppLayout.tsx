import { useAuth0 } from '@auth0/auth0-react';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Badge,
  Box,
  Button,
  CircularProgress,
  Container,
  Drawer,
  IconButton,
  Stack,
  type SxProps,
  type Theme,
  Toolbar,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Navigate, Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '@/features/auth/queries';
import { useTrades } from '@/features/trades/queries';
import { hasPendingAdd } from '@/features/auth';
import { palette } from '@/theme';
import { ErrorBoundary } from './ErrorBoundary';
import { LogoMark } from './LogoMark';

export function AppLayout() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout, user } = useAuth0();
  const location = useLocation();
  const me = useMe(isAuthenticated);
  const [menuOpen, setMenuOpen] = useState(false);
  /** A card picked before sign-up, so the welcome step hands off to the collection page. */
  const [pendingAdd] = useState(() => hasPendingAdd());

  // Trades waiting on this person. Drafts are theirs alone, so they do not count.
  const trades = useTrades(isAuthenticated && me.data?.onboarded === true);
  const yourTurnCount = (trades.data?.items ?? []).filter(
    (trade) => trade.yourTurn && trade.status !== 'draft',
  ).length;

  /** A signed-in user without a username goes to /welcome first, carrying the page they aimed for. */
  const needsWelcome = isAuthenticated && me.data !== undefined && !me.data.onboarded;
  const onWelcome = location.pathname === '/welcome';

  /** Auth0 strips ?code= before it marks the session signed in, so remember it to hold the loader. */
  const hasAuthCode = new URLSearchParams(location.search).has('code');
  const authReturnRef = useRef(hasAuthCode);
  if (hasAuthCode) authReturnRef.current = true;

  const accountPending = isAuthenticated && me.data === undefined && !me.isError;
  const redirectingToWelcome = needsWelcome && !onWelcome;
  const settlingAuthReturn = authReturnRef.current && (isLoading || accountPending);
  /** A /welcome refresh cannot know yet if setup is done, so cover the bar until the account row lands. */
  const welcomePending = onWelcome && (isLoading || accountPending);
  const showLoader =
    settlingAuthReturn ||
    welcomePending ||
    (accountPending && location.pathname === '/') ||
    redirectingToWelcome;

  if (me.data || (!isLoading && !isAuthenticated && !hasAuthCode)) {
    authReturnRef.current = false;
  }

  // A wide window already shows the links, so a phone drawer must close on resize.
  useEffect(() => {
    const wide = window.matchMedia('(min-width:600px)');
    const closeIfWide = () => {
      if (wide.matches) setMenuOpen(false);
    };
    closeIfWide();
    wide.addEventListener('change', closeIfWide);
    return () => wide.removeEventListener('change', closeIfWide);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 1 }}>
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            component={RouterLink}
            to="/"
            sx={{ textDecoration: 'none', color: 'inherit', minWidth: 0, mr: { sm: 2 } }}
          >
            <LogoMark />
            <Typography variant="h6" noWrap sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
              Opulent{' '}
              <Box component="span" sx={{ color: palette.gold }}>
                Tutor
              </Box>
            </Typography>
          </Stack>

          <BarActions
            part="links"
            yourTurnCount={yourTurnCount}
            isLoading={isLoading}
            isAuthenticated={isAuthenticated}
            needsWelcome={needsWelcome}
            username={me.data?.username}
            fallbackName={user?.name ?? user?.email}
            pathname={location.pathname}
            onSignIn={() => void loginWithRedirect()}
            onSignOut={() => void logout({ logoutParams: { returnTo: window.location.origin } })}
            sx={{ display: { xs: 'none', sm: 'flex' }, flexWrap: 'wrap', rowGap: 0.5 }}
          />

          <Box sx={{ flexGrow: 1 }} />

          <BarActions
            part="account"
            yourTurnCount={yourTurnCount}
            isLoading={isLoading}
            isAuthenticated={isAuthenticated}
            needsWelcome={needsWelcome}
            username={me.data?.username}
            fallbackName={user?.name ?? user?.email}
            pathname={location.pathname}
            onSignIn={() => void loginWithRedirect()}
            onSignOut={() => void logout({ logoutParams: { returnTo: window.location.origin } })}
            sx={{ display: { xs: 'none', sm: 'flex' } }}
          />

          {!isLoading && !isAuthenticated && (
            <Button
              variant="contained"
              onClick={() => void loginWithRedirect()}
              sx={{ display: { sm: 'none' } }}
            >
              Sign in
            </Button>
          )}

          {isAuthenticated && (
            <IconButton
              color="inherit"
              aria-label="Open menu"
              size="large"
              onClick={() => setMenuOpen(true)}
              sx={{ display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        slotProps={{
          paper: {
            sx: { width: 'min(100%, 20rem)', px: 2, py: 2 },
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Menu
          </Typography>
          <IconButton
            color="inherit"
            aria-label="Close menu"
            size="large"
            onClick={() => setMenuOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
        <BarActions
          part="all"
          stacked
          yourTurnCount={yourTurnCount}
          isLoading={isLoading}
          isAuthenticated={isAuthenticated}
          needsWelcome={needsWelcome}
          username={me.data?.username}
          fallbackName={user?.name ?? user?.email}
          pathname={location.pathname}
          onSignIn={() => void loginWithRedirect()}
          onSignOut={() => void logout({ logoutParams: { returnTo: window.location.origin } })}
        />
      </Drawer>

      <Container maxWidth="lg" sx={{ px: { xs: 2.5, sm: 3 }, py: { xs: 4, md: 5 }, flexGrow: 1 }}>
        {redirectingToWelcome && (
          <Navigate
            to="/welcome"
            state={{
              // A visitor who picked a card finishes that add on the collection page.
              from: pendingAdd ? '/collection' : `${location.pathname}${location.search}`,
            }}
            replace
          />
        )}
        <ErrorBoundary>{showLoader ? <FullPageLoader /> : <Outlet />}</ErrorBoundary>
      </Container>

      <Box
        component="footer"
        sx={{
          borderTop: `1px solid ${palette.divider}`,
          py: { xs: 4, md: 3 },
          textAlign: 'center',
        }}
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

interface BarActionsProps {
  /** Which part of the bar to render; the phone menu shows all of it. */
  part: 'links' | 'account' | 'all';
  stacked?: boolean;
  /** Trades waiting on this person; zero hides the badge. */
  yourTurnCount: number;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsWelcome: boolean;
  username: string | undefined;
  fallbackName: string | undefined;
  pathname: string;
  onSignIn: () => void;
  onSignOut: () => void;
  sx?: SxProps<Theme>;
}

/** The same links: a row in a wide bar, stacked in the phone menu. */
function BarActions({
  part,
  stacked = false,
  yourTurnCount,
  isLoading,
  isAuthenticated,
  needsWelcome,
  username,
  fallbackName,
  pathname,
  onSignIn,
  onSignOut,
  sx,
}: BarActionsProps) {
  const showLinks = part !== 'account' && isAuthenticated && !needsWelcome;
  const showSignIn = part !== 'links' && !isLoading && !isAuthenticated;
  const showAccount = part !== 'links' && isAuthenticated;
  if (!showLinks && !showSignIn && !showAccount) return null;

  const itemSx = stacked ? { justifyContent: 'flex-start', minHeight: 48 } : undefined;

  return (
    <Stack
      direction={stacked ? 'column' : 'row'}
      spacing={stacked ? 1 : part === 'account' ? 2 : 1}
      alignItems={stacked ? 'stretch' : 'center'}
      sx={sx}
    >
      {showLinks && (
        <>
          <Button
            component={RouterLink}
            to="/collection"
            color={
              pathname.startsWith('/collection') || pathname.startsWith('/groups/')
                ? 'primary'
                : 'inherit'
            }
            fullWidth={stacked}
            sx={itemSx}
          >
            My collection
          </Button>
          <Button
            component={RouterLink}
            to="/wants"
            color={pathname === '/wants' || pathname.startsWith('/wants/') ? 'primary' : 'inherit'}
            fullWidth={stacked}
            sx={itemSx}
          >
            My wants
          </Button>
          <Button
            component={RouterLink}
            to="/matches"
            color={pathname === '/matches' ? 'primary' : 'inherit'}
            fullWidth={stacked}
            sx={itemSx}
          >
            Find trades
          </Button>
          <Button
            component={RouterLink}
            to="/trades"
            color={
              pathname === '/trades' || pathname.startsWith('/trades/') ? 'primary' : 'inherit'
            }
            fullWidth={stacked}
            sx={itemSx}
          >
            <Badge
              badgeContent={yourTurnCount}
              color="primary"
              max={99}
              sx={{ '& .MuiBadge-badge': { right: -12, top: 2 } }}
            >
              Trades
            </Badge>
          </Button>
        </>
      )}

      {showSignIn && (
        <Button variant="contained" onClick={onSignIn} fullWidth={stacked} sx={itemSx}>
          Sign in
        </Button>
      )}

      {showAccount && (
        <>
          {username && !needsWelcome ? (
            <Button
              component={RouterLink}
              to={`/u/${username}`}
              color={pathname === `/u/${username}` ? 'primary' : 'inherit'}
              fullWidth={stacked}
              sx={itemSx}
            >
              Profile
            </Button>
          ) : (
            <Typography
              variant="body2"
              color="secondary"
              sx={stacked ? { px: 1, py: 1, overflowWrap: 'anywhere' } : undefined}
            >
              {fallbackName}
            </Typography>
          )}
          <Button
            variant="outlined"
            color="secondary"
            onClick={onSignOut}
            fullWidth={stacked}
            sx={itemSx}
          >
            Sign out
          </Button>
        </>
      )}
    </Stack>
  );
}

/** Covers the whole window, bar and footer included, so nothing underneath shows. */
function FullPageLoader() {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: (theme) => theme.zIndex.modal + 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <CircularProgress />
    </Box>
  );
}
