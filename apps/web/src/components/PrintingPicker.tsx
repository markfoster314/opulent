import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import type { Card, CardSet } from '@opulent/shared';
import { formatUsd, priceForFinish } from '@opulent/shared';
import { useEffect, useState } from 'react';
import { useCardPrintings, useCardSets } from '../api/queries';
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
 * depending on the set, so "a Sol Ring" is not a tradeable description. The grid
 * holds two rows, and the arrows page through the rest.
 */
export function PrintingPicker({ oracleId, selectedId, onSelect }: PrintingPickerProps) {
  const [setFilter, setSetFilter] = useState('');
  const debouncedFilter = useDebounced(setFilter);

  // Columns drive the page size, so every page fills exactly two rows.
  const isMd = useMediaQuery('(min-width:900px)');
  const isLg = useMediaQuery('(min-width:1200px)');
  const columns = isLg ? 5 : isMd ? 4 : 3;
  const limit = columns * 2;

  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const query = useCardPrintings(oracleId, debouncedFilter, limit, cursors[pageIndex] ?? null);
  const setsQuery = useCardSets(oracleId);

  const printings = query.data?.items ?? [];

  // A new card or a new column count starts at the first page.
  useEffect(() => {
    setPageIndex(0);
    setCursors([null]);
  }, [oracleId, limit]);

  function changeFilter(value: string) {
    setSetFilter(value);
    setPageIndex(0);
    setCursors([null]);
  }

  function goNext() {
    const next = query.data?.nextCursor;
    if (!next) return;
    setCursors((current) => {
      const nextCursors = [...current];
      nextCursors[pageIndex + 1] = next;
      return nextCursors;
    });
    setPageIndex((index) => index + 1);
  }

  const hasPagination = pageIndex > 0 || Boolean(query.data?.nextCursor);
  // Fill the last page's empty cells so it keeps the height of a full page.
  const placeholders =
    hasPagination && printings.length > 0 && printings.length < limit
      ? limit - printings.length
      : 0;

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
          onChange={changeFilter}
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
          gridTemplateColumns: {
            xs: 'repeat(3, minmax(0, 1fr))',
            sm: 'repeat(3, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
            lg: 'repeat(5, minmax(0, 1fr))',
          },
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
        {Array.from({ length: placeholders }, (_, index) => (
          <PrintingTilePlaceholder key={`empty-${index}`} />
        ))}
      </Box>

      {hasPagination && (
        <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
          <Button
            size="small"
            variant="outlined"
            onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
            disabled={pageIndex === 0 || query.isFetching}
          >
            Previous
          </Button>
          <Typography variant="caption" color="text.secondary">
            Page {pageIndex + 1}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={goNext}
            disabled={!query.data?.nextCursor || query.isFetching}
          >
            Next
          </Button>
        </Stack>
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
 * One printing: the card image, then its set code and collector number.
 *
 * The image runs to the tile edges. Hovering shows the same large preview the
 * collection tables use, portalled so the grid cannot clip it. Scryfall terms
 * forbid cropping, so the image is only ever scaled.
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
  const iconColor = rarityIconColor(printing.rarity, printing.typeLine);
  const iconUrl = `https://svgs.scryfall.io/sets/${printing.setCode.toLowerCase()}.svg`;

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
        p: 0,
        overflow: 'hidden',
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
        borderRadius: 2,
        backgroundColor: selected ? palette.goldSelected : palette.surface,
        border: `1px solid ${selected ? palette.goldLight : palette.divider}`,
        transition: 'border-color 120ms ease, transform 120ms ease',
        '&:hover': { borderColor: palette.goldLight, transform: 'translateY(-2px)' },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '488 / 680',
          flexShrink: 0,
          overflow: 'hidden',
          backgroundColor: palette.surfaceRaised,
        }}
      >
        {image ? (
          <Box
            component="img"
            src={image}
            alt={`${printing.name} (${printing.setCode.toUpperCase()} #${printing.collectorNumber})`}
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

        <Box
          sx={{
            position: 'absolute',
            right: 6,
            bottom: 6,
            display: 'grid',
            gap: 0.5,
            gridTemplateColumns: 'max-content',
            pointerEvents: 'none',
          }}
        >
          {nonfoil && <PricePill price={nonfoil} />}
          {foil && <PricePill label="F" price={foil} />}
          {etched && <PricePill label="EF" price={etched} />}
        </Box>
      </Box>

      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        justifyContent="center"
        sx={{ p: 0.75, minWidth: 0, overflow: 'hidden' }}
      >
        {/* The set symbol is a mask, so its colour follows the card rarity. */}
        <Box
          aria-hidden
          sx={{
            width: 12,
            height: 12,
            flexShrink: 0,
            backgroundColor: iconColor,
            maskImage: `url("${iconUrl}")`,
            WebkitMaskImage: `url("${iconUrl}")`,
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
          }}
        />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            fontSize: 12,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            lineHeight: 1.3,
          }}
        >
          {printing.setCode.toUpperCase()}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: palette.textSecondary,
            fontSize: 10.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.3,
          }}
        >
          #{printing.collectorNumber}
          {printing.lang !== 'en' ? ` · ${printing.lang.toUpperCase()}` : ''}
        </Typography>
      </Stack>
    </Box>
  );
}

/**
 * Scryfall set symbols are black, so the colour comes from the card's rarity.
 * Lands count as common. White wins on the dark tile over the offered black.
 */
function rarityIconColor(rarity: string | null, typeLine: string | null): string {
  if (typeLine?.toLowerCase().includes('land')) return '#FFFFFF';
  if (rarity === 'uncommon') return '#B9DCED';
  if (rarity === 'rare') return '#E6CD8C';
  if (rarity === 'mythic' || rarity === 'mythic rare') return '#F59105';
  return '#FFFFFF';
}

/** A small price chip over the card image: coloured dot, optional finish letter, price. */
function PricePill({ label, price }: { label?: string; price: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.375,
        borderRadius: 99,
        backgroundColor: 'rgba(11, 11, 12, 0.62)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {label && (
        <Typography
          sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1, color: palette.textSecondary }}
        >
          {label}
        </Typography>
      )}
      <Typography
        sx={{
          ml: 'auto',
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1,
          color: palette.textSecondary,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {price}
      </Typography>
    </Box>
  );
}

/** An invisible tile that holds the height of a missing card in the last row. */
function PrintingTilePlaceholder() {
  return (
    <Box
      aria-hidden
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
        height: '100%',
        visibility: 'hidden',
        overflow: 'hidden',
        borderRadius: 2,
        border: '1px solid transparent',
        pointerEvents: 'none',
      }}
    >
      <Box sx={{ width: '100%', aspectRatio: '488 / 680', flexShrink: 0 }} />
      <Typography
        variant="caption"
        sx={{ p: 0.75, fontWeight: 600, fontSize: 12, lineHeight: 1.3 }}
      >
        &nbsp;
      </Typography>
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
