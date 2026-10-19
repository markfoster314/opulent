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
import type { CardImageUris, TradeCard, TradeDetail } from '@opulent/shared';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useCancelTrade,
  useFinalizeTrade,
  useProposeTrade,
  useTrade,
  useTradeChoices,
} from '../api/queries';

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
  const [lines, setLines] = useState<DraftCard[]>(trade.youReceive);
  const [search, setSearch] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const closed =
    trade.status === 'completed' || trade.status === 'cancelled' || trade.status === 'declined';
  const pending = propose.isPending || finalize.isPending || cancel.isPending;
  const over = lines.some(
    (card) =>
      !Number.isInteger(card.quantity) ||
      card.quantity < 1 ||
      card.quantity > card.availableQuantity,
  );
  const payload = {
    items: lines.map((card) => ({ scryfallId: card.scryfallId, quantity: card.quantity })),
  };
  const picked = new Set(lines.map((card) => card.scryfallId));
  const found = (choices.data?.items ?? [])
    .filter(
      (card) =>
        !picked.has(card.scryfallId) &&
        card.name.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .slice(0, 20);

  function setQuantity(scryfallId: string, quantity: number) {
    setLines((current) =>
      current.map((card) => (card.scryfallId === scryfallId ? { ...card, quantity } : card)),
    );
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1" sx={{ overflowWrap: 'anywhere' }}>
          Trade with @{trade.partnerUsername}
        </Typography>
        <Typography color="text.secondary">{statusLine(trade)}</Typography>
      </Stack>

      {trade.yourTurn && trade.theyFinalized && (
        <Alert severity="info">
          They finalized this trade. Finalize to complete it, or change the cards and propose.
        </Alert>
      )}

      {(propose.error || finalize.error || cancel.error) && (
        <Alert severity="error">{(propose.error ?? finalize.error ?? cancel.error)?.message}</Alert>
      )}

      <CardList
        title="You get"
        empty="You have not added cards yet."
        cards={lines}
        editable={trade.yourTurn}
        onQuantity={setQuantity}
        onRemove={(scryfallId) =>
          setLines((current) => current.filter((card) => card.scryfallId !== scryfallId))
        }
      />

      {trade.yourTurn && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h3" sx={{ mb: 1.5 }}>
            Add a card they have for trade
          </Typography>
          <TextField
            label="Find a card"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          {choices.isLoading && <CircularProgress size={24} />}
          {choices.error && <Alert severity="error">{choices.error.message}</Alert>}
          {choices.isSuccess && found.length === 0 && (
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
                  detail={`${card.availableQuantity} for trade`}
                />
                <Button
                  variant="outlined"
                  onClick={() =>
                    setLines((current) => [
                      ...current,
                      { ...card, quantity: 1, availableQuantity: card.availableQuantity },
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

      <CardList title="You give" empty="They have not added cards yet." cards={trade.youGive} />

      {!closed && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          useFlexGap
          sx={{ flexWrap: 'wrap' }}
        >
          <Button
            variant="contained"
            disabled={!trade.yourTurn || pending || over}
            onClick={() => propose.mutate(payload)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Propose
          </Button>
          <Button
            variant="outlined"
            disabled={!trade.yourTurn || pending || over}
            onClick={() => finalize.mutate(payload)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Finalize
          </Button>
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

function CardList({
  title,
  empty,
  cards,
  editable = false,
  onQuantity,
  onRemove,
}: {
  title: string;
  empty: string;
  cards: DraftCard[];
  editable?: boolean;
  onQuantity?: (scryfallId: string, quantity: number) => void;
  onRemove?: (scryfallId: string) => void;
}) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="h2">{title}</Typography>
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
              detail={`Qty ${card.quantity}`}
            />
            {editable && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}>
                <TextField
                  label="Quantity"
                  type="number"
                  size="small"
                  value={card.quantity}
                  onChange={(event) => onQuantity?.(card.scryfallId, Number(event.target.value))}
                  slotProps={{ htmlInput: { min: 1, max: card.availableQuantity } }}
                  error={card.quantity < 1 || card.quantity > card.availableQuantity}
                  helperText={`Up to ${card.availableQuantity}`}
                  sx={{ width: { xs: '100%', sm: 120 } }}
                />
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => onRemove?.(card.scryfallId)}
                  sx={{ width: { xs: '100%', sm: 'auto' }, alignSelf: { sm: 'center' } }}
                >
                  Remove
                </Button>
              </Stack>
            )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
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
  if (trade.status === 'completed') return 'This trade is complete.';
  if (trade.status === 'cancelled' || trade.status === 'declined')
    return 'This trade was cancelled.';
  if (trade.yourTurn && trade.theyFinalized) {
    return 'They said yes. Finalize to complete it, or change the cards and propose.';
  }
  if (trade.youFinalized) return 'You finalized. Waiting on them.';
  if (trade.yourTurn) return 'Your turn. Add the cards you want, then propose or finalize.';
  return `Waiting on @${trade.partnerUsername}.`;
}
