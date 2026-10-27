import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Button,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  binderVisibilityDescriptions,
  binderVisibilityLabels,
  binderVisibilitySchema,
  type Me,
} from '@opulent/shared';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useRotateTradeBinderToken, useUpdateProfile } from '../api/queries';

/** Who can open the trade binder, and the link to hand out. Saves on change. */
export function TradeBinderSettings({ me, forTradeCount }: { me: Me; forTradeCount: number }) {
  const updateProfile = useUpdateProfile();
  const rotateToken = useRotateTradeBinderToken();
  const [copied, setCopied] = useState(false);

  const visibility = me.tradeBinderVisibility;
  const url = new URL(`/u/${me.username}/trade-binder`, window.location.origin);
  if (visibility === 'unlisted') url.searchParams.set('t', me.tradeBinderShareToken);
  const shareUrl = visibility === 'private' ? null : url.toString();

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
        >
          <div>
            <Typography variant="h3">Trade binder</Typography>
            <Typography variant="body2" color="text.secondary">
              {forTradeCount} card{forTradeCount === 1 ? '' : 's'} marked for trade. Visitors see
              these and only these.
            </Typography>
          </div>
          <Button
            component={RouterLink}
            to={`/u/${me.username}/trade-binder`}
            variant="outlined"
            sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
          >
            View as visitor
          </Button>
        </Stack>

        <FormControl fullWidth size="small">
          <InputLabel id="trade-binder-visibility-label">Who can see it</InputLabel>
          <Select
            labelId="trade-binder-visibility-label"
            label="Who can see it"
            value={visibility}
            disabled={updateProfile.isPending}
            onChange={(event) =>
              updateProfile.mutate({
                tradeBinderVisibility: binderVisibilitySchema.parse(event.target.value),
              })
            }
          >
            {binderVisibilitySchema.options.map((option) => (
              <MenuItem key={option} value={option}>
                {binderVisibilityLabels[option]}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{binderVisibilityDescriptions[visibility]}</FormHelperText>
        </FormControl>

        {shareUrl && (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                value={shareUrl}
                size="small"
                fullWidth
                sx={{ minWidth: 0 }}
                slotProps={{ input: { readOnly: true } }}
              />
              <Tooltip title={copied ? 'Copied' : 'Copy link'}>
                <IconButton onClick={() => void handleCopy()} aria-label="Copy share link">
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            {visibility === 'unlisted' && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={() => rotateToken.mutate(undefined, { onSuccess: () => setCopied(false) })}
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
        )}

        {updateProfile.error && <Alert severity="error">{updateProfile.error.message}</Alert>}
        {rotateToken.error && <Alert severity="error">{rotateToken.error.message}</Alert>}
      </Stack>
    </Paper>
  );
}
