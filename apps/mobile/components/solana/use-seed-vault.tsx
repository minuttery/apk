import { useCallback, useEffect, useState } from 'react'
import { PermissionsAndroid, Platform } from 'react-native'
import { SeedVault, SeedVaultPermissionAndroid } from '@solana-mobile/seed-vault-lib'
import { showError } from '@/utils/show-error'

export type SeedVaultAccount = {
  derivationPath: string
  publicKeyEncoded: string
}

// Seed Vault is Solana Mobile's hardware-backed key store. It only exists on Saga/Seeker
// devices (or the simulated variant on other Solana Mobile OS builds) — never on a
// stock Android phone, so callers must always be ready to fall back to Mobile Wallet Adapter.
export function useMinutterySeedVault() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [accounts, setAccounts] = useState<SeedVaultAccount[]>([])
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    async function checkAvailability() {
      if (Platform.OS !== 'android') {
        if (mounted) setIsAvailable(false)
        return
      }
      try {
        const allowSimulated = __DEV__
        const available = await SeedVault.isSeedVaultAvailable(allowSimulated)
        if (mounted) setIsAvailable(available)
      } catch {
        if (mounted) setIsAvailable(false)
      }
    }
    void checkAvailability()
    return () => {
      mounted = false
    }
  }, [])

  const requestPermission = useCallback(async () => {
    const result = await PermissionsAndroid.request(SeedVaultPermissionAndroid, {
      title: 'Permiso de Seed Vault',
      message: 'minuttery necesita permiso para usar Seed Vault y firmar con tu semilla protegida por hardware.',
      buttonNeutral: 'Preguntar luego',
      buttonNegative: 'Cancelar',
      buttonPositive: 'Permitir',
    })
    return result === PermissionsAndroid.RESULTS.GRANTED
  }, [])

  const loadAccounts = useCallback(async () => {
    setIsBusy(true)
    try {
      const seeds = await SeedVault.getAuthorizedSeeds()
      const seed = seeds[0] ?? (await SeedVault.authorizeNewSeed())
      const seedAccounts = await SeedVault.getAccounts(seed.authToken)
      const resolved = seedAccounts.map((account) => ({
        derivationPath: account.derivationPath,
        publicKeyEncoded: account.publicKeyEncoded,
      }))
      setAccounts(resolved)
      return resolved
    } catch (error) {
      showError('No se pudo leer Seed Vault', error)
      return []
    } finally {
      setIsBusy(false)
    }
  }, [])

  return { isAvailable, accounts, isBusy, requestPermission, loadAccounts }
}

