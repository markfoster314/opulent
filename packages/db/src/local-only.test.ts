import { afterEach, describe, expect, it } from 'vitest';
import { assertLocalDatabase } from './local-only';

const original = process.env.ALLOW_REMOTE_DB;

afterEach(() => {
  if (original === undefined) delete process.env.ALLOW_REMOTE_DB;
  else process.env.ALLOW_REMOTE_DB = original;
});

describe('assertLocalDatabase', () => {
  it('allows a local host', () => {
    expect(() =>
      assertLocalDatabase('postgres://opulent:opulent@localhost:5432/opulent_tutor'),
    ).not.toThrow();
    expect(() =>
      assertLocalDatabase('postgres://opulent:opulent@127.0.0.1:5432/opulent_tutor'),
    ).not.toThrow();
  });

  it('refuses a remote host', () => {
    expect(() =>
      assertLocalDatabase('postgres://opulent:secret@db.example.com:5432/opulent_tutor'),
    ).toThrow(/db\.example\.com/);
  });

  it('allows a remote host when the override is set', () => {
    process.env.ALLOW_REMOTE_DB = '1';
    expect(() =>
      assertLocalDatabase('postgres://opulent:secret@db.example.com:5432/opulent_tutor'),
    ).not.toThrow();
  });
});
