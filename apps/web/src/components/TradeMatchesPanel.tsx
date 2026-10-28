import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { TradeMatch } from '@opulent/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpenTrade } from '../api/queries';
import { palette } from '../theme';

interface TradeMatchesPanelProps {
  /** The person whose cards these are. A draft trade goes to them. */
  handle: string;
  matches: TradeMatch[];
  /** False while we do not yet know the viewer is someone else, or the list is empty. */
  canTrade: boolean;
  sourceLabel: string;
}

export function TradeMatchesPanel({
  handle,
  matches,
  canTrade,
  sourceLabel,
}: TradeMatchesPanelProps) {
  const navigate = useNavigate();
  const openTrade = useOpenTrade();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Record<string, number>>({});

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
    if (readyItems.length === 0) return;
    openTrade.mutate(
      { username: handle, items: readyItems },
      {
        onSuccess: (trade) => {
          void navigate(`/trades/${trade.id}`);
        },
      },
    );
  }

  return (
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
            Cards you are hunting that {sourceLabel} is holding for trade.
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
  );
}

function bestPrinting(match: TradeMatch) {
  return [...match.printings].sort((a, b) => b.quantity - a.quantity)[0];
}
