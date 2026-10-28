import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useFollowers, useFollowing, useRemoveFriend } from '@/features/profile/queries';
import { useMe } from '@/features/auth/queries';
import { clickableSurfaceSx } from '@/theme';

export function FollowersPage() {
  return <PeoplePage kind="followers" />;
}

export function FollowingPage() {
  return <PeoplePage kind="following" />;
}

function PeoplePage({ kind }: { kind: 'followers' | 'following' }) {
  const { handle } = useParams<{ handle: string }>();
  const { isAuthenticated } = useSession();
  const me = useMe(isAuthenticated);
  const followers = useFollowers(kind === 'followers' ? handle : undefined);
  const following = useFollowing(kind === 'following' ? handle : undefined);
  const removeFriend = useRemoveFriend();
  const [confirmName, setConfirmName] = useState<string | null>(null);
  const list = kind === 'followers' ? followers : following;
  const canUnfollow = kind === 'following' && me.data?.username === handle;

  if (list.isLoading) return <CircularProgress />;
  if (list.error) return <Alert severity="error">{list.error.message}</Alert>;

  const items = list.data?.items ?? [];
  const title = kind === 'followers' ? 'Followers' : 'Following';
  const detail =
    kind === 'followers' ? `People who follow @${handle}` : `People @${handle} follows`;

  function unfollow() {
    if (!confirmName) return;
    removeFriend.mutate(confirmName, { onSuccess: () => setConfirmName(null) });
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1">{title}</Typography>
        <Typography
          sx={{
            color: 'text.secondary',
            overflowWrap: 'anywhere',
          }}
        >
          {detail}
        </Typography>
      </Stack>
      {items.length === 0 && (
        <Alert severity="info">
          {kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
        </Alert>
      )}
      <Stack spacing={1.5}>
        {items.map((person) =>
          canUnfollow ? (
            <Paper key={person.username} sx={{ p: 2, minWidth: 0 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                sx={{
                  justifyContent: 'space-between',
                  alignItems: { sm: 'center' },
                }}
              >
                <Typography
                  component={RouterLink}
                  to={`/u/${person.username}`}
                  sx={{
                    fontWeight: 600,
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                    color: 'inherit',
                    textDecoration: 'none',
                    '&:hover, &:focus-visible': { color: 'primary.main' },
                  }}
                >
                  @{person.username}
                </Typography>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => setConfirmName(person.username)}
                  disabled={removeFriend.isPending}
                  sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
                >
                  Unfollow
                </Button>
              </Stack>
            </Paper>
          ) : (
            <Paper
              key={person.username}
              component={RouterLink}
              to={`/u/${person.username}`}
              sx={{ p: 2, display: 'block', overflowWrap: 'anywhere', ...clickableSurfaceSx }}
            >
              <Typography
                sx={{
                  fontWeight: 600,
                }}
              >
                @{person.username}
              </Typography>
            </Paper>
          ),
        )}
      </Stack>

      <Dialog
        open={confirmName !== null}
        onClose={() => setConfirmName(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Unfollow</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography sx={{ overflowWrap: 'anywhere' }}>
              Stop following @{confirmName}?
            </Typography>
            {removeFriend.error && <Alert severity="error">{removeFriend.error.message}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setConfirmName(null)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={unfollow}
            disabled={removeFriend.isPending}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Unfollow
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
