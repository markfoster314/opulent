import { Button, Stack } from '@mui/material';
import type { DevEvent } from '../state';
import { Section } from '../Section';

const EVENTS: readonly { name: DevEvent; label: string }[] = [
  { name: 'trade', label: 'Trade request' },
  { name: 'match', label: 'New match' },
  { name: 'price', label: 'Price change' },
  { name: 'refetch', label: 'Refetch all' },
  { name: 'clear', label: 'Clear cache' },
];

export function EventsSection({ onEvent }: { onEvent: (name: DevEvent) => void }) {
  return (
    <Section title="Events">
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {EVENTS.map((event) => (
          <Button
            key={event.name}
            size="small"
            variant="outlined"
            onClick={() => onEvent(event.name)}
          >
            {event.label}
          </Button>
        ))}
      </Stack>
    </Section>
  );
}
