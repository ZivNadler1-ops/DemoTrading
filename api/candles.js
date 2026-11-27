const RANGES = {
  '1m': { tf: '1Min', days: 1 },
  '5m': { tf: '5Min', days: 3 },
  '15m': { tf: '15Min', days: 7 },
  '1h': { tf: '1Hour', days: 30 },
  '1d': { tf: '1Day', days: 365 },
  '1w': { tf: '1Week', days: 1825 },
  '1mo': { tf: '1Month', days: 1825 },
};

const cache = new Map();
const CACHE_MS = 60000;

export default async function handler(req, res) {
  const keyId = process.env.ALPACA_KEY_ID;
  const secret = process.env.ALPACA_SECRET;
  if (!keyId || !secret) {
    return res.status(500).json({ error: 'Alpaca keys missing' });
  }

  const symbol = String(req.query.symbol || '').toUpperCase();
  const range = RANGES[req.query.range] ? req.query.range : '1d';
  if (!symbol) {
    return res.status(400).json({ error: 'symbol is required' });
  }

  const cacheKey = `${symbol}:${range}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.time < CACHE_MS) {
    return res.status(200).json(hit.data);
  }

  const { tf, days } = RANGES[range];
  const end = new Date(Date.now() - 16 * 60 * 1000);
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const url =
    `https://data.alpaca.markets/v2/stocks/${symbol}/bars` +
    `?timeframe=${tf}&start=${start.toISOString()}&end=${end.toISOString()}` +
    `&limit=10000&feed=iex&adjustment=split`;

  try {
    const r = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': keyId,
        'APCA-API-SECRET-KEY': secret,
      },
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