import { MenuItem, Select, Stack, Typography } from '@mui/material';
import { ENDPOINTS, SCENARIOS, type DevState, type EndpointId, type EndpointRule } from '../state';
import { Section } from '../Section';
import { SCENARIO_LABELS } from '../ui';

export function EndpointsSection({
  state,
  update,
}: {
  state: DevState;
  update: (patch: Partial<DevState>) => void;
}) {
  function choose(endpoint: EndpointId, rule: EndpointRule) {
    update({ endpoints: { ...state.endpoints, [endpoint]: rule } });
  }

  return (
    <Section title="Endpoints">
      {ENDPOINTS.map((endpoint) => (
        <Stack
          key={endpoint.id}
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Typography variant="body2">{endpoint.label}</Typography>
          <Select
            size="small"
            value={state.endpoints[endpoint.id] ?? 'inherit'}
            onChange={(event) => choose(endpoint.id, event.target.value as EndpointRule)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="inherit">Inherit</MenuItem>
            <MenuItem value="real">Real</MenuItem>
            {SCENARIOS.map((scenario) => (
              <MenuItem key={scenario} value={scenario}>
                {SCENARIO_LABELS[scenario]}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      ))}
    </Section>
  );
}
