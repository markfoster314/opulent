import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Collapse,
  IconButton,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { AddCollectionItemInput, Card, CardLanguage } from '@opulent/shared';
import {
  askingPrice,
  cardLanguageOrEnglish,
  formatUsd,
  NOTES_MAX_LENGTH,
  parseCustomAmount,
  parsePhotoLink,
  priceForFinish,
} from '@opulent/shared';
import { useSession } from '@/app/session';
import { useEffect, useState } from 'react';
import { useCardLanguages, useGroups } from '@/shared/cards/queries';
import type { CardDetails } from './CardDetailsFields';
import {
  CardDetailsFields,
  defaultFinish,
  isPriceInvalid,
  isPhotoLinkInvalid,
  isQuantityInvalid,
  priceFromDetails,
} from './CardDetailsFields';
import { PrintingPicker } from './PrintingPicker';
import { FoilSheen } from './FoilSheen';

function marketDollar(prices: Card['prices'], finish: CardDetails['finish']): string {
  const market = priceForFinish(prices, finish);
  return market ? (parseCustomAmount(market) ?? '') : '';
}

interface AddCardPanelProps {
  /** Search collapses to one row per card, so this starts at its newest printing. */
  card: Card;
  onAdd: (input: AddCollectionItemInput) => void;
  onCancel: () => void;
  pending: boolean;
  error?: string | undefined;
  /** On the landing page, fold advanced fields to keep the form short before sign-up. */
  foldAdvanced?: boolean;
  defaultGroupId?: string | undefined;
}

