import { useAuth0 } from '@auth0/auth0-react';
import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Fade,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { Card } from '@opulent/shared';
import { binderVisibilityLabels } from '@opulent/shared';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  useAddGlobalWant,
  useAllWantItems,
  useCreateWantList,
  useExportWants,
  useGenericWants,
  useWantLists,
} from '../api/queries';
import { CardGrid } from '../components/CardGrid';
import { CardSearchField } from '../components/CardSearchField';
import { GenericWantsSection } from '../components/GenericWantsSection';
import { PlusMinusButton } from '../components/PlusMinusButton';
import { WantCardPanel } from '../components/WantCardPanel';
import { WantItemTile } from '../components/WantItemTile';
import { clickableSurfaceSx, palette } from '../theme';

const PREVIEW_WANTS = 6;

function downloadWantsCsv(csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'opulent-tutor-wants.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function WantsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const listsQuery = useWantLists(isAuthenticated);
  const allWants = useAllWantItems(isAuthenticated);
  const generic = useGenericWants(isAuthenticated);
  const createList = useCreateWantList();
  const addWant = useAddGlobalWant();
  const exportWants = useExportWants();

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [panelClosing, setPanelClosing] = useState(false);
  const [draftCard, setDraftCard] = useState<Card | undefined>(undefined);

  if (authLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to keep your want lists.</Alert>;

  const lists = listsQuery.data?.items ?? [];
  const wants = allWants.data?.items ?? [];
  const totalCopies = wants.reduce((sum, want) => sum + want.quantity, 0);
  const highPriority = wants.filter((want) => want.priority === 1).length;

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createList.mutate(
      { name: trimmed, visibility: 'private' },
      {
        onSuccess: () => {
          setName('');
          setCreating(false);
        },
      },
    );
  }

  function closeAdd() {
    setAddOpen(false);
  }

  function toggleAdd() {
    if (addOpen) closeAdd();
    else setAddOpen(true);
  }

  function handlePanelClosed() {
    if (!panelClosing) return;
    setDraftCard(undefined);
    setPanelClosing(false);
  }

  return (
    <Stack spacing={4}>
      <Box>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
          >
            <Typography variant="h1">My wants</Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              sx={{ flexShrink: 0 }}
            >
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={toggleAdd}
                aria-expanded={addOpen}
                aria-controls="add-want-section"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Add a card
              </Button>
              <Button
                component={RouterLink}
                to="/wants/import"
                variant="outlined"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Import CSV
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => exportWants.mutate(undefined, { onSuccess: downloadWantsCsv })}
                disabled={exportWants.isPending}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {exportWants.isPending ? 'Preparing…' : 'Export CSV'}
              </Button>
            </Stack>
          </Stack>
          {exportWants.error && <Alert severity="error">{exportWants.error.message}</Alert>}
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={`${totalCopies} card${totalCopies === 1 ? '' : 's'}`} />
            <Chip label={`${highPriority} high priority`} />
            <Chip label={`${lists.length} list${lists.length === 1 ? '' : 's'}`} />
            <Chip label={`${generic.data?.items.length ?? 0} interests`} />
          </Stack>
        </Stack>

        <Collapse
          in={addOpen}
          unmountOnExit
          onExited={() => {
            setDraftCard(undefined);
            setPanelClosing(false);
          }}
        >
          <Box sx={{ pt: 4 }}>
            <Stack spacing={2} id="add-want-section">
              <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack spacing={2}>
                  <Typography
                    variant="overline"
                    sx={{ color: palette.goldLight, letterSpacing: '0.14em' }}
                  >
                    Add a card
                  </Typography>
                  <CardSearchField
                    onSelect={(card) => {
                      setDraftCard(card);
                      setPanelClosing(false);
                    }}
                    showSet={false}
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
                      <WantCardPanel
                        key={draftCard.oracleId}
                        card={draftCard}
                        lists={lists}
                        onAdd={(input) =>
                          addWant.mutate(input, {
                            onSuccess: () => setPanelClosing(true),
                          })
                        }
                        onCancel={() => setPanelClosing(true)}
                        pending={addWant.isPending}
                        error={addWant.error?.message}
                      />
                    </Box>
                  </Fade>
                </Collapse>
              )}
            </Stack>
          </Box>
        </Collapse>
      </Box>

      <Divider />

      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            Lists
          </Typography>
          <PlusMinusButton
            open={creating}
            label={creating ? 'Close new list' : 'New list'}
            onClick={() => setCreating((open) => !open)}
          />
        </Stack>

        <Collapse in={creating} unmountOnExit>
          <Box sx={{ pt: 2 }}>
            <Paper sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="List name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
                  fullWidth
                  placeholder="Commander upgrades"
                />
                <Button
                  variant="contained"
                  onClick={handleCreate}
                  disabled={!name.trim() || createList.isPending}
                  sx={{ minWidth: 140, width: { xs: '100%', sm: 'auto' } }}
                >
                  Create
                </Button>
              </Stack>
              {createList.error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {createList.error.message}
                </Alert>
              )}
            </Paper>
          </Box>
        </Collapse>
      </Box>

      {listsQuery.isLoading && <CircularProgress />}
      {listsQuery.error && <Alert severity="error">{listsQuery.error.message}</Alert>}
      {listsQuery.isSuccess && lists.length === 0 && (
        <Alert severity="info">No lists yet. Create one to group your wants.</Alert>
      )}

      <Box
        sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}
      >
        {lists.map((list) => (
          <Paper
            key={list.id}
            component={RouterLink}
            to={`/wants/${list.id}`}
            sx={{ p: 2.5, display: 'block', ...clickableSurfaceSx }}
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
                {list.name}
              </Typography>
              <Chip
                label={binderVisibilityLabels[list.visibility]}
                size="small"
                variant="outlined"
                color={list.visibility === 'public' ? 'primary' : 'secondary'}
              />
            </Stack>
            {list.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
              >
                {list.description}
              </Typography>
            )}
            <Typography variant="body2" color="secondary" sx={{ mt: 0.5 }}>
              {list.itemCount ?? 0} card{(list.itemCount ?? 0) === 1 ? '' : 's'}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Divider />

      <GenericWantsSection />

      <Divider />

      <Stack spacing={2}>
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
          <Typography variant="h2">All wants</Typography>
          <Button component={RouterLink} to="/wants/all" variant="outlined">
            View all wants
          </Button>
        </Stack>

        {allWants.isLoading && <CircularProgress />}
        {allWants.error && <Alert severity="error">{allWants.error.message}</Alert>}
        {allWants.isSuccess && wants.length === 0 && (
          <Alert severity="info">No cards yet. Add one above.</Alert>
        )}

        <CardGrid>
          {wants.slice(0, PREVIEW_WANTS).map((want) => (
            <WantItemTile
              key={want.id}
              item={want}
              readOnly
              saving={false}
              onUpdate={() => undefined}
              onRemove={() => undefined}
            />
          ))}
        </CardGrid>
      </Stack>
    </Stack>
  );
}
