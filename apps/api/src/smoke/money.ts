import { askingPrice, formatUsd } from '@opulent/shared';
import { check } from './harness';

export function checkMoney(): void {
  check(
    'money formats as US dollars',
    formatUsd('1234.5') === '$1,234.50',
    `${formatUsd('1234.5')}`,
  );
  check('no price formats as null', formatUsd(null) === null);
  check(
    'percent price is that share of market',
    askingPrice('1.50', { kind: 'percent', percent: 90 }) === '1.35',
  );
  check(
    '100 percent is the full market price',
    askingPrice('1.50', { kind: 'percent', percent: 100 }) === '1.50',
  );
  check(
    '0 percent is zero dollars',
    askingPrice('1.50', { kind: 'percent', percent: 0 }) === '0.00',
  );
  check(
    'market asking price is the stored price',
    askingPrice('1.50', { kind: 'market' }) === '1.50',
  );
  check(
    'custom asking price keeps cents',
    askingPrice('1.50', { kind: 'custom', amount: '4.5' }) === '4.50',
  );
  check(
    'a percent with no market price has no dollar amount',
    askingPrice(null, { kind: 'percent', percent: 90 }) === null,
  );
}
