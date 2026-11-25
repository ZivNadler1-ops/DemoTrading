const SYMBOLS = ['NVDA', 'AMD', 'AVGO', 'MU', 'INTC'];
const CACHE_MS = 15000;

let cache = { time: 0, data: null };

export default async function handler(req, res) {
  const key = process.env.FINNHUB_KEY;
  if (!key) {
    return res.status(500).json({ error: 'FINNHUB_KEY is missing' });
  }

  if (cache.data && Date.now() - cache.time < CACHE_MS) {
    return res.status(200).json(cache.data);
  }

  try {
    const results = await Promise.all(
      SYMBOLS.map(async (symbol) => {
        const r = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`
        );
        const q = await r.json();
        return { symbol, price: q.c, change: q.d, changePct: q.dp, time: q.t };
      })
    );

    cache = { time: Date.now(), data: results };
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
}