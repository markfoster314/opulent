import { Chip, Paper, Stack, Typography } from '@mui/material';
import { palette } from '@/theme';

/** Same shapes as MatchOwnerPaper, labelled "Example" so nobody reads it as a live record. */
export function MatchExamplePaper() {
  return (
    <Paper sx={{ p: 2.5, minWidth: 0, borderColor: palette.steelBorder }}>
      <Stack spacing={1}>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h3" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            @jamie
          </Typography>
          <Chip size="small" color="primary" label="3 matches" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          Portland · 2.4 mi away
        </Typography>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          Lightning Bolt, Counterspell, Sol Ring
        </Typography>
        <Typography variant="caption" color="secondary" sx={{ display: 'block' }}>
          Example of one trade partner.
        </Typography>
      </Stack>
    </Paper>
  );
}
