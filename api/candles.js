const TIMEFRAMES = new Set(['1Min', '5Min', '15Min', '1Hour', '1Day', '1Week', '1Month']);
const MAX_DAYS = { '1Min': 1, '5Min': 30, '15Min': 60, '1Hour': 365, '1Day': 3650, '1Week': 3650, '1Month': 3650 };
const cache = new Map();
const CACHE_MS = 60000;

export default async function handler(req, res) {
  const keyId = process.env.ALPACA_KEY_ID;
  const secret = process.env.ALPACA_SECRET;
  if (!keyId || !secret) {
    return res.status(500).json({ error: 'Alpaca keys missing' });
  }

  const symbol = String(req.query.symbol || '').toUpperCase();
  if (!symbol) {
    return res.status(400).json({ error: 'symbol is required' });
  }

  const tf = TIMEFRAMES.has(req.query.tf) ? req.query.tf : '1Day';
  const windowDays = Math.min(Math.max(parseInt(req.query.days, 10) || 365, 1), MAX_DAYS[tf]);
  const before = parseInt(req.query.before, 10);

  const latestEnd = Date.now() - 16 * 60 * 1000;
  const endMs = before ? Math.min(before * 1000, latestEnd) : latestEnd;
  const span = before ? Math.min(Math.max(windowDays, 10), MAX_DAYS[tf]) : windowDays;
  const startMs = endMs - span * 86400000;

  const cacheKey = `${symbol}:${tf}:${windowDays}:${before || 'now'}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.time < CACHE_MS) {
    return res.status(200).json(hit.data);
  }

  const url =
    `https://data.alpaca.markets/v2/stocks/${symbol}/bars` +
    `?timeframe=${tf}&start=${new Date(startMs).toISOString()}&end=${new Date(endMs).toISOString()}` +
    `&limit=10000&feed=iex&adjustment=split`;

  try {
    const r = await fetch(url, {
      headers: { 'APCA-API-KEY-ID': keyId, 'APCA-API-SECRET-KEY': secret },
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data.message || 'Alpaca error' });
    }
    const bars = (data.bars || []).map((b) => ({
      time: Math.floor(new Date(b.t).getTime() / 1000),
      o: b.o,
      h: b.h,
      l: b.l,
      c: b.c,
    }));
    cache.set(cacheKey, { time: Date.now(), data: bars });
    res.status(200).json(bars);
  } catch {
    res.status(500).json({ error: 'Failed to fetch candles' });
  }
}