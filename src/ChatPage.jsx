import { useEffect, useRef, useState } from 'react';
import { loadMessages, sendQuestion } from './lib/chat.js';
import { loadPins, setPin } from './lib/pins.js';

const GENERAL = { key: 'general', label: 'General' };
const STOCKS = [
  { key: 'NVDA', label: 'NVIDIA (NVDA)' },
  { key: 'AMD', label: 'AMD' },
  { key: 'AVGO', label: 'Broadcom (AVGO)' },
  { key: 'MU', label: 'Micron (MU)' },
  { key: 'INTC', label: 'Intel (INTC)' },
];
const ALL = [GENERAL, ...STOCKS];

function PinIcon({ filled }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 6 3 4H7l3-4z" />
    </svg>
  );
}

export default function ChatPage({ quotes = {} }) {
  const [messages, setMessages] = useState([]);
  const [pins, setPins] = useState([]);
  const [question, setQuestion] = useState('');
  const [active, setActive] = useState('general');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const logRef = useRef(null);

  const current = ALL.find((c) => c.key === active) || GENERAL;

  function reloadPins() {
    loadPins()
      .then((rows) => setPins((rows || []).map((r) => r.symbol ?? r)))
      .catch(() => {});
  }

  useEffect(() => {
    reloadPins();
  }, []);

  useEffect(() => {
    loadMessages(active === 'general' ? null : active)
      .then(setMessages)
      .catch(() => {});
  }, [active]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, active]);

  async function togglePin(symbol) {
    const pinned = pins.includes(symbol);
    setPins(pinned ? pins.filter((s) => s !== symbol) : [...pins, symbol]);
    try {
      await setPin(symbol, !pinned);
    } catch {
      reloadPins();
    }
  }

  function choose(key) {
    setActive(key);
    setMenuOpen(false);
  }

  async function ask(e) {
    e.preventDefault();
    const text = question.trim();
    if (!text || busy) return;

    const symbol = active;
    const q = quotes?.[symbol] || {};
    setBusy(true);
    setQuestion('');
    setMessages((m) => [...m, { id: 'u' + Date.now(), symbol, role: 'user', content: text }]);

    try {
      const answer = await sendQuestion({
        symbol,
        question: text,
        price: q.price,
        changePct: q.changePct,
      });
      setMessages((m) => [...m, { id: 'b' + Date.now(), symbol, role: 'bot', content: answer }]);
    } catch (err) {
      setMessages((m) => [...m, { id: 'e' + Date.now(), symbol, role: 'bot', content: err.message }]);
    } finally {
      setBusy(false);
    }
  }

  const q = query.trim().toLowerCase();
  const matches = (c) => !q || c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q);
  const pinnedList = ALL.filter((c) => (c.key === 'general' || pins.includes(c.key)) && matches(c));
  const stockList = STOCKS.filter(matches);

  function renderRow(c, inPinned) {
    const isPinned = pins.includes(c.key);
    return (
      <div className="chat-row" key={(inPinned ? 'p-' : 's-') + c.key}>
        <button
          type="button"
          className={'chat-item' + (active === c.key ? ' active' : '')}
          onClick={() => choose(c.key)}
        >
          {c.label}
        </button>
        {c.key !== 'general' && !inPinned && (
          <button
            type="button"
            className={'pin-toggle' + (isPinned ? ' pinned' : '')}
            onClick={(e) => {
              e.stopPropagation();
              togglePin(c.key);
            }}
            aria-label="הצמד"
          >
            <PinIcon filled={isPinned} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={'chat-page' + (menuOpen ? ' menu-open' : '')}>
      <aside className={'chat-side' + (menuOpen ? ' open' : '')} data-lenis-prevent>
        <div className="chat-side-top">
          <input
            className="chat-search"
            placeholder="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="chat-close" onClick={() => setMenuOpen(false)} aria-label="סגור">
            ✕
          </button>
        </div>

        <div className="chat-section">
          <div className="chat-section-title">Pinned</div>
          {pinnedList.map((c) => renderRow(c, true))}
        </div>

        <div className="chat-divider" />

        <div className="chat-section">
          <div className="chat-section-title">Stocks</div>
          {stockList.map((c) => renderRow(c, false))}
        </div>
      </aside>

      <section className="chat-main panel">
        <div className="chat-head">
          <button
            type="button"
            className="chat-menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="תפריט"
          >
            ☰
          </button>
          <h2>{current.label}</h2>
        </div>

        <div className="chat-log chat-page-log" ref={logRef} data-lenis-prevent>
          {messages.length === 0 && <div className="chat-empty">עדיין אין הודעות. שאל משהו.</div>}
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'chat-q' : 'chat-a'}>
              {active === 'general' && m.symbol !== 'general' && (
                <span className="chat-tag">{m.symbol}</span>
              )}
              {m.content}
            </div>
          ))}
          {busy && <div className="chat-typing">הבוט חושב...</div>}
        </div>

        <form className="chat-form" onSubmit={ask}>
          <button type="submit" disabled={busy}>
            שלח
          </button>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="שאל כל שאלה..."
            maxLength={500}
          />
        </form>
      </section>
    </div>
  );
}