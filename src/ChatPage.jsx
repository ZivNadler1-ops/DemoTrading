import { useEffect, useRef, useState } from 'react';
import { loadMessages, sendQuestion } from './lib/chat';
import { loadPins, setPin } from './lib/pins';

const GENERAL = { key: 'general', label: 'General' };

const STOCKS = [
  { key: 'NVDA', label: 'NVIDIA (NVDA)' },
  { key: 'AMD', label: 'AMD' },
  { key: 'AVGO', label: 'Broadcom (AVGO)' },
  { key: 'MU', label: 'Micron (MU)' },
  { key: 'INTC', label: 'Intel (INTC)' },
];

const ALL = [GENERAL, ...STOCKS];

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 10.76V6a3 3 0 0 1 6 0v4.76l2.5 3.24H6.5L9 10.76Z" />
    </svg>
  );
}

export default function ChatPage({ quotes }) {
  const [messages, setMessages] = useState([]);
  const [pins, setPins] = useState([]);
  const [question, setQuestion] = useState('');
  const [active, setActive] = useState('general');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  const isGeneral = active === 'general';
  const visible = isGeneral ? messages : messages.filter((m) => m.symbol === active);
  const activeLabel = ALL.find((c) => c.key === active)?.label;

  const q = query.trim().toLowerCase();
  const matches = (c) => !q || c.label.toLowerCase().includes(q);
  const pinnedList = [GENERAL, ...STOCKS.filter((s) => pins.includes(s.key))].filter(matches);
  const stockList = STOCKS.filter(matches);

  useEffect(() => {
    let cancelled = false;
    loadMessages(null)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch(() => {});
    loadPins()
      .then((rows) => {
        if (!cancelled) setPins(rows);
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

  async function togglePin(symbol) {
    const next = !pins.includes(symbol);
    setPins((p) => (next ? [...p, symbol] : p.filter((x) => x !== symbol)));
    try {
      await setPin(symbol, next);
    } catch {
      loadPins()
        .then(setPins)
        .catch(() => {});
    }
  }

  async function ask(e) {
    e.preventDefault();
    const text = question.trim();
    if (!text || busy) return;

    const symbol = active;
    setBusy(true);
    setQuestion('');
    const quote = quotes[symbol];
    try {
      await sendQuestion({
        symbol,
        question: text,
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

  // inPinned: בתוך רשימת המוצמדים אין סיכה. הסיכה נמצאת רק ברשימת המניות למטה
  function renderRow(c, inPinned) {
    const isGen = c.key === 'general';
    const pinned = pins.includes(c.key);
    return (
      <div key={`${inPinned ? 'p' : 's'}-${c.key}`} className={c.key === active ? 'chat-row on' : 'chat-row'}>
        <button className="chat-item" onClick={() => setActive(c.key)}>
          {c.label}
        </button>
        {!isGen && !inPinned && (
          <button
            className={pinned ? 'pin-toggle pinned' : 'pin-toggle'}
            title={pinned ? 'בטל הצמדה' : 'הצמד'}
            onClick={(e) => {
              e.stopPropagation();
              togglePin(c.key);
            }}
          >
            <PinIcon />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="chat-page">
      <aside className="chat-side" data-lenis-prevent>
        <input
          className="chat-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats"
        />

        {pinnedList.length > 0 && (
          <div className="chat-section">
            <div className="chat-side-title">Pinned</div>
            {pinnedList.map((c) => renderRow(c, true))}
          </div>
        )}

        {pinnedList.length > 0 && stockList.length > 0 && <div className="chat-divider" />}

        {stockList.length > 0 && (
          <div className="chat-section">
            <div className="chat-side-title">Stocks</div>
            {stockList.map((c) => renderRow(c, false))}
          </div>
        )}

        {pinnedList.length === 0 && stockList.length === 0 && (
          <p className="chat-empty-side">לא נמצאו צ'אטים</p>
        )}
      </aside>

      <section className="chat-main panel">
        <div className="chat-head">
          <h2>{activeLabel}</h2>
        </div>

        <div className="chat-log chat-page-log" ref={logRef} data-lenis-prevent>
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