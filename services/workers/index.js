"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");

const anchor = require("@coral-xyz/anchor");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} = require("@solana/web3.js");
const { SecretKey } = require("@blueshift-gg/solana-ecvrf");

require("./config");
const { saveRound } = require("./db");


const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);
const ROOM_TIERS = [0, 1, 2, 3, 4];
const TIER_AMOUNTS = [
  100_000_000n,
  200_000_000n,
  1_000_000_000n,
  2_000_000_000n,
  5_000_000_000n,
];
const CHECK_SECOND = 55;
const DEADLINE_SECOND = 85;
const ERROR_RETRY_MS = 10_000;

function readJson(path) {
  return JSON.parse(fs.readFileSync(require("node:path").resolve(__dirname, path), "utf8"));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function i64Le(value) {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(value));
  return buf;
}

function u64Le(value) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function roundPda(tier, roundId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("round"), Buffer.from([tier]), i64Le(roundId)],
    PROGRAM_ID,
  )[0];
}

function configPda() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID,
  )[0];
}

function buildAlpha(roundId, totalPot, walletsSorted) {
  const parts = [
    Buffer.from("minuttery-v2"),
    i64Le(roundId),
    u64Le(totalPot),
  ];
  for (const w of walletsSorted) parts.push(Buffer.from(w.toBytes()));
  return crypto.createHash("sha256").update(Buffer.concat(parts)).digest();
}

function winnerIndex(output, n) {
  return Number(Buffer.from(output).subarray(0, 8).readBigUInt64LE() % BigInt(n));
}

function sortWallets(wallets) {
  return [...wallets].sort((a, b) =>
    Buffer.compare(Buffer.from(a.toBytes()), Buffer.from(b.toBytes())),
  );
}

function validateEnv() {
  for (const key of [
    "SOLANA_RPC_URL",
    "PROGRAM_ID",
    "WALLET_PATH",
    "ECVRF_KEYPAIR_PATH",
    "IDL_PATH",
  ]) {
    if (!process.env[key]) throw new Error(`Falta ${key}`);
  }
}

async function fetchRound(program, tier, roundId) {
  try {
    const pubkey = roundPda(tier, roundId);
    const account = await program.account.roundState.fetch(pubkey);
    return { pubkey, account, tier };
  } catch {
    return null; // nadie abrió esa sala
  }
}

async function liquidate(program, operator, config, { pubkey, account, tier }, roundId) {
  const n = Number(account.n);
  if (n === 0) return;

  const players = account.players.slice(0, n);
  const opener = players[0];
  const totalPot = TIER_AMOUNTS[tier] * BigInt(n);

  let winner = opener;
  let proofBytes = new Array(80).fill(0);

  if (n >= 2) {
    const sorted = sortWallets(players);
    const alpha = buildAlpha(roundId, totalPot, sorted);
    const proof = operator.prove(alpha);
    const output = proof.verify(operator.publicKey, alpha);
    winner = sorted[winnerIndex(output, n)];
    proofBytes = Array.from(proof.bytes);
  }

  console.log(`liq tier=${tier} n=${n} winner=${winner.toBase58()} opener=${opener.toBase58()}`);

  const sig = await program.methods
    .liquidateRound(new anchor.BN(roundId), tier, proofBytes)
    .accounts({
      liquidator: program.provider.wallet.publicKey,
      house: config.house,
      winner,
      opener,
      config: configPda(),
      round: pubkey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`ok ${sig}`);

  saveRound({
    signature: sig,
    ts: Math.floor(Date.now() / 1000),
    roundId: Number(roundId),
    tier,
    n,
    pot: totalPot.toString(),
    winner: n >= 2 ? winner.toBase58() : null,
    opener: opener.toBase58(),
    winnerAmount: n >= 2 ? ((totalPot * 965n) / 1000n).toString() : "0",
    houseAmount: n >= 2 ? ((totalPot * 25n) / 1000n).toString() : "0",
    openerAmount: n >= 2 ? ((totalPot * 10n) / 1000n).toString() : "0",
    kind: n >= 2 ? "settled" : "refunded",
    players: players.map((p) => p.toBase58()),
  });
}

async function refundAll(program, { pubkey, account, tier }, roundId) {
  const n = Number(account.n);
  if (n === 0) return;

  const players = account.players.slice(0, n);
  const remainingAccounts = players.map((wallet) => ({
    pubkey: wallet,
    isWritable: true,
    isSigner: false,
  }));

  const sig = await program.methods
    .refundAll(new anchor.BN(roundId), tier)
    .accounts({
      caller: program.provider.wallet.publicKey,
      opener: players[0],
      round: pubkey,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .rpc();

  console.log(`refund tier=${tier} n=${n} ${sig}`);

  saveRound({
    signature: sig,
    ts: Math.floor(Date.now() / 1000),
    roundId: Number(roundId),
    tier,
    n,
    pot: (TIER_AMOUNTS[tier] * BigInt(n)).toString(),
    winner: null,
    opener: players[0].toBase58(),
    winnerAmount: "0",
    houseAmount: "0",
    openerAmount: "0",
    kind: "refunded",
    players: players.map((p) => p.toBase58()),
  });
}

async function processMinute(program, connection, operator) {
  const now = Math.floor(Date.now() / 1000);
  const roundId = Math.floor(now / 60);
  const second = now % 60;

  if (second < CHECK_SECOND) return;

  const config = await program.account.config.fetch(configPda());
  const localOp = Buffer.from(operator.publicKey.bytes);
  if (!localOp.equals(Buffer.from(config.operator))) {
    throw new Error("ECVRF local != config.operator");
  }

  for (const tier of ROOM_TIERS) {
    const round = await fetchRound(program, tier, roundId);
    if (!round || Number(round.account.n) === 0) continue;

    try {
      if (second < DEADLINE_SECOND) {
        await liquidate(program, operator, config, round, roundId);
      } else {
        await refundAll(program, round, roundId);
      }
    } catch (err) {
      console.error(`tier ${tier}:`, err.message || err);
    }
  }
}

function secondsUntil(targetSecond) {
  const s = Math.floor(Date.now() / 1000) % 60;
  return s < targetSecond ? targetSecond - s : 60 - s + targetSecond;
}

async function main() {
  validateEnv();

  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(readJson(process.env.WALLET_PATH)),
  );
  const operator = SecretKey.fromKeypair(readJson(process.env.ECVRF_KEYPAIR_PATH));
  const connection = new Connection(process.env.SOLANA_RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" },
  );
  const program = new anchor.Program(readJson(process.env.IDL_PATH), provider);

  console.log("worker", wallet.publicKey.toBase58());

  for (;;) {
    try {
      const wait = secondsUntil(CHECK_SECOND);
      console.log(`next ${wait}s`);
      await sleep(wait * 1000);
      await processMinute(program, connection, operator);
    } catch (err) {
      console.error(err);
      await sleep(ERROR_RETRY_MS);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});