import { Button, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import type { PlaceRef } from '@opulent/shared';
import { useEffect, useState } from 'react';
import { Section } from '../Section';

type PlaceOption = PlaceRef;

interface ViewerOption {
  id: string;
  username: string;
  wantCount: number;
}

export function UsersSection({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [placeId, setPlaceId] = useState<number | ''>('');
  const [count, setCount] = useState(10);
  const [viewers, setViewers] = useState<ViewerOption[]>([]);
  const [matchUserId, setMatchUserId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/__dev/viewers`);
        if (!response.ok) return;
        const body = (await response.json()) as { items: ViewerOption[] };
        if (active) setViewers(body.items);
      } catch {
        // The API is optional for the other sections.
      }
    })();
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  async function search() {
    try {
      const response = await fetch(`${apiBaseUrl}/__dev/places?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        setMessage('City search failed');
        return;
      }
      const body = (await response.json()) as { items: PlaceOption[] };
      setPlaces(body.items);
      setPlaceId(body.items[0]?.geonameId ?? '');
    } catch {
      setMessage('API is not running');
    }
  }

  async function create() {
    if (placeId === '') return;
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/__dev/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId,
          count,
          prefix: 'demo',
          ...(matchUserId ? { matchUserId } : {}),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        created?: number;
        error?: { message?: string };
      };
      setMessage(
        response.ok
          ? `Created ${body.created ?? 0} users`
          : (body.error?.message ?? 'Create failed'),
      );
    } catch {
      setMessage('API is not running');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/__dev/users`, { method: 'DELETE' });
      const body = (await response.json().catch(() => ({}))) as { removed?: number };
      setMessage(response.ok ? `Removed ${body.removed ?? 0} users` : 'Remove failed');
    } catch {
      setMessage('API is not running');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Users">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <TextField
          size="small"
          label="City"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ flexGrow: 1 }}
        />
        <Button size="small" variant="outlined" onClick={() => void search()} disabled={busy}>
          Search
        </Button>
      </Stack>
      {places.length > 0 ? (
        <Select
          size="small"
          value={placeId}
          onChange={(event) => setPlaceId(Number(event.target.value))}
        >
          {places.map((place) => (
            <MenuItem key={place.geonameId} value={place.geonameId}>
              {place.label}
            </MenuItem>
          ))}
        </Select>
      ) : null}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <TextField
          size="small"
          label="Count"
          type="number"
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          sx={{ width: { sm: 120 } }}
        />
        <Select
          size="small"
          displayEmpty
          value={matchUserId}
          onChange={(event) => setMatchUserId(event.target.value)}
          sx={{ minWidth: 190 }}
        >
          <MenuItem value="">No match cards</MenuItem>
          {viewers.map((viewer) => (
            <MenuItem key={viewer.id} value={viewer.id}>
              {viewer.username} ({viewer.wantCount})
            </MenuItem>
          ))}
        </Select>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="contained"
          onClick={() => void create()}
          disabled={busy || placeId === ''}
        >
          Create
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="warning"
          onClick={() => void remove()}
          disabled={busy}
        >
          Remove demo users
        </Button>
      </Stack>
      {message ? <Typography variant="body2">{message}</Typography> : null}
    </Section>
  );
}
