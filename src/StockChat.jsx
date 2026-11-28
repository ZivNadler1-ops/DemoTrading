import { useEffect, useRef, useState } from 'react';
import { loadMessages, sendQuestion } from './lib/chat';

export default function StockChat({ symbol, quote }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadMessages(symbol)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function ask(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;

    setBusy(true);
    setQuestion('');
    try {
      await sendQuestion({
        symbol,
        question: q,
        price: quote?.price,
        changePct: quote?.changePct,
      });
      setMessages(await loadMessages(symbol));
    } catch (err) {
      setMessages((m) => [
        ...m,
        { id: `err-${Date.now()}`, role: 'bot', content: err.message || 'שגיאה' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel chat">
      <h3>שאל את הבוט על {symbol}</h3>

      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && !busy && (
          <p className="chat-empty">לדוגמה: מה גרם לירידה במניה בחודש האחרון?</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'chat-q' : 'chat-a'}>
            {m.content}
          </div>
        ))}
        {busy && <div className="chat-a chat-typing">הבוט חושב...</div>}
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

      <p className="chat-note">התשובות מבוססות על מחירים וכותרות חדשות, והן אינן ייעוץ השקעות.</p>
    </div>
  );
}