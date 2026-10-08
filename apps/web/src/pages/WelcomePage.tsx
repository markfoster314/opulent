import { useAuth0 } from '@auth0/auth0-react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { Me, PlaceRef } from '@opulent/shared';
import { isReservedUsername, usernameSchema } from '@opulent/shared';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useCompleteOnboarding, useMe, useUsernameAvailability } from '../api/queries';
import { CitySearchField } from '../components/CitySearchField';
import { useDebounced } from '../hooks/useDebounced';
import { palette } from '../theme';

/**
 * Shown once, straight after the first sign-in.
 *
 * Until this is saved the user is carrying a generated username such as
 * `mark_a1b2c3`, which would otherwise end up in every link they share.
 */
export function WelcomePage() {
  const { isAuthenticated, isLoading } = useAuth0();
  const me = useMe(isAuthenticated);

  if (!isLoading && !isAuthenticated) return <Navigate to="/" replace />;

  if (!me.data) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return <WelcomeForm key={me.data.id} me={me.data} />;
}

function WelcomeForm({ me }: { me: Me }) {
  const location = useLocation();
  const navigate = useNavigate();
  const completeOnboarding = useCompleteOnboarding();

  const reduceMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  ).current;
  const [username, setUsername] = useState('');
  const [city, setCity] = useState<PlaceRef | null>(null);
  const [welcomeDone, setWelcomeDone] = useState(reduceMotion);
  const [promptDone, setPromptDone] = useState(reduceMotion);
  const usernameRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  // Fold case as the user types rather than complaining about it afterwards.
  // Somebody entering "Mark" means "mark", and watching it happen in the field
  // is clearer than reading a rule that says capitals are not allowed.
  const normalized = username.trim().toLowerCase();
  const debounced = useDebounced(normalized, 300);
  const settled = debounced === normalized;

  const shape = usernameSchema.safeParse(normalized);
  const reserved = shape.success && isReservedUsername(normalized);
  const shapeError =
    normalized.length > 0 && !shape.success ? (shape.error.issues[0]?.message ?? null) : null;

  const availability = useUsernameAvailability(
    debounced,
    usernameSchema.safeParse(debounced).success && !isReservedUsername(debounced),
  );

  const canSave = shape.success && !reserved && settled && availability.data?.available === true;

  /** Where the user was heading before being stopped, such as a shared binder. */
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/binders';

  if (me.onboarded) return <Navigate to={returnTo} replace />;

  function handleSave() {
    if (!canSave) return;
    completeOnboarding.mutate(
      { username: normalized, ...(city ? { placeId: city.geonameId } : {}) },
      { onSuccess: () => void navigate(returnTo, { replace: true }) },
    );
  }

  const checking = !settled || availability.isFetching;

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.inert = !promptDone;
    if (!promptDone) return;
    usernameRef.current?.focus();
  }, [promptDone]);

  return (
    <Stack spacing={3} sx={{ maxWidth: 560, mx: 'auto' }}>
      <TypedLine
        text={WELCOME_LINE}
        goldStart={WELCOME_PREFIX.length}
        active
        onDone={() => setWelcomeDone(true)}
        variant="h2"
      />

      <TypedLine
        text={PROMPT_LINE}
        active={welcomeDone}
        onDone={() => setPromptDone(true)}
        variant="body1"
        color="text.secondary"
      />

      {/*
       * Kept at full height while invisible, so the title, the subtitle, and
       * the footer do not move when this block fades in.
       */}
      <Stack
        ref={detailsRef}
        spacing={3}
        aria-hidden={!promptDone}
        sx={{
          opacity: promptDone ? 1 : 0,
          pointerEvents: promptDone ? 'auto' : 'none',
          transition: 'opacity 600ms ease',
        }}
      >
        <Stack spacing={1}>
          <Typography variant="h1">
            Pick a{' '}
            <Box component="span" sx={{ color: palette.gold }}>
              username
            </Box>
            .
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This is the name people see, and it is the name in every binder link you share. It must
            be unique. Letters, numbers and underscores only - no spaces.
          </Typography>
        </Stack>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={3}>
            <TextField
              label="Username"
              value={normalized}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="mark"
              inputRef={usernameRef}
              error={Boolean(shapeError) || reserved || availability.data?.available === false}
              helperText={describe({
                empty: normalized.length === 0,
                shapeError,
                reserved,
                checking,
                takenReason:
                  availability.data?.available === false ? availability.data.reason : null,
              })}
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      {normalized.length > 0 && checking && <CircularProgress size={18} />}
                      {!checking && availability.data?.available === true && (
                        <CheckCircleIcon fontSize="small" sx={{ color: palette.gold }} />
                      )}
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </Paper>

        <Stack spacing={1}>
          <Typography variant="h1">
            Select your{' '}
            <Box component="span" sx={{ color: palette.gold }}>
              City
            </Box>
            .
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Optional. Type the city, the state, and the country to pick the right one.
          </Typography>
        </Stack>

        <Paper sx={{ p: 3 }}>
          <CitySearchField
            value={city}
            onChange={setCity}
            helperText="For example, Austin, Texas, United States. You can leave this blank."
          />
        </Paper>

        {completeOnboarding.error && (
          <Alert severity="error">{completeOnboarding.error.message}</Alert>
        )}

        <Button
          variant="contained"
          size="large"
          onClick={handleSave}
          disabled={!canSave || completeOnboarding.isPending}
        >
          {completeOnboarding.isPending ? 'Saving…' : 'Start my binder'}
        </Button>
      </Stack>
    </Stack>
  );
}

