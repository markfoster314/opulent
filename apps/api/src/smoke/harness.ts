import type { Database, UserRow } from '@opulent/db';

/** Fixed fake identifiers, so a failed run leaves nothing hard to find. */
export const ORACLE_ID = '00000000-0000-4000-8000-00000000f00d';
export const PRINTING_A = '00000000-0000-4000-8000-0000000000a1';
export const PRINTING_A_JA = '00000000-0000-4000-8000-0000000000a6';
export const PRINTING_B = '00000000-0000-4000-8000-0000000000a2';
export const PRINTING_C = '00000000-0000-4000-8000-0000000000a3';
export const PRINTING_ARENA = '00000000-0000-4000-8000-0000000000a4';
export const PRINTING_ART = '00000000-0000-4000-8000-0000000000a5';
export const ARENA_ORACLE_ID = '00000000-0000-4000-8000-00000000f00e';
export const ART_ORACLE_ID = '00000000-0000-4000-8000-00000000f00f';

/** Fake GeoNames ids, far above any real one, so cleanup cannot touch a real city. */
export const AUSTIN_ID = 2_000_000_001;
export const NYC_ID = 2_000_000_002;

export interface SmokeWorld {
  db: Database;
  stamp: string;
  owner: UserRow;
  viewer: UserRow;
}

/** Stacks removed before the later page walk, so that walk still has a second page. */
export interface CollectionMarks {
  markedId: string;
  proofId: string;
}

export function check(label: string, condition: boolean, detail?: string): void {
  if (!condition) throw new Error(`${label} failed${detail ? `: ${detail}` : ''}`);
  console.log(`ok   ${label}`);
}

/** Async sibling of `passes`, for service calls that reject on bad input. */
export async function resolves(action: () => Promise<unknown>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch {
    return false;
  }
}

export function passes(action: () => void): boolean {
  try {
    action();
    return true;
  } catch {
    return false;
  }
}
