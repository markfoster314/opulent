import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { TradeSummary } from '@opulent/shared';
import { useState } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useCollectionSummary } from '@/features/collection/queries';
import { useMatchOwners } from '@/features/matches/queries';
import { useMe } from '@/features/auth/queries';
import { useTrades } from '@/features/trades/queries';
import { hasPendingAdd, LandingPage } from '@/features/auth';
import { MatchOwnerPaper } from '@/features/matches';
import { clickableSurfaceSx, palette } from '@/theme';

const pastStatus = new Set(['completed', 'cancelled', 'declined']);
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const HOME_MATCHES = 4;

export function HomePage() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useSession();
  if (isLoading) return <CircularProgress />;
  if (isAuthenticated) return <SignedInHome />;
  return <LandingPage onSignUp={() => void loginWithRedirect()} />;
}

function SignedInHome() {
  const me = useMe(true);
  const trades = useTrades(true);
  const matches = useMatchOwners(true);
  const summary = useCollectionSummary(true);
  /** A pre-signup card is replayed on /collection, so such visitors land there rather than home. */
  const [pendingAdd] = useState(() => hasPendingAdd());

  const waitingOnYou = (trades.data?.items ?? []).filter(
    (trade) => trade.status !== 'draft' && !pastStatus.has(trade.status) && trade.yourTurn,
  );
  const matchItems = (matches.data?.items ?? []).slice(0, HOME_MATCHES);
  const totals = summary.data;

  if (me.data?.onboarded && pendingAdd) return <Navigate to="/collection" replace />;

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          Welcome back{me.data ? `, @${me.data.username}` : ''}
        </Typography>
        {me.data && me.data.city === null && (
          <Typography color="text.secondary">
            Add your city on your{' '}
            <Box
              component={RouterLink}
              to={`/u/${me.data.username}`}
              sx={{ color: 'primary.main' }}
            >
              profile
            </Box>{' '}
            so nearby matches sort first.
          </Typography>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={1.5}>
          <Typography variant="h2">Waiting on you</Typography>
          {trades.isLoading && <CircularProgress />}
          {trades.error && <Alert severity="error">{trades.error.message}</Alert>}
          {trades.isSuccess && waitingOnYou.length === 0 && (
            <Alert severity="info">Nothing waiting on you.</Alert>
          )}
          {waitingOnYou.map((trade) => (
            <HomeTradePaper key={trade.id} trade={trade} />
          ))}
          <Button
            component={RouterLink}
            to="/trades"
            variant="outlined"
            sx={{ width: { xs: '100%', sm: 'auto' }, alignSelf: { sm: 'flex-start' } }}
          >
            All trades
          </Button>
        </Stack>

        <Stack spacing={1.5}>
          <Typography variant="h2">Who has what you want</Typography>
          {matches.isLoading && <CircularProgress />}
          {matches.error && <Alert severity="error">{matches.error.message}</Alert>}
          {matches.isSuccess && matchItems.length === 0 && (
            <Alert severity="info">Add wants, then we look through public trade binders.</Alert>
          )}
          {matchItems.map((owner) => (
            <MatchOwnerPaper key={owner.username} owner={owner} />
          ))}
          <Button
            component={RouterLink}
            to="/matches"
            variant="outlined"
            sx={{ width: { xs: '100%', sm: 'auto' }, alignSelf: { sm: 'flex-start' } }}
          >
            Find trades
          </Button>
        </Stack>
      </Box>

      <Stack spacing={1.5}>
        <Typography variant="h2">Your collection</Typography>
        {summary.error && <Alert severity="error">{summary.error.message}</Alert>}
        {totals && (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={`${totals.cardCount} card${totals.cardCount === 1 ? '' : 's'}`} />
            <Chip color="primary" variant="outlined" label={`${totals.forTradeCount} for trade`} />
            <Chip label={`${money.format(Number(totals.marketValue))} collection value`} />
          </Stack>
        )}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          useFlexGap
          sx={{ flexWrap: 'wrap' }}
        >
          <Button
            component={RouterLink}
            to="/collection"
            variant="contained"
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            My collection
          </Button>
          <Button
            component={RouterLink}
            to="/wants"
            variant="outlined"
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            My wants
          </Button>
          <Button
            component={RouterLink}
            to="/collection/import"
            variant="outlined"
            color="secondary"
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Import CSV
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
        }}
      >
        <ComingSlot title="Price moves" body="Cards in your collection that moved today." />
        <ComingSlot title="Alerts" body="When a friend marks a card you want for trade." />
      </Box>
    </Stack>
  );
}

function HomeTradePaper({ trade }: { trade: TradeSummary }) {
  return (
    <Paper
      component={RouterLink}
      to={`/trades/${trade.id}`}
      sx={{ p: 2.5, display: 'block', minWidth: 0, ...clickableSurfaceSx }}
    >
      <Typography variant="h3" sx={{ overflowWrap: 'anywhere' }}>
        @{trade.partnerUsername}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Your turn. You get {trade.youReceiveCount}. You give {trade.youGiveCount}.
      </Typography>
    </Paper>
  );
}

function ComingSlot({ title, body }: { title: string; body: string }) {
  return (
    <Paper sx={{ p: 2.5, minWidth: 0, borderColor: palette.steelBorder }}>
      <Typography variant="h3" sx={{ overflowWrap: 'anywhere' }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {body}
      </Typography>
      <Typography variant="caption" color="secondary" sx={{ mt: 1, display: 'block' }}>
        Coming next.
      </Typography>
    </Paper>
  );
}
