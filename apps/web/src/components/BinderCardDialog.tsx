import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { CollectionItem } from '@opulent/shared';
import { cardConditionLabels, cardFinishLabels, cardLanguageLabels } from '@opulent/shared';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useCard, useOpenTrade, useTrades } from '../api/queries';
import { collectionTilePrice } from './CardTile';

const closedTrade = new Set(['completed', 'cancelled', 'declined']);

export function BinderCardDialog({
  item,
  ownerUsername,
  open,
  onClose,
}: {
  item: CollectionItem | null;
  /** Set when this copy belongs to someone else. The trade prompt uses this name. */
  ownerUsername?: string | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const cardQuery = useCard(open ? item?.scryfallId : undefined);
  const trades = useTrades(
    open && isAuthenticated && Boolean(ownerUsername) && Boolean(item?.forTrade),
  );
  const openTrade = useOpenTrade();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState<{ id: string; status: string } | null>(null);

  if (!item?.card) return null;

  const card = cardQuery.data ?? item.card;
  const image = card.imageUris?.large ?? card.imageUris?.normal ?? card.imageUris?.small;
  const max = item.quantity;
  const quantityOk = Number.isInteger(quantity) && quantity >= 1 && quantity <= max;
  const withThem = (trades.data?.items ?? []).filter(
    (trade) =>
      ownerUsername !== undefined &&
      trade.partnerUsername.toLowerCase() === ownerUsername.toLowerCase() &&
      !closedTrade.has(trade.status),
  );
  const existing = withThem.find((trade) => trade.status !== 'draft') ?? withThem[0];
  const marks = [
    item.signed ? 'Signed' : '',
    item.altered ? 'Altered' : '',
    item.misprint ? 'Misprint' : '',
    item.miscut ? 'Miscut' : '',
    item.artistProof ? 'Artist proof' : '',
  ].filter((mark) => mark !== '');
  const price = collectionTilePrice(item);
  const facts = [
    fact(
      'Set',
      card.setName
        ? `${card.setName} (${card.setCode.toUpperCase()}) #${card.collectorNumber}`
        : `${card.setCode.toUpperCase()} #${card.collectorNumber}`,
    ),
    fact('Rarity', card.rarity),
    fact('Type', card.typeLine),
    fact('Mana cost', card.manaCost),
    fact('Released', card.releasedAt),
    fact('Finish', cardFinishLabels[item.finish]),
    fact('Condition', cardConditionLabels[item.condition]),
    fact('Language', cardLanguageLabels[item.language]),
    fact('Quantity', String(item.quantity)),
    fact('Price', price),
    fact('Trade', item.forTrade ? 'Marked for trade' : 'Not for trade'),
    fact('Marks', marks.length > 0 ? marks.join(', ') : null),
    fact('Notes', item.notes?.trim() ? item.notes : null),
  ].filter((row) => row.value !== null);

  function close() {
    setQuantity(1);
    setAdded(null);
    onClose();
  }

  function addToTrade() {
    if (!ownerUsername || !quantityOk || !item) return;
    openTrade.mutate(
      { username: ownerUsername, items: [{ scryfallId: item.scryfallId, quantity }] },
      { onSuccess: (trade) => setAdded({ id: trade.id, status: trade.status }) },
    );
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle sx={{ overflowWrap: 'anywhere' }}>{card.name}</DialogTitle>
      <DialogContent>
        <Stack
          spacing={2}
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'flex-start' }}
        >
          <Box
            sx={{
              width: { xs: '100%', sm: 220 },
              maxWidth: 280,
              mx: { xs: 'auto', sm: 0 },
              flexShrink: 0,
            }}
          >
            {image ? (
              <Box
                component="img"
                src={image}
                alt={card.name}
                sx={{ width: '100%', height: 'auto', display: 'block', borderRadius: 1 }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No image
              </Typography>
            )}
          </Box>
          <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
            {cardQuery.isLoading && <CircularProgress size={18} />}
            {facts.map((row) => (
              <Typography key={row.label} sx={{ overflowWrap: 'anywhere' }}>
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  {row.label}:{' '}
                </Box>
                {row.value}
              </Typography>
            ))}
            {item.photoUrl && (
              <Link
                href={item.photoUrl}
                target="_blank"
                rel="noreferrer"
                sx={{ overflowWrap: 'anywhere' }}
              >
                Photos of this copy
              </Link>
            )}
          </Stack>
        </Stack>

        {ownerUsername && item.forTrade && (
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {added ? (
              <Alert severity="success">
                {added.status === 'draft'
                  ? `Saved in a draft with @${ownerUsername}. They see it after you propose the trade.`
                  : `Added to your trade with @${ownerUsername}.`}
              </Alert>
            ) : (
              <Typography color="text.secondary">
                {!isAuthenticated
                  ? `Sign in to trade this card with @${ownerUsername}.`
                  : trades.isLoading
                    ? 'Checking for an open trade.'
                    : existing?.status === 'draft'
                      ? `This card goes in your draft with @${ownerUsername}. They cannot see it until you propose.`
                      : existing
                        ? `You already have a trade with @${ownerUsername}. Add this card to it.`
                        : `This starts a draft with @${ownerUsername}. They cannot see it until you propose.`}
              </Typography>
            )}
            {openTrade.error && <Alert severity="error">{openTrade.error.message}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
        <Button
          variant="outlined"
          color="secondary"
          onClick={close}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Close
        </Button>
        {ownerUsername && item.forTrade && added && (
          <Button
            variant="contained"
            component={RouterLink}
            to={`/trades/${added.id}`}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Open the trade
          </Button>
        )}
        {ownerUsername && item.forTrade && !added && !isAuthenticated && (
          <Button
            variant="contained"
            onClick={() => void loginWithRedirect()}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Sign in to trade
          </Button>
        )}
        {ownerUsername && item.forTrade && !added && isAuthenticated && (
          <>
            <TextField
              label="Quantity"
              type="number"
              size="small"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              error={!quantityOk}
              slotProps={{ htmlInput: { min: 1, max } }}
              sx={{ width: { xs: '100%', sm: 120 } }}
            />
            <Button
              variant="contained"
              onClick={addToTrade}
              disabled={!quantityOk || openTrade.isPending || trades.isLoading}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {trades.isLoading
                ? 'Checking trades'
                : existing?.status === 'draft'
                  ? 'Add to draft'
                  : existing
                    ? 'Add to trade'
                    : 'Start a draft'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

function fact(
  label: string,
  value: string | null | undefined,
): { label: string; value: string | null } {
  const trimmed = value?.trim() ?? '';
  return { label, value: trimmed === '' ? null : trimmed };
}