/** Set comes first because printings differ in value; mount with key={card.oracleId} to reset per card. */
export function AddCardPanel({
  card,
  onAdd,
  onCancel,
  pending,
  error,
  foldAdvanced,
  defaultGroupId,
}: AddCardPanelProps) {
  const [step, setStep] = useState<'set' | 'details'>('set');
  const [hasChosenSet, setHasChosenSet] = useState(false);
  /** Animate only the first set expansion; later step switches are instant. */
  const [settled, setSettled] = useState(false);
  const [printing, setPrinting] = useState<Card>(card);
  const [details, setDetails] = useState<CardDetails>({
    quantity: '1',
    finish: defaultFinish(card.finishes),
    condition: 'NM',
    language: cardLanguageOrEnglish(card.lang),
    signed: false,
    altered: false,
    misprint: false,
    miscut: false,
    artistProof: false,
    notes: '',
    photoUrl: '',
    forTrade: true,
    priceKind: 'market',
    pricePercent: '100',
    priceAmount: marketDollar(card.prices, defaultFinish(card.finishes)),
    groupIds: defaultGroupId ? [defaultGroupId] : [],
  });

  /** Correct finish on printing change so a foil-only drop never keeps an unprinted finish. */
  function handleSelectPrinting(next: Card, language?: CardLanguage) {
    setPrinting(next);
    setDetails((current) => {
      const finish = next.finishes.includes(current.finish)
        ? current.finish
        : defaultFinish(next.finishes);
      const previousMarket = marketDollar(printing.prices, current.finish);
      const nextMarket = marketDollar(next.prices, finish);
      const priceAmount =
        current.priceAmount === '' || current.priceAmount === previousMarket
          ? nextMarket
          : current.priceAmount;
      const nextLanguage =
        language ??
        (current.language === cardLanguageOrEnglish(printing.lang)
          ? cardLanguageOrEnglish(next.lang)
          : current.language);
      return { ...current, finish, priceAmount, language: nextLanguage };
    });
    setHasChosenSet(true);
    setStep('details');
  }

  const quantityError = isQuantityInvalid(details.quantity);
  const priceError = isPriceInvalid(details);
  const photoError = isPhotoLinkInvalid(details.photoUrl);
  const notesError = details.notes.length > NOTES_MAX_LENGTH;
  const quantity = Number(details.quantity);
  const chosenPrice = priceFromDetails(details);

  const marketUnit = priceForFinish(printing.prices, details.finish);
  const unitPrice = chosenPrice ? askingPrice(marketUnit, chosenPrice) : null;
  const formattedUnitPrice = formatUsd(unitPrice);
  const formattedMarket = formatUsd(marketUnit);
  const lineTotal =
    unitPrice && !quantityError && quantity > 1
      ? formatUsd(String(Number(unitPrice) * quantity))
      : null;

  let priceCaption = 'market estimate, each';
  if (chosenPrice?.kind === 'percent') {
    priceCaption = formattedMarket
      ? `${chosenPrice.percent}% of the ${formattedMarket} market price`
      : `${chosenPrice.percent}% of market`;
  } else if (chosenPrice?.kind === 'custom') {
    priceCaption = 'your price, each';
  }
  if (lineTotal) priceCaption = `${priceCaption} · ${quantity} copies about ${lineTotal}`;

  function handleAdd() {
    if (quantityError || priceError || photoError || notesError || !chosenPrice) return;
    const photoUrl = parsePhotoLink(details.photoUrl);
    onAdd({
      scryfallId: printing.scryfallId,
      quantity,
      finish: details.finish,
      condition: details.condition,
      language: details.language,
      signed: details.signed,
      altered: details.altered,
      misprint: details.misprint,
      miscut: details.miscut,
      artistProof: details.artistProof,
      forTrade: details.forTrade,
      price: chosenPrice,
      groupIds: details.groupIds,
      ...(details.notes.trim() ? { notes: details.notes.trim() } : {}),
      ...(photoUrl ? { photoUrl } : {}),
    });
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 2,
        }}
      >
        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <Typography variant="h3" sx={{ overflowWrap: 'anywhere' }}>
            {card.name}
          </Typography>
          {step === 'details' ? (
            <>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {printing.setName ?? printing.setCode.toUpperCase()} · #{printing.collectorNumber}
                {printing.rarity ? ` · ${printing.rarity}` : ''}
              </Typography>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => setStep('set')}
                disabled={pending}
                sx={{
                  alignSelf: 'flex-start',
                  width: { xs: '100%', sm: 'auto' },
                  justifyContent: { xs: 'flex-start', sm: 'center' },
                }}
              >
                Change set
              </Button>
            </>
          ) : null}
        </Stack>
        <IconButton onClick={onCancel} aria-label="Cancel adding this card" size="small">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Collapse
        in={step === 'set'}
        timeout={settled ? 0 : 240}
        appear
        unmountOnExit
        onEntered={() => setSettled(true)}
      >
        <PrintingPicker
          oracleId={card.oracleId}
          selectedId={hasChosenSet ? printing.scryfallId : ''}
          onSelect={handleSelectPrinting}
        />
      </Collapse>

      <Collapse in={step === 'details'} timeout={settled ? 0 : 240} unmountOnExit>
        <DetailsStep
          cardName={card.name}
          printing={printing}
          details={details}
          onDetails={(patch) =>
            setDetails((current) => {
              const next = { ...current, ...patch };
              if (patch.finish && patch.finish !== current.finish) {
                const previousMarket = marketDollar(printing.prices, current.finish);
                const nextMarket = marketDollar(printing.prices, patch.finish);
                if (current.priceAmount === '' || current.priceAmount === previousMarket) {
                  next.priceAmount = nextMarket;
                }
              }
              return next;
            })
          }
          quantityError={quantityError}
          priceError={priceError}
          photoError={photoError}
          notesError={notesError}
          formattedUnitPrice={formattedUnitPrice}
          priceCaption={priceCaption}
          priceKind={details.priceKind}
          pending={pending}
          error={error}
          onCancel={onCancel}
          onAdd={handleAdd}
          onSelectPrinting={handleSelectPrinting}
          foldAdvanced={foldAdvanced}
        />
      </Collapse>
    </Paper>
  );
}

