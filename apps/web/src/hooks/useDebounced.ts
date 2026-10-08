import { useEffect, useState } from 'react';

/**
 * Waits for typing to stop before returning the value.
 *
 * Used to turn one query per keystroke into one query per word, for both card
 * search and the set filter in the printing picker.
 */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
