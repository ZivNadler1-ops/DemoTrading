import { useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import Auth from './Auth';
import Dashboard from './Dashboard';
import Market, { isMarketOpen, SYMBOLS } from './Market';
import StockPage from './StockPage';
import { supabase } from './lib/supabase';
import './index.css';

const POLL_MS = 15000;

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [selected, setSelected] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [history, setHistory] = useState({});
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const loadedOnce = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const lenis = new Lenis();
    let frame;
    const raf = (t) => {
      lenis.raf(t);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isMarketOpen() && loadedOnce.current) return;
      try {
        const r = await fetch('/api/quote');
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'שגיאה');
        if (cancelled) return;

        loadedOnce.current = true;
        const now = Math.floor(Date.now() / 1000);
        const map = {};
        data.forEach((q) => {
          map[q.symbol] = q;
        });
        setQuotes(map);

        setHistory((prev) => {
          const next = { ...prev };
          data.forEach((q) => {
            const arr = next[q.symbol] ? [...next[q.symbol]] : [];
            if (!arr.length || arr[arr.length - 1].time < now) {
              arr.push({ time: now, value: q.price });
            }
            next[q.symbol] = arr;
          });
          return next;
        });
        setError('');
      } catch {
        if (!cancelled) setError('לא הצלחנו לטעון מחירים כרגע');
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (checking) return null;
  if (!session) return <Auth />;

  function openStock(symbol) {
    setSelected(symbol);
    setTab('stock');
  }

  const marketActive = tab === 'market' || tab === 'stock';

  return (
    <div dir="rtl" className="page">
      <nav className="nav">
        <button className={tab === 'dashboard' ? 'navbtn active' : 'navbtn'} onClick={() => setTab('dashboard')}>
          לוח בקרה
        </button>
        <button className={marketActive ? 'navbtn active' : 'navbtn'} onClick={() => setTab('market')}>
          שוק
        </button>
        <button className="navbtn" onClick={() => supabase.auth.signOut()}>
          יציאה
        </button>
      </nav>

      {error && <p className="error">{error}</p>}

      {tab === 'dashboard' && (
        <Dashboard key={refreshKey} quotes={quotes} userId={session.user.id} />
      )}

      {tab === 'market' && <Market quotes={quotes} onOpen={openStock} />}

      {tab === 'stock' && selected && (
        <StockPage
          symbol={selected}
          quote={quotes[selected]}
          history={history[selected]}
          userId={session.user.id}
          onBack={() => setTab('market')}
          onTraded={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}