import { useAuth0 } from '@auth0/auth0-react';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Fade,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { Card } from '@opulent/shared';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAddCollectionItem, useCollectionSummary } from '@/features/collection/queries';
import { useCreateGroup } from '@/features/groups/queries';
import { useGroups } from '@/shared/cards/queries';
import { useMe } from '@/features/auth/queries';
import { AddCardPanel } from '@/shared/cards/AddCardPanel';
import { CardSearchField } from '@/shared/cards/CardSearchField';
import { CollectionHeader } from '@/features/collection/CollectionHeader';
import { CollectionOverview } from '@/features/collection/CollectionOverview';
import { MostExpensiveCards } from '@/features/collection/MostExpensiveCards';
import { TopMovers } from '@/features/collection/TopMovers';
import { PlusMinusButton } from '@/shared/ui/PlusMinusButton';
import { takePendingAdd } from '@/features/auth';
import { TradeBinderPreview } from '@/features/profile';
import { palette } from '@/theme';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Collection dashboard; the full card grid lives at /collection/cards to keep this page light. */
export function CollectionPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const me = useMe(isAuthenticated);
  const summary = useCollectionSummary(isAuthenticated);
  const [addOpen, setAddOpen] = useState(false);
  const [addFocus, setAddFocus] = useState(0);
  const [panelClosing, setPanelClosing] = useState(false);
  const [draftCard, setDraftCard] = useState<Card | undefined>(undefined);

  const addItem = useAddCollectionItem();

  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const draftTaken = useRef(false);

  /** Replays a pre-signup draft once; taking it before the request prevents a double add. */
  useEffect(() => {
    if (!isAuthenticated || draftTaken.current) return;
    draftTaken.current = true;
    const draft = takePendingAdd();
    if (!draft) return;
    addItem.mutate(draft.input, {
      onSuccess: () =>
        setAddedNotice(
          `${draft.cardName} is in your collection.${
            draft.input.forTrade ? ' It is marked for trade.' : ''
          }`,
        ),
    });
  }, [isAuthenticated, addItem]);

  if (authLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to see your collection.</Alert>;

  const totals = summary.data;

  function closeAdd() {
    // The draft clears in onExited, so the whole panel collapses together.
    setAddOpen(false);
  }

  function handlePanelClosed() {
    // A new card may have been chosen while the old panel was fading out.
    if (!panelClosing) return;
    setDraftCard(undefined);
    setPanelClosing(false);
    setAddFocus((current) => current + 1);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  return (
    <Stack spacing={4}>
      {addedNotice && (
        <Alert severity="success" onClose={() => setAddedNotice(null)}>
          {addedNotice}
        </Alert>
      )}
      {addItem.error && !draftCard && <Alert severity="error">{addItem.error.message}</Alert>}

      {/* Header and add panel share one Stack child, so no spacing margin disappears when the collapse unmounts. */}
      <Box>
        <CollectionHeader
          title="My collection"
          totals={totals}
          summaryError={summary.error}
          showTotals={false}
          addOpen={addOpen}
          onAddCard={() => (addOpen ? closeAdd() : setAddOpen(true))}
        />

        <Collapse in={addOpen} unmountOnExit onExited={() => setDraftCard(undefined)}>
          <Box sx={{ pt: 4 }}>
            <Stack spacing={2} id="add-card-section">
              <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography
                      variant="overline"
                      sx={{ color: palette.goldLight, letterSpacing: '0.14em' }}
                    >
                      Add a card
                    </Typography>
                    <IconButton size="small" onClick={closeAdd} aria-label="Close add card">
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <CardSearchField
                    onSelect={(card) => {
                      setDraftCard(card);
                      setPanelClosing(false);
                    }}
                    showSet={false}
                    focusSignal={addFocus}
                  />
                </Stack>
              </Paper>

              {draftCard && (
                <Collapse
                  in={!panelClosing}
                  timeout={260}
                  unmountOnExit
                  onExited={handlePanelClosed}
                >
                  <Fade in={!panelClosing} timeout={260}>
                    <Box>
                      <AddCardPanel
                        // Remounts on a different card so the previous choices do not carry over.
                        key={draftCard.oracleId}
                        card={draftCard}
                        onAdd={(input) =>
                          addItem.mutate(input, {
                            // Keep the panel open on failure so the owner's choices survive.
                            onSuccess: () => setPanelClosing(true),
                          })
                        }
                        onCancel={() => setDraftCard(undefined)}
                        pending={addItem.isPending}
                        error={addItem.error?.message}
                      />
                    </Box>
                  </Fade>
                </Collapse>
              )}
            </Stack>
          </Box>
        </Collapse>
      </Box>

      {addOpen && <Divider />}

      {me.data && (
        <TradeBinderPreview
          variant="owner"
          username={me.data.username}
          visibility={me.data.tradeBinderVisibility}
          cardCount={totals?.forTradeCount ?? 0}
          value={totals?.forTradeValue ?? '0.00'}
          onTheTable={totals?.onTheTable ?? 0}
        />
      )}

      <CollectionOverview enabled={isAuthenticated} totals={totals} />

      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
        <Button
          component={RouterLink}
          to="/collection/cards"
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          View all cards
        </Button>
      </Box>

      <MostExpensiveCards enabled={isAuthenticated} />

      <TopMovers enabled={isAuthenticated} />

      <Divider />

      <GroupsSection />
    </Stack>
  );
}

function GroupsSection() {
  const { data, isLoading, error } = useGroups(true);
  const createGroup = useCreateGroup();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createGroup.mutate(
      { name: trimmed },
      {
        onSuccess: (group) => {
          setName('');
          setCreating(false);
          void navigate(`/groups/${group.id}`);
        },
      },
    );
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            Groups
          </Typography>
          <PlusMinusButton
            open={creating}
            label={creating ? 'Close new group' : 'New group'}
            onClick={() => setCreating((open) => !open)}
          />
        </Stack>

        <Collapse in={creating} unmountOnExit>
          <Box sx={{ pt: 2 }}>
            <Paper sx={{ p: 3 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Group name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
                  fullWidth
                  placeholder="Modern staples"
                />
                <Button
                  variant="contained"
                  onClick={handleCreate}
                  disabled={!name.trim() || createGroup.isPending}
                  sx={{ minWidth: 140 }}
                >
                  Create
                </Button>
              </Stack>
              {createGroup.error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {createGroup.error.message}
                </Alert>
              )}
            </Paper>
          </Box>
        </Collapse>
      </Box>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{error.message}</Alert>}
      {data && data.items.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No groups yet. They are optional. Use them to mark a pile, like a deck box or a trade
          stack.
        </Typography>
      )}

      <Box
        sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}
      >
        {data?.items.map((group) => (
          <Paper
            key={group.id}
            component={RouterLink}
            to={`/groups/${group.id}`}
            sx={{
              p: 2.5,
              display: 'block',
              minWidth: 0,
              cursor: 'pointer',
              textDecoration: 'none',
              transition:
                'background-color 120ms ease, border-color 120ms ease, transform 120ms ease',
              '&:hover, &:focus-visible': {
                backgroundColor: palette.goldTint,
                borderColor: palette.goldLight,
                transform: 'translateY(-2px)',
              },
              '&:focus-visible': { outline: `2px solid ${palette.gold}`, outlineOffset: -2 },
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
              spacing={1}
            >
              <Typography variant="h3" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {group.name}
              </Typography>
              <Stack
                direction="row"
                spacing={0.5}
                useFlexGap
                flexWrap="wrap"
                sx={{ justifyContent: 'flex-end' }}
              >
                <Chip label={`${group.itemCount ?? 0} cards`} size="small" variant="outlined" />
                <Chip
                  label={money.format(Number(group.value ?? 0))}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              </Stack>
            </Stack>
            {group.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {group.description}
              </Typography>
            )}
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}
