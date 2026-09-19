/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// minuttery brand tokens (see 0xNicko/minuttery style.css) — the app is dark-only by design.
const minutteryPalette = {
  background: '#0a0b0b',
  panel: '#111313',
  border: '#292d29',
  text: '#f3f4e9',
  muted: '#8a9088',
  accent: '#f1ff0a',
  danger: '#ff7575',
}

export const Colors = {
  light: {
    background: minutteryPalette.background,
    border: minutteryPalette.border,
    icon: minutteryPalette.muted,
    tabIconDefault: minutteryPalette.muted,
    tabIconSelected: minutteryPalette.accent,
    text: minutteryPalette.text,
    tint: minutteryPalette.accent,
  },
  dark: {
    background: minutteryPalette.background,
    border: minutteryPalette.border,
    icon: minutteryPalette.muted,
    tabIconDefault: minutteryPalette.muted,
    tabIconSelected: minutteryPalette.accent,
    text: minutteryPalette.text,
    tint: minutteryPalette.accent,
  },
}

export const MinutteryColors = minutteryPalette
