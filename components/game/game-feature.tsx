import { useGetBalance } from '@/components/account/use-get-balance'
import { useAuth } from '@/components/auth/auth-provider'
import { useCluster } from '@/components/cluster/cluster-provider'
import { MinutteryColors } from '@/constants/colors'
import { lamportsToSol } from '@/utils/lamports-to-sol'
import { showError } from '@/utils/show-error'
import Clipboard from '@react-native-clipboard/clipboard'
import { Connection, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { Buffer } from 'buffer'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

const PROGRAM_ID = new PublicKey('9Uf52hSPJPDqDj7QFqL5dKmdJseU1pRtzL8oNQGeDxrP')
const ROOM_TIERS = [0.1, 1, 2, 5]
const ROUND_MS = 60_000
const BETTING_CLOSES_AT = 55
const WINNERS_API = 'https://minuttery.com'
const WINNERS_PAGE_SIZE = 12
const TICKER_MS = 3_600
const SWIPE_CLOSE_PX = 56
const PLACE_BET_DISCRIMINATOR = Uint8Array.from([222, 62, 67, 220, 63, 166, 126, 33])

type WinnerRow = {
  winner?: string
  pot?: number
  roundId?: number
  signature?: string
  tier?: number
  n?: number
  ts?: number
  kind?: string
}

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

function shortAddress(address?: string) {
  return address ? `${address.slice(0, 4)}....${address.slice(-4)}` : '—'
}

function potSol(value?: number) {
  return ((value ?? 0) / 1_000_000_000).toFixed(2)
}

function formatMinuteStamp(ts?: number) {
  const date = new Date((ts || 0) * 1000)
  if (Number.isNaN(date.getTime()) || !ts) return '--:--:--'
  return date.toLocaleTimeString('en-GB', { hour12: false })
}

function formatHistoryDate(ts?: number) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('es-UY')
}

function PaperPlane({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M3.04 11.16 20.1 3.64c.82-.36 1.6.48 1.2 1.3L14.7 21.1c-.4.86-1.64.78-1.92-.12l-1.86-6.08-6.08-1.86c-.9-.28-.98-1.52-.12-1.92Zm5.2 1.66 3.78 1.16c.22.07.4.24.46.47l1.1 3.6 4.86-11.18-10.2 5.95Z"
      />
    </Svg>
  )
}

