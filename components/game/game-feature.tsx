import { useGetBalance } from '@/components/account/use-get-balance'
import { AppText } from '@/components/app-text'
import { useAuth } from '@/components/auth/auth-provider'
import { MinutteryColors } from '@/constants/colors'
import { lamportsToSol } from '@/utils/lamports-to-sol'
import { showError } from '@/utils/show-error'
import { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { Buffer } from 'buffer'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

const PROGRAM_ID = new PublicKey('9Uf52hSPJPDqDj7QFqL5dKmdJseU1pRtzL8oNQGeDxrP')
const ROOM_TIERS = [0.1, 1, 2, 5]
const ROUND_MS = 60_000
const BETTING_CLOSES_AT = 55
const WINNERS_API = 'https://minuttery.com'
const PLACE_BET_DISCRIMINATOR = Uint8Array.from([222, 62, 67, 220, 63, 166, 126, 33])

function roundIdAt(now: number) {
  return Math.floor(now / ROUND_MS)
}

function roundPda(roundId: number, tier: number) {
  const round = new ArrayBuffer(8)
  new DataView(round).setBigInt64(0, BigInt(roundId), true)
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('round'), Uint8Array.of(tier), new Uint8Array(round)],
    PROGRAM_ID,
  )[0]
}

function placeBetData(roundId: number, tier: number, amount: number) {
  const data = new Uint8Array(8 + 8 + 1 + 8)
  data.set(PLACE_BET_DISCRIMINATOR)
  const view = new DataView(data.buffer)
  view.setBigInt64(8, BigInt(roundId), true)
  view.setUint8(16, tier)
  view.setBigUint64(17, BigInt(Math.round(amount * 1_000_000_000)), true)
  return data
}

