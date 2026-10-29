import { describe, expect, it } from 'vitest';
import { claimedUsernameSchema, isReservedUsername, usernameSchema } from './user';

describe('usernameSchema', () => {
  it('folds case and keeps letters, numbers, and underscores', () => {
    expect(usernameSchema.parse('Mark_1')).toBe('mark_1');
  });

  it('rejects a short name, a long name, and a space', () => {
    expect(usernameSchema.safeParse('ab').success).toBe(false);
    expect(usernameSchema.safeParse('a'.repeat(31)).success).toBe(false);
    expect(usernameSchema.safeParse('bad name').success).toBe(false);
  });
});

describe('isReservedUsername', () => {
  it('matches a reserved word after trim and case fold', () => {
    expect(isReservedUsername(' Admin ')).toBe(true);
    expect(isReservedUsername('mark')).toBe(false);
  });
});

describe('claimedUsernameSchema', () => {
  it('rejects a reserved name that a reader may still look up', () => {
    expect(usernameSchema.parse('admin')).toBe('admin');
    expect(claimedUsernameSchema.safeParse('admin').success).toBe(false);
    expect(claimedUsernameSchema.parse('mark')).toBe('mark');
  });
});
