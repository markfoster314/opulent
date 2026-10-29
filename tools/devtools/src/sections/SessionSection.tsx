import { FormControlLabel, Switch, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { AUTH_PRESETS, type AuthPreset, type DevState } from '../state';
import { Section } from '../Section';
import { AUTH_LABELS } from '../ui';

export function SessionSection({
  state,
  update,
  mockOnly,
}: {
  state: DevState;
  update: (patch: Partial<DevState>) => void;
  mockOnly: boolean;
}) {
  return (
    <Section title="Session">
      {mockOnly ? null : (
        <FormControlLabel
          control={
            <Switch
              checked={state.mockAuth}
              onChange={(_, checked) => update({ mockAuth: checked })}
            />
          }
          label="Mock session"
        />
      )}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={state.mockAuth || mockOnly ? state.auth : null}
        onChange={(_, value: AuthPreset | null) => {
          if (value) update({ mockAuth: true, auth: value });
        }}
        sx={{ flexWrap: 'wrap' }}
      >
        {AUTH_PRESETS.map((preset) => (
          <ToggleButton key={preset} value={preset}>
            {AUTH_LABELS[preset]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Section>
  );
}
