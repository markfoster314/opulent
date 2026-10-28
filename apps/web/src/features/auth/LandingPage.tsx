import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { AddCollectionItemInput, Card } from '@opulent/shared';
import { useState } from 'react';
import { useSession } from '@/app/session';
import { AddCardPanel } from '@/shared/cards/AddCardPanel';
import { CardSearchField } from '@/shared/cards/CardSearchField';
import { MatchExamplePaper } from './MatchExamplePaper';
import { Reveal } from './Reveal';
import { savePendingAdd } from './pendingAdd';
import { palette } from '@/theme';

/** Public pitch: pain, match, then sign-up; phone-first, with gold reserved for actions and key copy. */
export function LandingPage({ onSignUp }: { onSignUp: () => void }) {
  return (
    <Stack spacing={{ xs: 6, md: 8 }}>
      <Hero onSignUp={onSignUp} />
      <Reveal>
        <PainSection />
      </Reveal>
      <Reveal>
        <HowItWorks />
      </Reveal>
      <Reveal>
        <WhatYouGet />
      </Reveal>
      <Reveal>
        <StartBinder />
      </Reveal>
      <Reveal>
        <ClosingAsk onSignUp={onSignUp} />
      </Reveal>
    </Stack>
  );
}

function Hero({ onSignUp }: { onSignUp: () => void }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 3.5, md: 5 },
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.2fr) minmax(0, 1fr)' },
        alignItems: 'center',
      }}
    >
      <Stack spacing={{ xs: 2.5, sm: 2 }}>
        <Typography
          variant="overline"
          sx={{ color: palette.goldLight, letterSpacing: '0.14em', lineHeight: 1.4 }}
        >
          Trade binders for Magic: The Gathering
        </Typography>
        <Typography
          variant="h1"
          sx={{
            minWidth: 0,
            overflowWrap: 'anywhere',
            lineHeight: 1.08,
            fontSize: { xs: '2rem', sm: '2.75rem', md: '3.25rem' },
          }}
        >
          Check your friends{' '}
          <Box component="span" sx={{ color: palette.gold }}>
            before you buy
          </Box>
          .
        </Typography>
        <Typography
          variant="h6"
          color="text.secondary"
          sx={{ fontWeight: 400, overflowWrap: 'anywhere' }}
        >
          List the cards you will trade. Share one link. See which of those cards your group is
          hunting right now.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={onSignUp}
          sx={{ width: { xs: '100%', sm: 'auto' }, alignSelf: { sm: 'flex-start' }, mt: 0.5 }}
        >
          Create your binder
        </Button>
        <Typography variant="body2" color="text.secondary">
          Free. About a minute to set up. Already have a list? You can import a CSV.
        </Typography>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          What a match looks like
        </Typography>
        <MatchExamplePaper />
      </Stack>
    </Box>
  );
}

function PainSection() {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
        alignItems: 'start',
      }}
    >
      <Typography variant="h2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        The card is often already in the room.
      </Typography>
      <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
        You hand a vendor $10 for a mythic. After the event you flip through your friend’s binder
        and there it is, marked for trade. Stings every time.
      </Typography>
    </Box>
  );
}

const beats = [
  {
    title: 'Mark cards for trade',
    body: 'Put your cards in. Mark the ones you will trade. Named folders are optional.',
  },
  {
    title: 'Share one link',
    body: 'One address for your whole trade binder. A hidden link for a small group, if you want it.',
  },
  {
    title: 'See the match',
    body: 'A friend opens your link and sees the cards they want from your binder. You see theirs. Then you talk at the table.',
  },
];