function DetailsStep({
  cardName,
  printing,
  details,
  onDetails,
  quantityError,
  priceError,
  photoError,
  notesError,
  formattedUnitPrice,
  priceCaption,
  priceKind,
  pending,
  error,
  onCancel,
  onAdd,
  onSelectPrinting,
  foldAdvanced,
}: {
  cardName: string;
  printing: Card;
  details: CardDetails;
  onDetails: (patch: Partial<CardDetails>) => void;
  quantityError: boolean;
  priceError: boolean;
  photoError: boolean;
  notesError: boolean;
  formattedUnitPrice: string | null;
  priceCaption: string;
  priceKind: CardDetails['priceKind'];
  pending: boolean;
  error: string | undefined;
  onCancel: () => void;
  onAdd: () => void;
  onSelectPrinting: (card: Card, language: CardLanguage) => void;
  foldAdvanced?: boolean;
}) {
  const image = printing.imageUris?.normal ?? printing.imageUris?.large;
  const languagesQuery = useCardLanguages(printing.scryfallId);
  const languagePrintings = languagesQuery.data?.items;
  const printedLanguages = languagePrintings?.map((card) => cardLanguageOrEnglish(card.lang));
  const { isAuthenticated } = useSession();
  const groupsQuery = useGroups(isAuthenticated);
  const groupOptions = groupsQuery.data?.items ?? [];
  const selectedGroups = groupOptions.filter((group) => details.groupIds.includes(group.id));

  useEffect(() => {
    if (!languagePrintings || languagePrintings.length === 0) return;
    if (printedLanguages?.includes(details.language)) return;
    const fallback = languagePrintings[0];
    if (!fallback) return;
    onSelectPrinting(fallback, cardLanguageOrEnglish(fallback.lang));
  }, [languagePrintings, printedLanguages, details.language, onSelectPrinting]);

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', md: 'minmax(180px, 240px) 1fr' },
        alignItems: 'start',
      }}
    >
      <Stack
        direction={{ xs: 'row', md: 'column' }}
        spacing={{ xs: 3, md: 1.5 }}
        sx={{ alignItems: { xs: 'stretch', md: 'flex-start' } }}
      >
        <Box
          sx={{
            width: { xs: 140, sm: 180, md: '100%' },
            maxWidth: '100%',
            flexShrink: 0,
            alignSelf: 'flex-start',
            aspectRatio: '488 / 680',
            borderRadius: 2,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {image ? (
            <Box
              component="img"
              src={image}
              alt={cardName}
              sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <Stack
              sx={{
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                No image
              </Typography>
            </Stack>
          )}
          {details.finish === 'foil' && image ? <FoilSheen /> : null}
        </Box>

        <Stack
          spacing={1}
          sx={{
            minWidth: 0,
            flex: { xs: 1, md: 'none' },
            justifyContent: { xs: 'space-between', md: 'flex-start' },
          }}
        >
          <Box>
            {formattedUnitPrice ? (
              <>
                <Typography variant="h3">{formattedUnitPrice}</Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {priceCaption}
                </Typography>
              </>
            ) : priceKind === 'custom' ? null : (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                No market price is stored for this finish.
              </Typography>
            )}
          </Box>

          <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
            {(
              [
                ['View on Scryfall', printing.scryfallUri],
                ['View on TCGPlayer', printing.purchaseUris?.tcgplayer],
                ['View on Cardmarket', printing.purchaseUris?.cardmarket],
                ['View on Cardhoarder', printing.purchaseUris?.cardhoarder],
              ] as const
            ).map(([label, url]) => {
              const href = url ? parsePhotoLink(url) : null;
              if (!href) return null;
              return (
                <Link
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </Stack>
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <CardDetailsFields
          value={details}
          onChange={(patch) => {
            if (patch.language && patch.language !== details.language) {
              const match = languagePrintings?.find(
                (card) => cardLanguageOrEnglish(card.lang) === patch.language,
              );
              if (match) {
                onSelectPrinting(match, patch.language);
                return;
              }
            }
            onDetails(patch);
          }}
          finishOptions={printing.finishes}
          languageOptions={printedLanguages ?? [details.language]}
          languagesReady={languagesQuery.isSuccess}
          prices={printing.prices}
          foldAdvanced={foldAdvanced}
          columns={2}
        />

        {groupOptions.length > 0 && (
          <Autocomplete
            multiple
            filterSelectedOptions
            size="small"
            options={groupOptions}
            value={selectedGroups}
            getOptionLabel={(group) => group.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_event, next) => onDetails({ groupIds: next.map((group) => group.id) })}
            renderInput={(params) => (
              <TextField {...params} label="Groups" placeholder="Add to a group" />
            )}
          />
        )}

        {error && <Alert severity="error">{error}</Alert>}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{
            justifyContent: { sm: 'flex-end' },
            '& .MuiButton-root': { width: { xs: '100%', sm: 'auto' } },
          }}
        >
          <Button onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={onAdd}
            disabled={quantityError || priceError || photoError || notesError || pending}
          >
            {pending ? 'Adding…' : 'Add to collection'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
