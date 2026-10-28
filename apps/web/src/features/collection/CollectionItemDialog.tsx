import CloseIcon from '@mui/icons-material/Close';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { CollectionItem, UpdateCollectionItemInput } from '@opulent/shared';
import { palette } from '@/theme';
import { CollectionItemForm } from './CollectionItemForm';

interface CollectionItemDialogProps {
  item: CollectionItem;
  open: boolean;
  onClose: () => void;
  onSave: (input: UpdateCollectionItemInput) => void;
  onDelete: () => void;
  saving: boolean;
  error?: string | undefined;
  mode?: 'all' | 'one';
}

/** Dialog shell; a binder modal hosts the same form inline. */
export function CollectionItemDialog({
  item,
  open,
  onClose,
  onSave,
  onDelete,
  saving,
  error,
  mode = 'all',
}: CollectionItemDialogProps) {
  // On phones, use full screen so nothing is cut off.
  const fullScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      slotProps={{ paper: { sx: { borderColor: palette.goldBorder } } }}
    >
      <DialogTitle component="div" sx={{ pr: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{ color: palette.goldLight, letterSpacing: '0.14em', lineHeight: 1.4 }}
            >
              {mode === 'one' ? 'Edit one copy' : 'Edit card'}
            </Typography>
            <Typography
              variant="h2"
              component="span"
              sx={{ display: 'block', overflowWrap: 'anywhere' }}
            >
              {item.card?.name ?? 'Card'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {[item.card?.setName, item.card?.setCode?.toUpperCase(), item.card?.collectorNumber]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </Stack>
          <IconButton aria-label="Close card editor" onClick={onClose} edge="end">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          colorScheme: 'dark',
          scrollbarColor: `${palette.goldDark} ${palette.surface}`,
          '&::-webkit-scrollbar': { width: 10 },
          '&::-webkit-scrollbar-track': { backgroundColor: palette.surface },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: palette.surfaceRaised,
            border: `2px solid ${palette.surface}`,
            borderRadius: 8,
          },
          '&::-webkit-scrollbar-thumb:hover': { backgroundColor: palette.goldDark },
        }}
      >
        <CollectionItemForm
          item={item}
          open={open}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
          saving={saving}
          error={error}
          mode={mode}
        />
      </DialogContent>
    </Dialog>
  );
}
