import { Autocomplete, Box, CircularProgress, TextField, Typography } from '@mui/material';
import type { Card } from '@opulent/shared';
import { useEffect, useRef, useState } from 'react';
import { useCardSearch } from '../api/queries';
import { useDebounced } from '../hooks/useDebounced';

interface CardSearchFieldProps {
  label?: string;
  onSelect: (card: Card) => void;
  disabled?: boolean;
  /** The binder search lists the name only. The want list still shows the set. */
  showSet?: boolean;
  /** Bump this number to focus the input, for "add another". */
  focusSignal?: number;
}

export function CardSearchField({
  label = 'Find a card',
  onSelect,
  disabled,
  showSet = true,
  focusSignal,
}: CardSearchFieldProps) {
  const [input, setInput] = useState('');
  const term = useDebounced(input);
  const { data, isFetching } = useCardSearch(term);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusSignal) return;
    // Wait for the collapsed add panel to leave the layout before focusing.
    const timer = window.setTimeout(() => {
      const input = inputRef.current ?? rootRef.current?.querySelector<HTMLInputElement>('input');
      input?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusSignal]);

  return (
    <Autocomplete<Card>
      ref={rootRef}
      options={data?.items ?? []}
      getOptionLabel={(card) => card.name}
      filterOptions={(options) => options}
      isOptionEqualToValue={(a, b) => a.scryfallId === b.scryfallId}
      inputValue={input}
      onInputChange={(_, value) => setInput(value)}
      onChange={(_, card) => {
        if (card) {
          onSelect(card);
          setInput('');
        }
      }}
      loading={isFetching}
      disabled={disabled}
      noOptionsText={term.length < 2 ? 'Type at least two letters' : 'No cards found'}
      renderOption={(props, card) => (
        <Box component="li" {...props} key={card.scryfallId}>
          <Box>
            <Typography variant="body2">{card.name}</Typography>
            {showSet && (
              <Typography variant="caption" color="text.secondary">
                {card.setName ?? card.setCode.toUpperCase()}
              </Typography>
            )}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          label={label}
          placeholder="Lightning Bolt"
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {isFetching ? <CircularProgress size={18} /> : null}
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
