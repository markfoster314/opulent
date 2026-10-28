import { Alert, Autocomplete, Button, Stack, TextField } from '@mui/material';
import type { CollectionItem, UpdateCollectionItemInput } from '@opulent/shared';
import { NOTES_MAX_LENGTH, cardLanguageOrEnglish, parsePhotoLink } from '@opulent/shared';
import { useEffect, useState } from 'react';
import { useCardLanguages, useGroups } from '../api/queries';
import type { CardDetails } from './CardDetailsFields';
import {
  CardDetailsFields,
  isPriceInvalid,
  isPhotoLinkInvalid,
  isQuantityInvalid,
  priceFromDetails,
} from './CardDetailsFields';

interface CollectionItemFormProps {
  item: CollectionItem;
  open?: boolean;
  onClose: () => void;
  onSave: (input: UpdateCollectionItemInput) => void;
  onDelete: () => void;
  saving: boolean;
  error?: string | undefined;
  /** "one" edits one copy; "all" edits the whole stack. */
  mode?: 'all' | 'one';
}

function detailsFromItem(item: CollectionItem, mode: 'all' | 'one' = 'all'): CardDetails {
  return {
    quantity: mode === 'one' ? '1' : String(item.quantity),
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
    groupIds: item.groups.map((group) => group.id),
  };
}

export function CollectionItemForm({
  item,
  open = true,
  onClose,
  onSave,
  onDelete,
  saving,
  error,
  mode = 'all',
}: CollectionItemFormProps) {
  const editingOne = mode === 'one';
  const [details, setDetails] = useState<CardDetails>(() => detailsFromItem(item, mode));
  const languagesQuery = useCardLanguages(open ? item.scryfallId : undefined);
  const groupsQuery = useGroups(open);
  const groupOptions = groupsQuery.data?.items ?? [];
  const selectedGroups = groupOptions.filter((group) => details.groupIds.includes(group.id));
  const printedLanguages = languagesQuery.data?.items.map((card) =>
    cardLanguageOrEnglish(card.lang),
  );

  useEffect(() => {
    if (open) setDetails(detailsFromItem(item, mode));
  }, [open, item, mode]);

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

  function hasChanges(): boolean {
    const price = priceFromDetails(details);
    const priceChanged =
      !price ||
      price.kind !== item.price.kind ||
      (price.kind === 'percent' &&
        item.price.kind === 'percent' &&
        price.percent !== item.price.percent) ||
      (price.kind === 'custom' &&
        item.price.kind === 'custom' &&
        price.amount !== item.price.amount);
    const groups = [...details.groupIds].sort().join('|');
    const itemGroups = [...item.groups.map((group) => group.id)].sort().join('|');
    return (
      details.finish !== item.finish ||
      details.condition !== item.condition ||
      details.language !== item.language ||
      details.notes !== (item.notes ?? '') ||
      (parsePhotoLink(details.photoUrl) ?? null) !== (item.photoUrl ?? null) ||
      details.forTrade !== item.forTrade ||
      details.signed !== item.signed ||
      details.altered !== item.altered ||
      details.misprint !== item.misprint ||
      details.miscut !== item.miscut ||
      details.artistProof !== item.artistProof ||
      priceChanged ||
      groups !== itemGroups
    );
  }

  function handleSave() {
    if (quantityError || photoError || !chosenPrice) return;
    if (editingOne && !hasChanges()) {
      onClose();
      return;
    }
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
      groupIds: details.groupIds,
    });
  }

  return (
    <Stack spacing={2.5}>
      <CardDetailsFields
        value={details}
        onChange={(patch) => setDetails((current) => ({ ...current, ...patch }))}
        finishOptions={item.availableFinishes ?? []}
        languageOptions={printedLanguages ?? [details.language]}
        languagesReady={languagesQuery.isSuccess}
        prices={item.card?.prices}
        columns={2}
        quantityLocked={editingOne}
      />

      {groupOptions.length > 0 && (
        <Autocomplete
          multiple
          options={groupOptions}
          value={selectedGroups}
          getOptionLabel={(group) => group.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onChange={(_event, next) =>
            setDetails((current) => ({ ...current, groupIds: next.map((group) => group.id) }))
          }
          renderInput={(params) => <TextField {...params} label="Groups" />}
        />
      )}

      {error && <Alert severity="error">{error}</Alert>}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        justifyContent={editingOne ? 'flex-end' : 'space-between'}
        sx={{ pt: 1 }}
      >
        {!editingOne && (
          <Button
            color="error"
            onClick={onDelete}
            disabled={saving}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Remove
          </Button>
        )}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <Button onClick={onClose} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={quantityError || priceError || photoError || notesError || saving}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            {editingOne ? 'Save one' : 'Save'}
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
