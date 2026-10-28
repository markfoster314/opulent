import { Button, Paper, Stack } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MOCK_SCENARIOS, readScenario, writeScenario, type MockScenario } from '@/mocks/scenario';

const LABELS: Record<MockScenario, string> = {
  ok: 'Ok',
  empty: 'Empty',
  slow: 'Slow',
  '401': '401',
  '404': '404',
  '500': '500',
  offline: 'Offline',
};

export function MockPanel() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<MockScenario>(() => readScenario());

  function choose(next: MockScenario) {
    writeScenario(next);
    setScenario(next);
    void queryClient.resetQueries();
  }

  return (
    <Stack
      spacing={1}
      sx={{
        position: 'fixed',
        left: 16,
        bottom: 16,
        zIndex: (theme) => theme.zIndex.modal,
        width: open ? 'min(320px, calc(100vw - 32px))' : 'auto',
        alignItems: 'flex-start',
      }}
    >
      {open ? (
        <Paper sx={{ p: 1 }}>
          <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>
            {MOCK_SCENARIOS.map((choice) => (
              <Button
                key={choice}
                variant={choice === scenario ? 'contained' : 'outlined'}
                aria-pressed={choice === scenario}
                onClick={() => choose(choice)}
              >
                {LABELS[choice]}
              </Button>
            ))}
          </Stack>
        </Paper>
      ) : null}
      <Button
        variant="contained"
        onClick={() => setOpen((value) => !value)}
        sx={{ alignSelf: 'flex-start' }}
      >
        Mocks
      </Button>
    </Stack>
  );
}
