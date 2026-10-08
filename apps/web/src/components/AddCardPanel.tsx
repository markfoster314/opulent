import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { AddBinderItemInput, Card } from '@opulent/shared';
import { formatUsd, priceForFinish } from '@opulent/shared';
import { useState } from 'react';
import { palette } from '../theme';
import type { CardDetails } from './CardDetailsFields';
import { CardDetailsFields, defaultFinish, isQuantityInvalid } from './CardDetailsFields';
import { PrintingPicker } from './PrintingPicker';

interface AddCardPanelProps {
  /**
   * The card chosen from search. Card search collapses to one row per card
   * concept, so this is the newest printing and acts as the starting selection.
   */
  card: Card;
  onAdd: (input: AddBinderItemInput) => void;
  onCancel: () => void;
  pending: boolean;
  error?: string | undefined;
}

/**
 * The step between finding a card and it landing in the binder.
 *
 * It exists because the two things that decide what a card is worth, the
 * printing and the finish, cannot be guessed from a name. Adding straight from
 * search would silently file every card as the newest non-foil printing.
 *
 * Mount this with `key={card.oracleId}` so picking a different card from search
 * gives a fresh panel rather than carrying the previous card's choices over.
 */
export function AddCardPanel({ card, onAdd, onCancel, pending, error }: AddCardPanelProps) {
  const [printing, setPrinting] = useState<Card>(card);
  const [details, setDetails] = useState<CardDetails>({
    quantity: '1',
    finish: defaultFinish(card.finishes),
    condition: 'NM',
    notes: '',
    forTrade: true,
  });

  /**
   * Switching printing can invalidate the finish, because a Secret Lair drop may
   * be foil only while the set it replaced was never foiled at all. Correcting
   * it here rather than in an effect avoids a render that claims the owner holds
   * a finish that was never printed.
   */
  function handleSelectPrinting(next: Card) {
    setPrinting(next);
    if (!next.finishes.includes(details.finish)) {
      setDetails((current) => ({ ...current, finish: defaultFinish(next.finishes) }));
    }
  }

  const quantityError = isQuantityInvalid(details.quantity);
  const quantity = Number(details.quantity);

  const unitPrice = priceForFinish(printing.prices, details.finish);
  const formattedUnitPrice = formatUsd(unitPrice);
  const lineTotal =
    unitPrice && !quantityError && quantity > 1
      ? formatUsd(String(Number(unitPrice) * quantity))
      : null;

  function handleAdd() {
    if (quantityError) return;
    onAdd({
      scryfallId: printing.scryfallId,
      quantity,
      finish: details.finish,
      condition: details.condition,
      language: printing.lang,
      forTrade: details.forTrade,
      ...(details.notes.trim() ? { notes: details.notes.trim() } : {}),
    });
  }

  const image = printing.imageUris?.normal ?? printing.imageUris?.large;

  return (
    <Paper sx={{ p: 3, borderColor: palette.goldLight }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="h3" sx={{ overflowWrap: 'anywhere' }}>
            {card.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {printing.setName ?? printing.setCode.toUpperCase()} · #{printing.collectorNumber}
            {printing.rarity ? ` · ${printing.rarity}` : ''}
          </Typography>
        </Stack>
        <IconButton onClick={onCancel} aria-label="Cancel adding this card" size="small">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(180px, 240px) 1fr' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={1.5}>
          <Box sx={{ aspectRatio: '488 / 680', borderRadius: 2, overflow: 'hidden' }}>
            {image ? (
              <Box
                component="img"
                src={image}
                alt={card.name}
                sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  No image
                </Typography>
              </Stack>
            )}
          </Box>

          <Box>
            {formattedUnitPrice ? (
              <>
                <Typography variant="h3">{formattedUnitPrice}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {lineTotal
                    ? `each · ${quantity} copies about ${lineTotal}`
                    : 'market estimate, each'}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No price recorded for this finish.
              </Typography>
            )}
          </Box>

          {printing.scryfallUri && (
            <Link
              href={printing.scryfallUri}
              target="_blank"
              rel="noreferrer"
              variant="caption"
              color="text.secondary"
            >
              View on Scryfall
            </Link>
          )}
        </Stack>

        <Stack spacing={3}>
          <CardDetailsFields
            value={details}
            onChange={(patch) => setDetails((current) => ({ ...current, ...patch }))}
            finishOptions={printing.finishes}
            prices={printing.prices}
            stackNote="Each finish and condition is kept as its own stack, so you can list a foil and a beaten-up copy separately."
          />

          {error && <Alert severity="error">{error}</Alert>}

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              justifyContent: { sm: 'flex-end' },
              '& .MuiButton-root': { width: { xs: '100%', sm: 'auto' } },
            }}
          >
            <Button onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleAdd} disabled={quantityError || pending}>
              {pending ? 'Adding…' : 'Add to binder'}
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Divider sx={{ my: 3 }} />

      <PrintingPicker
        oracleId={card.oracleId}
        selectedId={printing.scryfallId}
        finish={details.finish}
        onSelect={handleSelectPrinting}
      />
    </Paper>
  );
}
