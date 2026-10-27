import type { AddCollectionItemInput } from '@opulent/shared';

/**
 * One card a visitor chose before they had an account.
 *
 * Sign-up leaves this page for the identity provider, so the choice needs a home
 * that survives the round trip. `sessionStorage` is per tab and per origin: the
 * draft dies with the tab, it cannot follow the person to another device, and it
 * never reaches the server until the collection page replays it.
 */
const KEY = 'opulent-tutor.pending-add';

/** Long enough for a sign-up, short enough that an abandoned tab is forgotten. */
const MAX_AGE_MS = 30 * 60 * 1000;

export interface PendingAdd {
  /** Exactly what the add panel would have sent, so the card lands as chosen. */
  input: AddCollectionItemInput;
  /** Shown back to the owner after the add, because the panel is gone by then. */
  cardName: string;
  savedAt: number;
}

/** Private browsing and blocked storage throw on access. A missing store only loses a draft. */
function store(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function parse(raw: string | null): PendingAdd | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingAdd>;
    if (!value.input || typeof value.cardName !== 'string') return null;
    if (typeof value.savedAt !== 'number') return null;
    if (Date.now() - value.savedAt > MAX_AGE_MS) return null;
    return value as PendingAdd;
  } catch {
    return null;
  }
}

export function savePendingAdd(input: AddCollectionItemInput, cardName: string): void {
  const draft: PendingAdd = { input, cardName, savedAt: Date.now() };
  try {
    store()?.setItem(KEY, JSON.stringify(draft));
  } catch {
    // A full store loses the draft. The sign-up itself still works.
  }
}

export function readPendingAdd(): PendingAdd | null {
  try {
    return parse(store()?.getItem(KEY) ?? null);
  } catch {
    return null;
  }
}

export function hasPendingAdd(): boolean {
  return readPendingAdd() !== null;
}

/**
 * Reads the draft and removes it in one step, so two mounts of the collection
 * page cannot add the same card twice.
 */
export function takePendingAdd(): PendingAdd | null {
  const draft = readPendingAdd();
  try {
    store()?.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
  return draft;
}
