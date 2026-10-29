import { Chip, Stack, Typography } from '@mui/material';
import type { RequestEntry } from './channel';
import { Section } from './Section';

export function RequestLog({ entries }: { entries: RequestEntry[] }) {
  return (
    <Section title="Requests">
      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No requests yet
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {entries.map((entry) => (
            <Stack
              key={`${entry.tab}-${entry.id}`}
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
            >
              <Chip
                size="small"
                color={entry.source === 'mock' ? 'primary' : 'default'}
                label={entry.source === 'mock' ? 'Mock' : 'Real'}
              />
              <Typography
                variant="body2"
                sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}
              >
                {entry.method} {entry.path}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {entry.status}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Section>
  );
}
