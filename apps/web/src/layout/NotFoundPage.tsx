import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Stack
      spacing={3}
      sx={{
        alignItems: 'flex-start',
      }}
    >
      <Typography variant="h1">Page not found</Typography>
      <Typography
        sx={{
          color: 'text.secondary',
        }}
      >
        That binder may be private, or the link may be out of date.
      </Typography>
      <Button component={RouterLink} to="/" variant="outlined">
        Back to the start
      </Button>
    </Stack>
  );
}
