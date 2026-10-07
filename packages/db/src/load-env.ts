import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from 'dotenv';

/** The workspace root is wherever pnpm-workspace.yaml lives. */
function findRepoRoot(start: string = process.cwd()): string | undefined {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Loads the repo-root .env file.
 *
 * Needed because pnpm runs scripts with the working directory set to the
 * package, not the repo root, so a fixed relative path to .env would miss.
 * Node's own --env-file flag cannot search upwards, which is why it is not used
 * here even though Node 24 supports it.
 *
 * Real environment variables always win, so a stray local .env can never
 * override deployed settings.
 */
export function loadEnv(): void {
  const root = findRepoRoot();
  if (!root) return;

  const path = join(root, '.env');
  if (existsSync(path)) {
    config({ path, override: false });
  }
}
