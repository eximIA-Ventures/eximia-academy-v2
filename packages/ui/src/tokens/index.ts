/**
 * Overlens Design Tokens - TypeScript Exports
 * Source: Benchmarks/Design/design-tokens.json v1.2.2
 *
 * Use these for programmatic access (CVA variants, runtime calculations).
 * For CSS/Tailwind, use the theme.css @theme variables instead.
 */

export const colors = {
  bg: {
    app: "#0f0f0f",
    sidebar: "#111111",
    surface: "#1a1a1a",
    card: "#1e1e1e",
    elevated: "#242424",
    hover: "#2a2a2a",
    dud: "#1c1c1c",
  },
  text: {
    primary: "#ffffff",
    secondary: "#a0a0a0",
    muted: "#666666",
    inactive: "#888888",
  },
  accent: {
    blue: {
      deep: "#0d2847",
      DEFAULT: "#1a4a8a",
      mid: "#2a6ab0",
      light: "#4a8ad0",
    },
    gold: {
      dark: "#8a6a20",
      DEFAULT: "#c4a040",
      light: "#d4b860",
    },
    teal: {
      dark: "#1a4a5a",
      DEFAULT: "#2a7a8a",
      light: "#3a9aaa",
    },
  },
  semantic: {
    success: "#4b9560",
    error: "#fe4338",
    warning: "#f6a609",
    info: "#2a6ab0",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.06)",
    medium: "rgba(255, 255, 255, 0.1)",
    button: "rgba(255, 255, 255, 0.25)",
  },
  special: {
    courseCard: "#f0ece4",
    courseCardText: "#2a2a2a",
  },
} as const

export const typography = {
  fontFamily: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    mono: '"JetBrains Mono", Monaco, monospace',
  },
  fontSize: {
    "2xs": "0.625rem",
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    md: "1.125rem",
    lg: "1.25rem",
    xl: "1.5rem",
    "2xl": "1.75rem",
    "3xl": "2rem",
    "4xl": "2.25rem",
    "5xl": "2.5rem",
    "6xl": "2.8rem",
    "7xl": "3.2rem",
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: "1.1",
    normal: "1.3",
    relaxed: "1.5",
    loose: "1.6",
  },
  letterSpacing: {
    hero: "-1px",
  },
} as const

export const spacing = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  7: "2rem",
  8: "2.5rem",
  9: "3rem",
  10: "4rem",
} as const

export const radius = {
  sm: "6px",
  md: "12px",
  lg: "18px",
  xl: "24px",
  pill: "100px",
  circle: "50%",
} as const

export const shadows = {
  card: "0 2px 8px rgba(0, 0, 0, 0.4)",
  elevated: "0 8px 24px rgba(0, 0, 0, 0.5)",
  hero: "0 16px 48px rgba(0, 0, 0, 0.6)",
} as const

export const focusRing = {
  color: "#2a6ab0",
  width: "2px",
  offset: "2px",
  style: "solid",
} as const

export const transitions = {
  duration: {
    fast: "150ms",
    normal: "200ms",
    slow: "300ms",
  },
  timing: {
    standard: "ease",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
  },
} as const

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const

export const zIndex = {
  base: 0,
  sticky: 10,
  sidebar: 20,
  dropdown: 30,
  modal: 40,
  toast: 50,
} as const

export const layout = {
  sidebar: { width: "230px" },
  topbar: { height: "56px" },
} as const

export const tokens = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  focusRing,
  transitions,
  breakpoints,
  zIndex,
  layout,
} as const

export type DesignTokens = typeof tokens
