const express = require("express");
const cors = require("cors");
const { listWinners, statsFor } = require("./db");

const app = express();

app.use(cors({
  origin: [
    "https://minuttery.com",
    "https://www.minuttery.com",
  ],
}));

app.get("/sync", (_req, res) => {
  const serverNow = Date.now();
  res.json({
    serverNow,
    roundId: Math.floor(serverNow / 60_000),
  });
});

app.get("/winners", (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const roundId = req.query.roundId != null && req.query.roundId !== ""
    ? Number(req.query.roundId)
    : null;
  const tier = req.query.tier != null && req.query.tier !== ""
    ? Number(req.query.tier)
    : null;

  const payload = listWinners({ limit, offset, roundId, tier });
  const serverNow = Date.now();
  res.json({
    ...payload,
    serverNow,
    roundId: Math.floor(serverNow / 60_000),
  });
});

app.get("/stats/:wallet", (req, res) => {
  res.json(statsFor(req.params.wallet));
});

app.listen(8787, "127.0.0.1", () => {
  console.log("api on 127.0.0.1:8787");
});