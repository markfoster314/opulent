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

/** The ten priciest stacks; price and weekly change use the copy's own finish, never a plain one. */
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
      <Typography variant="h2">Most expensive cards</Typography>

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
              onRowClick={(item) => {
                void navigate('/collection/cards', { state: { cardId: item.id } });
              }}
            />
          ),
        )}
      </Box>

      {items.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button component={RouterLink} to="/collection/cards" variant="text" color="primary">
            View all
          </Button>
        </Box>
      )}
    </Stack>
  );
}
