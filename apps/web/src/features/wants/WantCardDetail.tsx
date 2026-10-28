import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Card, CardFinish, WantItem } from '@opulent/shared';
import {
  cardConditionLabels,
  cardFinishLabels,
  cardLanguageLabels,
  cardLanguageOrEnglish,
  describeWantScope,
  parsePhotoLink,
  wantPriorityLabels,
} from '@opulent/shared';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useCardPrintings } from '@/shared/cards/queries';
import { palette } from '@/theme';
import { PriceHistoryChart } from '@/shared/cards/PriceHistoryChart';

interface WantCardDetailProps {
  item: WantItem;
  mode: 'all' | 'list';
  onEditRequest: () => void;
  onDeleteRequest: () => void;
  onUpdateQuantity: (quantity: number) => void;
  saving: boolean;
  error?: string | undefined;
}

function named(codes: readonly string[], labels?: Record<string, string>): string {
  if (codes.length === 0) return 'Any';
  return codes.map((code) => labels?.[code] ?? code.toUpperCase()).join(', ');
}

function pickPrinting(printings: Card[], item: WantItem): Card | undefined {
  if (printings.length === 0) return undefined;
  const wantedSet = item.wantedSets.length === 1 ? item.wantedSets[0] : undefined;
  const sameSet = wantedSet
    ? printings.filter((card) => card.setCode.toLowerCase() === wantedSet)
    : printings;
  const base = sameSet.length > 0 ? sameSet : printings;
  const wantedLanguage = item.wantedLanguages.length === 1 ? item.wantedLanguages[0] : 'en';
  const sameLanguage = base.filter((card) => cardLanguageOrEnglish(card.lang) === wantedLanguage);
  const pool = sameLanguage.length > 0 ? sameLanguage : base;
  const wantedFinish = item.wantedFinishes.length === 1 ? item.wantedFinishes[0] : undefined;
  return (
    (wantedFinish ? pool.find((card) => card.finishes.includes(wantedFinish)) : undefined) ??
    pool[0] ??
    printings[0]
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        justifyContent: 'space-between',
        minWidth: 0,
      }}
    >
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          flexShrink: 0,
        }}
      >
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

