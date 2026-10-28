import { beforeEach, describe, expect, it } from 'vitest';
import { readScenario, writeScenario } from './scenario';

describe('mock scenario', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('starts on ok', () => {
    expect(readScenario()).toBe('ok');
  });

  it('keeps the choice for this tab', () => {
    writeScenario('500');
    expect(readScenario()).toBe('500');
  });

  it('ignores a value that is not a choice', () => {
    sessionStorage.setItem('ot-mock-scenario', 'nope');
    expect(readScenario()).toBe('ok');
  });
});
