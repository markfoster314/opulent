import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { Card, CardSet } from '@opulent/shared';
import { formatUsd, priceForFinish } from '@opulent/shared';
import { useState } from 'react';
import { flattenPages, useCardPrintings, useCardSets } from '../api/queries';
import { useDebounced } from '../hooks/useDebounced';
import { palette } from '../theme';

interface PrintingPickerProps {
  oracleId: string;
  selectedId: string;
  onSelect: (printing: Card) => void;
}

/**
 * Lets the owner say which printing of a card they actually hold.
 *
 * It matters for trading: two Sol Rings can be a dollar or forty dollars apart
 * depending on the set, so "a Sol Ring" is not a tradeable description.
 */
export function PrintingPicker({ oracleId, selectedId, onSelect }: PrintingPickerProps) {
  const [setFilter, setSetFilter] = useState('');
  const debouncedFilter = useDebounced(setFilter);
  const query = useCardPrintings(oracleId, debouncedFilter);
  const setsQuery = useCardSets(oracleId);

  const printings = flattenPages(query.data?.pages);

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
      >
        <Typography variant="h3">Choose a set</Typography>
        <SetFilter
          sets={setsQuery.data?.items ?? []}
          loading={setsQuery.isFetching}
          value={setFilter}
          onChange={setSetFilter}
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
          alignItems: 'stretch',
        }}
      >
        {printings.map((printing) => (
          <PrintingTile
            key={printing.scryfallId}
            printing={printing}
            selected={printing.scryfallId === selectedId}
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
  onSelect: () => void;
}

/**
 * One printing: the card image, then the set it came from and its number in that
 * set, which together are how players identify a printing.
 *
 * The Scryfall terms forbid cropping, stretching, recolouring or watermarking
 * card images, so the image is only ever scaled proportionally.
 */
function PrintingTile({ printing, selected, onSelect }: PrintingTileProps) {
  const image = printing.imageUris?.normal ?? printing.imageUris?.small;
  const nonfoil = printing.finishes.includes('nonfoil')
    ? formatUsd(priceForFinish(printing.prices, 'nonfoil'))
    : null;
  const foil = printing.finishes.includes('foil')
    ? formatUsd(priceForFinish(printing.prices, 'foil'))
    : null;
  const etched = printing.finishes.includes('etched')
    ? formatUsd(priceForFinish(printing.prices, 'etched'))
    : null;

  const prices = [
    nonfoil ? `Nonfoil ${nonfoil}` : null,
    foil ? `Foil ${foil}` : null,
    etched ? `Etched ${etched}` : null,
  ].filter((line) => line !== null);

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
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
      <Box
        sx={{
          flexShrink: 0,
          aspectRatio: '488 / 680',
          borderRadius: 1.5,
          overflow: 'hidden',
        }}
      >
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
        <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {printing.setName ?? printing.setCode.toUpperCase()}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          #{printing.collectorNumber}
          {printing.lang !== 'en' ? ` · ${printing.lang.toUpperCase()}` : ''}
        </Typography>
        {prices.map((line) => (
          <Typography key={line} variant="caption" color="text.secondary">
            {line}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

function setLabel(set: CardSet): string {
  return set.setName ?? set.setCode.toUpperCase();
}

/**
 * A text box whose list is this card's sets, narrowed by what is typed.
 *
 * Matching covers the set name and the short code, so "MH3" finds Modern
 * Horizons 3. Choosing a row fills the box with that set's name, which is
 * what the tiles below then filter on.
 */
function SetFilter({
  sets,
  loading,
  value,
  onChange,
}: {
  sets: CardSet[];
  loading: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Autocomplete<CardSet, false, false, true>
      freeSolo
      openOnFocus
      size="small"
      options={sets}
      inputValue={value}
      loading={loading}
      getOptionLabel={(option) => (typeof option === 'string' ? option : setLabel(option))}
      isOptionEqualToValue={(a, b) => a.setCode === b.setCode && a.setName === b.setName}
      filterOptions={(options, state) => {
        const term = state.inputValue.trim().toLowerCase();
        return options.filter((set) => {
          const name = (set.setName ?? '').toLowerCase();
          const code = set.setCode.toLowerCase();
          return term.length === 0 || name.includes(term) || code.includes(term);
        });
      }}
      onInputChange={(_, next) => onChange(next)}
      noOptionsText={value.trim().length === 0 ? 'No sets for this card' : 'No sets match'}
      renderOption={(props, set) => (
        <Box component="li" {...props} key={`${set.setCode}-${set.setName ?? ''}`}>
          <Typography variant="body2">
            {setLabel(set)}
            {set.setName ? ` (${set.setCode.toUpperCase()})` : ''}
          </Typography>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Filter by set"
          placeholder="Modern Horizons, or MH3"
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
      sx={{ width: { xs: '100%', sm: 280 } }}
    />
  );
}
