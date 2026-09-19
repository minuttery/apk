import { useState } from 'react'
import { View } from 'react-native'
import { AppText } from '@/components/app-text'
import { AppButton } from '@/components/app-button'
import { ellipsify } from '@/utils/ellipsify'
import { useMinutterySeedVault } from '@/components/solana/use-seed-vault'

// Shown on the account screen: offers the native Seed Vault as an alternative signer to
// Mobile Wallet Adapter, but only when the OS actually exposes it (Saga/Seeker devices).
export function SeedVaultCard() {
  const { isAvailable, accounts, isBusy, requestPermission, loadAccounts } = useMinutterySeedVault()
  const [started, setStarted] = useState(false)

  async function handleConnect() {
    setStarted(true)
    const granted = await requestPermission()
    if (granted) {
      await loadAccounts()
    }
  }

  if (isAvailable === null) {
    return null
  }

  return (
    <View style={{ borderWidth: 1, borderColor: '#292d29', borderRadius: 15, padding: 16, gap: 8 }}>
      <AppText type="defaultSemiBold">Seed Vault</AppText>
      {!isAvailable ? (
        <AppText style={{ opacity: 0.7, fontSize: 13 }}>
          No disponible en este dispositivo. Seed Vault solo existe en hardware Solana Mobile (Saga/Seeker); acá
          seguí usando Mobile Wallet Adapter.
        </AppText>
      ) : accounts.length > 0 ? (
        accounts.map((account) => (
          <AppText key={account.publicKeyEncoded} type="mono" style={{ opacity: 0.8 }}>
            {ellipsify(account.publicKeyEncoded, 8)}
          </AppText>
        ))
      ) : (
        <AppButton variant="tinted" disabled={isBusy || started} onPress={() => void handleConnect()}>
          {isBusy ? 'Conectando...' : 'Usar Seed Vault'}
        </AppButton>
      )}
    </View>
  )
}
