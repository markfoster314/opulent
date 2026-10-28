import {
  Alert,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import {
  BIO_MAX_LENGTH,
  isReservedUsername,
  profileVisibilityDescriptions,
  profileVisibilityLabels,
  profileVisibilitySchema,
  usernameSchema,
} from '@opulent/shared';
import type { Me, PlaceRef, Profile, ProfileVisibility } from '@opulent/shared';
import { useState } from 'react';
import { useUsernameAvailability } from '@/features/auth/queries';
import { useUpdateProfile } from '@/features/profile/queries';
import { useDebounced } from '@/shared/hooks/useDebounced';
import { CitySearchField } from '@/shared/ui/CitySearchField';

export function ProfileEditor({
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
