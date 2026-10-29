import { spawn } from 'node:child_process';

const url = 'http://localhost:5173/__dev';

try {
  const response = await fetch(url);
  if (!response.ok) throw new Error('not ready');
} catch {
  console.error('Start pnpm dev first, then run pnpm dev:tools.');
  process.exit(1);
}

const opener =
  process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
const child = spawn(opener, [url], {
  shell: process.platform === 'win32',
  stdio: 'ignore',
  detached: true,
});
child.on('error', () => undefined);
child.unref();

console.log(`Open ${url}`);
