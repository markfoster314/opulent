import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { describeGenericWant, profileVisibilityLabels } from '@opulent/shared';
import type { Me } from '@opulent/shared';
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useMe } from '@/features/auth/queries';
import { ProfileEditor } from '@/features/profile/ProfileEditor';
import { ProfileTradeBinder } from '@/features/profile/ProfileTradeBinder';
import { useAddFriend, useProfile, useRemoveFriend } from '@/features/profile/queries';
import { clickableSurfaceSx, palette } from '@/theme';

type FriendConfirm = { kind: 'add' | 'remove'; username: string };

export function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, loginWithRedirect } = useSession();
  const profile = useProfile(handle);
  const me = useMe(isAuthenticated);
  const addFriend = useAddFriend();
  const removeFriend = useRemoveFriend();
  const [editing, setEditing] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [confirm, setConfirm] = useState<FriendConfirm | null>(null);

  if (profile.isLoading || authLoading) return <CircularProgress />;
  if (profile.error) return <Alert severity="error">{profile.error.message}</Alert>;
  if (!profile.data) return null;

  const page = profile.data;
  const ownPage = page.isOwner || me.data?.username === page.username;
  const canSeeLists = page.wantLists !== undefined;

  function applyConfirm() {
    if (!confirm) return;
    if (confirm.kind === 'add') {
      addFriend.mutate({ username: confirm.username }, { onSuccess: () => setConfirm(null) });
      return;
    }
    removeFriend.mutate(confirm.username, { onSuccess: () => setConfirm(null) });
  }

  function startEdit() {
    setEditKey((current) => current + 1);
    setEditing(true);
  }

  function finishEdit(saved: Me) {
    setEditing(false);
    if (saved.username !== page.username) void navigate(`/u/${saved.username}`);
  }

  return (
    <Stack spacing={3}>
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
          <LetterMark name={page.username} />

          {editing ? (
            <ProfileEditor
              key={editKey}
              page={page}
              onCancel={() => setEditing(false)}
              onSaved={finishEdit}
            />
          ) : (
            <Stack spacing={2} sx={{ mt: 1.5 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    @{page.username}
                  </Typography>
                  {page.city && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {page.city.label}
                    </Typography>
                  )}
                  {page.visibility === 'private' && (
                    <Typography variant="body2" color="text.secondary">
                      {profileVisibilityLabels.private}
                    </Typography>
                  )}
                </Box>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
                >
                  {ownPage && (
                    <Button
                      variant="outlined"
                      onClick={startEdit}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Edit profile
                    </Button>
                  )}
                  {!ownPage && isAuthenticated && (
                    <Button
                      variant={page.isFollowing ? 'outlined' : 'contained'}
                      color={page.isFollowing ? 'secondary' : 'primary'}
                      onClick={() =>
                        setConfirm({
                          kind: page.isFollowing ? 'remove' : 'add',
                          username: page.username,
                        })
                      }
                      disabled={addFriend.isPending || removeFriend.isPending}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      {page.isFollowing ? 'Unfollow' : 'Follow'}
                    </Button>
                  )}
                  {!ownPage && !isAuthenticated && (
                    <Button
                      variant="outlined"
                      onClick={() => void loginWithRedirect()}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Sign in to follow
                    </Button>
                  )}
                </Stack>
              </Stack>

              {page.bio && (
                <Typography sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                  {page.bio}
                </Typography>
              )}
            </Stack>
          )}

          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}>
            <Stat
              value={page.followerCount}
              label="Followers"
              to={`/u/${page.username}/followers`}
            />
            <Stat
              value={page.followingCount}
              label="Following"
              to={`/u/${page.username}/following`}
            />
          </Stack>
        </Box>
      </Paper>

      {page.visibility === 'private' && !editing && (
        <Alert severity="info">This profile is private.</Alert>
      )}

      {(addFriend.error || removeFriend.error) && (
        <Alert severity="error">{(addFriend.error ?? removeFriend.error)?.message}</Alert>
      )}

      {page.tradeBinderCount !== undefined && (
        <ProfileTradeBinder
          username={page.username}
          ownPage={ownPage}
          isAuthenticated={isAuthenticated}
          visibility={me.data?.tradeBinderVisibility}
        />
      )}
      {canSeeLists && (
        <ProfileLinks
          title="Wants"
          empty="No public want lists."
          lead={{
            name: 'All public wants',
            href: `/u/${page.username}/wants/all`,
            matchCount: page.wantMatchCount,
          }}
          items={page.wantLists ?? []}
          href={(slug) => `/u/${page.username}/wants/${slug}`}
        />
      )}
      {canSeeLists && (
        <Stack spacing={2}>
          <Typography variant="h2">Generic wants</Typography>
          {(page.genericWants ?? []).length === 0 && (
            <Alert severity="info">No generic wants.</Alert>
          )}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            {(page.genericWants ?? []).map((item) => (
              <Paper key={item.id} sx={{ p: 2.5, minWidth: 0 }}>
                <Typography sx={{ overflowWrap: 'anywhere' }}>
                  {describeGenericWant(item) || 'Any copy'}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Stack>
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>{confirm?.kind === 'remove' ? 'Unfollow' : 'Follow'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography sx={{ overflowWrap: 'anywhere' }}>
              {confirm?.kind === 'remove'
                ? `Stop following @${confirm.username}?`
                : `Follow @${confirm?.username}?`}
            </Typography>
            {(addFriend.error || removeFriend.error) && (
              <Alert severity="error">{(addFriend.error ?? removeFriend.error)?.message}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setConfirm(null)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={applyConfirm}
            disabled={addFriend.isPending || removeFriend.isPending}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            {confirm?.kind === 'remove' ? 'Unfollow' : 'Follow'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function LetterMark({ name }: { name: string }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: 72,
        height: 72,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        bgcolor: palette.steelDeep,
        color: palette.textPrimary,
        border: `3px solid ${palette.background}`,
        fontSize: '1.75rem',
        fontWeight: 600,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </Box>
  );
}

function Stat({ value, label, to }: { value: number; label: string; to?: string }) {
  return (
    <Box
      component={to ? RouterLink : 'div'}
      to={to}
      sx={{
        flex: '1 1 6rem',
        minWidth: 0,
        py: 1,
        px: 1,
        textAlign: 'center',
        color: 'inherit',
        textDecoration: 'none',
        borderRadius: 1,
        ...(to ? { '&:hover, &:focus-visible': { color: 'primary.main' } } : {}),
      }}
    >
      <Typography variant="h3" component="span" display="block">
        {value}
      </Typography>
      <Typography variant="caption" color="inherit">
        {label}
      </Typography>
    </Box>
  );
}

function MatchChip({ count }: { count: number | undefined }) {
  if (!count) return null;
  return (
    <Chip
      label={`${count} match${count === 1 ? '' : 'es'}`}
      size="small"
      color="primary"
      sx={{ alignSelf: 'flex-start', mb: 1 }}
    />
  );
}

function ProfileLinks({
  title,
  empty,
  lead,
  items,
  href,
  itemsLabel,
}: {
  title: string;
  empty: string;
  lead?: { name: string; detail?: string; href: string; matchCount?: number | undefined };
  items: {
    slug: string;
    name: string;
    description: string | null;
    matchCount?: number | undefined;
  }[];
  href: (slug: string) => string;
  itemsLabel?: string;
}) {
  return (
    <Stack spacing={2}>
      <Typography variant="h2">{title}</Typography>
      {lead && (
        <Paper
          component={RouterLink}
          to={lead.href}
          sx={{
            p: 2.5,
            display: 'block',
            minWidth: 0,
            ...clickableSurfaceSx,
            borderColor: palette.gold,
          }}
        >
          <MatchChip count={lead.matchCount} />
          <Typography variant="h3" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {lead.name}
          </Typography>
          {lead.detail && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {lead.detail}
            </Typography>
          )}
        </Paper>
      )}
      {itemsLabel && items.length > 0 && (
        <Typography variant="h3" component="h3">
          {itemsLabel}
        </Typography>
      )}
      {items.length === 0 && <Alert severity="info">{empty}</Alert>}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {items.map((item) => (
          <Paper
            key={item.slug}
            component={RouterLink}
            to={href(item.slug)}
            sx={{ p: 2.5, display: 'block', minWidth: 0, ...clickableSurfaceSx }}
          >
            <MatchChip count={item.matchCount} />
            <Typography variant="h3" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {item.name}
            </Typography>
            {item.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
              >
                {item.description}
              </Typography>
            )}
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}
