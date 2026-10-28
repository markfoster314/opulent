import { createTheme, type ThemeOptions } from '@mui/material/styles';

/** Black with dark gold; gold is reserved for actions and first-read copy, not every surface. */
export const palette = {
  background: '#0B0B0C',
  /** One step above the background so edges show without borders. */
  surface: '#16161A',
  surfaceRaised: '#1E1E24',
  divider: 'rgba(197, 160, 71, 0.16)',

  /** Darkened gold, muted enough to read as metal rather than yellow. */
  gold: '#B8860B',
  goldLight: '#D4A62A',
  goldHighlight: '#F0D48A',
  goldDark: '#8A6508',

  goldBorder: 'rgba(184, 134, 11, 0.45)',
  goldWash: 'rgba(184, 134, 11, 0.10)',
  goldTint: 'rgba(184, 134, 11, 0.08)',
  goldSelected: 'rgba(184, 134, 11, 0.12)',

  appBar: 'rgba(11, 11, 12, 0.82)',

  /** Steel blue marks facts and quiet controls; gold stays on the action. */
  steel: '#9BB0C0',
  steelDeep: '#4A6574',
  steelWash: 'rgba(155, 176, 192, 0.12)',
  steelBorder: 'rgba(155, 176, 192, 0.45)',

  success: '#4F8A5B',
  warning: '#C9962F',
  error: '#B4544A',

  textPrimary: '#F2EFE6',
  textSecondary: '#A39B86',

  /** Binder marks use distinct hues; gold stays reserved for notes. */
  markSigned: '#3E6F8C',
  markAltered: '#6B5B8C',
  markMisprint: '#2F7A6E',
  markMiscut: '#8C4E3A',
  markArtistProof: '#8E4A6A',

  markLanguage: '#3E6F8C',
  markPrinting: '#6B5B8C',
  markCondition: '#2F7A6E',
  markSet: '#8C4E3A',

  /** Foil gloss is a shine overlay, not a recolor of the scan. */
  foilShine: 'rgba(255, 255, 255, 0.7)',
  foilWarm: 'rgba(240, 212, 138, 0.75)',
  foilCool: 'rgba(186, 214, 232, 0.7)',
} as const;

const themeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: palette.gold,
      light: palette.goldLight,
      dark: palette.goldDark,
      contrastText: palette.background,
    },
    secondary: {
      main: palette.steel,
      dark: palette.steelDeep,
      contrastText: palette.background,
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
    success: { main: palette.success },
    warning: { main: palette.warning },
    error: { main: palette.error },
  },

  shape: {
    borderRadius: 10,
  },

  typography: {
    fontFamily: ['"Inter"', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'].join(','),
    h1: {
      fontSize: '1.75rem',
      fontWeight: 600,
      letterSpacing: '-0.02em',
      '@media (min-width:600px)': { fontSize: '2.25rem' },
    },
    h2: {
      fontSize: '1.375rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      '@media (min-width:600px)': { fontSize: '1.75rem' },
    },
    h3: {
      fontSize: '1.2rem',
      fontWeight: 600,
      '@media (min-width:600px)': { fontSize: '1.375rem' },
    },
    button: { textTransform: 'none', fontWeight: 600 },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.background,
          // Faint gold wash from the top so the page is not a flat black slab.
          backgroundImage: `radial-gradient(1200px 600px at 50% -200px, ${palette.goldWash}, transparent 70%)`,
          backgroundAttachment: 'fixed',
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'transparent' },
      styleOverrides: {
        root: {
          backgroundColor: palette.appBar,
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
        root: ({ ownerState }) => ({
          ...(ownerState.variant === 'contained' &&
            ownerState.color === 'primary' && {
              // Hover stays a gradient: a flat background-color would flash through MUI's fade, and && stops that fade.
              '&&': {
                transition:
                  'color 250ms cubic-bezier(0.4, 0, 0.2, 1), border-color 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                backgroundColor: palette.gold,
                backgroundImage: `linear-gradient(180deg, ${palette.goldLight} 0%, ${palette.gold} 100%)`,
              },
              '&&:hover': {
                backgroundColor: palette.goldLight,
                backgroundImage: `linear-gradient(180deg, ${palette.goldHighlight} 0%, ${palette.goldLight} 100%)`,
              },
            }),
          ...(ownerState.variant === 'outlined' &&
            ownerState.color === 'primary' && {
              borderColor: palette.goldBorder,
              '&:hover': { borderColor: palette.goldLight, backgroundColor: palette.goldTint },
            }),
          ...(ownerState.variant === 'outlined' &&
            ownerState.color === 'secondary' && {
              borderColor: palette.steelBorder,
              '&:hover': { borderColor: palette.steel, backgroundColor: palette.steelWash },
            }),
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          ...(ownerState.variant === 'outlined' &&
            ownerState.color === 'primary' && { borderColor: palette.goldBorder }),
          ...(ownerState.variant === 'outlined' &&
            ownerState.color === 'secondary' && { borderColor: palette.steelBorder }),
        }),
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
  },
};

export const clickableSurfaceSx = {
  cursor: 'pointer',
  textDecoration: 'none',
  transition: 'border-color 120ms ease, transform 120ms ease, background-color 120ms ease',
  '&:hover, &:focus-visible': {
    borderColor: palette.gold,
    backgroundColor: palette.goldWash,
    transform: 'translateY(-2px)',
  },
} as const;

export const theme = createTheme(themeOptions);
