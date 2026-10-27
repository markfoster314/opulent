import { Chip, Paper, Stack, Typography } from '@mui/material';
import type { MatchOwner } from '@opulent/shared';
import { Link as RouterLink } from 'react-router-dom';
import { clickableSurfaceSx, palette } from '../theme';

/** One person who holds cards on the viewer's want lists. */
export function MatchOwnerPaper({ owner }: { owner: MatchOwner }) {
  const more = owner.matchCount - owner.cardNames.length;
  return (
    <Paper
      component={RouterLink}
      to={`/u/${owner.username}/trade-binder?want=1`}
      sx={{
        p: 2.5,
        display: 'block',
        minWidth: 0,
        ...clickableSurfaceSx,
        borderColor: palette.steelBorder,
      }}
    >
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
            @{owner.username}
          </Typography>
          <Chip
            size="small"
            color="primary"
            label={`${owner.matchCount} match${owner.matchCount === 1 ? '' : 'es'}`}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {describePlace(owner)}
        </Typography>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {owner.cardNames.join(', ')}
          {more > 0 ? `, and ${more} more` : ''}
        </Typography>
      </Stack>
    </Paper>
  );
}

function describePlace(owner: MatchOwner): string {
  if (!owner.city) return 'No city set';
  if (owner.distanceMeters === null) return owner.city;
  return `${owner.city} · ${formatDistance(owner.distanceMeters)}`;
}

/** Short and round. Nobody plans a trade on the exact meter. */
function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  if (miles < 1) return 'same city';
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}
