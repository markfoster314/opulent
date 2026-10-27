import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useCollectionHighlights } from '../api/queries';
import { CollectionCardTable } from './CollectionCardTable';

/** Rows in one table on a wide window. A phone gets one table of ten. */
const ROWS_PER_TABLE = 5;

/**
 * The top of the collection dashboard: the ten priciest stacks.
 *
 * Rank and the printed price are the asking price of one copy: the market price
 * for its finish, unless the owner set a percent or a custom amount. The weekly
 * figure compares the same finish a week ago, so a foil is never measured
 * against a plain copy.
 */
export function MostExpensiveCards({ enabled }: { enabled: boolean }) {
  const { data, isLoading, error } = useCollectionHighlights(enabled);
  const navigate = useNavigate();
  const isWide = useMediaQuery((theme: Theme) => theme.breakpoints.up('md'));
  const items = data?.items ?? [];
  const tables = isWide
    ? [items.slice(0, ROWS_PER_TABLE), items.slice(ROWS_PER_TABLE, ROWS_PER_TABLE * 2)]
    : [items];

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h2">Most expensive cards</Typography>
        <Typography variant="body2" color="text.secondary">
          Ranked by the price of one copy. The weekly figure follows the same finish.
        </Typography>
      </Stack>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{error.message}</Alert>}
      {!isLoading && !error && items.length === 0 && (
        <Alert severity="info">No priced cards yet. Add one and its value appears here.</Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        }}
      >
        {tables.map((rows, index) =>
          rows.length === 0 ? null : (
            <CollectionCardTable
              key={index}
              items={rows}
              onRowClick={(item) => navigate(`/collection/cards#${item.id}`)}
            />
          ),
        )}
      </Box>

      {items.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button component={RouterLink} to="/collection/cards" variant="text" color="primary">
            View all cards
          </Button>
        </Box>
      )}
    </Stack>
  );
}
