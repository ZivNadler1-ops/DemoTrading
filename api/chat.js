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
      body: JSON.stringify(body),
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

// מנקה סימני עיצוב שהמודל עלול להוסיף בכל זאת
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
  'אתה עוזר שמסביר מניות בעברית, בפשטות. ענה רק על בסיס המידע שנשלח לך. ' +
  'אם המידע לא מספיק כדי לענות, כתוב זאת במפורש ואל תמציא סיבות. ' +
  'ציין תאריכים ומקורות כשאפשר. אל תיתן המלצות קנייה או מכירה. ' +
  'כתוב טקסט רגיל בלבד: בלי כוכביות, בלי Markdown, בלי כותרות ובלי קישורים. ' +
  'להסברים עם כמה נקודות השתמש במספור פשוט (1. 2. 3.). ' +
  'סיים בהערה קצרה שזה לא ייעוץ השקעות.';

const GENERAL_SYSTEM =
  'אתה עוזר ידידותי שעונה בעברית, בפשטות, על כל נושא שהמשתמש שואל. ' +
  'כשמדובר בשוק ההון או במניות, הסבר מושגים ורעיונות בצורה כללית, ואל תמציא נתונים או חדשות עדכניים. ' +
  'אם שואלים על מצב עדכני של מניה או שוק, ציין שאין לך נתונים עדכניים. ' +
  'אל תיתן המלצות קנייה או מכירה. ' +
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
  let context = '';

  if (!isGeneral) {
    const news = await getNews(symbol);
    const newsText =
      news.map((n) => `- ${n.date} | ${n.source}: ${n.headline}`).join('\n') ||
      'לא נמצאו כותרות ב-30 הימים האחרונים';
    system = STOCK_SYSTEM;
    context =
      `מניה: ${symbol}\n` +
      `מחיר נוכחי: ${price ?? 'לא ידוע'}\n` +
      `שינוי יומי: ${changePct ?? 'לא ידוע'}%\n\n` +
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