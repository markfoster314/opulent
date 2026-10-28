import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import type { UpdateWantItemInput, WantItem, WantList } from '@opulent/shared';
import { cardConditionLabels, cardFinishLabels, cardLanguageLabels } from '@opulent/shared';
import { useEffect, useRef, useState } from 'react';
import { palette } from '@/theme';
import type { CardTileMark } from '@/shared/cards/CardTile';
import { CardTile } from '@/shared/cards/CardTile';
import { WantItemDialog } from './WantItemDialog';

interface WantItemTileProps {
  item: WantItem;
  onUpdate: (wantId: string, input: UpdateWantItemInput) => void;
  onRemove: (wantId: string) => void;
  saving: boolean;
  error?: string | undefined;
  /** Shared lists show the card only; owners still get edit controls. */
  readOnly?: boolean;
  lists?: WantList[];
  /** A list's action says "Remove from list"; the dialog says delete. */
  removeLabel?: string;
}

const QUANTITY_DEBOUNCE_MS = 500;
const markIconSize = 18;

function named(codes: readonly string[], labels?: Record<string, string>): string {
  return codes.map((code) => labels?.[code] ?? code.toUpperCase()).join(', ');
}

function specText(
  title: string,
  wanted: readonly string[],
  labels?: Record<string, string>,
): string | null {
  if (wanted.length === 0) return null;
  return `${title}: ${named(wanted, labels)}`;
}

function specMarks(item: WantItem): CardTileMark[] {
  const specs: { key: string; label: string | null; color: string; icon: CardTileMark['icon'] }[] =
    [
      {
        key: 'language',
        label: specText('Language', item.wantedLanguages, cardLanguageLabels),
        color: palette.markLanguage,
        icon: <LanguageOutlinedIcon sx={{ fontSize: markIconSize }} />,
      },
      {
        key: 'printing',
        label: specText('Printing', item.wantedFinishes, cardFinishLabels),
        color: palette.markPrinting,
        icon: <AutoAwesomeOutlinedIcon sx={{ fontSize: markIconSize }} />,
      },
      {
        key: 'condition',
        label: specText('Condition', item.wantedConditions, cardConditionLabels),
        color: palette.markCondition,
        icon: <VerifiedOutlinedIcon sx={{ fontSize: markIconSize }} />,
      },
      {
        key: 'set',
        label: specText('Set', item.wantedSets),
        color: palette.markSet,
        icon: <LayersOutlinedIcon sx={{ fontSize: markIconSize }} />,
      },
    ];

  return specs.flatMap((spec) =>
    spec.label ? [{ key: spec.key, label: spec.label, color: spec.color, icon: spec.icon }] : [],
  );
}

export function WantItemTile({
  item,
  onUpdate,
  onRemove,
  saving,
  error,
  readOnly,
  lists = [],
  removeLabel,
}: WantItemTileProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftQuantity, setDraftQuantity] = useState(item.quantity);
  const name = item.cardName ?? 'Card';

  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    setDraftQuantity(item.quantity);
  }, [item.quantity]);

  useEffect(() => {
    if (draftQuantity === item.quantity) return;
    const timer = setTimeout(
      () => onUpdateRef.current(item.id, { quantity: draftQuantity }),
      QUANTITY_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [draftQuantity, item.quantity, item.id]);

  return (
    <Stack spacing={0.5} sx={{ height: '100%' }}>
      <CardTile
        card={{
          name,
          imageUris: item.imageUris ?? null,
          setCode: '',
          collectorNumber: '',
        }}
        nameOnly
        quantity={readOnly ? item.quantity : undefined}
        extraMarks={specMarks(item)}
        onClick={readOnly ? undefined : () => setDialogOpen(true)}
      />

      {!readOnly && (
        <Stack
          direction="row"
          spacing={0.25}
          useFlexGap
          sx={{
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <IconButton
            size="small"
            aria-label={`One fewer ${name}`}
            disabled={draftQuantity <= 1}
            onClick={() => setDraftQuantity((current) => Math.max(1, current - 1))}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>

          <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>
            {draftQuantity}
          </Typography>

          <IconButton
            size="small"
            aria-label={`One more ${name}`}
            disabled={draftQuantity >= 999}
            onClick={() => setDraftQuantity((current) => Math.min(999, current + 1))}
          >
            <AddIcon fontSize="small" />
          </IconButton>

          <Tooltip title="Edit this want">
            <IconButton
              size="small"
              aria-label={`Edit ${name}`}
              onClick={() => setDialogOpen(true)}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}

      {!readOnly && (
        <WantItemDialog
          item={item}
          lists={lists}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSave={(input) => {
            onUpdate(item.id, input);
            setDialogOpen(false);
          }}
          onDelete={() => {
            onRemove(item.id);
            setDialogOpen(false);
          }}
          saving={saving}
          error={error}
          removeLabel={removeLabel}
        />
      )}
    </Stack>
  );
}
