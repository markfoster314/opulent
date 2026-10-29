import { FormControlLabel, Switch, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { LATENCIES, SCENARIOS, type DevState, type Latency, type Scenario } from '../state';
import { Section } from '../Section';
import { LATENCY_LABELS, SCENARIO_LABELS } from '../ui';

export function NetworkSection({
  state,
  update,
  mockOnly,
}: {
  state: DevState;
  update: (patch: Partial<DevState>) => void;
  mockOnly: boolean;
}) {
  return (
    <Section title="Network">
      {mockOnly ? null : (
        <FormControlLabel
          control={
            <Switch
              checked={state.mockApi}
              onChange={(_, checked) => update({ mockApi: checked })}
            />
          }
          label="Mocks"
        />
      )}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={state.scenario}
        onChange={(_, value: Scenario | null) => {
          if (value) update({ scenario: value });
        }}
        sx={{ flexWrap: 'wrap' }}
      >
        {SCENARIOS.map((scenario) => (
          <ToggleButton key={scenario} value={scenario}>
            {SCENARIO_LABELS[scenario]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={state.latencyMs}
        onChange={(_, value: Latency | null) => {
          if (value !== null) update({ latencyMs: value });
        }}
        sx={{ flexWrap: 'wrap' }}
      >
        {LATENCIES.map((latency) => (
          <ToggleButton key={latency} value={latency}>
            {LATENCY_LABELS[latency]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Section>
  );
}
