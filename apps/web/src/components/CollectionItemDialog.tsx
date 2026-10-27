import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { CollectionItem, UpdateCollectionItemInput } from '@opulent/shared';
import { NOTES_MAX_LENGTH, cardLanguageOrEnglish, parsePhotoLink } from '@opulent/shared';
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

interface CollectionItemDialogProps {
  item: CollectionItem;
  open: boolean;
  onClose: () => void;
  onSave: (input: UpdateCollectionItemInput) => void;
  onDelete: () => void;
  saving: boolean;
  error?: string | undefined;
}

function detailsFromItem(item: CollectionItem): CardDetails {
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
    artistProof: item.artistProof,
    priceKind: item.price.kind,
    pricePercent: item.price.kind === 'percent' ? String(item.price.percent) : '',
    priceAmount: item.price.kind === 'custom' ? item.price.amount : '',
    groupIds: [],
  };
}

export function CollectionItemDialog({
  item,
  open,
  onClose,
  onSave,
  onDelete,
  saving,
  error,
}: CollectionItemDialogProps) {
  const [details, setDetails] = useState<CardDetails>(() => detailsFromItem(item));
  // A phone gets the full screen: one column, nothing cut off by a small window.
  const fullScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
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
  const notesError = details.notes.length > NOTES_MAX_LENGTH;
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
      artistProof: details.artistProof,
      price: chosenPrice,
    });
  }

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
              Edit card
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
        <Stack spacing={3} sx={{ pt: 1 }}>
          <CardDetailsFields
            value={details}
            onChange={(patch) => setDetails((current) => ({ ...current, ...patch }))}
            finishOptions={item.availableFinishes ?? []}
            languageOptions={printedLanguages ?? [details.language]}
            languagesReady={languagesQuery.isSuccess}
            prices={item.card?.prices}
            stackNote="Changing finish, condition, language, price, or a mark moves these copies into their own stack."
            columns={2}
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 }, py: 2 }}>
        <Button color="error" onClick={onDelete} disabled={saving}>
          Remove
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={quantityError || priceError || photoError || notesError || saving}
          >
            Save
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
