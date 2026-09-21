import { PublicKey } from '@solana/web3.js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'

export function useGetBalanceQueryKey({ address, endpoint }: { address: PublicKey; endpoint: string }) {
  return ['get-balance', { endpoint, address }]
}

export function useGetBalance({ address }: { address?: PublicKey | null }) {
  const { connection } = useMobileWallet()
  const queryKey = useGetBalanceQueryKey({ address: address as PublicKey, endpoint: connection.rpcEndpoint })

  return useQuery({
    queryKey,
    enabled: Boolean(address),
    queryFn: () => connection.getBalance(address as PublicKey),
  })
}

export function useGetBalanceInvalidate({ address }: { address: PublicKey }) {
  const { connection } = useMobileWallet()
  const queryKey = useGetBalanceQueryKey({ address, endpoint: connection.rpcEndpoint })
  const client = useQueryClient()

  return () => client.invalidateQueries({ queryKey })
}
