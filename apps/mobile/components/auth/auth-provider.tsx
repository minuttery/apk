import { createOrGetPasskeyWallet, type PasskeyWallet } from '@/components/auth/passkey-wallet'
import { PublicKey } from '@solana/web3.js'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { createContext, type PropsWithChildren, use, useMemo, useState } from 'react'

export interface AuthState {
  isAuthenticated: boolean
  kind: 'wallet' | 'passkey' | null
  passkeyWallet: PasskeyWallet | null
  playerAddress: PublicKey | null
  signIn: () => Promise<void>
  signInWithPasskey: () => Promise<void>
  signOut: () => Promise<void>
}

const Context = createContext<AuthState>({} as AuthState)

export function useAuth() {
  const value = use(Context)
  if (!value) {
    throw new Error('useAuth must be wrapped in a <AuthProvider />')
  }
  return value
}

export function AuthProvider({ children }: PropsWithChildren) {
  const { account, accounts, connect, disconnect } = useMobileWallet()
  const [passkeyWallet, setPasskeyWallet] = useState<PasskeyWallet | null>(null)

  const walletConnected = (accounts?.length ?? 0) > 0
  const kind = passkeyWallet ? 'passkey' : walletConnected ? 'wallet' : null
  const playerAddress = passkeyWallet?.keypair.publicKey ?? account?.address ?? null

  const value: AuthState = useMemo(
    () => ({
      isAuthenticated: Boolean(kind),
      kind,
      passkeyWallet,
      playerAddress,
      signIn: async () => {
        setPasskeyWallet(null)
        // authorize/connect only — SIWS signIn is what Phantom/Backpack reject on Android
        await connect()
      },
      signInWithPasskey: async () => {
        const wallet = await createOrGetPasskeyWallet()
        setPasskeyWallet(wallet)
      },
      signOut: async () => {
        setPasskeyWallet(null)
        if (walletConnected) await disconnect()
      },
    }),
    [connect, disconnect, kind, passkeyWallet, playerAddress, walletConnected],
  )

  return <Context value={value}>{children}</Context>
}
