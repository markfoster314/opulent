import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { binderVisibilityLabels } from '@opulent/shared';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useCreateWantList, useWantLists } from '../api/queries';

export function WantsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const { data, isLoading, error } = useWantLists(isAuthenticated);
  const createList = useCreateWantList();
  const [name, setName] = useState('');

  if (authLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to keep your want lists.</Alert>;

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createList.mutate({ name: trimmed, visibility: 'private' }, { onSuccess: () => setName('') });
  }

  return (
    <Stack spacing={4}>
      <Typography variant="h1">My wants</Typography>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>
          New list
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="List name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
            fullWidth
            placeholder="Commander upgrades"
          />
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!name.trim() || createList.isPending}
            sx={{ minWidth: 140 }}
          >
            Create
          </Button>
        </Stack>
        {createList.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {createList.error.message}
          </Alert>
        )}
      </Paper>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{error.message}</Alert>}

      {data && data.items.length === 0 && (
        <Alert severity="info">No lists yet. Create one above to get started.</Alert>
      )}

      <Box
        sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}
      >
        {data?.items.map((list) => (
          <Paper
            key={list.id}
            component={RouterLink}
            to={`/wants/${list.id}`}
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
                {list.name}
              </Typography>
              <Chip
                label={binderVisibilityLabels[list.visibility]}
                size="small"
                variant="outlined"
                color={list.visibility === 'public' ? 'primary' : 'default'}
              />
            </Stack>
            {list.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
              >
                {list.description}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {list.itemCount ?? 0} card{(list.itemCount ?? 0) === 1 ? '' : 's'}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}
