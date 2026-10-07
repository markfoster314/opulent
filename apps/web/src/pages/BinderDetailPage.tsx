import { useAuth0 } from '@auth0/auth0-react';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { useAddBinderItem, useBinderItems, useRemoveBinderItem } from '../api/queries';
import { CardGrid } from '../components/CardGrid';
import { CardSearchField } from '../components/CardSearchField';
import { CardTile } from '../components/CardTile';

export function BinderDetailPage() {
  const { binderId } = useParams<{ binderId: string }>();
  const { isAuthenticated } = useAuth0();

  const { data, isLoading, error } = useBinderItems(binderId);
  const addItem = useAddBinderItem(binderId ?? '');
  const removeItem = useRemoveBinderItem(binderId ?? '');

  if (!isAuthenticated) return <Alert severity="info">Sign in to edit this binder.</Alert>;
  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Stack spacing={4}>
      <Typography variant="h1">Binder</Typography>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>
          Add a card
        </Typography>
        <CardSearchField
          onSelect={(card) =>
            addItem.mutate({
              scryfallId: card.scryfallId,
              quantity: 1,
              finish: 'nonfoil',
              condition: 'NM',
              language: 'en',
              forTrade: true,
            })
          }
          disabled={addItem.isPending}
        />
        {addItem.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {addItem.error.message}
          </Alert>
        )}
      </Paper>

      {data && data.items.length === 0 && (
        <Alert severity="info">This binder is empty. Add a card above.</Alert>
      )}

      <CardGrid>
        {data?.items.map((item) =>
          item.card ? (
            <Stack key={item.id} spacing={1}>
              <CardTile
                card={item.card}
                quantity={item.quantity}
                caption={`${item.card.setCode.toUpperCase()} · ${item.finish} · ${item.condition}`}
              />
              <IconButton
                size="small"
                aria-label={`Remove ${item.card.name}`}
                onClick={() => removeItem.mutate(item.id)}
                sx={{ alignSelf: 'center' }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ) : null,
        )}
      </CardGrid>

      {data?.nextCursor && (
        <Button variant="outlined" sx={{ alignSelf: 'center' }}>
          Load more
        </Button>
      )}
    </Stack>
  );
}
