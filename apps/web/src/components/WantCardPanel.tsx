import CloseIcon from '@mui/icons-material/Close';
import { Alert, Box, Button, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import type {
  AddWantItemInput,
  Card,
  CardCondition,
  CardFinish,
  CardLanguage,
} from '@opulent/shared';
import { useState } from 'react';
import { palette } from '../theme';
import { WantScopeFields, type WantScopeValue } from './WantScopeFields';

interface WantCardPanelProps {
  card: Card;
  onAdd: (input: AddWantItemInput) => void;
  onCancel: () => void;
  pending: boolean;
  error?: string | undefined;
}

const emptyScope: WantScopeValue = {
  languages: [],
  finishes: [],
  conditions: [],
  sets: [],
};

/** After a search hit, the owner picks how many and which printings count. */
export function WantCardPanel({ card, onAdd, onCancel, pending, error }: WantCardPanelProps) {
  const [quantity, setQuantity] = useState('1');
  const [scope, setScope] = useState<WantScopeValue>(emptyScope);

  const parsedQuantity = Number(quantity);
  const quantityError =
    quantity.trim() === '' ||
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity < 1 ||
    parsedQuantity > 999;

  function handleAdd() {
    if (quantityError) return;
    onAdd({
      oracleId: card.oracleId,
      quantity: parsedQuantity,
      priority: 2,
      wantedLanguages: scope.languages as CardLanguage[],
      unwantedLanguages: [],
      wantedFinishes: scope.finishes as CardFinish[],
      unwantedFinishes: [],
      wantedConditions: scope.conditions as CardCondition[],
      unwantedConditions: [],
      wantedSets: scope.sets,
      unwantedSets: [],
    });
  }

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, borderColor: palette.goldLight }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography variant="h3" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {card.name}
        </Typography>
        <IconButton onClick={onCancel} aria-label="Cancel adding this card" size="small">
          <CloseIcon />
        </IconButton>
      </Stack>

      <TextField
        label="How many"
        type="number"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        error={quantityError}
        helperText={quantityError ? 'Pick a whole number from 1 to 999' : ' '}
        slotProps={{ htmlInput: { min: 1, max: 999 } }}
        fullWidth
        sx={{ mt: 2 }}
      />

      <Stack spacing={2} sx={{ mt: 1 }}>
        <WantScopeFields
          oracleId={card.oracleId}
          idPrefix="add-want"
          value={scope}
          onChange={(patch) => setScope((current) => ({ ...current, ...patch }))}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 3 }}>
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={quantityError || pending}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          {pending ? 'Adding…' : 'Add to list'}
        </Button>
      </Box>
    </Paper>
  );
}
