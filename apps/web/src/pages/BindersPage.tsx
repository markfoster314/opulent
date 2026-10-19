import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useBinders, useCreateBinder } from '../api/queries';
import { PlusMinusButton } from '../components/PlusMinusButton';

export function BindersPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const { data, isLoading, error } = useBinders(isAuthenticated);
  const createBinder = useCreateBinder();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  if (authLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to manage your binders.</Alert>;

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createBinder.mutate({ name: trimmed, visibility: 'private' }, { onSuccess: () => setName('') });
  }

  return (
    <Stack spacing={4}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            My binders
          </Typography>
          <PlusMinusButton
            open={creating}
            label={creating ? 'Close new binder' : 'New binder'}
            onClick={() => setCreating((open) => !open)}
          />
        </Stack>

        <Collapse in={creating} unmountOnExit>
          <Box sx={{ pt: 4 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h3" sx={{ mb: 2 }}>
                New binder
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Binder name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
                  fullWidth
                  placeholder="Modern staples for trade"
                />
                <Button
                  variant="contained"
                  onClick={handleCreate}
                  disabled={!name.trim() || createBinder.isPending}
                  sx={{ minWidth: 140 }}
                >
                  Create
                </Button>
              </Stack>
              {createBinder.error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {createBinder.error.message}
                </Alert>
              )}
            </Paper>
          </Box>
        </Collapse>
      </Box>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{error.message}</Alert>}

      {data && data.items.length === 0 && <Alert severity="info">No binders yet.</Alert>}

      <Box
        sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}
      >
        {data?.items.map((binder) => (
          <Paper
            key={binder.id}
            component={RouterLink}
            to={`/binders/${binder.id}`}
            sx={{ p: 2.5, textDecoration: 'none', display: 'block' }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
              spacing={1}
            >
              <Typography variant="h3" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {binder.name}
              </Typography>
              <Chip
                label={binder.visibility}
                size="small"
                variant="outlined"
                color={binder.visibility === 'public' ? 'primary' : 'secondary'}
              />
            </Stack>
            <Typography variant="body2" color="secondary" sx={{ mt: 0.5 }}>
              {binder.itemCount ?? 0} cards
            </Typography>
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}
