import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, BarSeries, LineSeries, AreaSeries } from 'lightweight-charts';
import TradePanel from './TradePanel';
import { NAMES } from './Market';

const TIMEFRAMES = [
  { key: '1Min', label: '1 דקה' },
  { key: '5Min', label: '5 דקות' },
  { key: '15Min', label: '15 דקות' },
  { key: '1Hour', label: 'שעה' },
  { key: '1Day', label: 'יום' },
  { key: '1Week', label: 'שבוע' },
  { key: '1Month', label: 'חודש' },
];

const SPANS = [
  { days: 1, label: 'יום' },
  { days: 5, label: '5 ימים' },
  { days: 30, label: 'חודש' },
  { days: 182, label: '6 חודשים' },
  { days: 365, label: 'שנה' },
  { days: 1825, label: '5 שנים' },
  { days: 3650, label: 'הכול' },
];

const TYPES = [
  { key: 'candle', label: 'נר' },
  { key: 'bar', label: 'עמודות' },
  { key: 'line', label: 'קו' },
  { key: 'area', label: 'שטח' },
];

export default function StockPage({ symbol, quote, userId, onBack, onTraded }) {
  const chartRef = useRef(null);
  const chartObj = useRef(null);
  const seriesRef = useRef(null);
  const [tf, setTf] = useState('1Day');
  const [span, setSpan] = useState(365);
  const [type, setType] = useState('candle');
  const [tradeOpen, setTradeOpen] = useState(false);
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 440,
      layout: { background: { color: '#0b0f14' }, textColor: '#8a94a6' },
      grid: { vertLines: { color: '#161c26' }, horzLines: { color: '#161c26' } },
      rightPriceScale: { borderColor: '#1f2733' },
      timeScale: { borderColor: '#1f2733', timeVisible: true, secondsVisible: false },
    });
    chartObj.current = chart;
    const resize = () => chart.applyOptions({ width: chartRef.current.clientWidth });
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/candles?symbol=${symbol}&tf=${tf}&days=${span}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setBars(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, tf, span]);

  useEffect(() => {
    const chart = chartObj.current;
    if (!chart) return;
    if (seriesRef.current) chart.removeSeries(seriesRef.current);

    const up = '#22c55e';
    const down = '#ef4444';
    let series;
    if (type === 'candle') {
      series = chart.addSeries(CandlestickSeries, {
        upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down,
      });
    } else if (type === 'bar') {
      series = chart.addSeries(BarSeries, { upColor: up, downColor: down });
    } else if (type === 'line') {
      series = chart.addSeries(LineSeries, { color: up, lineWidth: 2 });
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: up, topColor: 'rgba(34,197,94,0.25)', bottomColor: 'rgba(34,197,94,0)',
      });
    }
    seriesRef.current = series;
  }, [type]);

  useEffect(() => {
    if (!seriesRef.current || bars.length === 0) return;
    const data =
      type === 'line' || type === 'area'
        ? bars.map((b) => ({ time: b.time, value: b.c }))
        : bars.map((b) => ({ time: b.time, open: b.o, high: b.h, low: b.l, close: b.c }));
    seriesRef.current.setData(data);
    chartObj.current?.timeScale().fitContent();
  }, [bars, type]);

  useEffect(() => {
    if (!seriesRef.current || !quote || bars.length === 0) return;
    const last = bars[bars.length - 1];
    const price = quote.price;
    if (type === 'line' || type === 'area') {
      seriesRef.current.update({ time: last.time, value: price });
    } else {
      seriesRef.current.update({
        time: last.time,
        open: last.o,
        high: Math.max(last.h, price),
        low: Math.min(last.l, price),
        close: price,
      });
    }
  }, [quote, bars, type]);

  return (
    <div>
      <button className="back" onClick={onBack}>חזרה לשוק</button>

      <div className="stock-head">
        <h2>{NAMES[symbol]} ({symbol})</h2>
        {quote && (
          <span className="price">
            ${quote.price.toFixed(2)}{' '}
            <span className={quote.change >= 0 ? 'pos' : 'neg'}>
              {quote.change >= 0 ? '+' : ''}
              {quote.change.toFixed(2)} ({quote.changePct.toFixed(2)}%)
            </span>
          </span>
        )}
        <button className="trade-btn" onClick={() => setTradeOpen(true)}>מסחר</button>
      </div>

      <div className="chart-bar">
        <div className="seg-group">
          {TIMEFRAMES.map((t) => (
            <button key={t.key} className={tf === t.key ? 'chip on' : 'chip'} onClick={() => setTf(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="seg-group">
          {SPANS.map((s) => (
            <button key={s.days} className={span === s.days ? 'chip on' : 'chip'} onClick={() => setSpan(s.days)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="seg-group">
          {TYPES.map((t) => (
            <button key={t.key} className={type === t.key ? 'chip on' : 'chip'} onClick={() => setType(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-wrap">
        {loading && <p className="note">טוען נתונים...</p>}
        <div ref={chartRef} dir="ltr" className="chart" />
      </div>

      <p className="note">
        הנתונים מ-Alpaca מתעכבים ב-15 דקות (בתוכנית החינמית). המחיר האחרון מתעדכן כל 15 שניות בשעות המסחר.
      </p>

      {tradeOpen && (
        <TradePanel
          symbol={symbol}
          name={NAMES[symbol]}
          quote={quote}
          userId={userId}
          onClose={() => setTradeOpen(false)}
          onTraded={onTraded}
        />
      )}
    </div>
  );
}