import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useMatchOwners, useMe } from '../api/queries';
import { MatchOwnerPaper } from '../components/MatchOwnerPaper';

/**
 * Find trades: who has what I want, nearest city first.
 *
 * Each paper is one person. Clicking it opens their trade binder with
 * "On my want lists" already checked, so the viewer lands on the overlap.
 */
export function MatchesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const me = useMe(isAuthenticated);
  const matches = useMatchOwners(isAuthenticated);

  if (authLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to find people to trade with.</Alert>;

  const items = matches.data?.items ?? [];

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1">Find trades</Typography>
        <Typography color="text.secondary">
          People whose trade binder holds cards on your want lists. Nearest city first.
        </Typography>
        {me.data && me.data.city === null && (
          <Alert severity="info">
            Set your city on your{' '}
            <Box
              component={RouterLink}
              to={`/u/${me.data.username}`}
              sx={{ color: 'primary.main' }}
            >
              profile
            </Box>{' '}
            to sort by distance.
          </Alert>
        )}
      </Stack>

      {matches.isLoading && <CircularProgress />}
      {matches.error && <Alert severity="error">{matches.error.message}</Alert>}
      {matches.isSuccess && items.length === 0 && (
        <Alert severity="info">
          No matches yet. Add cards to a want list, then check back. Matches appear as people mark
          cards for trade.
        </Alert>
      )}

      <Box
        sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}
      >
        {items.map((owner) => (
          <MatchOwnerPaper key={owner.username} owner={owner} />
        ))}
      </Box>
    </Stack>
  );
}
