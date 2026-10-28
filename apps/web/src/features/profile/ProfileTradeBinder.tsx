import type { BinderVisibility } from '@opulent/shared';
import { useCollectionSummary } from '@/features/collection/queries';
import { useTradeBinderMatches } from '@/features/profile/queries';
import { TradeBinderPreview } from './TradeBinderPreview';

/** Own page mirrors the collection totals; someone else's page reports only want-list matches. */
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
