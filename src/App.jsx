import { useEffect, useRef, useState } from 'react';
import { createChart, LineSeries } from 'lightweight-charts';
import Lenis from 'lenis';
import gsap from 'gsap';
import RiskPanel from './RiskPanel';
import './index.css';

const SYMBOLS = ['NVDA', 'AMD', 'AVGO', 'MU', 'INTC'];
const NAMES = { NVDA: 'אנבידיה', AMD: 'AMD', AVGO: 'ברודקום', MU: 'מיקרון', INTC: 'אינטל' };
const POLL_MS = 15000;

function isMarketOpen() {
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = ny.getDay();
  const mins = ny.getHours() * 60 + ny.getMinutes();
  return day >= 1 && day <= 5 && mins >= 570 && mins < 960;
}

export default function App() {
  const [quotes, setQuotes] = useState({});
  const [selected, setSelected] = useState('NVDA');
  const [history, setHistory] = useState({});
  const [error, setError] = useState('');
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const headerRef = useRef(null);
  const loadedOnce = useRef(false);

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
    gsap.from(headerRef.current, { opacity: 0, y: -12, duration: 0.6, ease: 'power2.out' });
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

  useEffect(() => {
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 360,
      layout: { background: { color: '#0b0f14' }, textColor: '#8a94a6' },
      grid: { vertLines: { color: '#161c26' }, horzLines: { color: '#161c26' } },
      rightPriceScale: { borderColor: '#1f2733' },
      timeScale: { borderColor: '#1f2733', timeVisible: true, secondsVisible: true },
    });
    seriesRef.current = chart.addSeries(LineSeries, { color: '#22c55e', lineWidth: 2 });

    const resize = () => chart.applyOptions({ width: chartRef.current.clientWidth });
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const data = history[selected] || [];
    seriesRef.current?.setData(data.map((p) => ({ time: p.time, value: p.value })));
  }, [history, selected]);

  useEffect(() => {
    const up = quotes[selected] ? quotes[selected].change >= 0 : true;
    seriesRef.current?.applyOptions({ color: up ? '#22c55e' : '#ef4444' });
  }, [quotes, selected]);

  const q = quotes[selected];
  const open = isMarketOpen();

  return (
    <div dir="rtl" className="page">
      <header ref={headerRef} className="top">
        <h1>סימולציית מסחר</h1>
        <span className={open ? 'status open' : 'status closed'}>
          {open ? 'השוק פתוח' : 'השוק סגור'}
        </span>
      </header>

      <div className="tabs">
        {SYMBOLS.map((s) => {
          const x = quotes[s];
          return (
            <button
              key={s}
              className={selected === s ? 'tab active' : 'tab'}
              onClick={() => setSelected(s)}
            >
              <span className="tab-name">
                {NAMES[s]} <small>{s}</small>
              </span>
              {x && <strong>${x.price.toFixed(2)}</strong>}
              {x && (
                <em className={x.change >= 0 ? 'pos' : 'neg'}>
                  {x.changePct.toFixed(2)}%
                </em>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="error">{error}</p>}

      <section className="panel">
        <div className="panel-head">
          <h2>
            {NAMES[selected]} ({selected})
          </h2>
          {q && (
            <p className="price">
              ${q.price.toFixed(2)}
              <span className={q.change >= 0 ? 'pos' : 'neg'}>
                {' '}
                {q.change >= 0 ? '+' : ''}
                {q.change.toFixed(2)} ({q.changePct.toFixed(2)}%)
              </span>
            </p>
          )}
        </div>
        <div ref={chartRef} dir="ltr" className="chart" />
        <p className="note">
          הגרף מתעדכן כל 15 שניות, ומתחיל ברגע שפתחת את הדף. מחוץ לשעות המסחר של ארה"ב המחירים לא מתעדכנים.
        </p>
      </section>

      <RiskPanel symbol={selected} price={q?.price} />
    </div>
  );
}