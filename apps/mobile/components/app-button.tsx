import Color from 'color'
import { useTheme } from 'expo-router'
import { PropsWithChildren } from 'react'
import { Pressable, PressableProps, StyleSheet, Text } from 'react-native'

type AppButtonProps = PropsWithChildren<
  Omit<PressableProps, 'children'> & {
    color?: string
    variant?: 'filled' | 'plain' | 'tinted'
  }
>

export function AppButton({
  android_ripple,
  children,
  color: customColor,
  style,
  variant = 'filled',
  ...props
}: AppButtonProps) {
  const { colors, fonts } = useTheme()
  const color = customColor ?? colors.primary
  const backgroundColor =
    variant === 'plain' ? 'transparent' : variant === 'filled' ? color : 'transparent'
  const textColor = variant === 'filled' ? colors.background : color
  const borderColor = variant === 'tinted' ? colors.border : 'transparent'

  return (
    <Pressable
      {...props}
      android_ripple={{
        color: Color(textColor).fade(0.85).string(),
        radius: 40,
        ...android_ripple,
      }}
      role="button"
      style={(state) => [
        { backgroundColor, borderColor, opacity: state.pressed ? 0.7 : 1 },
        styles.button,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <Text style={[{ color: textColor }, fonts.heavy, styles.text]}>{children}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    borderCurve: 'continuous',
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  text: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 18,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
})
