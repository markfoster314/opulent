import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import type { Card, CardFinish } from '@opulent/shared';
import { formatUsd, priceForFinish } from '@opulent/shared';
import { useState } from 'react';
import { flattenPages, useCardPrintings } from '../api/queries';
import { useDebounced } from '../hooks/useDebounced';
import { palette } from '../theme';

interface PrintingPickerProps {
  oracleId: string;
  selectedId: string;
  /** Prices shown per tile follow the finish chosen in the form. */
  finish: CardFinish;
  onSelect: (printing: Card) => void;
}

/**
 * Lets the owner say which printing of a card they actually hold.
 *
 * It matters for trading: two Sol Rings can be a dollar or forty dollars apart
 * depending on the set, so "a Sol Ring" is not a tradeable description.
 */
export function PrintingPicker({ oracleId, selectedId, finish, onSelect }: PrintingPickerProps) {
  const [setFilter, setSetFilter] = useState('');
  const debouncedFilter = useDebounced(setFilter);
  const query = useCardPrintings(oracleId, debouncedFilter);

  const printings = flattenPages(query.data?.pages);

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
      >
        <Typography variant="h3">Choose a printing</Typography>
        <TextField
          size="small"
          label="Filter by set"
          placeholder="Modern Horizons, or MH3"
          value={setFilter}
          onChange={(event) => setSetFilter(event.target.value)}
          sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 240 } }}
        />
      </Stack>

      {query.isLoading && <CircularProgress size={24} />}
      {query.error && <Alert severity="error">{query.error.message}</Alert>}

      {query.isSuccess && printings.length === 0 && (
        <Alert severity="info">No printing matches that set.</Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: 'repeat(auto-fill, minmax(124px, 1fr))',
        }}
      >
        {printings.map((printing) => (
          <PrintingTile
            key={printing.scryfallId}
            printing={printing}
            selected={printing.scryfallId === selectedId}
            finish={finish}
            onSelect={() => onSelect(printing)}
          />
        ))}
      </Box>

      {query.hasNextPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Show more printings'}
          </Button>
        </Box>
      )}
    </Stack>
  );
}

interface PrintingTileProps {
  printing: Card;
  selected: boolean;
  finish: CardFinish;
  onSelect: () => void;
}

/**
 * One printing: the card image, then the set it came from and its number in that
 * set, which together are how players identify a printing.
 *
 * The Scryfall terms forbid cropping, stretching, recolouring or watermarking
 * card images, so the image is only ever scaled proportionally.
 */
function PrintingTile({ printing, selected, finish, onSelect }: PrintingTileProps) {
  const image = printing.imageUris?.normal ?? printing.imageUris?.small;
  // Falls back to the plain price so a tile is not blank just because the chosen
  // finish does not exist for this printing.
  const price =
    formatUsd(priceForFinish(printing.prices, finish)) ?? formatUsd(printing.prices?.usd);

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        p: 1,
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
        borderRadius: 2.5,
        backgroundColor: selected ? palette.goldSelected : palette.surface,
        border: `1px solid ${selected ? palette.goldLight : palette.divider}`,
        transition: 'border-color 120ms ease, transform 120ms ease',
        '&:hover': { borderColor: palette.goldLight, transform: 'translateY(-2px)' },
      }}
    >
      <Box sx={{ aspectRatio: '488 / 680', borderRadius: 1.5, overflow: 'hidden' }}>
        {image ? (
          <Box
            component="img"
            src={image}
            alt={`${printing.name} (${printing.setCode.toUpperCase()})`}
            loading="lazy"
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

      <Stack sx={{ pt: 1 }}>
        <Typography
          variant="caption"
          // Clamped to two lines so a long set name cannot make one tile taller
          // than its neighbours.
          sx={{
            fontWeight: 600,
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
          }}
          title={printing.setName ?? printing.setCode.toUpperCase()}
        >
          {printing.setName ?? printing.setCode.toUpperCase()}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          #{printing.collectorNumber}
          {printing.lang !== 'en' ? ` · ${printing.lang.toUpperCase()}` : ''}
          {price ? ` · ${price}` : ''}
        </Typography>
      </Stack>
    </Box>
  );
}
