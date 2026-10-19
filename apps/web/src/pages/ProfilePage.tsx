import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  BIO_MAX_LENGTH,
  profileVisibilityDescriptions,
  profileVisibilityLabels,
  profileVisibilitySchema,
} from '@opulent/shared';
import type { ProfileVisibility } from '@opulent/shared';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  useAddFriend,
  useFriends,
  useMe,
  useProfile,
  useRemoveFriend,
  useUpdateProfile,
} from '../api/queries';
import { ProfileSettingsDialog } from '../components/ProfileSettingsDialog';
import { clickableSurfaceSx, palette } from '../theme';

type FriendConfirm = { kind: 'add' | 'remove'; username: string };

export function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const { isAuthenticated, isLoading: authLoading, loginWithRedirect } = useAuth0();
  const me = useMe(isAuthenticated);
  const profile = useProfile(handle);
  const updateProfile = useUpdateProfile();
  const canSeeFriendList = Boolean(profile.data && (profile.data.isOwner || profile.data.isFriend));
  const friends = useFriends(canSeeFriendList ? handle : undefined);
  const addFriend = useAddFriend();
  const removeFriend = useRemoveFriend();
  const [username, setUsername] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [confirm, setConfirm] = useState<FriendConfirm | null>(null);

  if (profile.isLoading || authLoading) return <CircularProgress />;
  if (profile.error) return <Alert severity="error">{profile.error.message}</Alert>;
  if (!profile.data) return null;

  const page = profile.data;
  const canSeeLists = page.binders !== undefined && page.wantLists !== undefined;

  function askToAdd(name: string) {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return;
    setConfirm({ kind: 'add', username: trimmed });
  }

  function applyConfirm() {
    if (!confirm) return;
    if (confirm.kind === 'add') {
      addFriend.mutate(
        { username: confirm.username },
        {
          onSuccess: () => {
            if (confirm.username === username.trim().toLowerCase()) setUsername('');
            setConfirm(null);
          },
        },
      );
      return;
    }
    removeFriend.mutate(confirm.username, { onSuccess: () => setConfirm(null) });
  }

  function handleVisibility(next: ProfileVisibility) {
    if (next === page.visibility) return;
    updateProfile.mutate({ profileVisibility: next });
  }

  function startBioEdit() {
    setBioDraft(page.bio ?? '');
    setEditingBio(true);
  }

  function saveBio() {
    updateProfile.mutate({ bio: bioDraft }, { onSuccess: () => setEditingBio(false) });
  }

  return (
    <Stack spacing={3}>
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
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
            {page.username.slice(0, 1).toUpperCase()}
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
            sx={{ mt: 1.5 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                @{page.username}
              </Typography>
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
              {page.isOwner && (
                <Button
                  variant="outlined"
                  onClick={() => setSettingsOpen(true)}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Edit name and city
                </Button>
              )}
              {!page.isOwner && isAuthenticated && (
                <Button
                  variant={page.isFriend ? 'outlined' : 'contained'}
                  color={page.isFriend ? 'secondary' : 'primary'}
                  onClick={() =>
                    setConfirm({
                      kind: page.isFriend ? 'remove' : 'add',
                      username: page.username,
                    })
                  }
                  disabled={addFriend.isPending || removeFriend.isPending}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  {page.isFriend ? 'Remove friend' : 'Add friend'}
                </Button>
              )}
              {!page.isOwner && !isAuthenticated && (
                <Button
                  variant="outlined"
                  onClick={() => void loginWithRedirect()}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Sign in to add a friend
                </Button>
              )}
            </Stack>
          </Stack>

          <Box sx={{ mt: 2 }}>
            {page.isOwner && editingBio ? (
              <Stack spacing={1}>
                <TextField
                  label="Bio"
                  value={bioDraft}
                  onChange={(event) => setBioDraft(event.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                  helperText={`${bioDraft.trim().length} / ${BIO_MAX_LENGTH}`}
                  error={bioDraft.trim().length > BIO_MAX_LENGTH}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="contained"
                    onClick={saveBio}
                    disabled={updateProfile.isPending || bioDraft.trim().length > BIO_MAX_LENGTH}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Save bio
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => setEditingBio(false)}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Stack spacing={0.5} alignItems="flex-start">
                {page.bio ? (
                  <Typography sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                    {page.bio}
                  </Typography>
                ) : (
                  page.isOwner && (
                    <Typography variant="body2" color="text.secondary">
                      Add a short note about your trades.
                    </Typography>
                  )
                )}
                {page.isOwner && (
                  <Button variant="text" onClick={startBioEdit} sx={{ px: 0 }}>
                    {page.bio ? 'Edit bio' : 'Add a bio'}
                  </Button>
                )}
              </Stack>
            )}
          </Box>

          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}>
            <Stat value={page.friendCount} label="Friends" />
            {canSeeLists && <Stat value={page.binders?.length ?? 0} label="Binders" />}
            {canSeeLists && <Stat value={page.wantLists?.length ?? 0} label="Wants" />}
          </Stack>

          {page.isOwner && (
            <FormControl fullWidth sx={{ mt: 2 }} size="small">
              <InputLabel id="profile-visibility-label">Who can open this page</InputLabel>
              <Select
                labelId="profile-visibility-label"
                label="Who can open this page"
                value={page.visibility}
                onChange={(event) =>
                  handleVisibility(profileVisibilitySchema.parse(event.target.value))
                }
              >
                {profileVisibilitySchema.options.map((option) => (
                  <MenuItem key={option} value={option}>
                    {profileVisibilityLabels[option]}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{profileVisibilityDescriptions[page.visibility]}</FormHelperText>
            </FormControl>
          )}

          {updateProfile.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {updateProfile.error.message}
            </Alert>
          )}
        </Box>
      </Paper>

      {!page.isOwner && page.visibility === 'private' && (
        <Alert severity="info">This profile is private.</Alert>
      )}

      {(addFriend.error || removeFriend.error) && (
        <Alert severity="error">{(addFriend.error ?? removeFriend.error)?.message}</Alert>
      )}

      {(page.isOwner || page.isFriend) && (
        <Stack spacing={2}>
          <Typography variant="h2">Friends</Typography>
          {page.isOwner && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && askToAdd(username)}
                fullWidth
                placeholder="their_name"
              />
              <Button
                variant="contained"
                onClick={() => askToAdd(username)}
                disabled={!username.trim() || addFriend.isPending}
                sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
              >
                Add
              </Button>
            </Stack>
          )}
          {friends.isLoading && <CircularProgress />}
          {friends.error && <Alert severity="error">{friends.error.message}</Alert>}
          {friends.data && friends.data.items.length === 0 && (
            <Alert severity="info">No friends yet.</Alert>
          )}
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            }}
          >
            {friends.data?.items.map((friend) => (
              <Paper key={friend.username} sx={{ p: 2 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                >
                  <Typography
                    component={RouterLink}
                    to={`/u/${friend.username}`}
                    sx={{
                      minWidth: 0,
                      overflowWrap: 'anywhere',
                      color: 'inherit',
                      textDecoration: 'none',
                      fontWeight: 600,
                      borderRadius: 1,
                      '&:hover, &:focus-visible': { color: 'primary.main' },
                    }}
                  >
                    @{friend.username}
                  </Typography>
                  {page.isOwner && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => setConfirm({ kind: 'remove', username: friend.username })}
                      disabled={removeFriend.isPending}
                      sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, flexShrink: 0 }}
                    >
                      Remove
                    </Button>
                  )}
                </Stack>
              </Paper>
            ))}
          </Box>
        </Stack>
      )}

      {canSeeLists && (
        <ProfileLinks
          title="Binders"
          empty="No public binders."
          items={page.binders ?? []}
          href={(slug) => `/u/${page.username}/${slug}`}
        />
      )}
      {canSeeLists && (
        <ProfileLinks
          title="Wants"
          empty="No public want lists."
          items={page.wantLists ?? []}
          href={(slug) => `/u/${page.username}/wants/${slug}`}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>{confirm?.kind === 'remove' ? 'Remove friend' : 'Add friend'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography sx={{ overflowWrap: 'anywhere' }}>
              {confirm?.kind === 'remove'
                ? `Remove @${confirm.username} from your friends?`
                : `Add @${confirm?.username} as a friend?`}
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
            {confirm?.kind === 'remove' ? 'Remove' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {page.isOwner && me.data && (
        <ProfileSettingsDialog
          me={me.data}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </Stack>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Box sx={{ flex: '1 1 6rem', minWidth: 0, py: 1, px: 1, textAlign: 'center' }}>
      <Typography variant="h3" component="span" display="block">
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function ProfileLinks({
  title,
  empty,
  items,
  href,
}: {
  title: string;
  empty: string;
  items: { slug: string; name: string; description: string | null }[];
  href: (slug: string) => string;
}) {
  return (
    <Stack spacing={2}>
      <Typography variant="h2">{title}</Typography>
      {items.length === 0 && <Alert severity="info">{empty}</Alert>}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {items.map((item) => (
          <Paper
            key={item.slug}
            component={RouterLink}
            to={href(item.slug)}
            sx={{ p: 2.5, display: 'block', minWidth: 0, ...clickableSurfaceSx }}
          >
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
