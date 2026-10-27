import type { BinderVisibility } from '@opulent/shared';
import { useCollectionSummary, useTradeBinderMatches } from '../api/queries';
import { TradeBinderPreview } from './TradeBinderPreview';

/**
 * The profile page's binder card.
 *
 * On your own page it mirrors the collection dashboard: cards, value, and cards
 * on the table. On someone else's page it only answers the useful question: do
 * their trade cards meet your want lists, and how many do.
 */
export function ProfileTradeBinder({
  username,
  ownPage,
  isAuthenticated,
  visibility,
}: {
  username: string;
  ownPage: boolean;
  isAuthenticated: boolean;
  visibility: BinderVisibility | undefined;
}) {
  const summary = useCollectionSummary(ownPage);
  const matches = useTradeBinderMatches(username, isAuthenticated && !ownPage);

  if (ownPage) {
    return (
      <TradeBinderPreview
        variant="owner"
        username={username}
        visibility={visibility ?? 'private'}
        cardCount={summary.data?.forTradeCount ?? 0}
        value={summary.data?.forTradeValue ?? '0.00'}
        onTheTable={summary.data?.onTheTable ?? 0}
      />
    );
  }

  return (
    <TradeBinderPreview
      variant="visitor"
      username={username}
      authenticated={isAuthenticated}
      matchCount={matches.data ? matches.data.items.length : null}
      matchesLoading={matches.isLoading}
    />
  );
}
