import { useAuth0 } from '@auth0/auth0-react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { CollectionImportResult, ImportRow } from '@opulent/shared';
import { cardConditionLabels, cardFinishLabels, cardLanguageLabels } from '@opulent/shared';
import { useRef, useState, type ChangeEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useImportCollection } from '../api/queries';
import { palette } from '../theme';

/**
 * CSV import with a dry run first.
 *
 * Step 1: pick a file or paste text. Step 2: Preview. Nothing is written; the
 * screen shows what matched and what did not. Step 3: Import the matched rows.
 */
export function ImportPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const importRows = useImportCollection();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [forTradeDefault, setForTradeDefault] = useState(false);
  const [preview, setPreview] = useState<CollectionImportResult | null>(null);
  const [done, setDone] = useState<CollectionImportResult | null>(null);

  if (authLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to import cards.</Alert>;

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
    setPreview(null);
    setDone(null);
  }

  function runPreview() {
    setDone(null);
    importRows.mutate(
      { csv, dryRun: true, forTradeDefault },
      { onSuccess: (result) => setPreview(result) },
    );
  }

  function runImport() {
    importRows.mutate(
      { csv, dryRun: false, forTradeDefault },
      {
        onSuccess: (result) => {
          setDone(result);
          setPreview(null);
        },
      },
    );
  }

  const canPreview = csv.trim().length > 0 && !importRows.isPending;
  const canImport = preview !== null && preview.matched > 0 && !importRows.isPending;

  return (
    <Stack spacing={3}>
      <Button
        component={RouterLink}
        to="/collection"
        startIcon={<ArrowBackIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        My collection
      </Button>

      <Stack spacing={1}>
        <Typography variant="h1">Import cards</Typography>
        <Typography color="text.secondary">
          Bring a CSV from ManaBox, Moxfield, or our own export. Preview first. Nothing is saved
          until you press Import.
        </Typography>
      </Stack>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h3">1. Choose a file</Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            useFlexGap
            flexWrap="wrap"
          >
            <Button
              variant="outlined"
              onClick={() => fileInput.current?.click()}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Pick a CSV file
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv,text/plain"
              hidden
              onChange={(event) => void pickFile(event)}
            />
            {fileName && (
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {fileName}
              </Typography>
            )}
          </Stack>
          <TextField
            label="Or paste CSV text"
            value={csv}
            onChange={(event) => {
              setCsv(event.target.value);
              setPreview(null);
              setDone(null);
            }}
            multiline
            minRows={4}
            maxRows={12}
            fullWidth
            placeholder={'name,set,number,quantity,condition,finish,language,for trade\nLightning Bolt,m11,149,4,NM,nonfoil,en,true'}
            slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: 'monospace' } } }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={forTradeDefault}
                onChange={(event) => setForTradeDefault(event.target.checked)}
              />
            }
            label="Mark every card For trade when the file does not say"
          />
          <Typography variant="caption" color="text.secondary">
            Rows match on set code, collector number, and language. When a row has no number, the
            card name plus set is used instead.
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h3">2. Preview</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="contained"
              onClick={runPreview}
              disabled={!canPreview}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {importRows.isPending && importRows.variables?.dryRun ? 'Checking…' : 'Preview'}
            </Button>
          </Stack>
          {importRows.error && <Alert severity="error">{importRows.error.message}</Alert>}
          {preview && <ResultSummary result={preview} />}
          {preview && <RowTable rows={preview.rows} />}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, borderColor: preview ? palette.gold : undefined }}>
        <Stack spacing={2}>
          <Typography variant="h3">3. Import</Typography>
          <Typography variant="body2" color="text.secondary">
            Matched rows are added to your collection. A card you already have gets a higher count.
            Unmatched rows are left out.
          </Typography>
          <Button
            variant="contained"
            onClick={runImport}
            disabled={!canImport}
            sx={{ width: { xs: '100%', sm: 'auto' }, alignSelf: { sm: 'flex-start' } }}
          >
            {importRows.isPending && importRows.variables?.dryRun === false
              ? 'Importing…'
              : `Import ${preview?.matched ?? 0} matched row${preview?.matched === 1 ? '' : 's'}`}
          </Button>
          {done && (
            <Alert severity="success">
              Added {done.added} card{done.added === 1 ? '' : 's'} from {done.matched} row
              {done.matched === 1 ? '' : 's'}.{' '}
              <Box component={RouterLink} to="/collection" sx={{ color: 'inherit' }}>
                Open my collection
              </Box>
            </Alert>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

function ResultSummary({ result }: { result: CollectionImportResult }) {
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
      <Chip size="small" variant="outlined" label={`Format: ${formatLabel[result.format]}`} />
      <Chip size="small" label={`${result.total} rows`} />
      <Chip size="small" color="primary" label={`${result.matched} matched`} />
      {result.unmatched > 0 && (
        <Chip size="small" color="warning" variant="outlined" label={`${result.unmatched} unmatched`} />
      )}
      {result.skipped > 0 && (
        <Chip size="small" variant="outlined" label={`${result.skipped} skipped`} />
      )}
      {result.rows.length < result.total && (
        <Typography variant="caption" color="text.secondary">
          Showing the first {result.rows.length}.
        </Typography>
      )}
    </Stack>
  );
}

const formatLabel = { manabox: 'ManaBox', moxfield: 'Moxfield', plain: 'Plain' } as const;

/** One line per row. Stacks on a phone, lines up on a wider window. */
function RowTable({ rows }: { rows: ImportRow[] }) {
  return (
    <Stack spacing={1}>
      {rows.map((row) => (
        <Box
          key={row.line}
          sx={{
            display: 'grid',
            gap: 0.5,
            gridTemplateColumns: { xs: '1fr', sm: 'auto minmax(0, 1fr) auto' },
            alignItems: 'center',
            px: 1.5,
            py: 1,
            borderRadius: 1,
            border: `1px solid ${palette.divider}`,
            bgcolor: row.status === 'matched' ? 'transparent' : palette.goldWash,
          }}
        >
          <Chip
            size="small"
            label={row.status}
            color={row.status === 'matched' ? 'primary' : 'default'}
            variant={row.status === 'matched' ? 'filled' : 'outlined'}
            sx={{ justifySelf: 'start' }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ overflowWrap: 'anywhere', fontWeight: 600 }}>
              {row.name || '(no name)'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              Line {row.line} · {row.setCode.toUpperCase() || '—'}
              {row.collectorNumber ? ` #${row.collectorNumber}` : ''} ·{' '}
              {cardConditionLabels[row.condition]} · {cardFinishLabels[row.finish]} ·{' '}
              {cardLanguageLabels[row.language]}
              {row.forTrade ? ' · For trade' : ''}
            </Typography>
            {row.reason && (
              <Typography variant="body2" color="warning.main">
                {row.reason}
              </Typography>
            )}
          </Box>
          <Typography variant="body2" sx={{ justifySelf: { sm: 'end' } }}>
            ×{row.quantity}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
