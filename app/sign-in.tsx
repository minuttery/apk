import { AppText } from '@/components/app-text'
import { useAuth } from '@/components/auth/auth-provider'
import { AppConfig } from '@/constants/app-config'
import { MinutteryColors } from '@/constants/colors'
import { showError } from '@/utils/show-error'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

export default function SignIn() {
  const { signIn } = useAuth()
  const [isSigningIn, setIsSigningIn] = useState(false)

  // Sign-in goes through the wallet, which can decline or fail the request.
  async function handleSignIn() {
    if (isSigningIn) {
      return
    }
    setIsSigningIn(true)
    try {
      await signIn()
      // We only get here when sign-in succeeded, so it is safe to navigate.
      router.replace('/')
    } catch (error) {
      showError('Could not sign in', error)
    } finally {
      setIsSigningIn(false)
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topbar}>
          <View style={styles.brand}>
            <Text style={styles.brandMark}>m</Text>
            <AppText style={styles.brandName}>{AppConfig.name}</AppText>
          </View>
          <View style={styles.network}>
            <View style={styles.liveDot} />
            <Text style={styles.networkText}>Solana devnet</Text>
          </View>
        </View>
        <View style={styles.content}>
          <Text style={styles.kicker}>SECURE ACCESS</Text>
          <AppText type="title" style={styles.heading}>
            Sign in
          </AppText>
          <Text style={styles.copy}>One tap to enter the arena. Connect your Solana wallet to play.</Text>
          <Pressable
            disabled={isSigningIn}
            onPress={() => void handleSignIn()}
            style={[styles.button, isSigningIn && styles.disabled]}
          >
            <Text style={styles.buttonText}>{isSigningIn ? 'Connecting...' : 'Connect wallet'}</Text>
          </Pressable>
          <Text style={styles.hint}>Your wallet stays in control of every transaction.</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>powered by </Text>
          <Text style={styles.footerStrong}>minuttery protocol</Text>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>every 60 seconds</Text>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MinutteryColors.background },
  safeArea: { flex: 1 },
  topbar: {
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: MinutteryColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: {
    color: MinutteryColors.background,
    backgroundColor: MinutteryColors.accent,
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    transform: [{ rotate: '-8deg' }],
  },
  brandName: { fontFamily: 'serif', fontSize: 19 },
  network: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MinutteryColors.accent },
  networkText: { color: MinutteryColors.muted, fontSize: 11 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  kicker: { color: MinutteryColors.accent, fontSize: 10, letterSpacing: 1.5, marginBottom: 12 },
  heading: { fontSize: 38, lineHeight: 44, marginBottom: 12 },
  copy: { color: MinutteryColors.muted, fontSize: 14, lineHeight: 21, maxWidth: 320, marginBottom: 28 },
  button: {
    backgroundColor: MinutteryColors.accent,
    alignItems: 'center',
    paddingVertical: 16,
    maxWidth: 280,
    borderRadius: 15,
  },
  disabled: { opacity: 0.5 },
  buttonText: {
    color: MinutteryColors.background,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hint: { color: MinutteryColors.muted, fontSize: 11, marginTop: 14 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: 16 },
  footerText: { color: MinutteryColors.muted, fontSize: 10 },
  footerStrong: { color: MinutteryColors.text, fontSize: 10, fontWeight: '700' },
  footerLine: { width: 24, height: 1, backgroundColor: MinutteryColors.border, marginHorizontal: 8 },
})
