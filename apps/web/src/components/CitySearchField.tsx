import { Autocomplete, Box, CircularProgress, TextField, Typography } from '@mui/material';
import type { PlaceRef } from '@opulent/shared';
import { useState } from 'react';
import { usePlaceSearch } from '../api/queries';
import { useDebounced } from '../hooks/useDebounced';

interface CitySearchFieldProps {
  value: PlaceRef | null;
  onChange: (place: PlaceRef | null) => void;
  helperText?: string;
}

/**
 * Picks one city from our copy of the GeoNames list.
 *
 * The box stores the chosen place, not whatever was typed. Clearing it is how
 * a profile edit removes the city.
 */
export function CitySearchField({
  value,
  onChange,
  helperText = 'You can leave this blank',
}: CitySearchFieldProps) {
  const [input, setInput] = useState(value?.label ?? '');
  const term = useDebounced(input.trim());
  const { data, isFetching } = usePlaceSearch(value ? '' : term);

  const matches = data?.items ?? [];
  const options =
    value && !matches.some((place) => place.geonameId === value.geonameId)
      ? [value, ...matches]
      : matches;

  return (
    <Autocomplete<PlaceRef>
      fullWidth
      options={options}
      value={value}
      inputValue={input}
      getOptionLabel={(place) => place.label}
      isOptionEqualToValue={(a, b) => a.geonameId === b.geonameId}
      filterOptions={(places) => places}
      loading={isFetching && !value}
      noOptionsText={term.length < 2 ? 'Type at least two letters' : 'No cities found'}
      onChange={(_, place) => {
        onChange(place);
        setInput(place?.label ?? '');
      }}
      onInputChange={(_, next, reason) => {
        if (reason === 'input') {
          setInput(next);
          if (value) onChange(null);
        }
        if (reason === 'clear') {
          setInput('');
          onChange(null);
        }
      }}
      renderOption={(props, place) => (
        <Box component="li" {...props} key={place.geonameId}>
          <Typography variant="body2">{place.label}</Typography>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="City"
          placeholder="Austin, Texas, United States"
          helperText={helperText}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {isFetching && !value ? <CircularProgress size={18} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
