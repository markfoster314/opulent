import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useParams, useSearchParams } from 'react-router-dom';
import { flattenPages, useBinderItems, useBinderMatches, useSharedBinder } from '../api/queries';
import { CardGrid } from '../components/CardGrid';
import { CardTile } from '../components/CardTile';
import { palette } from '../theme';

export function SharedBinderPage() {
  const { handle, slug } = useParams<{ handle: string; slug: string }>();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth0();

  // Unlisted binders are reachable only with ?t=<share token>.
  const shareToken = searchParams.get('t') ?? undefined;

  const binderQuery = useSharedBinder(handle, slug, shareToken);
  const binderId = binderQuery.data?.id;

  const itemsQuery = useBinderItems(binderId, shareToken);
  const matchesQuery = useBinderMatches(binderId, isAuthenticated);

  if (binderQuery.isLoading) return <CircularProgress />;
  if (binderQuery.error) return <Alert severity="error">{binderQuery.error.message}</Alert>;

  const matches = matchesQuery.data?.items ?? [];

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h1">{binderQuery.data?.name}</Typography>
        <Typography color="text.secondary">
          Shared by{' '}
          <Box component="span" sx={{ color: palette.gold }}>
            @{handle}
          </Box>
        </Typography>
        {binderQuery.data?.description && (
          <Typography color="text.secondary">{binderQuery.data.description}</Typography>
        )}
      </Stack>

      {!isAuthenticated && (
        <Alert severity="info">
          Sign in and add cards to your want list to see which of these are matches for you.
        </Alert>
      )}

      {isAuthenticated && matches.length > 0 && (
        <Paper sx={{ p: 3, borderColor: palette.gold }}>
          <Typography variant="h3" sx={{ mb: 0.5 }}>
            {matches.length} match{matches.length === 1 ? '' : 'es'} for your want list
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cards you are hunting that this binder is holding for trade.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {matches.map((match) => (
              <Chip
                key={match.oracleId}
                color="primary"
                variant="outlined"
                label={`${match.cardName} · ${match.availableQuantity} available`}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {isAuthenticated && matchesQuery.isSuccess && matches.length === 0 && (
        <Alert severity="info">No overlap with your want list yet.</Alert>
      )}

      <Divider />

      {itemsQuery.isLoading && <CircularProgress />}
      {itemsQuery.error && <Alert severity="error">{itemsQuery.error.message}</Alert>}

      <CardGrid>
        {flattenPages(itemsQuery.data?.pages).map((item) =>
          item.card ? (
            <CardTile
              key={item.id}
              card={item.card}
              quantity={item.quantity}
              caption={`${item.card.setCode.toUpperCase()} · ${item.finish} · ${item.condition}`}
            />
          ) : null,
        )}
      </CardGrid>

      {itemsQuery.hasNextPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            onClick={() => void itemsQuery.fetchNextPage()}
            disabled={itemsQuery.isFetchingNextPage}
          >
            {itemsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}
    </Stack>
  );
}
