import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  binderVisibilityLabels,
  binderVisibilitySchema,
  type BinderVisibility,
  type Me,
} from '@opulent/shared';
import { useEffect, useRef, useState } from 'react';
import { useRotateTradeBinderToken, useUpdateProfile } from '../api/queries';
import { palette } from '../theme';

/** Who can open the trade binder, the link to hand out, and the token controls. */
export function TradeBinderSettings({ me }: { me: Me }) {
  const updateProfile = useUpdateProfile();
  const rotateToken = useRotateTradeBinderToken();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const visibility = me.tradeBinderVisibility;
  const url = new URL(`/u/${me.username}/trade-binder`, window.location.origin);
  if (visibility === 'unlisted') url.searchParams.set('t', me.tradeBinderShareToken);
  const shareUrl = visibility === 'private' ? null : url.toString();
  const displayLink = `${url.pathname}${url.search}`;

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setCopyError(null);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Could not copy the link.');
    }
  }

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, borderColor: palette.goldBorder }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Typography variant="h3">Binder settings</Typography>
          <Chip
            size="small"
            label={binderVisibilityLabels[visibility]}
            color={visibility === 'public' ? 'primary' : 'default'}
            variant={visibility === 'public' ? 'filled' : 'outlined'}
          />
        </Stack>

        <ToggleButtonGroup
          fullWidth
          size="small"
          exclusive
          value={visibility}
          onChange={(_event, next: BinderVisibility | null) => {
            if (!next || next === visibility) return;
            updateProfile.mutate({ tradeBinderVisibility: next });
          }}
          aria-label="Trade binder visibility"
          disabled={updateProfile.isPending}
        >
          {binderVisibilitySchema.options.map((option) => (
            <ToggleButton key={option} value={option} sx={{ textTransform: 'none' }}>
              {binderVisibilityLabels[option]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {shareUrl && (
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  color: palette.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayLink}
              </Typography>
              <Tooltip title={copied ? 'Copied' : 'Copy link'}>
                <IconButton
                  size="small"
                  onClick={() => void handleCopy()}
                  aria-label="Copy trade binder link"
                >
                  {copied ? (
                    <CheckIcon fontSize="small" color="primary" />
                  ) : (
                    <ContentCopyIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            </Stack>

            {visibility === 'unlisted' && (
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => setConfirmRotate(true)}
                disabled={rotateToken.isPending}
                sx={{ alignSelf: 'flex-start' }}
              >
                Rotate share token
              </Button>
            )}
          </Stack>
        )}

        {copyError && <Alert severity="error">{copyError}</Alert>}
        {updateProfile.error && <Alert severity="error">{updateProfile.error.message}</Alert>}
        {rotateToken.error && <Alert severity="error">{rotateToken.error.message}</Alert>}

        <Dialog open={confirmRotate} onClose={() => setConfirmRotate(false)}>
          <DialogTitle>Rotate share token?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Every link you sent stops working. The new link appears here.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmRotate(false)}>Cancel</Button>
            <Button
              color="primary"
              disabled={rotateToken.isPending}
              onClick={() =>
                rotateToken.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmRotate(false);
                    setCopied(false);
                  },
                })
              }
            >
              Rotate
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Paper>
  );
}
