import { getUserFromRequest, isAdmin } from '../lib/auth.js';

const ALLOWED = ['NVDA', 'AMD', 'AVGO', 'MU', 'INTC'];
const DAILY_LIMIT = 10;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'יש להתחבר לאתר' });
  }

  const { symbol, question, price, changePct } = req.body || {};
  if (!ALLOWED.includes(symbol)) {
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

  const news = await getNews(symbol);

  const system =
    'אתה עוזר שמסביר מניות בעברית, בפשטות. ענה רק על בסיס המידע שנשלח לך. ' +
    'אם המידע לא מספיק כדי לענות, כתוב זאת במפורש ואל תמציא סיבות. ' +
    'ציין תאריכים ומקורות כשאפשר. אל תיתן המלצות קנייה או מכירה. ' +
    'סיים בהערה קצרה שזה לא ייעוץ השקעות.';

  const newsText =
    news.map((n) => `- ${n.date} | ${n.source}: ${n.headline}`).join('\n') ||
    'לא נמצאו כותרות ב-30 הימים האחרונים';

  const context =
    `מניה: ${symbol}\n` +
    `מחיר נוכחי: ${price ?? 'לא ידוע'}\n` +
    `שינוי יומי: ${changePct ?? 'לא ידוע'}%\n\n` +
    `כותרות חדשות מ-30 הימים האחרונים:\n${newsText}`;

  const gr = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: `${context}\n\nשאלה: ${question}` }] }],
      }),
    }
  );

  if (!gr.ok) {
    console.error('Gemini error', gr.status, await gr.text());
    return res.status(502).json({ error: 'הבוט לא זמין כרגע, נסה שוב מאוחר יותר' });
  }

  const data = await gr.json();
  const answer =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || 'לא התקבלה תשובה';

  if (!admin) {
    await fetch(`${base}/rest/v1/rpc/increment_chat_usage`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_user: user.id }),
    });
  }

  return res.status(200).json({ answer });
}