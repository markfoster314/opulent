import { useAuth0 } from '@auth0/auth0-react';
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
  describeGenericWant,
  isReservedUsername,
  profileVisibilityDescriptions,
  profileVisibilityLabels,
  profileVisibilitySchema,
  usernameSchema,
} from '@opulent/shared';
import type { Me, PlaceRef, Profile, ProfileVisibility } from '@opulent/shared';
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  useAddFriend,
  useMe,
  useProfile,
  useRemoveFriend,
  useUpdateProfile,
  useUsernameAvailability,
} from '../api/queries';
import { CitySearchField } from '../components/CitySearchField';
import { ProfileTradeBinder } from '../components/ProfileTradeBinder';
import { useDebounced } from '../hooks/useDebounced';
import { clickableSurfaceSx, palette } from '../theme';

type FriendConfirm = { kind: 'add' | 'remove'; username: string };

export function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, loginWithRedirect } = useAuth0();
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
    if (saved.username !== page.username) navigate(`/u/${saved.username}`);
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

function ProfileEditor({
  page,
  onCancel,
  onSaved,
}: {
  page: Profile;
  onCancel: () => void;
  onSaved: (me: Me) => void;
}) {
  const updateProfile = useUpdateProfile();
  const [username, setUsername] = useState(page.username);
  const [city, setCity] = useState<PlaceRef | null>(page.city);
  const [bio, setBio] = useState(page.bio ?? '');
  const [visibility, setVisibility] = useState<ProfileVisibility>(page.visibility);

  const normalized = username.trim().toLowerCase();
  const debounced = useDebounced(normalized, 300);
  const changing = normalized !== page.username;
  const shape = usernameSchema.safeParse(normalized);
  const reserved = shape.success && isReservedUsername(normalized);
  const availability = useUsernameAvailability(
    debounced,
    changing && usernameSchema.safeParse(debounced).success && !isReservedUsername(debounced),
  );
  const cityChanged = (city?.geonameId ?? null) !== (page.city?.geonameId ?? null);
  const bioChanged = (bio.trim() === '' ? null : bio.trim()) !== page.bio;
  const visibilityChanged = visibility !== page.visibility;
  const usernameBlocked =
    !shape.success ||
    reserved ||
    (changing && (availability.data?.available === false || availability.isFetching));
  const bioTooLong = bio.trim().length > BIO_MAX_LENGTH;

  function save() {
    if (usernameBlocked || bioTooLong) return;
    if (!changing && !cityChanged && !bioChanged && !visibilityChanged) {
      onCancel();
      return;
    }
    updateProfile.mutate(
      {
        ...(changing ? { username: normalized } : {}),
        ...(cityChanged ? { placeId: city?.geonameId ?? null } : {}),
        ...(bioChanged ? { bio } : {}),
        ...(visibilityChanged ? { profileVisibility: visibility } : {}),
      },
      { onSuccess: onSaved },
    );
  }

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <TextField
        label="Username"
        value={normalized}
        onChange={(event) => setUsername(event.target.value)}
        error={Boolean(usernameBlocked) && !availability.isFetching}
        helperText={usernameHelp({
          changed: changing,
          shapeError: shape.success ? null : (shape.error.issues[0]?.message ?? null),
          reserved,
          checking: changing && (availability.isFetching || debounced !== normalized),
          takenReason: availability.data?.available === false ? availability.data.reason : null,
        })}
        fullWidth
      />
      <CitySearchField
        value={city}
        onChange={setCity}
        helperText="Optional. Clear the field to remove it."
      />
      <TextField
        label="Bio"
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        multiline
        minRows={3}
        fullWidth
        helperText={`${bio.trim().length} / ${BIO_MAX_LENGTH}`}
        error={bioTooLong}
      />
      <FormControl fullWidth size="small">
        <InputLabel id="profile-visibility-label">Who can open this page</InputLabel>
        <Select
          labelId="profile-visibility-label"
          label="Who can open this page"
          value={visibility}
          onChange={(event) => setVisibility(profileVisibilitySchema.parse(event.target.value))}
        >
          {profileVisibilitySchema.options.map((option) => (
            <MenuItem key={option} value={option}>
              {profileVisibilityLabels[option]}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>{profileVisibilityDescriptions[visibility]}</FormHelperText>
      </FormControl>
      {changing && (
        <Alert severity="warning">
          Changing your username will break the links you have already sent. They all point at{' '}
          <strong>{page.username}</strong>.
        </Alert>
      )}
      {updateProfile.error && <Alert severity="error">{updateProfile.error.message}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="contained"
          onClick={save}
          disabled={usernameBlocked || bioTooLong || updateProfile.isPending}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Save
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          onClick={onCancel}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Cancel
        </Button>
      </Stack>
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

function usernameHelp(state: {
  changed: boolean;
  shapeError: string | null;
  reserved: boolean;
  checking: boolean;
  takenReason: string | null;
}): string {
  if (!state.changed) return 'This is your current username';
  if (state.shapeError) return state.shapeError;
  if (state.reserved) return 'That username is reserved. Please pick another.';
  if (state.checking) return 'Checking…';
  if (state.takenReason) return state.takenReason;
  return 'That one is free';
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
