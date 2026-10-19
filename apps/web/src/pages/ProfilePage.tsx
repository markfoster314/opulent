import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
import { palette } from '../theme';

type Section = 'binders' | 'wants' | 'friends';

export function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const { isAuthenticated, isLoading: authLoading, loginWithRedirect } = useAuth0();
  const me = useMe(isAuthenticated);
  const profile = useProfile(handle);
  const updateProfile = useUpdateProfile();
  const friends = useFriends(Boolean(profile.data?.isOwner));
  const addFriend = useAddFriend();
  const removeFriend = useRemoveFriend();
  const [username, setUsername] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState<Section>('binders');
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');

  if (profile.isLoading || authLoading) return <CircularProgress />;
  if (profile.error) return <Alert severity="error">{profile.error.message}</Alert>;
  if (!profile.data) return null;

  const page = profile.data;
  const canSeeLists = page.binders !== undefined && page.wantLists !== undefined;
  const active: Section = !canSeeLists && page.isOwner ? 'friends' : section;

  function handleAdd() {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) return;
    addFriend.mutate({ username: trimmed }, { onSuccess: () => setUsername('') });
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
        <Box
          sx={{
            height: { xs: 88, sm: 128 },
            background: `linear-gradient(120deg, ${palette.goldWash}, ${palette.steelWash})`,
          }}
        />
        <Box sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 } }}>
          <Box
            aria-hidden
            sx={{
              width: 72,
              height: 72,
              mt: -4.5,
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
              <Typography variant="body2" color="text.secondary">
                {profileVisibilityLabels[page.visibility]}
              </Typography>
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
                    page.isFriend
                      ? removeFriend.mutate(page.username)
                      : addFriend.mutate({ username: page.username })
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
            <Stat
              value={page.friendCount}
              label="Friends"
              selected={page.isOwner && active === 'friends'}
              onClick={page.isOwner ? () => setSection('friends') : undefined}
            />
            {canSeeLists && (
              <Stat
                value={page.binders?.length ?? 0}
                label="Binders"
                selected={active === 'binders'}
                onClick={() => setSection('binders')}
              />
            )}
            {canSeeLists && (
              <Stat
                value={page.wantLists?.length ?? 0}
                label="Wants"
                selected={active === 'wants'}
                onClick={() => setSection('wants')}
              />
            )}
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

      {page.isOwner && active === 'friends' && (
        <Stack spacing={2}>
          <Typography variant="h2">Friends</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleAdd()}
              fullWidth
              placeholder="their_name"
            />
            <Button
              variant="contained"
              onClick={handleAdd}
              disabled={!username.trim() || addFriend.isPending}
              sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
            >
              Add
            </Button>
          </Stack>
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
                    }}
                  >
                    @{friend.username}
                  </Typography>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => removeFriend.mutate(friend.username)}
                    disabled={removeFriend.isPending}
                    sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, flexShrink: 0 }}
                  >
                    Remove
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Box>
        </Stack>
      )}

      {canSeeLists && active === 'binders' && (
        <ProfileLinks
          title="Binders"
          empty="No public binders."
          items={page.binders ?? []}
          href={(slug) => `/u/${page.username}/${slug}`}
        />
      )}
      {canSeeLists && active === 'wants' && (
        <ProfileLinks
          title="Wants"
          empty="No public want lists."
          items={page.wantLists ?? []}
          href={(slug) => `/u/${page.username}/wants/${slug}`}
        />
      )}

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

function Stat({
  value,
  label,
  selected,
  onClick,
}: {
  value: number;
  label: string;
  selected: boolean;
  onClick?: () => void;
}) {
  return (
    <Box
      component={onClick ? 'button' : 'div'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      sx={{
        flex: '1 1 6rem',
        minWidth: 0,
        py: 1,
        px: 1,
        border: 0,
        borderBottom: selected ? 2 : 0,
        borderColor: 'primary.main',
        borderRadius: 1,
        bgcolor: selected ? palette.goldWash : 'transparent',
        color: 'inherit',
        font: 'inherit',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'center',
      }}
    >
      <Typography variant="h3" component="span" display="block">
        {value}
      </Typography>
      <Typography variant="caption" color={selected ? 'primary' : 'text.secondary'}>
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
            sx={{ p: 2.5, textDecoration: 'none', display: 'block', minWidth: 0 }}
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
