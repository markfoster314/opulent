import CloseIcon from '@mui/icons-material/Close';
import { Alert, Box, Collapse, Fade, IconButton, Paper, Stack, Typography } from '@mui/material';
import type { Card, WantList } from '@opulent/shared';
import { useState } from 'react';
import { useAddGlobalWant } from '@/features/wants/queries';
import { palette } from '@/theme';
import { CardSearchField } from '@/shared/cards/CardSearchField';
import { WantCardPanel } from './WantCardPanel';

interface WantAddSectionProps {
  open: boolean;
  onClose: () => void;
  lists: WantList[];
  defaultListId?: string | undefined;
  onAdded?: () => void;
}

export function WantAddSection({
  open,
  onClose,
  lists,
  defaultListId,
  onAdded,
}: WantAddSectionProps) {
  const addWant = useAddGlobalWant();
  const [draftCard, setDraftCard] = useState<Card | undefined>(undefined);
  const [panelClosing, setPanelClosing] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);

  function handlePanelClosed() {
    if (!panelClosing) return;
    setDraftCard(undefined);
    setPanelClosing(false);
    setFocusSignal((current) => current + 1);
    onAdded?.();
  }

  return (
    <Collapse
      in={open}
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
              <Stack
                direction="row"
                sx={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography
                  variant="overline"
                  sx={{ color: palette.goldLight, letterSpacing: '0.14em' }}
                >
                  Add a card
                </Typography>
                <IconButton size="small" onClick={onClose} aria-label="Close add card">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
              <CardSearchField
                onSelect={(card) => {
                  setDraftCard(card);
                  setPanelClosing(false);
                }}
                showSet={false}
                focusSignal={focusSignal}
              />
            </Stack>
          </Paper>

          {draftCard && (
            <Collapse in={!panelClosing} timeout={260} unmountOnExit onExited={handlePanelClosed}>
              <Fade in={!panelClosing} timeout={260}>
                <Box>
                  <WantCardPanel
                    key={draftCard.oracleId}
                    card={draftCard}
                    lists={lists}
                    defaultListId={defaultListId}
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

          {addWant.error && !draftCard && <Alert severity="error">{addWant.error.message}</Alert>}
        </Stack>
      </Box>
    </Collapse>
  );
}
