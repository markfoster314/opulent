import { describe, expect, it } from 'vitest';
import { askingValueSql, englishMatch } from './collection-value';

function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks
    .map((chunk) => {
      if (!chunk || typeof chunk !== 'object') return '';
      const record = chunk as { value?: unknown; queryChunks?: unknown[] };
      if (Array.isArray(record.value)) return record.value.join('');
      if (typeof record.value === 'string') return record.value;
      if (record.queryChunks) return sqlText(chunk);
      return '';
    })
    .join(' ');
}

describe('collection value sql', () => {
  it('matches the english printing and prices foil separately', () => {
    expect(sqlText(englishMatch())).toContain('en');
    const asking = sqlText(askingValueSql());
    expect(asking).toContain('foil');
    expect(asking).toContain('etched');
    expect(asking).toContain('custom');
    expect(asking).toContain('percent');
  });
});