export function WantCardDetail({
  item,
  mode,
  onEditRequest,
  onDeleteRequest,
  onUpdateQuantity,
  saving,
  error,
}: WantCardDetailProps) {
  const [draftQuantity, setDraftQuantity] = useState(item.quantity);
  const dirtyQuantity = useRef(false);
  const requestedQuantity = useRef<number | null>(null);
  const onUpdateRef = useRef(onUpdateQuantity);
  const specificSet = item.wantedSets.length === 1;
  const printingsQuery = useCardPrintings(item.oracleId, specificSet ? item.wantedSets[0] : '', 60);
  const chosenPrinting = pickPrinting(printingsQuery.data?.items ?? [], item);
  const scryfallHref = chosenPrinting?.scryfallUri
    ? parsePhotoLink(chosenPrinting.scryfallUri)
    : null;
  const specificPrinting =
    specificSet && chosenPrinting && chosenPrinting.setCode.toLowerCase() === item.wantedSets[0]
      ? chosenPrinting
      : undefined;
  const image =
    chosenPrinting?.imageUris?.normal ??
    chosenPrinting?.imageUris?.large ??
    chosenPrinting?.imageUris?.small ??
    item.imageUris?.normal ??
    item.imageUris?.large ??
    item.imageUris?.small;
  const chartFinish: CardFinish | null = chosenPrinting
    ? item.wantedFinishes.length === 1
      ? item.wantedFinishes[0]!
      : chosenPrinting.finishes.includes('nonfoil')
        ? 'nonfoil'
        : (chosenPrinting.finishes[0] ?? null)
    : null;
  const shownQuantity = draftQuantity;
  const quantityDirty = draftQuantity !== item.quantity;
  const editLocked = quantityDirty || saving;

  useEffect(() => {
    onUpdateRef.current = onUpdateQuantity;
  }, [onUpdateQuantity]);

  useEffect(() => {
    if (dirtyQuantity.current) {
      if (requestedQuantity.current === null || item.quantity !== requestedQuantity.current) return;
      dirtyQuantity.current = false;
      requestedQuantity.current = null;
    }
    setDraftQuantity(item.quantity);
  }, [item.quantity]);

  useEffect(() => {
    setDraftQuantity(item.quantity);
    dirtyQuantity.current = false;
    requestedQuantity.current = null;
    // Reset only when the selected want changes; quantity updates must not overwrite the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    if (draftQuantity === item.quantity) return;
    const timer = window.setTimeout(() => {
      dirtyQuantity.current = true;
      requestedQuantity.current = draftQuantity;
      onUpdateRef.current(draftQuantity);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draftQuantity, item.quantity, item.id]);

  useEffect(() => {
    if (!error) return;
    dirtyQuantity.current = false;
    requestedQuantity.current = null;
    setDraftQuantity(item.quantity);
  }, [error, item.quantity]);

  function adjust(delta: number) {
    if (saving) return;
    setDraftQuantity((current) => Math.min(999, Math.max(1, current + delta)));
  }

  function requestDelete() {
    if (saving) return;
    onDeleteRequest();
  }

  return (
    <Box sx={{ backgroundColor: palette.surfaceRaised, borderTop: `1px solid ${palette.divider}` }}>
      <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5}>
          {image && (
            <Box
              sx={{
                position: 'relative',
                width: { xs: 150, md: 200 },
                alignSelf: { xs: 'center', md: 'flex-start' },
                flexShrink: 0,
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <Box
                component="img"
                src={image}
                alt={item.cardName ?? 'Card'}
                sx={{ width: '100%', display: 'block' }}
              />
            </Box>
          )}

          <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="h3" sx={{ overflowWrap: 'anywhere', flex: 1, minWidth: 150 }}>
                {chosenPrinting?.name ?? item.cardName ?? 'Card'}
              </Typography>
              <Stack
                direction="row"
                spacing={0.25}
                sx={{
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Tooltip title="Remove one wanted copy">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Remove one wanted copy"
                      disabled={shownQuantity <= 1}
                      aria-disabled={saving || undefined}
                      tabIndex={saving ? -1 : undefined}
                      onClick={() => adjust(-1)}
                      sx={saving ? { pointerEvents: 'none' } : undefined}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Typography
                  variant="body2"
                  sx={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}
                  aria-label={`${shownQuantity} wanted copies`}
                >
                  ×{shownQuantity}
                </Typography>
                <Tooltip title="Add one wanted copy">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Add one wanted copy"
                      disabled={shownQuantity >= 999}
                      aria-disabled={saving || undefined}
                      tabIndex={saving ? -1 : undefined}
                      onClick={() => adjust(1)}
                      sx={saving ? { pointerEvents: 'none' } : undefined}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={mode === 'list' ? 'Remove from this list' : 'Delete this want'}>
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={mode === 'list' ? 'Remove from this list' : 'Delete this want'}
                      aria-disabled={saving || undefined}
                      tabIndex={saving ? -1 : undefined}
                      onClick={requestDelete}
                      sx={saving ? { pointerEvents: 'none' } : undefined}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>

            {specificPrinting && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {[
                  specificPrinting.setName,
                  specificPrinting.setCode.toUpperCase(),
                  specificPrinting.collectorNumber ? `#${specificPrinting.collectorNumber}` : '',
                  specificPrinting.rarity,
                  specificPrinting.lang.toUpperCase(),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            )}
            {chosenPrinting?.typeLine && (
              <Typography variant="body2">{chosenPrinting.typeLine}</Typography>
            )}
            {chosenPrinting?.manaCost && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                Mana cost: {chosenPrinting.manaCost}
              </Typography>
            )}
            {chosenPrinting?.oracleText && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', maxWidth: '70ch' }}>
                {chosenPrinting.oracleText}
              </Typography>
            )}
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              sx={{
                flexWrap: 'wrap',
              }}
            >
              {chosenPrinting?.artist && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  Art by {chosenPrinting.artist}
                </Typography>
              )}
              {chosenPrinting?.releasedAt && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  Released {chosenPrinting.releasedAt}
                </Typography>
              )}
              {scryfallHref && (
                <Link href={scryfallHref} target="_blank" rel="noreferrer" variant="caption">
                  Scryfall page
                </Link>
              )}
            </Stack>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {describeWantScope(item)}
            </Typography>
            {printingsQuery.error && <Alert severity="error">{printingsQuery.error.message}</Alert>}
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="h4">Your want</Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditOutlinedIcon />}
              onClick={onEditRequest}
              aria-disabled={editLocked || undefined}
              tabIndex={editLocked ? -1 : undefined}
              sx={editLocked ? { pointerEvents: 'none' } : undefined}
            >
              Edit
            </Button>
          </Stack>

          <DetailRow label="Priority" value={wantPriorityLabels[item.priority] ?? 'Medium'} />
          <DetailRow label="Language" value={named(item.wantedLanguages, cardLanguageLabels)} />
          <DetailRow label="Printing" value={named(item.wantedFinishes, cardFinishLabels)} />
          <DetailRow label="Condition" value={named(item.wantedConditions, cardConditionLabels)} />
          <DetailRow
            label="Set"
            value={
              item.wantedSets.length > 0
                ? item.wantedSets.map((code) => code.toUpperCase()).join(', ')
                : 'Any'
            }
          />
          <DetailRow
            label="Lists"
            value={item.lists.length > 0 ? item.lists.map((list) => list.name).join(', ') : 'None'}
          />
          {item.notes && <DetailRow label="Notes" value={item.notes} />}
        </Stack>

        {specificPrinting && chartFinish && (
          <Box>
            <Divider sx={{ mb: 1.5 }} />
            <PriceHistoryChart
              scryfallId={specificPrinting.scryfallId}
              finish={chartFinish}
              defaultRange="1m"
            />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </Box>
  );
}
