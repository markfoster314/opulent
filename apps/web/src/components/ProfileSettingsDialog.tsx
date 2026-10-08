import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import type { Me, PlaceRef } from '@opulent/shared';
import { isReservedUsername, usernameSchema } from '@opulent/shared';
import { useEffect, useState } from 'react';
import { useUpdateProfile, useUsernameAvailability } from '../api/queries';
import { useDebounced } from '../hooks/useDebounced';
import { CitySearchField } from './CitySearchField';

interface ProfileSettingsDialogProps {
  me: Me;
  open: boolean;
  onClose: () => void;
}

/**
 * The deliberate way to change your username after the welcome screen.
 *
 * Changing it moves every binder URL already shared, so the form tells the
 * user that before they save. It does not hide the field behind a second
 * button: one field, one warning, one save.
 */
export function ProfileSettingsDialog({ me, open, onClose }: ProfileSettingsDialogProps) {
  const updateProfile = useUpdateProfile();

  const [username, setUsername] = useState(me.username);
  const [city, setCity] = useState<PlaceRef | null>(me.city);
  const [formKey, setFormKey] = useState(0);

  // Re-seed on reopen, so a cancelled edit does not linger as stale text.
  // The key remounts the city box so its typed text matches the saved city.
  useEffect(() => {
    if (open) {
      setUsername(me.username);
      setCity(me.city);
      setFormKey((current) => current + 1);
      updateProfile.reset();
    }
    // Deliberately keyed on open and me only. The mutation object is rebuilt
    // every render, so depending on it would reset the form mid-edit.
  }, [open, me]);

  const normalized = username.trim().toLowerCase();
  const debounced = useDebounced(normalized, 300);
  const changing = normalized !== me.username;

  const shape = usernameSchema.safeParse(normalized);
  const reserved = shape.success && isReservedUsername(normalized);
  const availability = useUsernameAvailability(
    debounced,
    changing && usernameSchema.safeParse(debounced).success && !isReservedUsername(debounced),
  );

  const cityChanged = (city?.geonameId ?? null) !== (me.city?.geonameId ?? null);

  const usernameBlocked =
    !shape.success ||
    reserved ||
    (changing && (availability.data?.available === false || availability.isFetching));

  function handleSave() {
    if (usernameBlocked) return;

    if (!changing && !cityChanged) {
      onClose();
      return;
    }

    updateProfile.mutate(
      {
        username: normalized,
        ...(cityChanged ? { placeId: city?.geonameId ?? null } : {}),
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Profile</DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField
            label="Username"
            value={normalized}
            onChange={(event) => setUsername(event.target.value)}
            error={Boolean(usernameBlocked) && !availability.isFetching}
            helperText={describe({
              changed: changing,
              shapeError: shape.success ? null : (shape.error.issues[0]?.message ?? null),
              reserved,
              checking: changing && (availability.isFetching || debounced !== normalized),
              takenReason: availability.data?.available === false ? availability.data.reason : null,
            })}
            fullWidth
          />

          <CitySearchField
            key={formKey}
            value={city}
            onChange={setCity}
            helperText="Optional. Clear the field to remove it."
          />

          {changing && (
            <Alert severity="warning">
              Changing your username will break the binder links you have already sent. They all
              point at <strong>{me.username}</strong>.
            </Alert>
          )}

          {updateProfile.error && <Alert severity="error">{updateProfile.error.message}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={usernameBlocked || updateProfile.isPending}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function describe(state: {
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
