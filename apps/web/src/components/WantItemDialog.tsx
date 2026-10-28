import { Dialog, DialogContent, DialogTitle, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { UpdateWantItemInput, WantItem, WantList } from '@opulent/shared';
import { palette } from '../theme';
import { WantItemForm } from './WantItemForm';

interface WantItemDialogProps {
  item: WantItem;
  open: boolean;
  onClose: () => void;
  onSave: (input: UpdateWantItemInput) => void;
  onDelete: () => void;
  saving: boolean;
  error?: string | undefined;
  lists?: WantList[];
  removeLabel?: string;
}

export function WantItemDialog({
  item,
  open,
  onClose,
  onSave,
  onDelete,
  saving,
  error,
  lists = [],
  removeLabel = 'Remove',
}: WantItemDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle sx={{ overflowWrap: 'anywhere' }}>{item.cardName ?? 'Edit want'}</DialogTitle>
      <DialogContent
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
        {open && (
          <WantItemForm
            item={item}
            lists={lists}
            onClose={onClose}
            onSave={onSave}
            onDelete={onDelete}
            saving={saving}
            error={error}
            removeLabel={removeLabel}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
