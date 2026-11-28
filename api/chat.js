import { getUserFromRequest, isAdmin } from '../lib/auth.js';

const STOCKS = ['NVDA', 'AMD', 'AVGO', 'MU', 'INTC'];
const DAILY_LIMIT = 10;
const MODEL = 'gemini-3.5-flash-lite';

function sbHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const delays = [0, 1000, 2000];
  let last = null;

  for (const delay of delays) {
    if (delay) await sleep(delay);
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        ...body,
        tools: [{ google_search: {} }],
      }),
    });
    if (r.ok) return { ok: true, data: await r.json() };
    last = { status: r.status, text: await r.text() };
    if (r.status !== 503) break;
  }

  console.error('Gemini error', last?.status, last?.text);
  return { ok: false };
}

async function getNews(symbol) {
  const to = isoDay(new Date());
  const from = isoDay(new Date(Date.now() - 30 * 86400000));
  const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${process.env.FINNHUB_KEY}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const items = await r.json();
    return (Array.isArray(items) ? items : []).slice(0, 15).map((n) => ({
      date: isoDay(new Date(n.datetime * 1000)),
      source: n.source,
      headline: n.headline,
    }));
  } catch {
    return [];
  }
}

// סיכום מחירים יומיים לשנה האחרונה מ-Alpaca
async function getPriceSummary(symbol) {
  const end = new Date(Date.now() - 16 * 60 * 1000);
  const start = new Date(end.getTime() - 370 * 86400000);
  const url =
    `https://data.alpaca.markets/v2/stocks/${symbol}/bars` +
    `?timeframe=1Day&start=${start.toISOString()}&end=${end.toISOString()}` +
    `&limit=400&feed=iex&adjustment=split`;
  try {
    const r = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': process.env.ALPACA_KEY_ID,
        'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET,
      },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const bars = data.bars || [];
    if (bars.length === 0) return null;

    const first = bars[0];
    const last = bars[bars.length - 1];
    const monthAgo = bars[Math.max(0, bars.length - 22)];
    const hi = Math.max(...bars.map((b) => b.h));
    const lo = Math.min(...bars.map((b) => b.l));
    const hiBar = bars.find((b) => b.h === hi);
    const loBar = bars.find((b) => b.l === lo);
    const pct = (from, to) => (((to - from) / from) * 100).toFixed(1);

    return [
      `סגירה אחרונה (${isoDay(new Date(last.t))}): ${last.c}`,
      `לפני חודש בערך (${isoDay(new Date(monthAgo.t))}): ${monthAgo.c}, שינוי של ${pct(monthAgo.c, last.c)}%`,
      `לפני שנה בערך (${isoDay(new Date(first.t))}): ${first.c}, שינוי של ${pct(first.c, last.c)}%`,
      `שיא בשנה האחרונה: ${hi} בתאריך ${isoDay(new Date(hiBar.t))}`,
      `שפל בשנה האחרונה: ${lo} בתאריך ${isoDay(new Date(loBar.t))}`,
    ].join('\n');
  } catch {
    return null;
  }
}

function cleanText(text) {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/`/g, '')
    .trim();
}

async function saveMessage(row) {
  const base = process.env.VITE_SUPABASE_URL;
  await fetch(`${base}/rest/v1/chat_messages`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
}

const STOCK_SYSTEM =
  'אתה עוזר שמסביר מניות בעברית, בפשטות. ענה על סמך המידע שנשלח לך: מחיר נוכחי, ' +
  'סיכום מחירים היסטוריים, וכותרות חדשות. ' +
  'אם המידע שנשלח לא מספיק כדי לענות (למשל מחיר ביום מסוים, או סיבה לתנועה שלא מופיעה בכותרות), ' +
  'השתמש בחיפוש ברשת כדי למצוא את התשובה, וציין בתשובה שהמידע הגיע מחיפוש ברשת. ' +
  'אל תמציא מספרים או סיבות. אל תיתן המלצות קנייה או מכירה. ' +
  'כתוב טקסט רגיל בלבד: בלי כוכביות, בלי Markdown, בלי כותרות ובלי קישורים. ' +
  'להסברים עם כמה נקודות השתמש במספור פשוט (1. 2. 3.). ' +
  'בסוף התשובה כתוב שורה קצרה שזה לא ייעוץ השקעות.';

const GENERAL_SYSTEM =
  'אתה עוזר ידידותי שעונה בעברית, בפשטות, על כל נושא שהמשתמש שואל. ' +
  'אם השאלה דורשת מידע עדכני, השתמש בחיפוש ברשת וציין שהמידע הגיע מחיפוש. ' +
  'אל תמציא נתונים. אל תיתן המלצות קנייה או מכירה. ' +
  'כתוב טקסט רגיל בלבד: בלי כוכביות, בלי Markdown, בלי כותרות ובלי קישורים. ' +
  'להסברים עם כמה נקודות השתמש במספור פשוט (1. 2. 3.).';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'יש להתחבר לאתר' });
  }

  const { symbol, question, price, changePct } = req.body || {};
  const isGeneral = symbol === 'general';
  if (!isGeneral && !STOCKS.includes(symbol)) {
    return res.status(400).json({ error: 'מניה לא נתמכת' });
  }
  if (typeof question !== 'string' || !question.trim() || question.length > 500) {
    return res.status(400).json({ error: 'השאלה חייבת להיות עד 500 תווים' });
  }

  const admin = isAdmin(user);
  const base = process.env.VITE_SUPABASE_URL;

  if (!admin) {
    const r = await fetch(
      `${base}/rest/v1/chat_usage?user_id=eq.${user.id}&day=eq.${isoDay(new Date())}&select=count`,
      { headers: sbHeaders() }
    );
    const rows = await r.json();
    const used = rows[0]?.count ?? 0;
    if (used >= DAILY_LIMIT) {
      return res.status(429).json({ error: `הגעת למגבלה היומית (${DAILY_LIMIT} שאלות ביום).` });
    }
  }

  await saveMessage({ user_id: user.id, symbol, role: 'user', content: question.trim() });

  let system = GENERAL_SYSTEM;
  let context = `תאריך היום: ${isoDay(new Date())}\n\n`;

  if (!isGeneral) {
    const [news, summary] = await Promise.all([getNews(symbol), getPriceSummary(symbol)]);
    const newsText =
      news.map((n) => `- ${n.date} | ${n.source}: ${n.headline}`).join('\n') ||
      'לא נמצאו כותרות ב-30 הימים האחרונים';
    system = STOCK_SYSTEM;
    context +=
      `מניה: ${symbol}\n` +
      `מחיר נוכחי: ${price ?? 'לא ידוע'}\n` +
      `שינוי יומי: ${changePct ?? 'לא ידוע'}%\n\n` +
      `סיכום מחירים יומיים לשנה האחרונה:\n${summary || 'לא זמין כרגע'}\n\n` +
      `כותרות חדשות מ-30 הימים האחרונים:\n${newsText}\n\n`;
  }

  const result = await callGemini({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: `${context}שאלה: ${question}` }] }],
  });

  if (!result.ok) {
    return res.status(502).json({ error: 'הבוט עמוס כרגע, נסה שוב בעוד כמה דקות' });
  }

  const data = result.data;
  const answer = cleanText(
    data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || 'לא התקבלה תשובה'
  );

  await saveMessage({ user_id: user.id, symbol, role: 'bot', content: answer });

  if (!admin) {
    await fetch(`${base}/rest/v1/rpc/increment_chat_usage`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_user: user.id }),
    });
  }

  return res.status(200).json({ answer });
}