import { readFileSync } from 'node:fs';

const floor = 50;
const summaryPath = 'coverage/coverage-summary.json';

/** Warn when coverage is under the loose floor. Never fails the Quality job. */
function main() {
  let summary;
  try {
    summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  } catch {
    report(`Coverage summary is missing at ${summaryPath}.`);
    return;
  }

  const total = summary.total ?? {};
  const keys = ['lines', 'statements', 'functions', 'branches'];
  const low = keys.flatMap((key) => {
    const pct = total[key]?.pct;
    return typeof pct === 'number' && pct < floor ? [`${key} ${pct}%`] : [];
  });

  if (low.length === 0) {
    console.log(`Coverage is at or above ${floor}%.`);
    return;
  }

  report(`Coverage is under ${floor}%: ${low.join(', ')}.`);
}

function report(message) {
  const line = `${message} This is a warning. The Quality job stays green.`;
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(`::warning::${line}`);
    return;
  }
  console.warn(line);
}

main();
