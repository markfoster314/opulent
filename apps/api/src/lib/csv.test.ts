import { describe, expect, it } from 'vitest';
import { parseCsv, toCsvLine } from './csv';

describe('parseCsv', () => {
  it('reads quoted commas, doubled quotes, and blank lines', () => {
    expect(parseCsv('\uFEFFname,city\r\n"Solitude, the card","say ""hi"""\n\n')).toEqual([
      ['name', 'city'],
      ['Solitude, the card', 'say "hi"'],
    ]);
  });

  it('keeps a field that breaks across lines', () => {
    expect(parseCsv('a,"b\nc",d')).toEqual([['a', 'b\nc', 'd']]);
  });
});

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

  it('writes an empty cell for null and quotes a line break', () => {
    expect(toCsvLine([null, 'a\nb'])).toBe(',"a\nb"');
  });
});
