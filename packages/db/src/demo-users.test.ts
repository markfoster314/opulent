import { describe, expect, it } from 'vitest';
import { demoUsername } from './demo-users';

describe('demo username', () => {
  it('stays inside the username rules', () => {
    const name = demoUsername('demo', 12, 'ab12');
    expect(name).toBe('dev_demo_12_ab12');
    expect(name).toMatch(/^[a-z0-9_]+$/);
    expect(name.length).toBeGreaterThanOrEqual(3);
    expect(name.length).toBeLessThanOrEqual(30);
  });

  it('drops characters the contract refuses', () => {
    expect(demoUsername('Bad Prefix!', 1, 'x')).toBe('dev_badprefix_1_x');
  });

  it('trims a long prefix to the limit', () => {
    expect(demoUsername('a'.repeat(40), 1, 'ab12')).toHaveLength(30);
  });

  it('differs by index', () => {
    expect(demoUsername('demo', 1, 'ab12')).not.toBe(demoUsername('demo', 2, 'ab12'));
  });
});
