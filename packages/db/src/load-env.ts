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

/** Loads the repo-root .env (pnpm runs scripts from the package dir and --env-file cannot search upwards), never overriding real env vars. */
export function loadEnv(): void {
  const root = findRepoRoot();
  if (!root) return;

  const path = join(root, '.env');
  if (existsSync(path)) {
    config({ path, override: false });
  }
}
