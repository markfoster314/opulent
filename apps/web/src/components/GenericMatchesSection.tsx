import { Alert, Box, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { cardConditionLabels, cardFinishLabels, cardLanguageLabels } from '@opulent/shared';
import { Link as RouterLink } from 'react-router-dom';
import { useGenericMatches } from '../api/queries';
import { clickableSurfaceSx, palette } from '../theme';

function distanceLabel(meters: number | null): string {
  if (meters === null) return 'No distance';
  const miles = meters / 1609.344;
  if (miles < 1) return 'Same city';
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}

/** Separate from card-want results and counts. */
export function GenericMatchesSection() {
  const query = useGenericMatches(true);
  const owners = query.data?.items ?? [];

  return (
    <Stack spacing={2} id="generic-matches">
      <Typography variant="h2">Generic wants</Typography>

      {query.isLoading && <CircularProgress />}
      {query.error && <Alert severity="error">{query.error.message}</Alert>}
      {query.isSuccess && owners.length === 0 && (
        <Alert severity="info">No generic matches yet.</Alert>
      )}

      <Box
        sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}
      >
        {owners.map((owner) => (
          <Paper
            key={owner.username}
            component={RouterLink}
            to={`/u/${owner.username}/trade-binder?generic=1`}
            sx={{
              p: 2.5,
              display: 'block',
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
              <Typography variant="body2" color="text.secondary">
                {owner.city ?? 'No city'} · {distanceLabel(owner.distanceMeters)}
              </Typography>
              <Stack spacing={0.5}>
                {owner.cards.map((card, index) => (
                  <Typography
                    key={`${card.name}-${index}`}
                    variant="body2"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {card.quantity}× {card.name} · {card.setCode.toUpperCase()} ·{' '}
                    {cardFinishLabels[card.finish]} · {cardConditionLabels[card.condition]} ·{' '}
                    {cardLanguageLabels[card.language]}
                  </Typography>
                ))}
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}
