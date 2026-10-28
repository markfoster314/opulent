import { MenuItem, TextField } from '@mui/material';
import type { WantSort, WantSortDir } from '@/features/wants/wantBrowser';

const OPTIONS: { value: string; label: string; sort: WantSort; dir: WantSortDir }[] = [
  { value: 'priority:asc', label: 'Priority high–low', sort: 'priority', dir: 'asc' },
  { value: 'priority:desc', label: 'Priority low–high', sort: 'priority', dir: 'desc' },
  { value: 'name:asc', label: 'Name A–Z', sort: 'name', dir: 'asc' },
  { value: 'name:desc', label: 'Name Z–A', sort: 'name', dir: 'desc' },
  { value: 'quantity:desc', label: 'Quantity high–low', sort: 'quantity', dir: 'desc' },
  { value: 'quantity:asc', label: 'Quantity low–high', sort: 'quantity', dir: 'asc' },
];

export function WantSortSelect({
  sort,
  dir,
  onChange,
}: {
  sort: WantSort;
  dir: WantSortDir;
  onChange: (sort: WantSort, dir: WantSortDir) => void;
}) {
  return (
    <TextField
      select
      size="small"
      label="Sort"
      value={`${sort}:${dir}`}
      onChange={(event) => {
        const option = OPTIONS.find((row) => row.value === event.target.value);
        if (option) onChange(option.sort, option.dir);
      }}
      sx={{ minWidth: { md: 200 }, width: { xs: '100%', md: 'auto' } }}
    >
      {OPTIONS.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
