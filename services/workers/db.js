const Database = require("better-sqlite3");
require("./config");
const { resolve } = require("node:path");
const db = new Database(resolve(__dirname, process.env.DB_PATH || "minuttery.db"));
db.pragma("journal_mode = WAL");

const insertRound = db.prepare(`
  INSERT OR IGNORE INTO rounds
  (signature, ts, round_id, tier, n, pot, winner, opener,
   winner_amount, house_amount, opener_amount, kind)
  VALUES (@signature, @ts, @roundId, @tier, @n, @pot, @winner, @opener,
          @winnerAmount, @houseAmount, @openerAmount, @kind)
`);

const insertPlayer = db.prepare(`
  INSERT OR IGNORE INTO round_players (signature, wallet, is_winner, is_opener)
  VALUES (@signature, @wallet, @isWinner, @isOpener)
`);

function saveRound(row) {
  const tx = db.transaction(() => {
    insertRound.run(row);
    for (const wallet of row.players) {
      insertPlayer.run({
        signature: row.signature,
        wallet,
        isWinner: wallet === row.winner ? 1 : 0,
        isOpener: wallet === row.opener ? 1 : 0,
      });
    }
  });
  tx();
}

function listWinners(opts = {}) {
  if (typeof opts === "number") {
    opts = { limit: opts };
  }

  const limit = Math.min(Math.max(Number(opts.limit) || 12, 1), 50);
  const offset = Math.max(Number(opts.offset) || 0, 0);
  const roundId = opts.roundId == null ? null : Number(opts.roundId);
  const tier = opts.tier == null ? null : Number(opts.tier);

  const where = ["kind = 'settled'"];
  const params = [];

  if (roundId != null && Number.isFinite(roundId)) {
    where.push("round_id = ?");
    params.push(roundId);
  }
  if (tier != null && Number.isFinite(tier)) {
    where.push("tier = ?");
    params.push(tier);
  }

  const whereSql = where.join(" AND ");
  const total = db.prepare(
    `SELECT COUNT(*) AS total FROM rounds WHERE ${whereSql}`
  ).get(...params).total;

  const rows = db.prepare(`
    SELECT signature, ts, round_id AS roundId, tier, n, pot,
           winner, opener, winner_amount AS winnerAmount, kind
    FROM rounds
    WHERE ${whereSql}
    ORDER BY ts DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { rows, total };
}

function statsFor(wallet) {
  const played = db.prepare(`
    SELECT r.kind, r.winner, r.n, r.pot, r.winner_amount, r.opener_amount, p.is_opener
    FROM round_players p
    JOIN rounds r ON r.signature = p.signature
    WHERE p.wallet = ?
  `).all(wallet);

  let playedCount = played.length;
  let won = 0, lost = 0, refunded = 0;
  let staked = 0n, returned = 0n;
  for (const row of played) {
    const stake = BigInt(row.pot) / BigInt(row.n);
    staked += stake;
    if (row.kind === "refunded") {
      refunded += 1;
      returned += stake;
      if (row.is_opener) returned += 0n;
    } else if (row.winner === wallet) {
      won += 1;
      returned += BigInt(row.winner_amount);
      if (row.is_opener) returned += BigInt(row.opener_amount);
    } else {
      lost += 1;
      if (row.is_opener) returned += BigInt(row.opener_amount);
    }
  }
  return {
    wallet, played: playedCount, won, lost, refunded,
    staked: staked.toString(),
    returned: returned.toString(),
    net: (returned - staked).toString(),
    winRate: playedCount ? won / (won + lost || 1) : 0,
  };
}

module.exports = { saveRound, listWinners, statsFor };