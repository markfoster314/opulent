import { describe, expect, it } from 'vitest';
import { errorText, redactEmails } from './log';

describe('redactEmails', () => {
  it('replaces an email address', () => {
    expect(redactEmails('see person@example.com now')).toBe('see [redacted] now');
  });
});

describe('errorText', () => {
  it('redacts an error message', () => {
    expect(errorText(new Error('person@example.com'))).toBe('[redacted]');
  });

  it('says unknown when the value is not an error', () => {
    expect(errorText('nope')).toBe('unknown');
  });
});
