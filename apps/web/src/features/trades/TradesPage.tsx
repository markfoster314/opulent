import { Alert, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import type { TradeSummary } from '@opulent/shared';
import { Link as RouterLink } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useTrades } from '@/features/trades/queries';
import { clickableSurfaceSx } from '@/theme';

const pastStatus = new Set(['completed', 'cancelled', 'declined']);

export function TradesPage() {
  const { isAuthenticated, isLoading: authLoading } = useSession();
  const trades = useTrades(isAuthenticated);

  if (authLoading || trades.isLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to see your trades.</Alert>;
  if (trades.error) return <Alert severity="error">{trades.error.message}</Alert>;

  const items = trades.data?.items ?? [];
  const drafts = items.filter((trade) => trade.status === 'draft');
  const waitingOnYou = items.filter(
    (trade) => trade.status !== 'draft' && !pastStatus.has(trade.status) && trade.yourTurn,
  );
  const waitingOnThem = items.filter(
    (trade) => trade.status !== 'draft' && !pastStatus.has(trade.status) && !trade.yourTurn,
  );

  return (
    <Stack spacing={4}>
      <Typography variant="h1">Trades</Typography>
      <TradeSection title="Draft" empty="No drafts." items={drafts} />
      <TradeSection
        title="Waiting on you"
        empty="Nothing is waiting on you."
        items={waitingOnYou}
      />
      <TradeSection
        title="Waiting on them"
        empty="Nothing is waiting on them."
        items={waitingOnThem}
      />
      <Paper
        component={RouterLink}
        to="/trades/past"
        sx={{ p: 2.5, display: 'block', minWidth: 0, ...clickableSurfaceSx }}
      >
        <Typography variant="h2">Completed trades</Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mt: 0.5,
          }}
        >
          Open the full list of your past trades.
        </Typography>
      </Paper>
    </Stack>
  );
}

export function PastTradesPage() {
  const { isAuthenticated, isLoading: authLoading } = useSession();
  const trades = useTrades(isAuthenticated);

  if (authLoading || trades.isLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to see your trades.</Alert>;
  if (trades.error) return <Alert severity="error">{trades.error.message}</Alert>;

  const items = (trades.data?.items ?? []).filter((trade) => pastStatus.has(trade.status));

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1">Past trades</Typography>
        <Typography
          sx={{
            color: 'text.secondary',
          }}
        >
          Completed and cancelled trades.
        </Typography>
      </Stack>
      {items.length === 0 && <Alert severity="info">No past trades yet.</Alert>}
      {items.map((trade) => (
        <TradeCard key={trade.id} trade={trade} />
      ))}
    </Stack>
  );
}

function TradeSection({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: TradeSummary[];
}) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="h2">{title}</Typography>
      {items.length === 0 && <Alert severity="info">{empty}</Alert>}
      {items.map((trade) => (
        <TradeCard key={trade.id} trade={trade} />
      ))}
    </Stack>
  );
}

function TradeCard({ trade }: { trade: TradeSummary }) {
  return (
    <Paper
      component={RouterLink}
      to={`/trades/${trade.id}`}
      sx={{ p: 2.5, display: 'block', minWidth: 0, ...clickableSurfaceSx }}
    >
      <Typography variant="h3" sx={{ overflowWrap: 'anywhere' }}>
        @{trade.partnerUsername}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          mt: 0.5,
        }}
      >
        {tradeCaption(trade)}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        You get {trade.youReceiveCount}. You give {trade.youGiveCount}.
      </Typography>
    </Paper>
  );
}

function tradeCaption(trade: TradeSummary): string {
  if (trade.status === 'draft') return 'Only you can see this until you propose it.';
  if (trade.status === 'completed') return 'Complete';
  if (trade.status === 'cancelled' || trade.status === 'declined') return 'Cancelled';
  if (trade.yourTurn && trade.theyFinalized) return 'They finalized. Your turn to answer.';
  if (trade.yourTurn) return 'Your turn';
  if (trade.youFinalized) return 'You finalized. Waiting on them.';
  return 'Waiting on them';
}