export function GameFeature() {
  const { account, connection, signAndSendTransactions } = useMobileWallet()
  const { signOut } = useAuth()
  const balanceQuery = useGetBalance({ address: account?.address as PublicKey })
  const [selectedTier, setSelectedTier] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [players, setPlayers] = useState(0)
  const [joining, setJoining] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [winnersOpen, setWinnersOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [winners, setWinners] = useState<{ winner?: string; pot?: number; roundId?: number; signature?: string }[]>([])
  const [winnersLoading, setWinnersLoading] = useState(true)

  const roundId = roundIdAt(now)
  const elapsed = ((now % ROUND_MS) + ROUND_MS) % ROUND_MS
  const seconds = Math.floor(elapsed / 1000)
  const centiseconds = Math.floor((elapsed % 1000) / 10)
  const bettingClosed = seconds >= BETTING_CLOSES_AT
  const selectedBet = ROOM_TIERS[selectedTier]
  const pot = (players * selectedBet).toFixed(2)
  const balance = balanceQuery.data === undefined ? null : lamportsToSol(balanceQuery.data).toFixed(2)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 50)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!account) return
    let cancelled = false
    async function loadRound() {
      try {
        const info = await connection.getAccountInfo(roundPda(roundId, selectedTier), 'confirmed')
        if (!cancelled) setPlayers(info?.data.length ? info.data[8] : 0)
      } catch {
        // The clock and join action remain usable while devnet is unavailable.
      }
    }
    void loadRound()
    const poll = setInterval(loadRound, 5_000)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [account, connection, roundId, selectedTier])

  useEffect(() => {
    let cancelled = false
    async function loadWinners() {
      try {
        const response = await fetch(`${WINNERS_API}/winners?limit=12`)
        if (!response.ok) throw new Error(`Winners API ${response.status}`)
        const payload = await response.json()
        const rows = Array.isArray(payload) ? payload : (payload.rows ?? payload.items ?? payload.winners ?? [])
        if (!cancelled) setWinners(rows)
      } catch {
        if (!cancelled) setWinners([])
      } finally {
        if (!cancelled) setWinnersLoading(false)
      }
    }
    void loadWinners()
    const poll = setInterval(loadWinners, 30_000)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [])

  const timer = useMemo(
    () => `00:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`,
    [centiseconds, seconds],
  )

  async function joinRound() {
    if (!account || joining || bettingClosed) return
    setJoining(true)
    try {
      const round = roundPda(roundId, selectedTier)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      const instruction = {
        programId: PROGRAM_ID,
        keys: [
          { pubkey: account.address, isSigner: true, isWritable: true },
          { pubkey: round, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(placeBetData(roundId, selectedTier, selectedBet)),
      }
      const message = new TransactionMessage({
        payerKey: account.address,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToV0Message()
      const signature = await signAndSendTransactions(new VersionedTransaction(message), 0)
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
      setPlayers((value) => value + 1)
    } catch (error) {
      showError('Could not join round', error)
    } finally {
      setJoining(false)
    }
  }

  async function shareRound() {
    await Share.share({ message: 'Join me on minuttery: https://minuttery.com' })
  }

  function shortAddress(address?: string) {
    return address ? `${address.slice(0, 4)}....${address.slice(-4)}` : 'Unknown wallet'
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topbar}>
          <View style={styles.brand}>
            <Text style={styles.brandMark}>m</Text>
            <AppText style={styles.brandName}>minuttery</AppText>
          </View>
          <View style={styles.sessionCluster}>
            <Pressable style={styles.balanceChip} onPress={() => setProfileOpen(true)}>
              <Text style={styles.balanceText}>{balance ?? '0.00'} SOL</Text>
              <Text style={styles.caret}>⌄</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Challenge someone"
              accessibilityRole="button"
              style={styles.headerInvite}
              onPress={() => setInviteOpen(true)}
            >
              <Text style={styles.headerInviteIcon}>↗</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.arena}>
          <View style={styles.gamePanel}>
            <View style={styles.presets}>
              {ROOM_TIERS.map((amount, tier) => (
                <Pressable
                  key={amount}
                  onPress={() => setSelectedTier(tier)}
                  style={[styles.preset, selectedTier === tier && styles.selectedPreset]}
                >
                  {selectedTier === tier ? <Text style={styles.betLabel}>BET</Text> : null}
                  <Text style={[styles.presetAmount, selectedTier === tier && styles.selectedPresetAmount]}>
                    {amount} ◎
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.roundHeader}>
              <Text style={styles.muted}>{bettingClosed ? 'betting closed' : 'round open'}</Text>
              <Text style={styles.muted}>
                #<Text style={styles.roundNumber}>{roundId}</Text>
              </Text>
            </View>
            <Text style={styles.timer}>{timer}</Text>
            <View style={styles.track}>
              <View style={[styles.progress, { width: `${(elapsed / ROUND_MS) * 100}%` }]} />
            </View>
            <View style={styles.timerLabels}>
              <Text style={styles.muted}>00:00</Text>
              <Text style={styles.muted}>01:00</Text>
            </View>
            <Pressable style={styles.winnerTicker} onPress={() => setWinnersOpen(true)}>
              <Text style={styles.winnerTickerText}>
                {winnersLoading
                  ? 'Loading recent winners...'
                  : winners[0]?.winner
                    ? `${shortAddress(winners[0].winner)} won ${((winners[0].pot ?? 0) / 1_000_000_000).toFixed(2)} SOL`
                    : 'No settled rounds yet'}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            <View style={styles.stats}>
              <View>
                <Text style={styles.statLabel}>players</Text>
                <Text style={styles.statValue}>{players}</Text>
              </View>
              <View>
                <Text style={styles.statLabel}>total pot</Text>
                <Text style={styles.statValue}>
                  {pot} <Text style={styles.sol}>SOL</Text>
                </Text>
              </View>
            </View>
            <View style={styles.actionArea}>
              <Pressable
                disabled={bettingClosed || joining}
                onPress={() => void joinRound()}
                style={[styles.joinButton, (bettingClosed || joining) && styles.disabled]}
              >
                {joining ? (
                  <ActivityIndicator color={MinutteryColors.background} />
                ) : (
                  <Text style={styles.joinText}>Join this round</Text>
                )}
              </Pressable>
              <Text style={styles.actionMessage}>
                {bettingClosed
                  ? 'The next round starts in a few seconds'
                  : players === 0
                    ? 'Fee refunded. You earn 1% of the pot.'
                    : 'Join before betting closes'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>powered by </Text>
          <Text style={styles.footerStrong}>minuttery protocol</Text>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>every 60 seconds</Text>
        </View>
      </SafeAreaView>
      {profileOpen ? (
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalKicker}>ACCOUNT</Text>
            <Text style={styles.modalTitle}>Your profile</Text>
            <Text style={styles.address}>{account?.address.toString()}</Text>
            <View style={styles.profileStats}>
              <View>
                <Text style={styles.statLabel}>balance</Text>
                <Text style={styles.profileValue}>{balance ?? '0.00'} SOL</Text>
              </View>
              <View>
                <Text style={styles.statLabel}>rounds joined</Text>
                <Text style={styles.profileValue}>--</Text>
              </View>
            </View>
            <Pressable onPress={() => setProfileOpen(false)} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>Close</Text>
            </Pressable>
            <Pressable onPress={() => void signOut()}>
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {winnersOpen ? (
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Pressable onPress={() => setWinnersOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
            <Text style={styles.modalKicker}>SETTLED ROUNDS</Text>
            <Text style={styles.modalTitle}>Past winners</Text>
            <Text style={styles.modalCopy}>Recent rooms settled by the protocol.</Text>
            {winnersLoading ? (
              <ActivityIndicator color={MinutteryColors.accent} />
            ) : winners.length ? (
              winners.map((winner, index) => (
                <Pressable
                  key={`${winner.signature ?? winner.roundId ?? index}`}
                  onPress={() =>
                    winner.signature &&
                    void Linking.openURL(`https://explorer.solana.com/tx/${winner.signature}?cluster=devnet`)
                  }
                  style={styles.winnerRow}
                >
                  <Text style={styles.winnerAddress}>{shortAddress(winner.winner)}</Text>
                  <Text style={styles.winnerPot}>{((winner.pot ?? 0) / 1_000_000_000).toFixed(2)} SOL</Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.modalCopy}>No settled rounds yet.</Text>
            )}
            <Pressable onPress={() => setWinnersOpen(false)} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {inviteOpen ? (
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Pressable onPress={() => setInviteOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
            <Text style={styles.modalKicker}>THIS MINUTE</Text>
            <Text style={styles.modalTitle}>Challenge someone</Text>
            <Text style={styles.modalCopy}>Send a one-minute room. They join the same pot, same clock.</Text>
            <TextInput
              defaultValue="Join me on minuttery: https://minuttery.com"
              multiline
              numberOfLines={4}
              style={styles.inviteInput}
            />
            <View style={styles.shareRow}>
              {['X', 'Telegram', 'Discord', 'Copy'].map((label) => (
                <Pressable key={label} onPress={() => void shareRound()} style={styles.shareOption}>
                  <Text style={styles.shareOptionText}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setInviteOpen(false)} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MinutteryColors.background },
  safeArea: { flex: 1 },
  topbar: {
    minHeight: 76,
    borderBottomWidth: 1,
    borderBottomColor: MinutteryColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: {
    color: MinutteryColors.background,
    backgroundColor: MinutteryColors.accent,
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  brandName: { fontFamily: 'serif', fontSize: 19 },
  sessionCluster: { flexDirection: 'row', alignItems: 'center', gap: 8, position: 'relative' },
  balanceChip: {
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 999,
    backgroundColor: '#151817',
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 8,
  },
  balanceText: { color: MinutteryColors.text, fontSize: 12, fontWeight: '700' },
  caret: { color: MinutteryColors.muted },
  headerInvite: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 19,
    backgroundColor: '#151817',
  },
  headerInviteIcon: { color: MinutteryColors.muted, fontSize: 17 },
  accountMenu: {
    position: 'absolute',
    right: 0,
    top: 42,
    zIndex: 2,
    backgroundColor: MinutteryColors.panel,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    padding: 12,
  },
  menuText: { color: MinutteryColors.text, fontSize: 13 },
  arena: { flex: 1, justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 14 },
  gamePanel: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  presets: { flexDirection: 'row', gap: 9, marginBottom: 18 },
  preset: {
    flex: 1,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 15,
    backgroundColor: '#151817',
    paddingVertical: 11,
    paddingHorizontal: 5,
  },
  selectedPreset: { borderColor: MinutteryColors.accent, backgroundColor: MinutteryColors.accent },
  betLabel: { color: MinutteryColors.muted, fontSize: 10, letterSpacing: 1, textAlign: 'center' },
  presetAmount: { color: MinutteryColors.text, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  selectedPresetAmount: { color: MinutteryColors.background },
  roundHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  muted: { color: MinutteryColors.muted, fontSize: 12 },
  roundNumber: { color: MinutteryColors.text },
  timer: {
    color: MinutteryColors.text,
    fontFamily: 'monospace',
    fontSize: 54,
    letterSpacing: 0,
    textAlign: 'center',
    marginVertical: 36,
  },
  track: { height: 2, backgroundColor: MinutteryColors.border, overflow: 'hidden' },
  progress: { height: 2, backgroundColor: MinutteryColors.accent },
  timerLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  winnerTicker: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 18, padding: 4 },
  winnerTickerText: { color: MinutteryColors.muted, fontSize: 11 },
  chevron: { color: MinutteryColors.muted, fontSize: 18, marginLeft: 8 },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: MinutteryColors.border,
    marginTop: 30,
    paddingVertical: 18,
  },
  statLabel: { color: MinutteryColors.muted, fontSize: 11, textAlign: 'center', marginBottom: 6 },
  statValue: { color: MinutteryColors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  sol: { color: MinutteryColors.muted, fontSize: 11 },
  actionArea: { alignItems: 'center', marginTop: 28 },
  joinButton: {
    backgroundColor: MinutteryColors.accent,
    width: '100%',
    borderRadius: 15,
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
  },
  disabled: { opacity: 0.45 },
  joinText: {
    color: MinutteryColors.background,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionMessage: { color: MinutteryColors.muted, fontSize: 12, marginTop: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: 16 },
  footerText: { color: MinutteryColors.muted, fontSize: 10 },
  footerStrong: { color: MinutteryColors.text, fontSize: 10, fontWeight: '700' },
  footerLine: { width: 24, height: 1, backgroundColor: MinutteryColors.border, marginHorizontal: 8 },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  sheet: {
    backgroundColor: MinutteryColors.panel,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    padding: 24,
    gap: 14,
    maxHeight: '82%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: MinutteryColors.muted,
    opacity: 0.6,
  },
  modalKicker: { color: MinutteryColors.accent, fontSize: 10, letterSpacing: 1.4, marginTop: 8 },
  modalTitle: { color: MinutteryColors.text, fontFamily: 'serif', fontSize: 30 },
  modalCopy: { color: MinutteryColors.muted, fontSize: 13, lineHeight: 20 },
  address: { color: MinutteryColors.muted, fontFamily: 'monospace', fontSize: 12 },
  profileStats: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: MinutteryColors.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  profileValue: { color: MinutteryColors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  modalButton: { backgroundColor: MinutteryColors.accent, borderRadius: 15, alignItems: 'center', paddingVertical: 15 },
  modalButtonText: {
    color: MinutteryColors.background,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  logoutText: { color: MinutteryColors.danger, textAlign: 'center', fontSize: 12 },
  closeButton: { position: 'absolute', right: 20, top: 18 },
  closeText: { color: MinutteryColors.text, fontSize: 28, fontWeight: '300' },
  inviteInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 14,
    backgroundColor: '#101312',
    color: MinutteryColors.text,
    fontSize: 16,
    lineHeight: 23,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  shareRow: { flexDirection: 'row', gap: 8 },
  shareOption: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 12,
    backgroundColor: '#151817',
  },
  shareOptionText: { color: MinutteryColors.text, fontSize: 10, fontWeight: '700' },
  winnerRow: {
    borderBottomWidth: 1,
    borderColor: MinutteryColors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  winnerAddress: { color: MinutteryColors.text, fontFamily: 'monospace', fontSize: 12 },
  winnerPot: { color: MinutteryColors.accent, fontSize: 12, fontWeight: '700' },
})