function CaretDown({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 12 12">
      <Path
        d="M2.2 4.2 6 8l3.8-3.8"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function ChevronRight({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12">
      <Path
        d="M4.2 2.2 8 6l-3.8 3.8"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function BottomSheet({
  children,
  onClose,
  maxHeight = '82%',
}: {
  children: ReactNode
  onClose: () => void
  maxHeight?: `${number}%` | number
}) {
  const insets = useSafeAreaInsets()
  const translateY = useSharedValue(0)

  const gesture = Gesture.Pan()
    .minDistance(8)
    .activeOffsetY(6)
    .failOffsetX([-48, 48])
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY)
    })
    .onEnd((event) => {
      const shouldClose = translateY.value > SWIPE_CLOSE_PX || event.velocityY > 650
      if (shouldClose) {
        translateY.value = withTiming(720, { duration: 200 }, (finished) => {
          if (finished) runOnJS(onClose)()
        })
      } else {
        translateY.value = withTiming(0, { duration: 180 })
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <View style={styles.modalBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View style={[styles.sheet, { maxHeight, paddingBottom: 20 + insets.bottom }, sheetStyle]}>
        <GestureDetector gesture={gesture}>
          <View style={styles.sheetGrab} collapsable={false}>
            <View style={styles.sheetHandle} />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </View>
  )
}

export function GameFeature() {
  const insets = useSafeAreaInsets()
  const { account, connection: walletConnection, signAndSendTransactions } = useMobileWallet()
  const { selectedCluster } = useCluster()
  const { signOut, passkeyWallet, playerAddress, kind } = useAuth()
  const connection = useMemo(
    () => walletConnection ?? new Connection(selectedCluster.endpoint, 'confirmed'),
    [selectedCluster.endpoint, walletConnection],
  )
  const payer = playerAddress ?? account?.address ?? null
  const balanceQuery = useGetBalance({ address: (payer ?? account?.address) as PublicKey })
  const [selectedTier, setSelectedTier] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [players, setPlayers] = useState(0)
  const [joining, setJoining] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [winnersOpen, setWinnersOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [winners, setWinners] = useState<WinnerRow[]>([])
  const [winnersLoading, setWinnersLoading] = useState(true)
  const [historyTotal, setHistoryTotal] = useState<number | null>(null)
  const [historyHasMore, setHistoryHasMore] = useState(false)
  const [historyPage, setHistoryPage] = useState(0)
  const [historyRows, setHistoryRows] = useState<WinnerRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [tickerIndex, setTickerIndex] = useState(0)
  const [invitePressed, setInvitePressed] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [settlePhase, setSettlePhase] = useState<'calculating' | 'winner' | 'solo' | 'waiting'>('calculating')
  const [settleRow, setSettleRow] = useState<WinnerRow | null>(null)
  const [joinedRound, setJoinedRound] = useState<{ roundId: number; tier: number } | null>(null)
  const [withdrawTo, setWithdrawTo] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawStatus, setWithdrawStatus] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [claimRoundId, setClaimRoundId] = useState('')
  const [claimTier, setClaimTier] = useState(0)
  const [claimStatus, setClaimStatus] = useState('')
  const settleKeyRef = useRef('')

  const roundId = roundIdAt(now)
  const elapsed = ((now % ROUND_MS) + ROUND_MS) % ROUND_MS
  const seconds = Math.floor(elapsed / 1000)
  const centiseconds = Math.floor((elapsed % 1000) / 10)
  const bettingClosed = seconds >= BETTING_CLOSES_AT
  const selectedBet = ROOM_TIERS[selectedTier]
  const pot = (players * selectedBet).toFixed(2)
  const balance = balanceQuery.data === undefined ? null : lamportsToSol(balanceQuery.data).toFixed(2)
  const progress = Math.min(100, (elapsed / ROUND_MS) * 100)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 50)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!payer) return
    let cancelled = false
    async function loadRound() {
      try {
        const info = await connection.getAccountInfo(roundPda(roundId, selectedTier), 'confirmed')
        if (!cancelled) setPlayers(info?.data.length ? info.data[8] : 0)
      } catch {
        // Clock and join stay usable if the RPC blips.
      }
    }
    void loadRound()
    const poll = setInterval(loadRound, 5_000)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [payer, connection, roundId, selectedTier])

  useEffect(() => {
    let cancelled = false
    async function loadWinners() {
      try {
        const response = await fetch(`${WINNERS_API}/winners?limit=30`)
        if (!response.ok) throw new Error(`Winners API ${response.status}`)
        const payload = await response.json()
        const rows = Array.isArray(payload) ? payload : (payload.rows ?? payload.items ?? payload.winners ?? [])
        if (!cancelled) {
          setWinners(rows)
          setTickerIndex(0)
        }
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

  useEffect(() => {
    if (winners.length < 2) return
    const tick = setInterval(() => {
      setTickerIndex((value) => (value + 1) % winners.length)
    }, TICKER_MS)
    return () => clearInterval(tick)
  }, [winners.length])

  useEffect(() => {
    if (!winnersOpen) return
    let cancelled = false
    async function loadPage() {
      setHistoryLoading(true)
      try {
        const offset = historyPage * WINNERS_PAGE_SIZE
        const response = await fetch(`${WINNERS_API}/winners?limit=${WINNERS_PAGE_SIZE}&offset=${offset}`)
        if (!response.ok) throw new Error(`Winners API ${response.status}`)
        const payload = await response.json()
        const rows = Array.isArray(payload) ? payload : (payload.rows ?? payload.items ?? payload.winners ?? [])
        const total = Array.isArray(payload) ? null : (payload.total ?? payload.count ?? null)
        if (cancelled) return
        setHistoryRows(rows)
        setHistoryTotal(total)
        setHistoryHasMore(total != null ? offset + rows.length < total : rows.length === WINNERS_PAGE_SIZE)
      } catch {
        if (!cancelled) setHistoryRows([])
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }
    void loadPage()
    return () => {
      cancelled = true
    }
  }, [historyPage, winnersOpen])

  useEffect(() => {
    if (!joinedRound) return
    const watching = joinedRound
    const shouldOpen = (roundId === watching.roundId && seconds >= BETTING_CLOSES_AT) || roundId > watching.roundId
    if (!shouldOpen) return
    const key = `${watching.roundId}:${watching.tier}`
    if (settleKeyRef.current === key) return
    settleKeyRef.current = key
    setSettlePhase('calculating')
    setSettleRow(null)
    setSettleOpen(true)
    let cancelled = false
    const startedAt = Date.now()
    async function poll() {
      while (!cancelled) {
        try {
          const params = new URLSearchParams({
            limit: '20',
            roundId: String(watching.roundId),
            tier: String(watching.tier),
          })
          const response = await fetch(`${WINNERS_API}/winners?${params}`)
          const payload = await response.json()
          const rows: WinnerRow[] = Array.isArray(payload) ? payload : (payload.rows ?? payload.items ?? [])
          const row =
            rows.find((item) => Number(item.roundId) === watching.roundId && Number(item.tier) === watching.tier) ||
            rows.find((item) => Number(item.roundId) === watching.roundId)
          if (row?.winner || row?.kind === 'refunded') {
            const count = Number(row.n ?? 0)
            setSettleRow(row)
            setSettlePhase(count <= 1 || row.kind === 'refunded' ? 'solo' : 'winner')
            return
          }
        } catch {
          // keep polling through API blips
        }
        if (Date.now() - startedAt >= 30_000) {
          setSettlePhase('waiting')
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
    void poll()
    return () => {
      cancelled = true
    }
  }, [joinedRound, roundId, seconds])

  const timer = useMemo(
    () => `00:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`,
    [centiseconds, seconds],
  )

  const tickerRow = winners[tickerIndex % Math.max(winners.length, 1)]
  const payerBase58 = payer?.toString()
  const roundsWon = payerBase58 ? winners.filter((row) => row.winner === payerBase58).length : 0
  const depositQr = payerBase58
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=0a0b0b&bgcolor=f1ff0a&data=${encodeURIComponent(payerBase58)}`
    : null

  async function joinRound() {
    if (!payer || joining || bettingClosed) return
    setJoining(true)
    try {
      const round = roundPda(roundId, selectedTier)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      const instruction = {
        programId: PROGRAM_ID,
        keys: [
          { pubkey: payer, isSigner: true, isWritable: true },
          { pubkey: round, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(placeBetData(roundId, selectedTier, selectedBet)),
      }
      const message = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToV0Message()
      const transaction = new VersionedTransaction(message)
      let signature: string
      if (passkeyWallet) {
        transaction.sign([passkeyWallet.keypair])
        signature = await connection.sendTransaction(transaction, { skipPreflight: false })
      } else {
        signature = await signAndSendTransactions(transaction, 0)
      }
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
      setJoinedRound({ roundId, tier: selectedTier })
      setPlayers((value) => value + 1)
    } catch (error) {
      showError('Could not join round', error)
    } finally {
      setJoining(false)
    }
  }

  async function sendSigned(transaction: VersionedTransaction) {
    if (passkeyWallet) {
      transaction.sign([passkeyWallet.keypair])
      return connection.sendTransaction(transaction, { skipPreflight: false })
    }
    return signAndSendTransactions(transaction, 0)
  }

  async function sendWithdraw() {
    if (!payer || withdrawing) return
    setWithdrawing(true)
    setWithdrawStatus('')
    try {
      const dest = new PublicKey(withdrawTo.trim())
      const amountSol = Number(withdrawAmount)
      if (!Number.isFinite(amountSol) || amountSol <= 0) throw new Error('Enter an amount.')
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      const instruction = SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: dest,
        lamports: Math.round(amountSol * 1_000_000_000),
      })
      const message = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToV0Message()
      const signature = await sendSigned(new VersionedTransaction(message))
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
      setWithdrawStatus(`Sent ${amountSol} SOL`)
      void balanceQuery.refetch?.()
    } catch (error) {
      setWithdrawStatus(error instanceof Error ? error.message : 'Withdraw failed')
    } finally {
      setWithdrawing(false)
    }
  }

  async function sendRefund() {
    if (!payer) return
    const targetRound = Number(claimRoundId || joinedRound?.roundId || roundId)
    const targetTier = Number(claimTier)
    setClaimStatus('Preparing refund…')
    try {
      const pda = roundPda(targetRound, targetTier)
      const info = await connection.getAccountInfo(pda, 'confirmed')
      if (!info?.data) throw new Error('Round account not found.')
      const data = Buffer.from(info.data)
      const n = data[8] ?? 0
      if (!n) throw new Error('No players found for refund.')
      const playersOnChain: PublicKey[] = []
      for (let i = 0; i < n; i += 1) {
        const start = 9 + i * 32
        playersOnChain.push(new PublicKey(data.subarray(start, start + 32)))
      }
      const refundData = new Uint8Array(8 + 8 + 1)
      refundData.set(Uint8Array.from([174, 87, 222, 126, 23, 59, 189, 155]))
      const view = new DataView(refundData.buffer)
      view.setBigInt64(8, BigInt(targetRound), true)
      view.setUint8(16, targetTier)
      const instruction = {
        programId: PROGRAM_ID,
        keys: [
          { pubkey: payer, isSigner: true, isWritable: false },
          { pubkey: playersOnChain[0], isSigner: false, isWritable: true },
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ...playersOnChain.map((pubkey) => ({ pubkey, isSigner: false, isWritable: true })),
        ],
        data: Buffer.from(refundData),
      }
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      const message = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToV0Message()
      const signature = await sendSigned(new VersionedTransaction(message))
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
      setClaimStatus('Refund submitted.')
      setSettlePhase('solo')
    } catch (error) {
      setClaimStatus(error instanceof Error ? error.message : 'Refund failed')
    }
  }

  async function shareRound() {
    await Share.share({ message: 'Join me on minuttery: https://minuttery.com' })
  }

  const historyPageLabel =
    historyTotal != null
      ? `${historyPage + 1} / ${Math.max(1, Math.ceil(historyTotal / WINNERS_PAGE_SIZE))}`
      : `Page ${historyPage + 1}`

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <View style={styles.brandMarkWrap}>
            <Text style={styles.brandMark} allowFontScaling={false}>
              m
            </Text>
          </View>
          <Text style={styles.brandName} allowFontScaling={false}>
            minuttery
          </Text>
        </View>
        <View style={styles.sessionCluster}>
          <Pressable
            style={({ pressed }) => [styles.balanceChip, pressed && styles.balanceChipActive]}
            onPress={() => setProfileOpen(true)}
            android_ripple={{ color: 'rgba(241,255,10,0.16)', borderless: false }}
          >
            <Text style={styles.balanceText} allowFontScaling={false}>
              {balance ?? '0.00'} SOL
            </Text>
            <CaretDown color={MinutteryColors.muted} />
          </Pressable>
          <Pressable
            accessibilityLabel="Challenge someone"
            accessibilityRole="button"
            onPressIn={() => setInvitePressed(true)}
            onPressOut={() => setInvitePressed(false)}
            onPress={() => setInviteOpen(true)}
            style={[styles.headerInvite, invitePressed && styles.headerInviteActive]}
            android_ripple={{ color: 'rgba(241,255,10,0.25)', borderless: true, radius: 18 }}
          >
            <PaperPlane color={invitePressed ? MinutteryColors.background : MinutteryColors.muted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.arena}>
        <View style={styles.gamePanel}>
          <View style={styles.presets}>
            {ROOM_TIERS.map((amount, tier) => {
              const selected = selectedTier === tier
              const label = amount === 0.1 ? '0.1' : String(amount)
              return (
                <Pressable
                  key={amount}
                  onPress={() => setSelectedTier(tier)}
                  android_ripple={{ color: 'rgba(10,11,11,0.12)' }}
                  style={({ pressed }) => [styles.preset, (selected || pressed) && styles.selectedPreset]}
                >
                  {({ pressed }) => {
                    const active = selected || pressed
                    return (
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        allowFontScaling={false}
                        style={[styles.presetCopy, active && styles.selectedPresetCopy]}
                      >
                        {active ? `BET ${label} ◎` : `${label} ◎`}
                      </Text>
                    )
                  }}
                </Pressable>
              )
            })}
          </View>

          <View style={styles.roundHeader}>
            <Text style={styles.roundState} allowFontScaling={false}>
              {bettingClosed ? 'betting closed' : 'round open'}
            </Text>
            <Text style={styles.roundHash} allowFontScaling={false}>
              #<Text style={styles.roundNumber}>{roundId}</Text>
            </Text>
          </View>

          <View style={styles.timerWrap}>
            <Text style={styles.timer} allowFontScaling={false}>
              {timer}
            </Text>
            <View style={styles.track}>
              <View style={[styles.progress, { width: `${progress}%` }]} />
              <View style={[styles.progressGlow, { left: `${Math.max(0, progress - 2)}%` }]} />
            </View>
            <View style={styles.timerLabels}>
              <Text style={styles.timerLabel}>00:00</Text>
              <Text style={styles.timerLabel}>01:00</Text>
            </View>

            <Pressable
              style={styles.winnerTicker}
              onPress={() => {
                setHistoryPage(0)
                setWinnersOpen(true)
              }}
            >
              {winnersLoading ? (
                <Text style={styles.winnerTickerText}>Loading recent winners…</Text>
              ) : tickerRow?.winner ? (
                <Animated.View
                  key={`${tickerRow.signature ?? tickerRow.roundId ?? tickerIndex}`}
                  entering={FadeIn.duration(220)}
                  exiting={FadeOut.duration(220)}
                  style={styles.tickerRow}
                >
                  <Text style={styles.winnerTickerText} numberOfLines={1}>
                    {shortAddress(tickerRow.winner)} won{' '}
                    <Text style={styles.tickerPot}>{potSol(tickerRow.pot)} SOL</Text> in minute{' '}
                    {formatMinuteStamp(tickerRow.ts)}
                  </Text>
                  <ChevronRight color={MinutteryColors.accent} />
                </Animated.View>
              ) : (
                <View style={styles.tickerRow}>
                  <Text style={styles.winnerTickerText}>No settled rounds yet</Text>
                  <ChevronRight color={MinutteryColors.accent} />
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>PLAYERS</Text>
              <Text style={styles.statValue}>{players}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>TOTAL POT</Text>
              <Text style={styles.statValue}>
                {pot} <Text style={styles.sol}>SOL</Text>
              </Text>
            </View>
          </View>

          <View style={styles.actionArea}>
            <Pressable
              disabled={bettingClosed || joining}
              onPress={() => void joinRound()}
              style={({ pressed }) => [
                styles.joinButton,
                pressed && !bettingClosed && !joining && styles.joinButtonPressed,
                (bettingClosed || joining) && styles.disabled,
              ]}
            >
              {joining ? (
                <ActivityIndicator color={MinutteryColors.background} />
              ) : (
                <Text style={styles.joinText} allowFontScaling={false}>
                  Join this round
                </Text>
              )}
            </Pressable>
            <Text style={styles.actionMessage}>
              {joinedRound?.roundId === roundId && bettingClosed
                ? 'Drawing the winner on-chain…'
                : bettingClosed
                  ? 'Next minute opens in a few seconds'
                  : players === 0
                    ? 'Open this minute — you earn 1% of the pot.'
                    : 'Join before second 55.'}
            </Text>
          </View>
        </View>
      </View>

      {profileOpen ? (
        <BottomSheet onClose={() => setProfileOpen(false)}>
          <Pressable onPress={() => setProfileOpen(false)} style={styles.closeButton} hitSlop={12}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text style={styles.modalKicker}>{kind === 'passkey' ? 'SIGNED IN WITH PASSKEY' : 'CONNECTED WALLET'}</Text>
          <Text style={styles.modalTitle}>Your profile</Text>
          <Text style={styles.address}>{payer?.toString()}</Text>
          <View style={styles.profileStats}>
            <View style={styles.profileStat}>
              <Text style={styles.statLabel}>BALANCE</Text>
              <Text style={styles.profileValue}>
                {balance ?? '0.00'} <Text style={styles.sol}>SOL</Text>
              </Text>
            </View>
            <View style={styles.profileStat}>
              <Text style={styles.statLabel}>ROUNDS JOINED</Text>
              <Text style={styles.profileValue}>--</Text>
            </View>
            <View style={styles.profileStat}>
              <Text style={styles.statLabel}>ROUNDS WON</Text>
              <Text style={styles.profileValue}>{roundsWon}</Text>
            </View>
          </View>
          <View style={styles.moneyRow}>
            <Pressable
              onPress={() => {
                setProfileOpen(false)
                setDepositOpen(true)
              }}
              style={styles.moneyButtonActive}
            >
              <Text style={styles.moneyButtonActiveText}>Deposit</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setProfileOpen(false)
                setWithdrawStatus('')
                setWithdrawOpen(true)
              }}
              style={styles.moneyButton}
            >
              <Text style={styles.ghostButtonText}>Withdraw</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => void signOut()}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </BottomSheet>
      ) : null}

      {depositOpen ? (
        <BottomSheet onClose={() => setDepositOpen(false)}>
          <Pressable onPress={() => setDepositOpen(false)} style={styles.closeButton} hitSlop={12}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text style={styles.modalKicker}>ADD SOL</Text>
          <Text style={styles.modalTitle}>Deposit</Text>
          <Text style={styles.modalCopy}>Send SOL on Solana to this address.</Text>
          <View style={styles.depositRow}>
            <View style={styles.depositMain}>
              <Text style={styles.sheetLabel}>Deposit address</Text>
              <Text selectable style={styles.depositShort}>
                {payerBase58 ? `${payerBase58.slice(0, 6)}…${payerBase58.slice(-6)}` : '—'}
              </Text>
              <Pressable onPress={() => payerBase58 && Clipboard.setString(payerBase58)} style={styles.copyMini}>
                <Text style={styles.ghostButtonText}>Copy</Text>
              </Pressable>
            </View>
            {depositQr ? <Image source={{ uri: depositQr }} style={styles.depositQr} /> : null}
          </View>
          <Text style={styles.modalCopy}>Min 0.11 SOL · ~15s · Solana only.</Text>
        </BottomSheet>
      ) : null}

      {withdrawOpen ? (
        <BottomSheet onClose={() => setWithdrawOpen(false)}>
          <Pressable onPress={() => setWithdrawOpen(false)} style={styles.closeButton} hitSlop={12}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text style={styles.modalKicker}>SEND SOL</Text>
          <Text style={styles.modalTitle}>Withdraw</Text>
          <Text style={styles.modalCopy}>Send SOL from this minuttery wallet to another Solana address.</Text>
          <Text style={styles.sheetLabel}>Destination</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setWithdrawTo}
            placeholder="Solana address"
            placeholderTextColor="#6c726b"
            style={styles.fieldInput}
            value={withdrawTo}
          />
          <Text style={styles.sheetLabel}>Amount</Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setWithdrawAmount}
            placeholder="0.00"
            placeholderTextColor="#6c726b"
            style={styles.fieldInput}
            value={withdrawAmount}
          />
          <Text style={styles.modalCopy}>Keep a little SOL for fees. A send is usually under 0.00001 SOL.</Text>
          <Pressable disabled={withdrawing} onPress={() => void sendWithdraw()} style={styles.modalButton}>
            <Text style={styles.modalButtonText}>{withdrawing ? 'Sending…' : 'Send SOL'}</Text>
          </Pressable>
          {withdrawStatus ? <Text style={styles.modalCopy}>{withdrawStatus}</Text> : null}
        </BottomSheet>
      ) : null}

      {winnersOpen ? (
        <BottomSheet onClose={() => setWinnersOpen(false)} maxHeight="88%">
          <Pressable onPress={() => setWinnersOpen(false)} style={styles.closeButton} hitSlop={12}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text style={styles.modalKicker}>SETTLED ROUNDS</Text>
          <Text style={styles.modalTitle}>Past winners</Text>
          <Text style={styles.modalCopy}>Recent rooms settled by the protocol.</Text>
          {historyLoading ? (
            <ActivityIndicator color={MinutteryColors.accent} style={{ marginVertical: 24 }} />
          ) : historyRows.length ? (
            <ScrollView style={styles.historyList} nestedScrollEnabled>
              {historyRows.map((row, index) => {
                const stake = ROOM_TIERS[row.tier ?? -1] ?? row.tier ?? '—'
                return (
                  <View key={`${row.signature ?? row.roundId ?? index}`} style={styles.historyRow}>
                    <Text style={styles.historyLine}>
                      Winner:{' '}
                      <Text
                        style={styles.historyWallet}
                        onPress={() =>
                          row.winner &&
                          void Linking.openURL(`https://explorer.solana.com/address/${row.winner}?cluster=devnet`)
                        }
                      >
                        {shortAddress(row.winner)}
                      </Text>
                    </Text>
                    <Text style={styles.historyMeta}>
                      Round id: {row.roundId ?? '—'} · Bet: {stake} SOL · Players: {row.n ?? '—'} · Pot{' '}
                      <Text style={styles.tickerPot}>{potSol(row.pot)} ◎</Text>
                    </Text>
                    <Text style={styles.historyMeta}>Date: {formatHistoryDate(row.ts)}</Text>
                    {row.signature ? (
                      <Text
                        style={styles.explorerLink}
                        onPress={() =>
                          void Linking.openURL(`https://explorer.solana.com/tx/${row.signature}?cluster=devnet`)
                        }
                      >
                        Open settlement
                      </Text>
                    ) : null}
                  </View>
                )
              })}
            </ScrollView>
          ) : (
            <Text style={styles.modalCopy}>No settled rounds yet.</Text>
          )}
          <View style={styles.historyPager}>
            <Pressable
              disabled={historyPage === 0}
              onPress={() => setHistoryPage((page) => Math.max(0, page - 1))}
              style={[styles.pagerButton, historyPage === 0 && styles.disabled]}
            >
              <Text style={styles.pagerText}>Previous</Text>
            </Pressable>
            <Text style={styles.pagerLabel}>{historyPageLabel}</Text>
            <Pressable
              disabled={!historyHasMore}
              onPress={() => setHistoryPage((page) => page + 1)}
              style={[styles.pagerButton, !historyHasMore && styles.disabled]}
            >
              <Text style={styles.pagerText}>Next</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              setWinnersOpen(false)
              setClaimRoundId(String(joinedRound?.roundId ?? roundId))
              setClaimTier(joinedRound?.tier ?? selectedTier)
              setClaimStatus('')
              setClaimOpen(true)
            }}
            style={styles.ghostButton}
          >
            <Text style={styles.ghostButtonText}>Unsettled rounds</Text>
          </Pressable>
        </BottomSheet>
      ) : null}

      {claimOpen ? (
        <BottomSheet onClose={() => setClaimOpen(false)}>
          <Pressable onPress={() => setClaimOpen(false)} style={styles.closeButton} hitSlop={12}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text style={styles.modalKicker}>EMERGENCY</Text>
          <Text style={styles.modalTitle}>Unsettled rounds</Text>
          <Text style={styles.modalCopy}>
            Only if the worker missed the settle window after second 85. Refunds every stake and returns the room rent
            to the opener.
          </Text>
          <Text style={styles.sheetLabel}>Round id</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setClaimRoundId}
            placeholder="Round id"
            placeholderTextColor="#6c726b"
            style={styles.fieldInput}
            value={claimRoundId}
          />
          <Text style={styles.sheetLabel}>Room</Text>
          <View style={styles.shareRow}>
            {ROOM_TIERS.map((amount, index) => (
              <Pressable
                key={amount}
                onPress={() => setClaimTier(index)}
                style={[styles.shareOption, claimTier === index && styles.selectedPreset]}
              >
                <Text style={[styles.shareOptionText, claimTier === index && styles.selectedPresetCopy]}>{amount}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => void sendRefund()} style={styles.modalButton}>
            <Text style={styles.modalButtonText}>Refund this round</Text>
          </Pressable>
          {claimStatus ? <Text style={styles.modalCopy}>{claimStatus}</Text> : null}
        </BottomSheet>
      ) : null}

      {settleOpen ? (
        <BottomSheet onClose={() => setSettleOpen(false)}>
          <Pressable onPress={() => setSettleOpen(false)} style={styles.closeButton} hitSlop={12}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text style={styles.modalKicker}>
            {settlePhase === 'calculating'
              ? 'LIVE SETTLEMENT'
              : settlePhase === 'winner'
                ? 'ROUND RESOLVED'
                : settlePhase === 'solo'
                  ? 'NO DRAW'
                  : 'SETTLEMENT DELAYED'}
          </Text>
          <Text style={styles.modalTitle}>
            {settlePhase === 'calculating'
              ? 'Calculating winner'
              : settlePhase === 'winner'
                ? 'Winner selected'
                : settlePhase === 'solo'
                  ? 'Stake returned'
                  : 'Still waiting'}
          </Text>
          <Text style={styles.modalCopy}>
            {settlePhase === 'calculating'
              ? 'The worker is settling this round on-chain. This usually lands before second 85.'
              : settlePhase === 'winner'
                ? `Round #${settleRow?.roundId ?? joinedRound?.roundId} · ${ROOM_TIERS[settleRow?.tier ?? joinedRound?.tier ?? 0]} SOL room · ${settleRow?.n ?? players} players`
                : settlePhase === 'solo'
                  ? `Round #${joinedRound?.roundId ?? roundId}. Nobody else joined, so there was no raffle.`
                  : `Round #${joinedRound?.roundId ?? roundId} · no settlement yet. You can refund the room.`}
          </Text>
          {settlePhase === 'calculating' ? (
            <ActivityIndicator color={MinutteryColors.accent} style={{ marginVertical: 18 }} />
          ) : null}
          {settlePhase === 'winner' && settleRow?.winner ? (
            <>
              <Text style={styles.sheetLabel}>Winning wallet</Text>
              <Text
                style={styles.address}
                onPress={() =>
                  void Linking.openURL(`https://explorer.solana.com/address/${settleRow.winner}?cluster=devnet`)
                }
              >
                {settleRow.winner}
              </Text>
            </>
          ) : null}
          {settleRow?.signature ? (
            <Text
              style={styles.explorerLink}
              onPress={() =>
                void Linking.openURL(`https://explorer.solana.com/tx/${settleRow.signature}?cluster=devnet`)
              }
            >
              Verify settlement
            </Text>
          ) : null}
          {settlePhase === 'waiting' ? (
            <Pressable
              onPress={() => {
                setSettleOpen(false)
                setClaimRoundId(String(joinedRound?.roundId ?? roundId))
                setClaimTier(joinedRound?.tier ?? selectedTier)
                setClaimStatus('')
                setClaimOpen(true)
              }}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Refund this round</Text>
            </Pressable>
          ) : null}
        </BottomSheet>
      ) : null}

      {inviteOpen ? (
        <BottomSheet onClose={() => setInviteOpen(false)}>
          <Pressable onPress={() => setInviteOpen(false)} style={styles.closeButton} hitSlop={12}>
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
              <Pressable
                key={label}
                onPress={() => void shareRound()}
                style={({ pressed }) => [styles.shareOption, pressed && styles.selectedPreset]}
              >
                {({ pressed }) => (
                  <Text style={[styles.shareOptionText, pressed && styles.selectedPresetCopy]}>{label}</Text>
                )}
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => void Linking.openURL('https://t.me/minuttery')} style={styles.telegramFollow}>
            <Text style={styles.winnerTickerText}>
              Get round <Text style={styles.tickerPot}>alerts</Text> on Telegram
            </Text>
            <ChevronRight color={MinutteryColors.muted} />
          </Pressable>
        </BottomSheet>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MinutteryColors.background },
  topbar: {
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: MinutteryColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 2,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  brandMarkWrap: {
    width: 25,
    height: 25,
    borderRadius: 7,
    backgroundColor: MinutteryColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  brandMark: {
    color: MinutteryColors.background,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  brandName: {
    color: MinutteryColors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.6,
    includeFontPadding: false,
  },
  sessionCluster: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  balanceChip: {
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 999,
    backgroundColor: '#151817',
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceChipActive: { borderColor: MinutteryColors.accent },
  balanceText: { color: MinutteryColors.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  headerInvite: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 18,
    backgroundColor: '#151817',
  },
  headerInviteActive: {
    backgroundColor: MinutteryColors.accent,
    borderColor: MinutteryColors.accent,
  },
  arena: { flex: 1, paddingHorizontal: 18, paddingTop: 16 },
  gamePanel: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    flex: 1,
  },
  presets: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  preset: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 15,
    backgroundColor: '#151817',
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPreset: {
    borderColor: MinutteryColors.accent,
    backgroundColor: MinutteryColors.accent,
    shadowColor: MinutteryColors.accent,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  presetCopy: {
    color: MinutteryColors.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    includeFontPadding: false,
  },
  selectedPresetCopy: { color: MinutteryColors.background },
  roundHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  roundState: {
    color: MinutteryColors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  roundHash: {
    color: MinutteryColors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  roundNumber: { color: MinutteryColors.text, letterSpacing: 0.4 },
  timerWrap: { flex: 1, justifyContent: 'center', minHeight: 160 },
  timer: {
    color: MinutteryColors.text,
    fontFamily: 'SpaceMono',
    fontSize: 52,
    fontWeight: '400',
    letterSpacing: -3,
    textAlign: 'center',
    lineHeight: 56,
    includeFontPadding: false,
  },
  track: {
    marginTop: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: '#2a2e2a',
    overflow: 'visible',
  },
  progress: {
    height: 2,
    borderRadius: 999,
    backgroundColor: MinutteryColors.accent,
  },
  progressGlow: {
    position: 'absolute',
    top: -3,
    width: 10,
    height: 8,
    borderRadius: 8,
    backgroundColor: MinutteryColors.accent,
    opacity: 0.55,
    shadowColor: MinutteryColors.accent,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  timerLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  timerLabel: { color: '#656b63', fontFamily: 'SpaceMono', fontSize: 10 },
  winnerTicker: { alignItems: 'center', justifyContent: 'center', marginTop: 16, minHeight: 22, paddingHorizontal: 4 },
  tickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%' },
  winnerTickerText: { color: MinutteryColors.muted, fontSize: 11, letterSpacing: 0.2, flexShrink: 1 },
  tickerPot: { color: MinutteryColors.accent, fontWeight: '700' },
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: MinutteryColors.border,
    marginTop: 8,
    paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: 'flex-start', paddingHorizontal: 8 },
  statDivider: { width: 1, backgroundColor: MinutteryColors.border },
  statLabel: {
    color: MinutteryColors.muted,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statValue: {
    color: MinutteryColors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontSize: 22,
    fontWeight: '400',
  },
  sol: {
    color: MinutteryColors.accent,
    fontFamily: Platform.select({ ios: 'Trebuchet MS', default: 'sans-serif' }),
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  actionArea: { marginTop: 'auto', paddingTop: 16, paddingBottom: 28 },
  joinButton: {
    backgroundColor: MinutteryColors.accent,
    width: '100%',
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: MinutteryColors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  joinButtonPressed: {
    transform: [{ translateX: -2 }, { translateY: -2 }],
    shadowOffset: { width: 4, height: 6 },
  },
  disabled: { opacity: 0.42 },
  joinText: {
    color: MinutteryColors.background,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    includeFontPadding: false,
  },
  actionMessage: { color: MinutteryColors.muted, fontSize: 12, marginTop: 10, marginBottom: 8, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: MinutteryColors.border,
  },
  footerText: {
    color: '#555b54',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  footerStrong: { color: '#858b82', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  footerLine: { width: 36, height: 1, backgroundColor: MinutteryColors.border, marginHorizontal: 6 },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5,6,6,0.78)',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  sheet: {
    backgroundColor: MinutteryColors.panel,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
  },
  sheetGrab: {
    minHeight: 36,
    paddingTop: 10,
    paddingBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 4,
    backgroundColor: '#8a9088',
  },
  modalKicker: {
    color: MinutteryColors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  modalTitle: {
    color: MinutteryColors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontSize: 30,
    fontWeight: '400',
  },
  modalCopy: { color: MinutteryColors.muted, fontSize: 13, lineHeight: 20 },
  address: { color: MinutteryColors.muted, fontFamily: 'SpaceMono', fontSize: 12 },
  profileStats: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: MinutteryColors.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    gap: 6,
  },
  profileValue: { color: MinutteryColors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  modalButton: { backgroundColor: MinutteryColors.accent, borderRadius: 15, alignItems: 'center', paddingVertical: 15 },
  modalButtonText: {
    color: MinutteryColors.background,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ghostButton: {
    width: '100%',
    marginTop: 6,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 15,
    alignItems: 'center',
  },
  ghostButtonText: {
    color: MinutteryColors.text,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  logoutText: { color: MinutteryColors.danger, textAlign: 'center', fontSize: 12, paddingVertical: 8 },
  moneyRow: { flexDirection: 'row', gap: 10 },
  moneyButton: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 15,
    alignItems: 'center',
  },
  moneyButtonActive: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 15,
    alignItems: 'center',
    backgroundColor: MinutteryColors.accent,
  },
  moneyButtonActiveText: {
    color: MinutteryColors.background,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  profileStat: { flex: 1, alignItems: 'center' },
  depositRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  depositMain: { flex: 1, gap: 8 },
  depositShort: {
    color: MinutteryColors.text,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 16,
    fontWeight: '700',
  },
  depositQr: {
    width: 108,
    height: 108,
    borderRadius: 12,
    backgroundColor: MinutteryColors.accent,
  },
  copyMini: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 12,
  },
  sheetLabel: {
    color: MinutteryColors.muted,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  fieldInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 14,
    backgroundColor: '#101312',
    color: MinutteryColors.text,
    fontSize: 15,
    paddingHorizontal: 14,
  },
  closeButton: { position: 'absolute', right: 16, top: 14, zIndex: 2 },
  closeText: { color: MinutteryColors.muted, fontSize: 28, fontWeight: '300' },
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
  shareOptionText: {
    color: MinutteryColors.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  telegramFollow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  historyList: { maxHeight: 360 },
  historyRow: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: MinutteryColors.border,
  },
  historyLine: { color: MinutteryColors.muted, fontSize: 12, marginBottom: 6 },
  historyWallet: { color: MinutteryColors.text, fontFamily: 'SpaceMono', fontSize: 13, fontWeight: '700' },
  historyMeta: { color: MinutteryColors.muted, fontSize: 11, marginBottom: 4 },
  explorerLink: { color: MinutteryColors.accent, fontSize: 12, marginTop: 4 },
  historyPager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: MinutteryColors.border,
  },
  pagerButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: MinutteryColors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerText: { color: MinutteryColors.text, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  pagerLabel: { color: MinutteryColors.muted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
})
