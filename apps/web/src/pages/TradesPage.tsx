import { useAuth0 } from '@auth0/auth0-react';
import { Alert, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import type { TradeSummary } from '@opulent/shared';
import { Link as RouterLink } from 'react-router-dom';
import { useTrades } from '../api/queries';
import { clickableSurfaceSx } from '../theme';

export function TradesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const trades = useTrades(isAuthenticated);

  if (authLoading || trades.isLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to see your trades.</Alert>;
  if (trades.error) return <Alert severity="error">{trades.error.message}</Alert>;

  const items = trades.data?.items ?? [];

  return (
    <Stack spacing={3}>
      <Typography variant="h1">Trades</Typography>
      {items.length === 0 && (
        <Alert severity="info">No trades yet. Open one from a friend's binder.</Alert>
      )}
      {items.map((trade) => (
        <Paper
          key={trade.id}
          component={RouterLink}
          to={`/trades/${trade.id}`}
          sx={{ p: 2.5, display: 'block', minWidth: 0, ...clickableSurfaceSx }}
        >
          <Typography variant="h3" sx={{ overflowWrap: 'anywhere' }}>
            @{trade.partnerUsername}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {tradeCaption(trade)}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            You get {trade.youReceiveCount}. You give {trade.youGiveCount}.
          </Typography>
        </Paper>
      ))}
    </Stack>
  );
}

function tradeCaption(trade: TradeSummary): string {
  if (trade.status === 'completed') return 'Complete';
  if (trade.status === 'cancelled' || trade.status === 'declined') return 'Cancelled';
  if (trade.yourTurn && trade.theyFinalized) return 'They finalized. Your turn to answer.';
  if (trade.yourTurn) return 'Your turn';
  if (trade.youFinalized) return 'You finalized. Waiting on them.';
  return 'Waiting on them';
}
