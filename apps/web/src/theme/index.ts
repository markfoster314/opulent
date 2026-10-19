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
  /** Lightest gold. The top of a hovered button. */
  goldHighlight: '#F0D48A',
  goldDark: '#8A6508',

  /** The same gold, thinned, for borders, washes, and a selected tile. */
  goldBorder: 'rgba(184, 134, 11, 0.45)',
  goldWash: 'rgba(184, 134, 11, 0.10)',
  goldTint: 'rgba(184, 134, 11, 0.08)',
  goldSelected: 'rgba(184, 134, 11, 0.12)',

  /** Bar over the page, same black as the background with some see-through. */
  appBar: 'rgba(11, 11, 12, 0.82)',

  /**
   * Muted steel blue. Facts and quiet controls. Gold stays on the action.
   * steel is the text and icon. steelDeep is a fill. The wash is a thin tint.
   */
  steel: '#9BB0C0',
  steelDeep: '#4A6574',
  steelWash: 'rgba(155, 176, 192, 0.12)',
  steelBorder: 'rgba(155, 176, 192, 0.45)',

  success: '#4F8A5B',
  warning: '#C9962F',
  error: '#B4544A',

  textPrimary: '#F2EFE6',
  textSecondary: '#A39B86',

  /** Marks on a binder card. Gold stays the notes mark. These stay distinct from it and from each other. */
  markSigned: '#3E6F8C',
  markAltered: '#6B5B8C',
  markMisprint: '#2F7A6E',
  markMiscut: '#8C4E3A',
  markArtistProof: '#8E4A6A',

  /** Marks on a want card. One color for each choice the owner narrowed. */
  markLanguage: '#3E6F8C',
  markPrinting: '#6B5B8C',
  markCondition: '#2F7A6E',
  markSet: '#8C4E3A',

  /**
   * Gloss laid over a foil card. These are the shine, not a recolor of the scan.
   * Warm matches goldHighlight. Cool is the other side of the reflection.
   */
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
        containedPrimary: {
          // The button fades `background-color` on hover. A gradient lives on
          // `background-image`, which cannot fade, so a flat hover color lets
          // the black page show through for a frame. Hover stays a gradient,
          // and `&&` beats the button's own color fade so it does not run.
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
        },
        outlinedPrimary: {
          borderColor: palette.goldBorder,
          '&:hover': { borderColor: palette.goldLight, backgroundColor: palette.goldTint },
        },
        outlinedSecondary: {
          borderColor: palette.steelBorder,
          '&:hover': { borderColor: palette.steel, backgroundColor: palette.steelWash },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        outlinedPrimary: { borderColor: palette.goldBorder },
        outlinedSecondary: { borderColor: palette.steelBorder },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
  },
};

/** A paper or row that opens another page. Gold edge and a small lift on hover. */
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
