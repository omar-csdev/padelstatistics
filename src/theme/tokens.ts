// Navy / electric-blue broadcast palette ported from the design prototype.
// Single theme for MVP — alt palettes (Lime / Court / Ink) are deferred.

export const colors = {
  bg: '#0a1623',
  surface: '#11243c',
  surface2: '#173352',
  surface3: '#1f4570',
  border: '#1f4a78',
  borderSoft: 'rgba(255,255,255,0.08)',

  ink: '#ffffff',
  ink2: '#b8c8de',
  ink3: '#7a8ca6',

  accent: '#3aa8ff',
  accent2: '#00d4ff',

  won: '#5be087',
  error: '#ff5470',
  warn: '#ffce3d',
  hot: '#ff8a3d',

  courtLine: 'rgba(255,255,255,0.55)',
  courtGlass: '#1a3855',
  courtBlue: '#1d4a78',

  onAccent: '#03101f',
} as const;

export const space = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semibold: 'Archivo_600SemiBold',
  bold: 'Archivo_700Bold',
  extrabold: 'Archivo_800ExtraBold',
  black: 'Archivo_900Black',
  narrow: 'Archivo_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_700Bold',
} as const;

export const type = {
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.ink3,
  },
  digit: {
    fontFamily: fonts.black,
    fontVariant: ['tabular-nums' as const],
    letterSpacing: -0.5,
  },
  mono: {
    fontFamily: fonts.mono,
    fontVariant: ['tabular-nums' as const],
  },
} as const;
