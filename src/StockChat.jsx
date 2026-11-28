import { useState } from 'react';
import { supabase } from './lib/supabase';

export default function StockChat({ symbol, quote }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  async function ask(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;

    setBusy(true);
    setQuestion('');
    setMessages((m) => [...m, { role: 'user', text: q }]);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          symbol,
          question: q,
          price: quote?.price,
          changePct: quote?.changePct,
        }),
      });
      const json = await res.json();
      setMessages((m) => [
        ...m,
        { role: 'bot', text: res.ok ? json.answer : json.error || 'שגיאה' },
      ]);
    } catch {
      setMessages((m) => [...m, { role: 'bot', text: 'שגיאת רשת, נסה שוב' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel chat">
      <h3>שאל את הבוט על {symbol}</h3>

      <div className="chat-log">
        {messages.length === 0 && (
          <p className="note">לדוגמה: מה גרם לירידה במניה בחודש האחרון?</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'chat-q' : 'chat-a'}>
            {m.text}
          </div>
        ))}
        {busy && <div className="chat-a">חושב...</div>}
      </div>

      <form onSubmit={ask} className="chat-form">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="כתוב שאלה..."
          disabled={busy}
        />
        <button type="submit" disabled={busy || !question.trim()}>
          שלח
        </button>
      </form>

      <p className="note">התשובות מבוססות על מחירים וכותרות חדשות, והן אינן ייעוץ השקעות.</p>
    </div>
  );
}