import { useAuth0 } from '@auth0/auth0-react';
import { Alert, CircularProgress, Stack, Typography } from '@mui/material';
import type { WantItem } from '@opulent/shared';
import { useParams } from 'react-router-dom';
import { useAllWantItems, usePublicWantItems } from '../api/queries';
import { CardGrid } from '../components/CardGrid';
import { WantItemTile } from '../components/WantItemTile';

export function MineAllWantsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const wants = useAllWantItems(isAuthenticated);
  if (authLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to see all of your wants.</Alert>;
  return (
    <CollectedWantsView
      title="All wants"
      subtitle="Every card across your want lists."
      loading={wants.isLoading}
      error={wants.error?.message}
      items={wants.data?.items ?? []}
    />
  );
}

export function PublicAllWantsPage() {
  const { handle } = useParams<{ handle: string }>();
  const wants = usePublicWantItems(handle);
  return (
    <CollectedWantsView
      title="All public wants"
      subtitle={`Cards @${handle ?? ''} wants in public lists.`}
      loading={wants.isLoading}
      error={wants.error?.message}
      items={wants.data?.items ?? []}
    />
  );
}

function CollectedWantsView({
  title,
  subtitle,
  loading,
  error,
  items,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  error: string | undefined;
  items: WantItem[];
}) {
  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1">{title}</Typography>
        <Typography color="text.secondary">{subtitle}</Typography>
      </Stack>
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
