import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { CollectionHighlight, PriceRange, SortDirection } from '@opulent/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollectionMovers } from '../api/queries';
import { ChangeControls } from './ChangeControls';
import { CollectionCardTable } from './CollectionCardTable';

const MOVERS_PER_TABLE = 5;

/** Five 64 px rows, four dividers, and the table border. Keeps the section still. */
const MOVERS_MIN_HEIGHT = MOVERS_PER_TABLE * 64 + 8;

/**
 * The dashboard's second section: the biggest gains and the biggest drops.
 *
 * Each table is a fixed view, so its header is a caption. The two View all
 * buttons carry the window and format to the card list, plus the direction that
 * matches the table they came from.
 */
export function TopMovers({ enabled }: { enabled: boolean }) {
  const [range, setRange] = useState<PriceRange>('1w');
  const [changeMode, setChangeMode] = useState<'amount' | 'percent'>('amount');
  const navigate = useNavigate();
  const { data, isLoading, isFetching, error } = useCollectionMovers(enabled, range, changeMode);

  function openList(dir: SortDirection, cardId?: string) {
    navigate('/collection/cards', {
      state: {
        sort: 'change',
        dir,
        range,
        changeMode,
        ...(cardId ? { cardId } : {}),
      },
    });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h2">Top movers</Typography>

      <ChangeControls
        range={range}
        changeMode={changeMode}
        onRange={setRange}
        onMode={setChangeMode}
      />

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{error.message}</Alert>}

      {data && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          }}
        >
          <MoverTable
            title="Biggest increases"
            empty="No cards went up in this window."
            items={data.gainers.slice(0, MOVERS_PER_TABLE)}
            dir="desc"
            changeMode={changeMode}
            fetching={isFetching}
            onOpen={openList}
          />
          <MoverTable
            title="Biggest decreases"
            empty="No cards went down in this window."
            items={data.losers.slice(0, MOVERS_PER_TABLE)}
            dir="asc"
            changeMode={changeMode}
            fetching={isFetching}
            onOpen={openList}
          />
        </Box>
      )}
    </Stack>
  );
}

function MoverTable({
  title,
  empty,
  items,
  dir,
  changeMode,
  fetching,
  onOpen,
}: {
  title: string;
  empty: string;
  items: CollectionHighlight[];
  dir: SortDirection;
  changeMode: 'amount' | 'percent';
  fetching: boolean;
  onOpen: (dir: SortDirection, cardId?: string) => void;
}) {
  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      <Typography variant="h3">{title}</Typography>

      {/* This box holds the height of a full table whether the list is short,
          empty, or swapping to another window. */}
      <Box
        aria-busy={fetching}
        sx={{
          minHeight: MOVERS_MIN_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          opacity: fetching ? 0.55 : 1,
          transition: 'opacity 150ms ease',
        }}
      >
        {items.length === 0 ? (
          <Alert severity="info">{empty}</Alert>
        ) : (
          <CollectionCardTable
            items={items}
            changeMode={changeMode}
            onRowClick={(item) => onOpen(dir, item.id)}
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="text"
          color="primary"
          onClick={() => onOpen(dir)}
          disabled={items.length === 0}
        >
          View all
        </Button>
      </Box>
    </Stack>
  );
}