function HowItWorks() {
  return (
    <Stack spacing={{ xs: 2.5, sm: 2 }}>
      <Typography variant="h2">How it works</Typography>
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 3, md: 2.5 },
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {beats.map((beat, index) => (
          <Paper key={beat.title} sx={{ p: 3, minWidth: 0 }}>
            <Typography
              component="span"
              sx={{
                display: 'block',
                color: palette.gold,
                fontSize: { xs: '2rem', sm: '2.25rem' },
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              {index + 1}
            </Typography>
            <Typography variant="h3" sx={{ mt: 1, mb: 1, overflowWrap: 'anywhere' }}>
              {beat.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {beat.body}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}

const binderBenefits = [
  {
    title: 'One link, every card',
    body: 'Your whole trade binder in one address. No packing, no photos of a page.',
  },
  {
    title: 'Wants with rules',
    body: 'Any printing, or foil only, English only, one set only.',
  },
  {
    title: 'CSV in, CSV out',
    body: 'Bring the list you already keep, and take it with you.',
  },
];

const tableBenefits = [
  {
    title: 'Find trades near you',
    body: 'See who holds your wants, nearest city first.',
  },
  {
    title: 'A trade table',
    body: 'Propose, counter, and both sides say done. Value on each side.',
  },
  {
    title: 'Follow your people',
    body: 'Their new trade cards show up as matches on your page.',
  },
];

function WhatYouGet() {
  return (
    <Stack spacing={{ xs: 2.5, sm: 2 }}>
      <Typography variant="h2">What you get</Typography>
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 2.5, md: 2 },
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          alignItems: 'start',
        }}
      >
        <BinderPage title="Your binder" items={binderBenefits} />
        <BinderPage title="The table" items={tableBenefits} />
      </Box>
      <Typography variant="body2" color="text.secondary">
        Collection tracking comes with it.
      </Typography>
    </Stack>
  );
}

interface Benefit {
  title: string;
  body: string;
}

/** Two binder sheets instead of a six-card grid; quiet pockets rely on highlight and shade, not borders. */
function BinderPage({ title, items }: { title: string; items: Benefit[] }) {
  return (
    <Box
      component="section"
      sx={{
        minWidth: 0,
        p: { xs: 1, sm: 1.5 },
        borderRadius: 2,
        border: `1px solid ${palette.steelBorder}`,
        bgcolor: palette.background,
        backgroundImage:
          'linear-gradient(180deg, rgba(155, 176, 192, 0.07), rgba(0, 0, 0, 0) 140px)',
      }}
    >
      <Typography
        variant="overline"
        component="h3"
        sx={{ display: 'block', px: 1, py: 0.5, color: palette.steel, letterSpacing: '0.14em' }}
      >
        {title}
      </Typography>
      <Stack spacing={{ xs: 1.5, sm: 1 }}>
        {items.map((item) => (
          <Pocket key={item.title} benefit={item} />
        ))}
      </Stack>
    </Box>
  );
}

function Pocket({ benefit }: { benefit: Benefit }) {
  return (
    <Box
      sx={{
        position: 'relative',
        p: { xs: 2.5, sm: 2.25 },
        borderRadius: 1.5,
        bgcolor: palette.surfaceRaised,
        backgroundImage:
          'linear-gradient(160deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0) 55%)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.16), inset 0 -1px 0 rgba(0, 0, 0, 0.45)',
        overflow: 'hidden',
        // The lit top edge of a plastic sleeve.
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '1px',
          background:
            'linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0))',
        },
      }}
    >
      <Typography variant="h3" sx={{ mb: 0.5, overflowWrap: 'anywhere' }}>
        {benefit.title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {benefit.body}
      </Typography>
    </Box>
  );
}

/** Search is open to all; keeping the card needs an account, so the form is saved and replayed after sign-up. */
function StartBinder() {
  const { loginWithRedirect } = useSession();
  const [card, setCard] = useState<Card | null>(null);

  function handleAdd(input: AddCollectionItemInput) {
    if (!card) return;
    savePendingAdd(input, card.name);
    void loginWithRedirect({ appState: { returnTo: '/collection' } });
  }

  return (
    <Paper sx={{ p: { xs: 2.5, sm: 3 }, minWidth: 0, borderColor: palette.goldBorder }}>
      <Stack spacing={{ xs: 2.5, sm: 2 }}>
        <Stack spacing={{ xs: 1.5, sm: 1 }}>
          <Typography variant="h2" sx={{ overflowWrap: 'anywhere' }}>
            Start your binder
          </Typography>
          <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            Search any card in Magic. Choose the set and the details. We take you to sign up, then
            put that card in your collection.
          </Typography>
        </Stack>

        <CardSearchField label="Search a card" onSelect={setCard} showSet={false} />

        {card && (
          <AddCardPanel
            // Remounts on a different card so the previous choices do not carry over.
            key={card.oracleId}
            card={card}
            onAdd={handleAdd}
            onCancel={() => setCard(null)}
            pending={false}
            foldAdvanced
          />
        )}
      </Stack>
    </Paper>
  );
}

function ClosingAsk({ onSignUp }: { onSignUp: () => void }) {
  return (
    <Stack spacing={{ xs: 2.5, sm: 2 }}>
      <Typography variant="h2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        Your next trade is already in someone’s box.
      </Typography>
      <Button
        variant="contained"
        size="large"
        onClick={onSignUp}
        sx={{ width: { xs: '100%', sm: 'auto' }, alignSelf: { sm: 'flex-start' } }}
      >
        Create your binder
      </Button>
      <Typography variant="body2" color="text.secondary">
        Free. Card data comes from Scryfall.
      </Typography>
    </Stack>
  );
}
