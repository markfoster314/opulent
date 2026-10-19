import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { Box, IconButton } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

interface PlusMinusButtonProps {
  open: boolean;
  label: string;
  onClick: () => void;
}

/** A plus that turns into a minus while a section opens, and back when it closes. */
export function PlusMinusButton({ open, label, onClick }: PlusMinusButtonProps) {
  return (
    <IconButton
      color="primary"
      aria-label={label}
      aria-expanded={open}
      onClick={onClick}
      sx={{ flexShrink: 0 }}
    >
      <Box sx={{ position: 'relative', width: '1.5rem', height: '1.5rem' }}>
        <AddIcon sx={iconMotion(open)} />
        <RemoveIcon sx={iconMotion(!open)} />
      </Box>
    </IconButton>
  );
}

/** The mark that is leaving spins away. The mark that is arriving spins into place. */
function iconMotion(leaving: boolean): SxProps<Theme> {
  return {
    position: 'absolute',
    inset: 0,
    transition: (theme) =>
      theme.transitions.create(['opacity', 'transform'], {
        duration: theme.transitions.duration.shorter,
      }),
    opacity: leaving ? 0 : 1,
    transform: leaving ? 'rotate(90deg)' : 'none',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  };
}
