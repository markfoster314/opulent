import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import type { WantItem } from '@opulent/shared';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '@/app/session';
import { useAllWantItems, usePublicWantItems, useWantLists } from '@/features/wants/queries';
import { CardGrid } from '@/shared/cards/CardGrid';
import { WantAddSection } from '@/features/wants/WantAddSection';
import { WantCardsBrowser } from '@/features/wants/WantCardsBrowser';
import { WantItemTile } from '@/features/wants/WantItemTile';

export function MineAllWantsPage() {
  const { isAuthenticated, isLoading: authLoading } = useSession();
  const wants = useAllWantItems(isAuthenticated);
  const lists = useWantLists(isAuthenticated);
  const [addOpen, setAddOpen] = useState(false);

  if (authLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to see all of your wants.</Alert>;

  const items = wants.data?.items ?? [];
  const listItems = lists.data?.items ?? [];
  const totalCopies = items.reduce((sum, item) => sum + item.quantity, 0);
  const highPriority = items.filter((item) => item.priority === 1).length;

  return (
    <Stack spacing={4}>
      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: { sm: 'flex-start' },
          }}
        >
          <Stack spacing={1}>
            <Typography variant="h1">All wants</Typography>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{
                flexWrap: 'wrap',
              }}
            >
              <Chip label={`${totalCopies} card${totalCopies === 1 ? '' : 's'}`} />
              <Chip label={`${highPriority} high priority`} />
              <Chip label={`${listItems.length} list${listItems.length === 1 ? '' : 's'}`} />
            </Stack>
          </Stack>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen((open) => !open)}
            aria-expanded={addOpen}
            aria-controls="add-want-section"
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Add a card
          </Button>
        </Stack>

        <WantAddSection open={addOpen} onClose={() => setAddOpen(false)} lists={listItems} />
      </Box>

      <Divider />

      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
          }}
        >
          <Typography variant="h2">Cards</Typography>
          <Chip size="small" label={items.length} />
        </Stack>
        <WantCardsBrowser
          items={items}
          lists={listItems}
          mode="all"
          loading={wants.isLoading}
          error={wants.error?.message}
        />
      </Stack>
    </Stack>
  );
}

export function PublicAllWantsPage() {
  const { handle } = useParams<{ handle: string }>();
  const wants = usePublicWantItems(handle);
  const items = wants.data?.items ?? [];

  return (
    <CollectedWantsView
      title="All public wants"
      loading={wants.isLoading}
      error={wants.error?.message}
      items={items}
    />
  );
}

function CollectedWantsView({
  title,
  loading,
  error,
  items,
}: {
  title: string;
  loading: boolean;
  error: string | undefined;
  items: WantItem[];
}) {
  return (
    <Stack spacing={3}>
      <Typography variant="h1">{title}</Typography>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && items.length === 0 && (
        <Alert severity="info">No wants here yet.</Alert>
      )}
      <CardGrid>
        {items.map((item) => (
          <WantItemTile
            key={item.id}
            item={item}
            readOnly
            saving={false}
            onUpdate={() => undefined}
            onRemove={() => undefined}
          />
        ))}
      </CardGrid>
    </Stack>
  );
}
