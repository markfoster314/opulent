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
import type { BinderVisibility, UpdateWantListInput, WantList } from '@opulent/shared';
import { binderVisibilityDescriptions, binderVisibilityLabels, slugSchema } from '@opulent/shared';
import { useEffect, useState } from 'react';
import { useRotateWantShareToken, useUpdateWantList } from '@/features/wants/queries';

interface WantListSettingsDialogProps {
  list: WantList;
  /** Used to build the shareable URL. */
  username: string | undefined;
  open: boolean;
  onClose: () => void;
}

export function WantListSettingsDialog({
  list,
  username,
  open,
  onClose,
}: WantListSettingsDialogProps) {
  const updateList = useUpdateWantList(list.id);
  const rotateToken = useRotateWantShareToken(list.id);

  const [slug, setSlug] = useState(list.slug);
  const [visibility, setVisibility] = useState<BinderVisibility>(list.visibility);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setSlug(list.slug);
      setVisibility(list.visibility);
      setCopied(false);
    }
  }, [open, list]);

  const slugError = slug !== list.slug && !slugSchema.safeParse(slug).success;
  const shareUrl = buildShareUrl(username, slug, visibility, list.shareToken);

  function handleSave() {
    if (slugError) return;

    const input: UpdateWantListInput = {};
    if (slug !== list.slug) input.slug = slug;
    if (visibility !== list.visibility) input.visibility = visibility;

    if (Object.keys(input).length === 0) {
      onClose();
      return;
    }

    updateList.mutate(input, { onSuccess: onClose });
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>List settings</DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel id="want-visibility-label">Who can see it</InputLabel>
            <Select
              labelId="want-visibility-label"
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
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{
                      alignItems: { sm: 'center' },
                    }}
                  >
                    <TextField
                      value={shareUrl}
                      size="small"
                      fullWidth
                      sx={{ minWidth: 0 }}
                      slotProps={{ input: { readOnly: true } }}
                    />
                    <Tooltip title={copied ? 'Copied' : 'Copy link'}>
                      <IconButton
                        onClick={() => void handleCopy()}
                        aria-label="Copy share link"
                        sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ) : (
                  <Alert severity="info">Save the list to generate its link.</Alert>
                )}

                {visibility === 'unlisted' && (
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{
                      alignItems: { xs: 'flex-start', sm: 'center' },
                    }}
                  >
                    <Button
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={() => rotateToken.mutate()}
                      disabled={rotateToken.isPending}
                    >
                      Rotate share token
                    </Button>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                      }}
                    >
                      Makes every link you have already sent stop working.
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </>
          )}

          {updateList.error && <Alert severity="error">{updateList.error.message}</Alert>}
          {rotateToken.error && <Alert severity="error">{rotateToken.error.message}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={slugError || updateList.isPending}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function buildShareUrl(
  username: string | undefined,
  slug: string,
  visibility: BinderVisibility,
  shareToken: string | undefined,
): string | null {
  if (!username || visibility === 'private') return null;

  const url = new URL(`/u/${username}/wants/${slug}`, window.location.origin);
  if (visibility === 'unlisted') {
    if (!shareToken) return null;
    url.searchParams.set('t', shareToken);
  }
  return url.toString();
}
