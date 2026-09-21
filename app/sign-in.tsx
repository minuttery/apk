import { useAuth } from '@/components/auth/auth-provider'
import { passkeysSupported } from '@/components/auth/passkey-wallet'
import { useMinutterySeedVault } from '@/components/solana/use-seed-vault'
import { MinutteryColors } from '@/constants/colors'
import { showError } from '@/utils/show-error'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

type Pending = 'passkey' | 'wallet' | 'vault' | null

export default function SignIn() {
  const insets = useSafeAreaInsets()
  const { signIn, signInWithPasskey } = useAuth()
  const { isAvailable: seekerAvailable, isBusy: vaultBusy, requestPermission, loadAccounts } = useMinutterySeedVault()
  const [pending, setPending] = useState<Pending>(null)
  const canUsePasskey = passkeysSupported()

  async function connectWallet() {
    if (pending) return
    setPending('wallet')
    try {
      await signIn()
      router.replace('/')
    } catch (error) {
      showError('Could not connect wallet', error)
    } finally {
      setPending(null)
    }
  }

  async function connectPasskey() {
    if (pending) return
    setPending('passkey')
    try {
      await signInWithPasskey()
      router.replace('/')
    } catch (error) {
      showError('Could not sign in with passkey', error)
    } finally {
      setPending(null)
    }
  }

  async function connectSeedVault() {
    if (pending) return
    setPending('vault')
    try {
      const granted = await requestPermission()
      if (granted) await loadAccounts()
      await signIn()
      router.replace('/')
    } catch (error) {
      showError('Could not open Seed Vault', error)
    } finally {
      setPending(null)
    }
  }

  const busy = pending !== null || vaultBusy

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoLetter} allowFontScaling={false}>
            m
          </Text>
        </View>
        <Text style={styles.wordmark} allowFontScaling={false}>
          minuttery
        </Text>
        <Text style={styles.heading} allowFontScaling={false}>
          Welcome{'\n'}to minuttery
        </Text>
        <Text style={styles.subtitle}>One minute. One pot. On Solana.</Text>
      </View>

      <View style={styles.sheet}>
        <Pressable
          disabled={busy || !canUsePasskey}
          onPress={() => void connectPasskey()}
          style={[styles.passkeyButton, (busy || !canUsePasskey) && styles.disabled]}
        >
          <LockIcon />
          <Text style={styles.passkeyText} allowFontScaling={false}>
            {pending === 'passkey' ? 'Waiting for passkey…' : 'Sign in with passkey'}
          </Text>
        </Pressable>
        <Text style={styles.hint}>
          {canUsePasskey
            ? 'Face ID, Touch ID or your device passkey'
            : 'Passkeys need Android 9+ with Google Password Manager'}
        </Text>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orLabel}>or connect a wallet</Text>
          <View style={styles.orLine} />
        </View>

        <Pressable
          disabled={busy}
          onPress={() => void connectWallet()}
          style={[styles.walletButton, busy && styles.disabled]}
        >
          <Text style={styles.walletButtonText} allowFontScaling={false}>
            {pending === 'wallet' ? 'Connecting…' : 'Connect wallet'}
          </Text>
        </Pressable>

        {seekerAvailable ? (
          <Pressable
            disabled={busy}
            onPress={() => void connectSeedVault()}
            style={[styles.vaultButton, busy && styles.disabled]}
          >
            <Text style={styles.vaultButtonText} allowFontScaling={false}>
              {pending === 'vault' ? 'Opening Seed Vault…' : 'Connect with Seeker Seed Vault'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

function LockIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill={MinutteryColors.background}
        d="M12 1.8a4.7 4.7 0 0 0-4.7 4.7v2.2H6.4A2.4 2.4 0 0 0 4 11.1v8.4A2.4 2.4 0 0 0 6.4 22h11.2a2.4 2.4 0 0 0 2.4-2.5v-8.4a2.4 2.4 0 0 0-2.4-2.4h-.9V6.5A4.7 4.7 0 0 0 12 1.8Zm0 1.8A2.9 2.9 0 0 1 14.9 6.5v2.2H9.1V6.5A2.9 2.9 0 0 1 12 3.6Z"
      />
    </Svg>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MinutteryColors.background,
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 28,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: MinutteryColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
    marginBottom: 14,
  },
  logoLetter: {
    color: MinutteryColors.background,
    fontFamily: 'serif',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 36,
    includeFontPadding: false,
  },
  wordmark: {
    color: MinutteryColors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  heading: {
    color: MinutteryColors.text,
    fontFamily: 'serif',
    fontSize: 34,
    lineHeight: 38,
    textAlign: 'center',
    fontWeight: '400',
  },
  subtitle: {
    color: MinutteryColors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  sheet: {
    marginTop: 'auto',
    paddingBottom: 8,
  },
  passkeyButton: {
    minHeight: 56,
    borderRadius: 15,
    backgroundColor: MinutteryColors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  passkeyText: {
    color: MinutteryColors.background,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hint: {
    color: MinutteryColors.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 18,
  },
  orLine: { flex: 1, height: 1, backgroundColor: MinutteryColors.border },
  orLabel: {
    color: '#6c726b',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  walletButton: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  walletButtonText: {
    color: MinutteryColors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  vaultButton: {
    minHeight: 52,
    marginTop: 10,
    borderWidth: 1,
    borderColor: MinutteryColors.accent,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultButtonText: {
    color: MinutteryColors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  disabled: { opacity: 0.5 },
})
