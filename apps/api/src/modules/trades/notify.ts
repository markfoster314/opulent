import type { Database, TradeRow } from '@opulent/db';
import { users } from '@opulent/db';
import { eq } from 'drizzle-orm';
import { getEnv } from '../../env';

/**
 * Tells the other person it is their turn.
 *
 * Off unless RESEND_API_KEY and EMAIL_FROM are set, so local work sends
 * nothing. One plain template, one provider, plain `fetch`. The Trades badge
 * in the app is the floor. This is the nudge on top of it.
 */
export function notifyTurn(db: Database, trade: TradeRow, actorId: string): void {
  const env = getEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return;
  if (trade.status !== 'proposed' && trade.status !== 'countered' && trade.status !== 'accepted') {
    return;
  }

  // Never let email trouble fail the trade request itself.
  void sendTurnEmail(db, trade, actorId, env.RESEND_API_KEY, env.EMAIL_FROM).catch((error) => {
    console.error('trade email failed', error);
  });
}

async function sendTurnEmail(
  db: Database,
  trade: TradeRow,
  actorId: string,
  apiKey: string,
  from: string,
): Promise<void> {
  const recipientId = trade.proposerId === actorId ? trade.receiverId : trade.proposerId;
  const [recipient] = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(eq(users.id, recipientId))
    .limit(1);
  const [actor] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  if (!recipient?.email || !actor) return;

  const env = getEnv();
  const origin = env.WEB_ORIGIN ?? env.corsOrigins[0] ?? 'http://localhost:5173';
  const link = `${origin}/trades/${trade.id}`;
  const verb =
    trade.status === 'accepted'
      ? 'accepted your trade'
      : trade.status === 'countered'
        ? 'countered your trade'
        : 'proposed a trade';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [recipient.email],
      subject: `@${actor.username} ${verb} on Opulent Tutor`,
      text: [
        `Hi @${recipient.username},`,
        '',
        `@${actor.username} ${verb}. It is your turn.`,
        '',
        `Open it here: ${link}`,
        '',
        'Opulent Tutor',
      ].join('\n'),
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend answered ${response.status}: ${await response.text()}`);
  }
}
