import { Button, Stack, Typography } from '@mui/material';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Catches a render crash so the shell stays up. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  override render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Stack
        spacing={3}
        sx={{
          alignItems: 'flex-start',
        }}
      >
        <Typography variant="h1">Something went wrong</Typography>
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </Stack>
    );
  }
}
