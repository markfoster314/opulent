import { AppBar, Box, Button, Chip, Container, Stack, Toolbar, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { createDevChannel, type DevChannel, type DevMessage, type RequestEntry } from './channel';
import { RequestLog } from './RequestLog';
import { EndpointsSection } from './sections/EndpointsSection';
import { EventsSection } from './sections/EventsSection';
import { NetworkSection } from './sections/NetworkSection';
import { SessionSection } from './sections/SessionSection';
import { UsersSection } from './sections/UsersSection';
import { resetDevState, writeDevState, type DevEvent, type DevState } from './state';
import { useDevState } from './useDevState';

const MAX_ENTRIES = 50;

export function DevConsole({ apiBaseUrl, mockOnly }: { apiBaseUrl: string; mockOnly: boolean }) {
  const state = useDevState();
  const channelRef = useRef<DevChannel | null>(null);
  const connectedRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [entries, setEntries] = useState<RequestEntry[]>([]);

  useEffect(() => {
    const channel = createDevChannel((message) => {
      if (message.type === 'snapshot') {
        connectedRef.current = true;
        setConnected(true);
        setEntries(message.entries);
      }
      if (message.type === 'request') {
        connectedRef.current = true;
        setConnected(true);
        setEntries((current) => [message.entry, ...current].slice(0, MAX_ENTRIES));
      }
    });
    channelRef.current = channel;
    channel.post({ type: 'hello' });

    const timer = window.setInterval(() => {
      if (!connectedRef.current) channel.post({ type: 'hello' });
    }, 2000);

    return () => {
      window.clearInterval(timer);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  function post(message: DevMessage) {
    channelRef.current?.post(message);
  }

  function update(patch: Partial<DevState>) {
    writeDevState(patch);
  }

  function onEvent(name: DevEvent) {
    post({ type: 'event', name });
  }

  function reset() {
    resetDevState();
    post({ type: 'event', name: 'reset' });
  }

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" elevation={0}>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Dev console
          </Typography>
          <Chip
            size="small"
            color={connected ? 'success' : 'default'}
            label={connected ? 'App connected' : 'App not open'}
          />
          <Button size="small" component="a" href="/">
            Open app
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <SessionSection state={state} update={update} mockOnly={mockOnly} />
          <NetworkSection state={state} update={update} mockOnly={mockOnly} />
          <EndpointsSection state={state} update={update} />
          <UsersSection apiBaseUrl={apiBaseUrl} />
          <EventsSection onEvent={onEvent} />
          <RequestLog entries={entries} />
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button size="small" variant="outlined" color="warning" onClick={reset}>
              Reset all
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