const WELCOME_PREFIX = 'Welcome to ';
const WELCOME_LINE = `${WELCOME_PREFIX}Opulent Tutor`;
const PROMPT_LINE = "Let's finish setting up your account.";
const TYPE_DELAY_MS = 33;

/**
 * Types one line, one character at a time, with a gold caret.
 *
 * `goldStart` paints from that character onward in gold, so "Opulent Tutor"
 * can be gold while "Welcome to " stays the normal text color.
 * The full line is always in the layout, invisibly, so the page does not grow
 * as characters appear. The caret goes away when the line is finished.
 */
function TypedLine({
  text,
  active,
  goldStart,
  onDone,
  variant,
  color,
}: {
  text: string;
  active: boolean;
  goldStart?: number;
  onDone: () => void;
  variant: 'h2' | 'body1';
  color?: string;
}) {
  const reduceMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  ).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [count, setCount] = useState(reduceMotion ? text.length : 0);
  const done = count >= text.length;

  useEffect(() => {
    if (!active) return;
    if (reduceMotion) {
      onDoneRef.current();
      return;
    }
    if (done) {
      const pause = window.setTimeout(() => onDoneRef.current(), 280);
      return () => window.clearTimeout(pause);
    }
    const step = window.setTimeout(() => setCount((current) => current + 1), TYPE_DELAY_MS);
    return () => window.clearTimeout(step);
  }, [active, count, done, reduceMotion]);

  const leadEnd = goldStart === undefined ? count : Math.min(count, goldStart);
  const brand = goldStart === undefined ? '' : text.slice(goldStart, count);

  const showCaret = active && !done;

  return (
    <Typography variant={variant} color={color} aria-label={text} sx={{ position: 'relative' }}>
      <Box component="span" aria-hidden sx={{ visibility: 'hidden' }}>
        {text}
      </Box>
      <Box component="span" aria-hidden sx={{ position: 'absolute', left: 0, top: 0, right: 0 }}>
        {text.slice(0, leadEnd)}
        {brand && (
          <Box component="span" sx={{ color: palette.gold }}>
            {brand}
          </Box>
        )}
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            width: showCaret ? '0.07em' : 0,
            height: '0.9em',
            ml: showCaret ? '1px' : 0,
            bgcolor: palette.gold,
            verticalAlign: '-0.05em',
            animation: showCaret ? 'welcomeCaret 900ms steps(2, start) infinite' : 'none',
            '@keyframes welcomeCaret': {
              to: { visibility: 'hidden' },
            },
          }}
        />
      </Box>
    </Typography>
  );
}

/** One line of helper text, picking the most useful thing to say right now. */
function describe(state: {
  empty: boolean;
  shapeError: string | null;
  reserved: boolean;
  checking: boolean;
  takenReason: string | null;
}): string {
  if (state.empty) return 'Letters, numbers and underscores, with no spaces';
  if (state.shapeError) return state.shapeError;
  if (state.reserved) return 'That username is reserved. Please pick another.';
  if (state.checking) return 'Checking…';
  if (state.takenReason) return state.takenReason;
  return 'That one is free';
}
