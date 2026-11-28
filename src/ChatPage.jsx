import { useEffect, useRef, useState } from 'react';
import { loadMessages, sendQuestion } from './lib/chat';
import { SYMBOLS, NAMES } from './Market';

export default function ChatPage({ quotes }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [symbol, setSymbol] = useState(SYMBOLS[0]);
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadMessages(null)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
    const quote = quotes[symbol];
    try {
      await sendQuestion({
        symbol,
        question: q,
        price: quote?.price,
        changePct: quote?.changePct,
      });
      setMessages(await loadMessages(null));
    } catch (err) {
      setMessages((m) => [
        ...m,
        { id: `err-${Date.now()}`, role: 'bot', symbol, content: err.message || 'שגיאה' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-page panel">
      <h2>צ'אט עם הבוט</h2>

      <div className="chat-log chat-page-log" ref={logRef}>
        {messages.length === 0 && !busy && (
          <p className="chat-empty">עדיין אין שיחות. שאל שאלה על אחת המניות למטה.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'chat-q' : 'chat-a'}>
            {m.symbol && <span className="chat-tag">{m.symbol}</span>}
            {m.content}
          </div>
        ))}
        {busy && <div className="chat-a chat-typing">הבוט חושב...</div>}
      </div>

      <form onSubmit={ask} className="chat-form chat-page-form">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={busy}>
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {NAMES[s]} ({s})
            </option>
          ))}
        </select>
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
    </div>
  );
}