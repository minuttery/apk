import { PropsWithChildren } from 'react'
import { DarkTheme, ThemeProvider } from 'expo-router'
import { MinutteryColors } from '@/constants/colors'

// minuttery is a dark-only brand (see 0xNicko/minuttery style.css), so the app always renders in dark mode.
const minutteryTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: MinutteryColors.accent,
    background: MinutteryColors.background,
    card: MinutteryColors.panel,
    text: MinutteryColors.text,
    border: MinutteryColors.border,
    notification: MinutteryColors.danger,
  },
}

export function useAppTheme() {
  return {
    colorScheme: 'dark' as const,
    isDark: true,
    theme: minutteryTheme,
  }
}

export function AppTheme({ children }: PropsWithChildren) {
  const { theme } = useAppTheme()

  return <ThemeProvider value={theme}>{children}</ThemeProvider>
}
