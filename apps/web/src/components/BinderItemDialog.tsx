import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import type { BinderItem, UpdateBinderItemInput } from '@opulent/shared';
import { cardLanguageOrEnglish, parsePhotoLink } from '@opulent/shared';
import { useEffect, useState } from 'react';
import { useCardLanguages } from '../api/queries';
import { palette } from '../theme';
import type { CardDetails } from './CardDetailsFields';
import {
  CardDetailsFields,
  isPriceInvalid,
  isPhotoLinkInvalid,
  isQuantityInvalid,
  priceFromDetails,
} from './CardDetailsFields';

interface BinderItemDialogProps {
  item: BinderItem;
  open: boolean;
  onClose: () => void;
  onSave: (input: UpdateBinderItemInput) => void;
  onDelete: () => void;
  saving: boolean;
  error?: string | undefined;
}

function detailsFromItem(item: BinderItem): CardDetails {
  return {
    quantity: String(item.quantity),
    finish: item.finish,
    condition: item.condition,
    notes: item.notes ?? '',
    photoUrl: item.photoUrl ?? '',
    forTrade: item.forTrade,
    language: item.language,
    signed: item.signed,
    altered: item.altered,
    misprint: item.misprint,
    miscut: item.miscut,
    priceKind: item.price.kind,
    pricePercent: item.price.kind === 'percent' ? String(item.price.percent) : '',
    priceAmount: item.price.kind === 'custom' ? item.price.amount : '',
  };
}

export function BinderItemDialog({
  item,
  open,
  onClose,
  onSave,
  onDelete,
  saving,
  error,
}: BinderItemDialogProps) {
  const [details, setDetails] = useState<CardDetails>(() => detailsFromItem(item));
  const languagesQuery = useCardLanguages(open ? item.scryfallId : undefined);
  const printedLanguages = languagesQuery.data?.items.map((card) =>
    cardLanguageOrEnglish(card.lang),
  );

  // Re-seed on open so a cancelled edit does not linger into the next one.
  useEffect(() => {
    if (open) setDetails(detailsFromItem(item));
  }, [open, item]);

  useEffect(() => {
    if (!open || !printedLanguages || printedLanguages.length === 0) return;
    setDetails((current) => {
      if (printedLanguages.includes(current.language)) return current;
      const fallback = printedLanguages[0];
      return fallback ? { ...current, language: fallback } : current;
    });
  }, [open, printedLanguages, item]);

  const quantityError = isQuantityInvalid(details.quantity);
  const priceError = isPriceInvalid(details);
  const photoError = isPhotoLinkInvalid(details.photoUrl);
  const chosenPrice = priceFromDetails(details);

  function handleSave() {
    if (quantityError || photoError || !chosenPrice) return;
    onSave({
      quantity: Number(details.quantity),
      finish: details.finish,
      condition: details.condition,
      notes: details.notes,
      photoUrl: parsePhotoLink(details.photoUrl),
      forTrade: details.forTrade,
      language: details.language,
      signed: details.signed,
      altered: details.altered,
      misprint: details.misprint,
      miscut: details.miscut,
      price: chosenPrice,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{item.card?.name ?? 'Edit card'}</DialogTitle>

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
        <Stack spacing={3} sx={{ pt: 1 }}>
          <CardDetailsFields
            value={details}
            onChange={(patch) => setDetails((current) => ({ ...current, ...patch }))}
            finishOptions={item.availableFinishes ?? []}
            languageOptions={printedLanguages ?? [details.language]}
            languagesReady={languagesQuery.isSuccess}
            prices={item.card?.prices}
            stackNote="Changing finish, condition, language, price, or a mark moves these copies into their own stack."
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button color="error" onClick={onDelete} disabled={saving}>
          Remove
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={quantityError || priceError || photoError || saving}
          >
            Save
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
