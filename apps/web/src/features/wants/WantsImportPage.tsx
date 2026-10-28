import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { WantsImportResult } from '@opulent/shared';
import { useRef, useState, type ChangeEvent } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useImportWants, useWantLists } from '@/features/wants/queries';
import { palette } from '@/theme';

export function WantsImportPage() {
  const { isAuthenticated, isLoading: authLoading } = useSession();
  const [search] = useSearchParams();
  const initialList = search.get('list') ?? '';
  const listsQuery = useWantLists(isAuthenticated);
  const importWants = useImportWants();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [listId, setListId] = useState(initialList);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<WantsImportResult | null>(null);
  const [done, setDone] = useState<WantsImportResult | null>(null);

  if (authLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to import wants.</Alert>;

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
    importWants.mutate(
      { csv, dryRun: true, ...(listId ? { listId } : {}) },
      { onSuccess: (result) => setPreview(result) },
    );
  }

  function runImport() {
    importWants.mutate(
      { csv, dryRun: false, ...(listId ? { listId } : {}) },
      {
        onSuccess: (result) => {
          setDone(result);
          setPreview(null);
        },
      },
    );
  }

  const canPreview = csv.trim().length > 0 && !importWants.isPending;
  const canImport = preview !== null && preview.matched > 0 && !importWants.isPending;

  return (
    <Stack spacing={4}>
      <Button
        component={RouterLink}
        to="/wants"
        startIcon={<ArrowBackIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        My wants
      </Button>

      <Typography variant="h1">Import wants</Typography>

      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
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
            select
            label="Target list"
            value={listId}
            onChange={(event) => setListId(event.target.value)}
            fullWidth
          >
            <MenuItem value="">No list</MenuItem>
            {(listsQuery.data?.items ?? []).map((list) => (
              <MenuItem key={list.id} value={list.id}>
                {list.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="CSV"
            value={csv}
            onChange={(event) => {
              setCsv(event.target.value);
              setFileName(null);
              setPreview(null);
              setDone(null);
            }}
            multiline
            minRows={6}
            fullWidth
            placeholder={
              'name,set,finish,language,condition,quantity,priority,notes,lists,oracle_id\nLightning Bolt,,foil,,,1,high,,, '
            }
            slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
          />

          <Button
            variant="contained"
            onClick={runPreview}
            disabled={!canPreview}
            sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: 160 }}
          >
            Preview
          </Button>

          {importWants.error && <Alert severity="error">{importWants.error.message}</Alert>}
        </Stack>
      </Paper>

      {preview && (
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <Typography variant="h3">2. Preview</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label={`${preview.total} rows`} />
              <Chip color="primary" label={`${preview.matched} matched`} />
              {preview.unmatched > 0 && <Chip label={`${preview.unmatched} unmatched`} />}
              {preview.skipped > 0 && <Chip label={`${preview.skipped} skipped`} />}
            </Stack>
            {preview.listsCreated.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                New lists: {preview.listsCreated.join(', ')}
              </Typography>
            )}
            <Stack spacing={1}>
              {preview.rows.map((row) => (
                <Box
                  key={`${row.line}-${row.status}`}
                  sx={{
                    border: `1px solid ${palette.steelBorder}`,
                    borderRadius: 2,
                    p: 1.5,
                    minWidth: 0,
                  }}
                >
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                    <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      {row.line}. {row.name || 'No name'}
                    </Typography>
                    <Chip size="small" label={row.status} />
                    {row.setCode && <Chip size="small" variant="outlined" label={row.setCode} />}
                    <Typography variant="body2" color="text.secondary">
                      {row.quantity} copies
                    </Typography>
                  </Stack>
                  {row.reason && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {row.reason}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
            <Button
              variant="contained"
              onClick={runImport}
              disabled={!canImport}
              sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: 160 }}
            >
              Import {preview.matched} rows
            </Button>
          </Stack>
        </Paper>
      )}

      {done && (
        <Alert severity="success">
          Imported {done.added} copies across {done.matched} rows.
          {done.listsCreated.length > 0 ? ` New lists: ${done.listsCreated.join(', ')}.` : ''}
        </Alert>
      )}
    </Stack>
  );
}
