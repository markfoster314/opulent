import { createTheme, type ThemeOptions } from '@mui/material/styles';

/**
 * Black with darkened gold.
 *
 * The rule the palette follows: gold is reserved for things the user can act on
 * or should read first. Surfaces stay near-black. Gold on every surface reads as
 * a gift shop; gold on a few reads as expensive.
 */
export const palette = {
  /** Page background, the darkest layer. */
  background: '#0B0B0C',
  /** Cards, sheets and app bar sit one step up so edges are visible without borders. */
  surface: '#16161A',
  surfaceRaised: '#1E1E24',
  divider: 'rgba(197, 160, 71, 0.16)',

  /** Darkened gold. Muted enough to read as metal rather than yellow. */
  gold: '#B8860B',
  goldLight: '#D4A62A',
  goldDark: '#8A6508',

  textPrimary: '#F2EFE6',
  textSecondary: '#A39B86',
} as const;

const themeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: palette.gold,
      light: palette.goldLight,
      dark: palette.goldDark,
      contrastText: '#0B0B0C',
    },
    secondary: {
      main: '#6E7B8B',
      contrastText: '#0B0B0C',
    },
    background: {
      default: palette.background,
      paper: palette.surface,
    },
    text: {
      primary: palette.textPrimary,
      secondary: palette.textSecondary,
    },
    divider: palette.divider,
    success: { main: '#4F8A5B' },
    warning: { main: '#C9962F' },
    error: { main: '#B4544A' },
  },

  shape: {
    borderRadius: 10,
  },

  typography: {
    fontFamily: ['"Inter"', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'].join(','),
    h1: { fontSize: '2.25rem', fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h3: { fontSize: '1.375rem', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.background,
          // Faint gold wash from the top so the page is not a flat black slab.
          backgroundImage: `radial-gradient(1200px 600px at 50% -200px, rgba(184, 134, 11, 0.10), transparent 70%)`,
          backgroundAttachment: 'fixed',
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'transparent' },
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(11, 11, 12, 0.82)',
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${palette.divider}`,
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${palette.divider}`,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        containedPrimary: {
          background: `linear-gradient(180deg, ${palette.goldLight} 0%, ${palette.gold} 100%)`,
          '&:hover': { background: palette.goldLight },
        },
        outlinedPrimary: {
          borderColor: 'rgba(184, 134, 11, 0.45)',
          '&:hover': { borderColor: palette.goldLight, backgroundColor: 'rgba(184,134,11,0.08)' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        outlinedPrimary: { borderColor: 'rgba(184, 134, 11, 0.45)' },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
  },
};

export const theme = createTheme(themeOptions);
