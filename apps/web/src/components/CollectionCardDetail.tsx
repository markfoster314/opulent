import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { askingPriceForFinish, formatUsd, priceForFinish } from '@opulent/shared';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  useCollectionItem,
  useRemoveCollectionItem,
  useUpdateCollectionItem,
} from '../api/queries';
import { palette } from '../theme';
import { CollectionItemDialog } from './CollectionItemDialog';
import { PriceHistoryChart } from './PriceHistoryChart';

const priceKindLabels = {
  market: 'market',
  percent: '% of market',
  custom: 'custom',
} as const;

/**
 * The expanded row: our copy, the Scryfall record, and the price line.
 *
 * The edit button opens the same dialog the collection grid uses, so the two
 * places cannot drift apart.
 */
export function CollectionCardDetail({ itemId }: { itemId: string }) {
  const query = useCollectionItem(itemId);
  const updateItem = useUpdateCollectionItem();
  const removeItem = useRemoveCollectionItem();
  const [editing, setEditing] = useState(false);

  if (query.isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  if (query.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{query.error.message}</Alert>
      </Box>
    );
  }

  const item = query.data;
  if (!item) return null;

  const card = item.card;
  const asking = askingPriceForFinish(card?.prices, item.finish, item.price);
  const marks = [
    item.signed ? 'signed' : '',
    item.altered ? 'altered' : '',
    item.misprint ? 'misprint' : '',
    item.miscut ? 'miscut' : '',
    item.artistProof ? 'artist proof' : '',
  ].filter(Boolean);
  const image = card?.imageUris?.normal ?? card?.imageUris?.large ?? card?.imageUris?.small;

  return (
    <Box sx={{ backgroundColor: palette.surfaceRaised, borderTop: `1px solid ${palette.divider}` }}>
      <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5}>
          {image && (
            <Box
              component="img"
              src={image}
              alt={card?.name ?? ''}
              sx={{
                width: { xs: 150, md: 200 },
                alignSelf: { xs: 'center', md: 'flex-start' },
                flexShrink: 0,
                borderRadius: 1,
              }}
            />
          )}

          <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h3" sx={{ overflowWrap: 'anywhere' }}>
              {card?.name ?? 'Card'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {[
                card?.setName,
                card?.setCode.toUpperCase(),
                card?.collectorNumber ? `#${card.collectorNumber}` : '',
                card?.rarity,
                card?.lang.toUpperCase(),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
            {card?.typeLine && <Typography variant="body2">{card.typeLine}</Typography>}
            {card?.manaCost && (
              <Typography variant="body2" color="text.secondary">
                Mana cost: {card.manaCost}
              </Typography>
            )}
            {card?.oracleText && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', maxWidth: '70ch' }}>
                {card.oracleText}
              </Typography>
            )}
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
              {card?.artist && (
                <Typography variant="caption" color="text.secondary">
                  Art by {card.artist}
                </Typography>
              )}
              {card?.releasedAt && (
                <Typography variant="caption" color="text.secondary">
                  Released {card.releasedAt}
                </Typography>
              )}
              {card?.scryfallUri && (
                <Link href={card.scryfallUri} target="_blank" rel="noreferrer" variant="caption">
                  Scryfall page
                </Link>
              )}
            </Stack>
          </Stack>
        </Stack>

        <Divider />

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
            >
              <Typography variant="h4">Your copy</Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditOutlinedIcon />}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            </Stack>

            <DetailRow label="Quantity" value={String(item.quantity)} />
            <DetailRow label="Finish" value={item.finish} />
            <DetailRow label="Condition" value={item.condition} />
            <DetailRow label="Language" value={item.language} />
            <DetailRow label="For trade" value={item.forTrade ? 'Yes' : 'No'} />
            <DetailRow label="Marks" value={marks.length > 0 ? marks.join(', ') : 'None'} />
            <DetailRow
              label="Market price"
              value={formatUsd(priceForFinish(card?.prices, item.finish)) ?? '—'}
            />
            <DetailRow
              label="Price"
              value={`${asking === null ? '—' : (formatUsd(asking) ?? '—')} (${priceKindLabels[item.price.kind]})`}
            />
            <DetailRow
              label="Groups"
              value={
                item.groups.length > 0 ? item.groups.map((group) => group.name).join(', ') : 'None'
              }
            />
            {item.notes && <DetailRow label="Notes" value={item.notes} />}
            {item.photoUrl && (
              <DetailRow
                label="Photos"
                value={
                  <Link href={item.photoUrl} target="_blank" rel="noreferrer">
                    Open photos
                  </Link>
                }
              />
            )}
          </Stack>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <PriceHistoryChart scryfallId={item.scryfallId} finish={item.finish} />
          </Box>
        </Stack>
      </Stack>

      <CollectionItemDialog
        item={item}
        open={editing}
        onClose={() => setEditing(false)}
        onSave={(input) =>
          updateItem.mutate({ itemId: item.id, input }, { onSuccess: () => setEditing(false) })
        }
        onDelete={() => removeItem.mutate(item.id, { onSuccess: () => setEditing(false) })}
        saving={updateItem.isPending || removeItem.isPending}
        error={updateItem.error?.message ?? removeItem.error?.message}
      />
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} justifyContent="space-between" sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
