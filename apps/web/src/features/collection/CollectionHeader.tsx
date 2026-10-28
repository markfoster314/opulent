import AddIcon from '@mui/icons-material/Add';
import { Alert, Button, Chip, Stack, Typography } from '@mui/material';
import type { CollectionSummary } from '@opulent/shared';
import { Link as RouterLink } from 'react-router-dom';
import { useExportCollection } from '@/features/collection/queries';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'opulent-tutor-collection.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Shared by the overview and the full card list so the two pages cannot drift apart. */
export function CollectionHeader({
  title,
  totals,
  summaryError,
  showTotals = true,
  onAddCard,
  addOpen,
}: {
  title: string;
  totals: CollectionSummary | undefined;
  summaryError: Error | null;
  /** The dashboard shows the totals in its overview instead. */
  showTotals?: boolean;
  /** Only the collection dashboard offers the add panel. */
  onAddCard?: () => void;
  addOpen?: boolean;
}) {
  const exportCsv = useExportCollection();

  return (
    <Stack spacing={1}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{
          justifyContent: 'space-between',
          alignItems: { sm: 'center' },
        }}
      >
        <Typography variant="h1">{title}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}>
          {onAddCard && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onAddCard}
              aria-expanded={addOpen}
              aria-controls="add-card-section"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Add a card
            </Button>
          )}
          <Button
            component={RouterLink}
            to="/collection/import"
            variant="outlined"
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Import CSV
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => exportCsv.mutate(undefined, { onSuccess: downloadCsv })}
            disabled={exportCsv.isPending}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            {exportCsv.isPending ? 'Preparing…' : 'Export CSV'}
          </Button>
        </Stack>
      </Stack>
      {exportCsv.error && <Alert severity="error">{exportCsv.error.message}</Alert>}
      {showTotals && totals && (
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{
            flexWrap: 'wrap',
          }}
        >
          <Chip label={`${totals.cardCount} card${totals.cardCount === 1 ? '' : 's'}`} />
          <Chip label={`${money.format(Number(totals.marketValue))} collection value`} />
          <Chip
            color="primary"
            variant="outlined"
            label={`${totals.forTradeCount} for trade · ${money.format(Number(totals.forTradeValue))}`}
          />
        </Stack>
      )}
      {summaryError && <Alert severity="error">{summaryError.message}</Alert>}
    </Stack>
  );
}
