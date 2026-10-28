export const MOCK_SCENARIOS = ['ok', 'empty', 'slow', '401', '404', '500', 'offline'] as const;

export type MockScenario = (typeof MOCK_SCENARIOS)[number];

const STORAGE_KEY = 'ot-mock-scenario';

export function readScenario(): MockScenario {
  const value = sessionStorage.getItem(STORAGE_KEY);
  if (value && (MOCK_SCENARIOS as readonly string[]).includes(value)) {
    return value as MockScenario;
  }
  return 'ok';
}

export function writeScenario(scenario: MockScenario): void {
  sessionStorage.setItem(STORAGE_KEY, scenario);
}
