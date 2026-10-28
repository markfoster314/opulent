import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Box, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useMatchOwners } from '@/features/matches/queries';
import { useMe } from '@/features/auth/queries';
import { GenericMatchesSection } from '@/features/matches/GenericMatchesSection';
import { MatchOwnerPaper } from '@/features/matches/MatchOwnerPaper';

/** Results are nearest-first; opening one prechecks "On my want lists". */
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
          No matches yet. Add cards to your wants, then check back. Matches appear as people mark
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

      <Divider />

      <GenericMatchesSection />
    </Stack>
  );
}
