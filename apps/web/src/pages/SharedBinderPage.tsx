import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { BinderItem, TradeMatch } from '@opulent/shared';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  flattenPages,
  useBinderItems,
  useBinderMatches,
  useOpenTrade,
  useProfile,
  useSharedBinder,
} from '../api/queries';
import { emptyBinderSearch, binderSearchIsActive, type BinderSearch } from '../binderSearch';
import { BinderCardDialog } from '../components/BinderCardDialog';
import { BinderSearchFields } from '../components/BinderSearchFields';
import { CardGrid } from '../components/CardGrid';
import { binderTileCaption, binderTilePrice, CardTile } from '../components/CardTile';
import { palette } from '../theme';

export function SharedBinderPage() {
  const { handle, slug } = useParams<{ handle: string; slug: string }>();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const openTrade = useOpenTrade();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<BinderItem | null>(null);
  const [search, setSearch] = useState<BinderSearch>(emptyBinderSearch);

  // Unlisted binders are reachable only with ?t=<share token>.
  const shareToken = searchParams.get('t') ?? undefined;

  const binderQuery = useSharedBinder(handle, slug, shareToken);
  const binderId = binderQuery.data?.id;
  const profile = useProfile(isAuthenticated ? handle : undefined);
  const wantListReady = Boolean(isAuthenticated && profile.data && !profile.data.isOwner);
  const itemSearch = { ...search, onWantList: wantListReady && search.onWantList };

  const itemsQuery = useBinderItems(binderId, shareToken, itemSearch);
  const matchesQuery = useBinderMatches(binderId, isAuthenticated);

  if (binderQuery.isLoading) return <CircularProgress />;
  if (binderQuery.error) return <Alert severity="error">{binderQuery.error.message}</Alert>;

  const matches = matchesQuery.data?.items ?? [];
  const ownBinder = profile.data?.isOwner === true;
  const canTrade = Boolean(isAuthenticated && profile.data && !ownBinder && matches.length > 0);
  const canAddCard = Boolean(handle) && (!isAuthenticated || (profile.isSuccess && !ownBinder));

  function toggleCard(scryfallId: string, max: number) {
    setPicked((current) => {
      const next = { ...current };
      if (next[scryfallId] !== undefined) delete next[scryfallId];
      else next[scryfallId] = Math.min(1, max);
      return next;
    });
  }

  const readyItems = matches.flatMap((match) => {
    const printing = bestPrinting(match);
    if (!printing) return [];
    const quantity = picked[printing.scryfallId];
    if (
      quantity === undefined ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > printing.quantity
    ) {
      return [];
    }
    return [{ scryfallId: printing.scryfallId, quantity }];
  });

  function sendTrade() {
    if (!handle || readyItems.length === 0) return;
    openTrade.mutate(
      { username: handle, items: readyItems },
      { onSuccess: (trade) => navigate(`/trades/${trade.id}`) },
    );
  }

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h1">{binderQuery.data?.name}</Typography>
        <Typography color="secondary">Shared by @{handle}</Typography>
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
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h3">
                {matches.length} match{matches.length === 1 ? '' : 'es'} for your want list
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cards you are hunting that this binder is holding for trade.
              </Typography>
            </Box>
            {canTrade && (
              <Button
                variant="contained"
                onClick={() => setPicking((open) => !open)}
                sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
              >
                {picking ? 'Close' : 'Start a draft'}
              </Button>
            )}
          </Stack>
          {!picking && (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {matches.map((match) => (
                <Chip
                  key={match.wantId}
                  color="primary"
                  variant="outlined"
                  label={`${match.cardName} · ${match.availableQuantity} available`}
                />
              ))}
            </Stack>
          )}
          {picking && (
            <Stack spacing={1.5}>
              {matches.map((match) => {
                const printing = bestPrinting(match);
                if (!printing) return null;
                const max = printing.quantity;
                const selected = picked[printing.scryfallId];
                return (
                  <Stack
                    key={match.wantId}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                    justifyContent="space-between"
                  >
                    <FormControlLabel
                      sx={{ minWidth: 0, alignItems: 'flex-start', mr: 0 }}
                      control={
                        <Checkbox
                          checked={selected !== undefined}
                          onChange={() => toggleCard(printing.scryfallId, max)}
                        />
                      }
                      label={
                        <Typography sx={{ overflowWrap: 'anywhere' }}>
                          {match.cardName} · {max} of this printing
                        </Typography>
                      }
                    />
                    {selected !== undefined && (
                      <TextField
                        label="Quantity"
                        type="number"
                        size="small"
                        value={selected}
                        onChange={(event) =>
                          setPicked((current) => ({
                            ...current,
                            [printing.scryfallId]: Number(event.target.value),
                          }))
                        }
                        slotProps={{ htmlInput: { min: 1, max } }}
                        error={selected < 1 || selected > max}
                        sx={{ width: { xs: '100%', sm: 120 }, flexShrink: 0 }}
                      />
                    )}
                  </Stack>
                );
              })}
              {openTrade.error && <Alert severity="error">{openTrade.error.message}</Alert>}
              <Button
                variant="contained"
                onClick={sendTrade}
                disabled={openTrade.isPending || readyItems.length === 0}
                sx={{ width: { xs: '100%', sm: 'auto' }, alignSelf: { sm: 'flex-start' } }}
              >
                Save draft
              </Button>
            </Stack>
          )}
        </Paper>
      )}

      {isAuthenticated && matchesQuery.isSuccess && matches.length === 0 && (
        <Alert severity="info">No overlap with your want list yet.</Alert>
      )}

      {canAddCard && (
        <Alert severity="info">
          Click a card to see its details. Cards marked for trade can be added from there.
        </Alert>
      )}

      <Divider />

      <BinderSearchFields value={search} onChange={setSearch} canUseWantList={wantListReady} />

      {itemsQuery.isLoading && <CircularProgress />}
      {itemsQuery.isFetching && !itemsQuery.isFetchingNextPage && itemsQuery.isPlaceholderData && (
        <Typography color="text.secondary">Updating the list.</Typography>
      )}
      {itemsQuery.error && <Alert severity="error">{itemsQuery.error.message}</Alert>}
      {itemsQuery.isSuccess &&
        !itemsQuery.isPlaceholderData &&
        flattenPages(itemsQuery.data?.pages).length === 0 && (
          <Alert severity="info">
            {binderSearchIsActive(itemSearch)
              ? 'No cards match this search.'
              : 'No cards here yet.'}
          </Alert>
        )}

      <CardGrid>
        {flattenPages(itemsQuery.data?.pages).map((item) =>
          item.card ? (
            <CardTile
              key={item.id}
              card={item.card}
              quantity={item.quantity}
              price={binderTilePrice(item)}
              notes={item.notes?.trim() ? item.notes : null}
              signed={item.signed}
              altered={item.altered}
              misprint={item.misprint}
              miscut={item.miscut}
              artistProof={item.artistProof}
              photoUrl={item.photoUrl}
              caption={binderTileCaption(item)}
              foil={item.finish === 'foil'}
              onClick={canAddCard ? () => setSelected(item) : undefined}
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

      <BinderCardDialog
        key={selected?.id ?? 'closed'}
        item={selected}
        ownerUsername={canAddCard ? handle : undefined}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </Stack>
  );
}

function bestPrinting(match: TradeMatch) {
  return [...match.printings].sort((a, b) => b.quantity - a.quantity)[0];
}
