import AsyncStorage from '@react-native-async-storage/async-storage'
import { Keypair } from '@solana/web3.js'
import { Buffer } from 'buffer'
import { Passkey } from 'react-native-passkey'
import crypto from 'react-native-quick-crypto'

export const PASSKEY_RP_ID = 'minuttery.com'
export const PASSKEY_RP_NAME = 'minuttery'
const STORAGE_KEY = 'minuttery.passkey.v1'
const PRF_SALT = new TextEncoder().encode('minuttery:solana:ed25519:v1')

export type PasskeyRecord = {
  id: string
  pubkey: string
}

export type PasskeyWallet = {
  kind: 'passkey'
  keypair: Keypair
  credentialId: string
}

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return Uint8Array.from(Buffer.from(padded + pad, 'base64'))
}

function randomBytes(size: number) {
  return new Uint8Array(crypto.randomBytes(size))
}

function sha256(bytes: Uint8Array) {
  return new Uint8Array(crypto.createHash('sha256').update(Buffer.from(bytes)).digest())
}

function keypairFromPrf(prf: Uint8Array) {
  return Keypair.fromSeed(sha256(prf))
}

function decodePrf(value: unknown): Uint8Array | null {
  if (!value) return null
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (Array.isArray(value)) return Uint8Array.from(value)
  if (typeof value === 'string') return fromBase64Url(value)
  return null
}

function readPrfBytes(result: { clientExtensionResults?: { prf?: { results?: { first?: unknown } } } }) {
  const prf = decodePrf(result.clientExtensionResults?.prf?.results?.first)
  if (!prf) {
    throw new Error('This device created a passkey, but it does not expose PRF. Use a wallet instead.')
  }
  return prf
}

export async function readPasskeyRecord(): Promise<PasskeyRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PasskeyRecord) : null
  } catch {
    return null
  }
}

async function writePasskeyRecord(record: PasskeyRecord) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record))
}

export function passkeysSupported() {
  try {
    return Passkey.isSupported()
  } catch {
    return false
  }
}

export async function createOrGetPasskeyWallet(): Promise<PasskeyWallet> {
  if (!passkeysSupported()) {
    throw new Error('Passkeys are not available on this device.')
  }

  const stored = await readPasskeyRecord()
  const challenge = toBase64Url(randomBytes(32))
  const prfEval = { first: toBase64Url(PRF_SALT) }

  try {
    const existing = await Passkey.get({
      challenge,
      rpId: PASSKEY_RP_ID,
      userVerification: 'required',
      allowCredentials: stored?.id ? [{ type: 'public-key', id: stored.id }] : undefined,
      extensions: { prf: { eval: prfEval } },
    })
    const keypair = keypairFromPrf(readPrfBytes(existing))
    const credentialId = existing.rawId || existing.id
    await writePasskeyRecord({ id: credentialId, pubkey: keypair.publicKey.toBase58() })
    return { kind: 'passkey', keypair, credentialId }
  } catch {
    // No saved passkey yet, or the user cancelled get — try create.
  }

  const userId = toBase64Url(randomBytes(16))
  const created = await Passkey.create({
    challenge: toBase64Url(randomBytes(32)),
    rp: { id: PASSKEY_RP_ID, name: PASSKEY_RP_NAME },
    user: {
      id: userId,
      name: `minuttery-${userId.slice(0, 8)}`,
      displayName: 'minuttery',
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -8 },
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    authenticatorSelection: {
      residentKey: 'preferred',
      requireResidentKey: false,
      userVerification: 'required',
    },
    timeout: 120000,
    extensions: { prf: { eval: prfEval } },
  })

  let prf: Uint8Array
  try {
    prf = readPrfBytes(created)
  } catch {
    const followUp = await Passkey.get({
      challenge: toBase64Url(randomBytes(32)),
      rpId: PASSKEY_RP_ID,
      userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: created.rawId || created.id }],
      extensions: { prf: { eval: prfEval } },
    })
    prf = readPrfBytes(followUp)
  }

  const keypair = keypairFromPrf(prf)
  const credentialId = created.rawId || created.id
  await writePasskeyRecord({ id: credentialId, pubkey: keypair.publicKey.toBase58() })
  return { kind: 'passkey', keypair, credentialId }
}
