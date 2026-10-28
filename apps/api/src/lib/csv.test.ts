import { describe, expect, it } from 'vitest';
import { toCsvLine } from './csv';

describe('toCsvLine', () => {
  it('leaves an ordinary cell as text', () => {
    expect(toCsvLine(['Solitude', 2, true])).toBe('Solitude,2,true');
  });

  it('quotes a cell that contains a comma', () => {
    expect(toCsvLine(['Austin, Texas'])).toBe('"Austin, Texas"');
  });

  it('prefixes a spreadsheet formula so the cell stays text', () => {
    expect(toCsvLine(['=1+1'])).toBe("'=1+1");
    expect(toCsvLine(['+1'])).toBe("'+1");
    expect(toCsvLine(['-1'])).toBe("'-1");
    expect(toCsvLine(['@sum'])).toBe("'@sum");
  });
});
