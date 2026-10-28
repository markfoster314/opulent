import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { CardImageUris, TradeCard, TradeChoice, TradeDetail } from '@opulent/shared';
import { formatUsd, tradeSideValue } from '@opulent/shared';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useCancelTrade,
  useFinalizeTrade,
  useProposeTrade,
  useTrade,
  useTradeChoices,
} from '../api/queries';
import { palette } from '../theme';

type DraftCard = TradeCard;

export function TradePage() {
  const { tradeId } = useParams<{ tradeId: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const trade = useTrade(isAuthenticated ? tradeId : undefined);

  if (authLoading || trade.isLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to open a trade.</Alert>;
  if (trade.error) return <Alert severity="error">{trade.error.message}</Alert>;
  if (!trade.data) return null;

  return <TradeEditor key={trade.data.updatedAt} trade={trade.data} />;
}

function TradeEditor({ trade }: { trade: TradeDetail }) {
  const choices = useTradeChoices(trade.id, trade.yourTurn);
  const propose = useProposeTrade(trade.id);
  const finalize = useFinalizeTrade(trade.id);
  const cancel = useCancelTrade(trade.id);
  const [get, setGet] = useState<DraftCard[]>(trade.youReceive);
  const [give, setGive] = useState<DraftCard[]>(trade.youGive);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const draft = trade.status === 'draft';
  const closed =
    trade.status === 'completed' || trade.status === 'cancelled' || trade.status === 'declined';
  const pending = propose.isPending || finalize.isPending || cancel.isPending;
  const over = [...get, ...give].some(
    (card) =>
      !Number.isInteger(card.quantity) ||
      card.quantity < 1 ||
      card.quantity > card.availableQuantity,
  );
  const payload = {
    items: get.map((card) => ({ scryfallId: card.scryfallId, quantity: card.quantity })),
    give: give.map((card) => ({ scryfallId: card.scryfallId, quantity: card.quantity })),
  };
  const empty = get.length === 0 && give.length === 0;

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1" sx={{ overflowWrap: 'anywhere' }}>
          Trade with @{trade.partnerUsername}
        </Typography>
        <Typography color="text.secondary">{statusLine(trade)}</Typography>
      </Stack>

      {draft && (
        <Alert severity="info">
          Only you can see this draft. Pick what you want and what you will give, then propose.
        </Alert>
      )}

      {trade.yourTurn && trade.theyFinalized && (
        <Alert severity="info">
          They finalized this trade. Finalize to complete it, or change the cards and propose.
        </Alert>
      )}

      {(propose.error || finalize.error || cancel.error) && (
        <Alert severity="error">{(propose.error ?? finalize.error ?? cancel.error)?.message}</Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <TradeSide
          title="You get"
          empty="Nothing picked from their binder yet."
          addTitle="Add a card they have for trade"
          cards={get}
          onChange={setGet}
          choices={choices.data?.items}
          choicesState={choices}
          editable={trade.yourTurn}
        />
        <TradeSide
          title="You give"
          empty="Nothing offered from your binder yet."
          addTitle="Add a card you have for trade"
          cards={give}
          onChange={setGive}
          choices={choices.data?.mine}
          choicesState={choices}
          editable={trade.yourTurn}
        />
      </Box>

      {!closed && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          useFlexGap
          sx={{ flexWrap: 'wrap' }}
        >
          <Button
            variant="contained"
            disabled={!trade.yourTurn || pending || over || (draft && empty)}
            onClick={() => propose.mutate(payload)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            {draft ? 'Propose trade' : 'Propose'}
          </Button>
          {!draft && (
            <Button
              variant="outlined"
              disabled={!trade.yourTurn || pending || over}
              onClick={() => finalize.mutate(payload)}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Finalize
            </Button>
          )}
          <Button
            variant="outlined"
            color="secondary"
            disabled={pending}
            onClick={() => (confirmCancel ? cancel.mutate() : setConfirmCancel(true))}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            {confirmCancel ? 'Yes, cancel this trade' : 'Cancel trade'}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

function TradeSide({
  title,
  empty,
  addTitle,
  cards,
  onChange,
  choices,
  choicesState,
  editable,
}: {
  title: string;
  empty: string;
  addTitle: string;
  cards: DraftCard[];
  onChange: (next: DraftCard[]) => void;
  choices: TradeChoice[] | undefined;
  choicesState: { isLoading: boolean; isSuccess: boolean; error: Error | null };
  editable: boolean;
}) {
  const [search, setSearch] = useState('');
  const picked = new Set(cards.map((card) => card.scryfallId));
  const found = (choices ?? [])
    .filter(
      (card) =>
        !picked.has(card.scryfallId) &&
        card.name.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .slice(0, 20);
  const total = tradeSideValue(cards);
  const unpriced = cards.filter((card) => card.marketPrice === null).length;

  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        alignItems="baseline"
        justifyContent="space-between"
      >
        <Typography variant="h2">{title}</Typography>
        <Typography variant="h3" component="span" sx={{ color: palette.gold }}>
          {formatUsd(total.toFixed(2)) ?? '$0.00'}
          {unpriced > 0 && (
            <Typography variant="caption" color="text.secondary" component="span" sx={{ ml: 1 }}>
              {unpriced} unpriced
            </Typography>
          )}
        </Typography>
      </Stack>

      {cards.length === 0 && <Alert severity="info">{empty}</Alert>}
      {cards.map((card) => (
        <Paper key={card.scryfallId} sx={{ p: 2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
          >
            <CardFace
              name={card.name}
              setCode={card.setCode}
              imageUris={card.imageUris}
              detail={lineDetail(card)}
            />
            {editable && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}>
                <TextField
                  label="Quantity"
                  type="number"
                  size="small"
                  value={card.quantity}
                  onChange={(event) =>
                    onChange(
                      cards.map((row) =>
                        row.scryfallId === card.scryfallId
                          ? { ...row, quantity: Number(event.target.value) }
                          : row,
                      ),
                    )
                  }
                  slotProps={{ htmlInput: { min: 1, max: card.availableQuantity } }}
                  error={card.quantity < 1 || card.quantity > card.availableQuantity}
                  helperText={`Up to ${card.availableQuantity}`}
                  sx={{ width: { xs: '100%', sm: 120 } }}
                />
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => onChange(cards.filter((row) => row.scryfallId !== card.scryfallId))}
                  sx={{ width: { xs: '100%', sm: 'auto' }, alignSelf: { sm: 'center' } }}
                >
                  Remove
                </Button>
              </Stack>
            )}
          </Stack>
        </Paper>
      ))}

      {editable && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h3" sx={{ mb: 1.5 }}>
            {addTitle}
          </Typography>
          <TextField
            label="Find a card"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          {choicesState.isLoading && <CircularProgress size={24} />}
          {choicesState.error && <Alert severity="error">{choicesState.error.message}</Alert>}
          {choicesState.isSuccess && found.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No more cards match that search.
            </Typography>
          )}
          <Stack spacing={1.5}>
            {found.map((card) => (
              <Stack
                key={card.scryfallId}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
              >
                <CardFace
                  name={card.name}
                  setCode={card.setCode}
                  imageUris={card.imageUris}
                  detail={`${card.availableQuantity} for trade${
                    card.marketPrice ? ` · ${formatUsd(card.marketPrice)}` : ''
                  }`}
                />
                <Button
                  variant="outlined"
                  onClick={() =>
                    onChange([
                      ...cards,
                      {
                        scryfallId: card.scryfallId,
                        name: card.name,
                        setCode: card.setCode,
                        imageUris: card.imageUris,
                        quantity: 1,
                        availableQuantity: card.availableQuantity,
                        marketPrice: card.marketPrice,
                      },
                    ])
                  }
                  sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
                >
                  Add
                </Button>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

function lineDetail(card: TradeCard): string {
  const each = formatUsd(card.marketPrice);
  return each ? `Qty ${card.quantity} · ${each} each` : `Qty ${card.quantity}`;
}

function CardFace({
  name,
  setCode,
  imageUris,
  detail,
}: {
  name: string;
  setCode: string;
  imageUris: CardImageUris | null;
  detail: string;
}) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      {imageUris?.small && (
        <Box
          component="img"
          src={imageUris.small}
          alt=""
          sx={{ width: 48, height: 67, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
        />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ overflowWrap: 'anywhere', fontWeight: 600 }}>{name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {setCode.toUpperCase()} · {detail}
        </Typography>
      </Box>
    </Stack>
  );
}

function statusLine(trade: TradeDetail): string {
  if (trade.status === 'draft') return 'Draft. The other person cannot see this yet.';
  if (trade.status === 'completed') return 'This trade is complete.';
  if (trade.status === 'cancelled' || trade.status === 'declined')
    return 'This trade was cancelled.';
  if (trade.yourTurn && trade.theyFinalized) {
    return 'They said yes. Finalize to complete it, or change the cards and propose.';
  }
  if (trade.youFinalized) return 'You finalized. Waiting on them.';
  if (trade.yourTurn) return 'Your turn. Set both sides, then propose or finalize.';
  return `Waiting on @${trade.partnerUsername}.`;
}
