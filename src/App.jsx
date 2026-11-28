import { useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import Auth from './Auth';
import Dashboard from './Dashboard';
import Market, { isMarketOpen } from './Market';
import StockPage from './StockPage';
import ChatPage from './ChatPage';
import { supabase } from './lib/supabase';
import './index.css';

const POLL_MS = 15000;

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState(() => localStorage.getItem('tab') || 'dashboard');
  const [selected, setSelected] = useState(() => localStorage.getItem('selected') || null);
  const [quotes, setQuotes] = useState({});
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [navHidden, setNavHidden] = useState(false);
  const loadedOnce = useRef(false);

  useEffect(() => {
    localStorage.setItem('tab', tab);
  }, [tab]);

  useEffect(() => {
    if (selected) localStorage.setItem('selected', selected);
  }, [selected]);

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

  // הסתרה והצגה של התפריט העליון, בלי תלות באירועי גלילה שמשנים את הפריסה
  useEffect(() => {
    // דפים רגילים (לוח בקרה, שוק, מניה): לפי גלילה של הדף
    let lastY = window.scrollY;
    function onWindowScroll() {
      const y = window.scrollY;
      if (y < 40) setNavHidden(false);
      else if (y > lastY + 6) setNavHidden(true);
      else if (y < lastY - 6) setNavHidden(false);
      lastY = y;
    }

    // צ'אט: לפי תנועת אצבע או גלגלת בתוך רשימת ההודעות
    const isLog = (t) => !!(t && t.classList && t.classList.contains('chat-page-log'));
    let touchY = null;

    function onTouchStart(e) {
      touchY = e.touches[0].clientY;
    }

    function onTouchMove(e) {
      if (!isLog(e.target) || touchY === null) return;
      const y = e.touches[0].clientY;
      const dy = y - touchY;
      touchY = y;
      if (dy < -6) setNavHidden(true);
      else if (dy > 6 && e.target.scrollTop <= 0) setNavHidden(false);
    }

    function onWheel(e) {
      if (!isLog(e.target)) return;
      if (e.deltaY > 6) setNavHidden(true);
      else if (e.deltaY < -6 && e.target.scrollTop <= 0) setNavHidden(false);
    }

    window.addEventListener('scroll', onWindowScroll, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('scroll', onWindowScroll);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('wheel', onWheel);
    };
  }, []);

  // מושך מחירים: תמיד פעם אחת בטעינה, ובשעות המסחר כל 15 שניות
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
        const map = {};
        data.forEach((q) => {
          map[q.symbol] = q;
        });
        setQuotes(map);
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
      <nav className={'nav' + (navHidden ? ' nav-hidden' : '')}>
        <button className={tab === 'dashboard' ? 'navbtn active' : 'navbtn'} onClick={() => setTab('dashboard')}>
          לוח בקרה
        </button>
        <button className={marketActive ? 'navbtn active' : 'navbtn'} onClick={() => setTab('market')}>
          שוק
        </button>
        <button className={tab === 'chat' ? 'navbtn active' : 'navbtn'} onClick={() => setTab('chat')}>
          צ'אט
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
          userId={session.user.id}
          onBack={() => setTab('market')}
          onTraded={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {tab === 'chat' && <ChatPage quotes={quotes} />}
    </div>
  );
}