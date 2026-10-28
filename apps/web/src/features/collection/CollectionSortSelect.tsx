import { MenuItem, TextField } from '@mui/material';
import type { CollectionSort, SortDirection } from '@opulent/shared';

const SORT_OPTIONS: { value: string; label: string; sort: CollectionSort; dir: SortDirection }[] = [
  { value: 'name:asc', label: 'Name A–Z', sort: 'name', dir: 'asc' },
  { value: 'name:desc', label: 'Name Z–A', sort: 'name', dir: 'desc' },
  { value: 'price:desc', label: 'Price high to low', sort: 'price', dir: 'desc' },
  { value: 'price:asc', label: 'Price low to high', sort: 'price', dir: 'asc' },
  { value: 'change:desc', label: 'Change high to low', sort: 'change', dir: 'desc' },
  { value: 'change:asc', label: 'Change low to high', sort: 'change', dir: 'asc' },
];

export function CollectionSortSelect({
  sort,
  dir,
  onChange,
}: {
  sort: CollectionSort;
  dir: SortDirection;
  onChange: (sort: CollectionSort, dir: SortDirection) => void;
}) {
  return (
    <TextField
      select
      size="small"
      label="Sort"
      value={`${sort}:${dir}`}
      onChange={(event) => {
        const option = SORT_OPTIONS.find((row) => row.value === event.target.value);
        if (option) onChange(option.sort, option.dir);
      }}
      sx={{ minWidth: { md: 200 }, width: { xs: '100%', md: 'auto' } }}
    >
      {SORT_OPTIONS.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
