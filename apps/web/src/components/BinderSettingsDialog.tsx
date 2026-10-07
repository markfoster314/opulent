import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Binder, BinderVisibility, UpdateBinderInput } from '@opulent/shared';
import { binderVisibilityDescriptions, binderVisibilityLabels, slugSchema } from '@opulent/shared';
import { useEffect, useState } from 'react';
import { useRotateShareToken, useUpdateBinder } from '../api/queries';

interface BinderSettingsDialogProps {
  binder: Binder;
  /** The owner's handle, needed to build the shareable URL. */
  handle: string | undefined;
  open: boolean;
  onClose: () => void;
}

export function BinderSettingsDialog({ binder, handle, open, onClose }: BinderSettingsDialogProps) {
  const updateBinder = useUpdateBinder(binder.id);
  const rotateToken = useRotateShareToken(binder.id);

  const [name, setName] = useState(binder.name);
  const [slug, setSlug] = useState(binder.slug);
  const [description, setDescription] = useState(binder.description ?? '');
  const [visibility, setVisibility] = useState<BinderVisibility>(binder.visibility);
  const [copied, setCopied] = useState(false);

  // Re-seed the form whenever the dialog reopens, so a cancelled edit does not
  // linger as stale text the next time it is opened.
  useEffect(() => {
    if (open) {
      setName(binder.name);
      setSlug(binder.slug);
      setDescription(binder.description ?? '');
      setVisibility(binder.visibility);
      setCopied(false);
    }
  }, [open, binder]);

  const slugError = slug !== binder.slug && !slugSchema.safeParse(slug).success;
  const nameError = name.trim().length === 0;

  const shareUrl = buildShareUrl(handle, slug, visibility, binder.shareToken);

  function handleSave() {
    if (nameError || slugError) return;

    // Send only what actually changed, so a no-op save does not touch the slug
    // and silently break existing share links.
    const input: UpdateBinderInput = {};
    if (name.trim() !== binder.name) input.name = name.trim();
    if (slug !== binder.slug) input.slug = slug;
    if (description !== (binder.description ?? '')) input.description = description;
    if (visibility !== binder.visibility) input.visibility = visibility;

    if (Object.keys(input).length === 0) {
      onClose();
      return;
    }

    updateBinder.mutate(input, { onSuccess: onClose });
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Binder settings</DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={nameError}
            helperText={nameError ? 'A binder needs a name' : ' '}
            fullWidth
          />

          <TextField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            placeholder="Modern staples, mostly near mint. Happy to ship first."
          />

          <FormControl fullWidth>
            <InputLabel id="visibility-label">Who can see it</InputLabel>
            <Select
              labelId="visibility-label"
              label="Who can see it"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as BinderVisibility)}
            >
              {(Object.keys(binderVisibilityLabels) as BinderVisibility[]).map((option) => (
                <MenuItem key={option} value={option}>
                  {binderVisibilityLabels[option]}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{binderVisibilityDescriptions[visibility]}</FormHelperText>
          </FormControl>

          <TextField
            label="Link name"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            error={slugError}
            helperText={
              slugError
                ? 'Lowercase letters, numbers and hyphens only'
                : 'Changing this breaks any link you have already shared'
            }
            fullWidth
          />

          {visibility !== 'private' && (
            <>
              <Divider />
              <Stack spacing={1}>
                <Typography variant="subtitle2">Share link</Typography>

                {shareUrl ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      value={shareUrl}
                      size="small"
                      fullWidth
                      slotProps={{ input: { readOnly: true } }}
                    />
                    <Tooltip title={copied ? 'Copied' : 'Copy link'}>
                      <IconButton onClick={() => void handleCopy()} aria-label="Copy share link">
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ) : (
                  <Alert severity="info">Save the binder to generate its link.</Alert>
                )}

                {visibility === 'unlisted' && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={() => rotateToken.mutate()}
                      disabled={rotateToken.isPending}
                    >
                      Rotate share token
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      Makes every link you have already sent stop working.
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </>
          )}

          {updateBinder.error && <Alert severity="error">{updateBinder.error.message}</Alert>}
          {rotateToken.error && <Alert severity="error">{rotateToken.error.message}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={nameError || slugError || updateBinder.isPending}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * A public binder is reachable by its slug alone. An unlisted one also needs
 * the secret token, which only the owner ever receives from the API.
 */
function buildShareUrl(
  handle: string | undefined,
  slug: string,
  visibility: BinderVisibility,
  shareToken: string | undefined,
): string | null {
  if (!handle || visibility === 'private') return null;

  const url = new URL(`/u/${handle}/${slug}`, window.location.origin);
  if (visibility === 'unlisted') {
    if (!shareToken) return null;
    url.searchParams.set('t', shareToken);
  }
  return url.toString();
}
