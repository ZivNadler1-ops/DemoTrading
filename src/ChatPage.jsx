import { useEffect, useRef, useState } from 'react';
import { loadMessages, sendQuestion } from './lib/chat';

const CHAT_LIST = [
  { key: 'general', label: 'General' },
  { key: 'NVDA', label: 'NVIDIA (NVDA)' },
  { key: 'AMD', label: 'AMD' },
  { key: 'AVGO', label: 'Broadcom (AVGO)' },
  { key: 'MU', label: 'Micron (MU)' },
  { key: 'INTC', label: 'Intel (INTC)' },
];

export default function ChatPage({ quotes }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [active, setActive] = useState('general');
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  const isGeneral = active === 'general';
  const visible = isGeneral ? messages : messages.filter((m) => m.symbol === active);
  const activeLabel = CHAT_LIST.find((c) => c.key === active)?.label;

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
  }, [visible.length, busy, active]);

  async function ask(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;

    const symbol = active;
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
    <div className="chat-page">
      <aside className="chat-side">
        <div className="chat-side-title">Chats</div>
        {CHAT_LIST.map((c) => (
          <button
            key={c.key}
            className={c.key === active ? 'chat-item on' : 'chat-item'}
            onClick={() => setActive(c.key)}
          >
            {c.label}
          </button>
        ))}
      </aside>

      <section className="chat-main panel">
        <h2>{activeLabel}</h2>

        <div className="chat-log chat-page-log" ref={logRef}>
          {visible.length === 0 && !busy && (
            <p className="chat-empty">עדיין אין שיחות כאן. כתוב שאלה למטה.</p>
          )}
          {visible.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'chat-q' : 'chat-a'}>
              {isGeneral && m.symbol && m.symbol !== 'general' && (
                <span className="chat-tag">{m.symbol}</span>
              )}
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
            disabled={busy}
            placeholder={isGeneral ? 'שאל כל שאלה...' : 'כתוב שאלה על המניה...'}
          />
          <button type="submit" disabled={busy || !question.trim()}>
            שלח
          </button>
        </form>
      </section>
    </div>
  );
}