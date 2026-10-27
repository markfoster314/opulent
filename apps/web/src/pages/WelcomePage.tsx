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
import type { ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useCompleteOnboarding, useMe, useUsernameAvailability } from '../api/queries';
import { CitySearchField } from '../components/CitySearchField';
import { WelcomeSplash } from '../components/WelcomeSplash';
import { useDebounced } from '../hooks/useDebounced';
import { palette } from '../theme';

/** The two things setup asks for. The second one may be skipped. */
const STEPS = ['Username', 'City'] as const;

/** How long the gold fill takes to cross one part of the progress bar. */
const FILL_MS = 520;

/**
 * Shown once, straight after the first sign-in.
 *
 * Until this is saved the user is carrying a generated username such as
 * `mark_a1b2c3`, which would otherwise end up in every link they share. Setup
 * asks for two things in order: a name they must choose, then a city they may
 * leave blank.
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

  const [step, setStep] = useState(0);
  const [username, setUsername] = useState('');
  const [city, setCity] = useState<PlaceRef | null>(null);
  /** The splash covers the form once, then hands over for good. */
  const [splash, setSplash] = useState(true);
  const finishSplash = useCallback(() => setSplash(false), []);
  const usernameRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLElement>(null);
  const firstStep = useRef(true);

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

  const checking = !settled || availability.isFetching;
  const canContinue =
    shape.success && !reserved && settled && availability.data?.available === true;
  const saving = completeOnboarding.isPending;
  const onCity = step === 1;
  const origin = window.location.origin;

  /** Where the user was heading before being stopped, such as a shared binder. */
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/collection';

  // A phone keeps its keyboard down until the person taps the field themselves.
  // Nothing reaches for focus while the splash owns the window.
  useEffect(() => {
    if (splash) return;
    if (!window.matchMedia('(min-width: 900px)').matches) return;
    usernameRef.current?.focus();
  }, [splash]);

  // The button that moved the page has gone, so put the reader on the new step
  // instead of leaving focus on the body.
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  if (me.onboarded) return <Navigate to={returnTo} replace />;

  function handleFinish() {
    completeOnboarding.mutate(
      { username: normalized, ...(city ? { placeId: city.geonameId } : {}) },
      { onSuccess: () => void navigate(returnTo, { replace: true }) },
    );
  }

  return (
    <>
      {splash && <WelcomeSplash onDone={finishSplash} />}
      <Stack
        aria-hidden={splash || undefined}
        spacing={{ xs: 3, sm: 4 }}
        sx={{ width: '100%', maxWidth: 560, mx: 'auto' }}
      >
        <StepBar step={step} />

        <ResizeBox step={step}>
          {/*
           * Only the words change with the step, so only the words are
           * keyed. The card and the buttons below keep their place and
           * their paint, which is what stops the whole block from fading
           * on every move.
           */}
          <Box
            key={step}
            sx={{
              animation: 'welcomeTitle 360ms cubic-bezier(0.22, 1, 0.36, 1) both',
              '@keyframes welcomeTitle': {
                from: { opacity: 0 },
                to: { opacity: 1 },
              },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            <Stack spacing={1}>
              <Typography
                ref={headingRef}
                tabIndex={-1}
                variant="h1"
                sx={{ overflowWrap: 'anywhere', outline: 'none' }}
              >
                {onCity ? (
                  <>
                    Add your{' '}
                    <Box component="span" sx={{ color: palette.gold }}>
                      city
                    </Box>
                    .
                  </>
                ) : (
                  <>
                    Pick a{' '}
                    <Box component="span" sx={{ color: palette.gold }}>
                      username
                    </Box>
                    .
                  </>
                )}
              </Typography>
              <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {onCity
                  ? 'Optional. It sorts the closest trades first, and you can change it later on your profile.'
                  : 'This is the name people see, and the name in every binder link you share.'}
              </Typography>
            </Stack>
          </Box>
        </ResizeBox>

        <Paper sx={{ p: { xs: 2.5, sm: 3 } }}>
          <ResizeBox step={step}>
            {onCity ? (
              <CitySearchField
                value={city}
                onChange={setCity}
                helperText="Start typing, then pick the matching city. Leaving this blank is fine."
              />
            ) : (
              <Stack spacing={1.5}>
                <TextField
                  label="Username"
                  value={normalized}
                  onChange={(event) => setUsername(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canContinue) setStep(1);
                  }}
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
                {normalized.length > 0 && shape.success && !reserved && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    Your profile link: {origin}/u/{normalized}
                  </Typography>
                )}
              </Stack>
            )}
          </ResizeBox>
        </Paper>

        {completeOnboarding.error && (
          <Alert severity="error">{completeOnboarding.error.message}</Alert>
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          justifyContent={{ sm: 'flex-end' }}
          sx={{ '& .MuiButton-root': { width: { xs: '100%', sm: 'auto' } } }}
        >
          {onCity && (
            <Button color="secondary" onClick={() => setStep(0)} disabled={saving}>
              Back
            </Button>
          )}
          {/*
           * One button for both steps. A floor on the width stops
           * "Continue" and "Finish setup" from moving it.
           */}
          <Button
            variant="contained"
            size="large"
            onClick={onCity ? handleFinish : () => setStep(1)}
            disabled={onCity ? saving : !canContinue}
            sx={{ minWidth: { sm: 168 } }}
          >
            {onCity ? (saving ? 'Saving…' : 'Finish setup') : 'Continue'}
          </Button>
        </Stack>
      </Stack>
    </>
  );
}

/** Where the reader is in setup: a caption, the step name, and a two-part bar. */
function StepBar({ step }: { step: number }) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="baseline">
        <Typography variant="caption" color="text.secondary">
          Account setup · step {step + 1} of {STEPS.length}
        </Typography>
        <Typography variant="caption" sx={{ color: palette.goldLight }}>
          {STEPS[step]}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} aria-hidden>
        {STEPS.map((label, index) => (
          <Box
            key={label}
            sx={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              bgcolor: palette.divider,
              overflow: 'hidden',
            }}
          >
            {/*
             * Each part has a track and a fill. The fill grows from the left on
             * the way forward and pulls back to the left on the way back, so the
             * bar reports the move instead of blinking to the new step.
             */}
            <Box
              sx={{
                height: '100%',
                width: index <= step ? '100%' : '0%',
                borderRadius: 999,
                bgcolor: palette.gold,
                transition: `width ${FILL_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            />
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

/**
 * Holds its content at a measured height.
 *
 * The content is taken out of flow, so a swap between the two steps changes the
 * wrapper's height instead of moving the page at once. The wrapper then animates
 * to the new height over the same 360ms as the title fade, so the title block and
 * the input card always resize together.
 */
function ResizeBox({ step, children }: { step: number; children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const measure = () => setHeight(node.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [step]);

  return (
    <Box
      sx={{
        position: 'relative',
        height: height ?? undefined,
        /*
         * Clip the bottom while the box resizes, but leave room above the top.
         * A floating field label sits outside the top of its input, and a plain
         * `overflow: hidden` cuts it in half.
         */
        clipPath: 'inset(-16px 0 0 0)',
        transition: 'height 360ms cubic-bezier(0.22, 1, 0.36, 1)',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Box ref={contentRef} sx={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        {children}
      </Box>
    </Box>
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
