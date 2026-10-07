import { useAuth0 } from '@auth0/auth0-react';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useAddWant, useRemoveWant, useWants } from '../api/queries';
import { CardSearchField } from '../components/CardSearchField';

const priorityLabels: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };

export function WantsPage() {
  const { isAuthenticated } = useAuth0();
  const { data, isLoading, error } = useWants(isAuthenticated);
  const addWant = useAddWant();
  const removeWant = useRemoveWant();

  if (!isAuthenticated) return <Alert severity="info">Sign in to keep a want list.</Alert>;
  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h1">Want list</Typography>
        <Typography variant="body2" color="text.secondary">
          Wants are stored per card, not per printing, so any version of the card counts as a match.
        </Typography>
      </Stack>

      <Paper sx={{ p: 3 }}>
        <CardSearchField
          label="Add a card you are hunting"
          onSelect={(card) => addWant.mutate({ oracleId: card.oracleId, quantity: 1, priority: 2 })}
          disabled={addWant.isPending}
        />
        {addWant.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {addWant.error.message}
          </Alert>
        )}
      </Paper>

      {data && data.items.length === 0 ? (
        <Alert severity="info">Your want list is empty.</Alert>
      ) : (
        <Paper>
          <List disablePadding>
            {data?.items.map((want) => (
              <ListItem
                key={want.id}
                divider
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label={`Remove ${want.cardName ?? 'card'}`}
                    onClick={() => removeWant.mutate(want.id)}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={want.cardName ?? want.oracleId}
                  secondary={`Want ${want.quantity} · ${priorityLabels[want.priority] ?? 'Medium'} priority`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Stack>
  );
}
