import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, BarSeries, LineSeries, AreaSeries } from 'lightweight-charts';
import TradePanel from './TradePanel';
import { NAMES } from './Market';

const TF_OPTIONS = [
  { value: '5Min', label: '5 דקות' },
  { value: '15Min', label: '15 דקות' },
  { value: '1Hour', label: 'שעה' },
  { value: '1Day', label: 'יום' },
  { value: '1Week', label: 'שבוע' },
  { value: '1Month', label: 'חודש' },
];

const RANGES_BY_TF = {
  '5Min': [
    { value: 5, label: '5 ימים' },
    { value: 30, label: 'חודש' },
  ],
  '15Min': [
    { value: 30, label: 'חודש' },
    { value: 60, label: '2 חודשים' },
  ],
  '1Hour': [
    { value: 30, label: 'חודש' },
    { value: 182, label: '6 חודשים' },
    { value: 365, label: 'שנה' },
  ],
  '1Day': [
    { value: 182, label: '6 חודשים' },
    { value: 365, label: 'שנה' },
    { value: 1825, label: '5 שנים' },
  ],
  '1Week': [
    { value: 1825, label: '5 שנים' },
    { value: 3650, label: 'הכול' },
  ],
  '1Month': [
    { value: 1825, label: '5 שנים' },
    { value: 3650, label: 'הכול' },
  ],
};

const TYPE_OPTIONS = [
  { value: 'candle', label: 'נר' },
  { value: 'bar', label: 'עמודות' },
  { value: 'line', label: 'קו' },
  { value: 'area', label: 'שטח' },
];

function Dropdown({ label, current, options, onChange }) {
  const [open, setOpen] = useState(false);
  const currentLabel = options.find((o) => o.value === current)?.label ?? '';

  return (
    <div className="dd">
      <button className="dd-btn" onClick={() => setOpen(!open)}>
        {label}: {currentLabel} ▾
      </button>
      {open && (
        <div className="dd-menu">
          {options.map((o) => (
            <button
              key={o.value}
              className={o.value === current ? 'on' : ''}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StockPage({ symbol, quote, userId, onBack, onTraded }) {
  const chartRef = useRef(null);
  const chartObj = useRef(null);
  const seriesRef = useRef(null);
  const [tf, setTf] = useState('1Day');
  const [days, setDays] = useState(365);
  const [type, setType] = useState('candle');
  const [tradeOpen, setTradeOpen] = useState(false);
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(false);

  function changeTf(next) {
    setTf(next);
    const list = RANGES_BY_TF[next];
    if (!list.some((r) => r.value === days)) {
      setDays(list[list.length - 1].value);
    }
  }

  // יצירת הגרף פעם אחת
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

  // טעינת נתונים בכל שינוי מסגרת או טווח
  useEffect(() => {
    let cancelled = false;
    setBars([]);
    setLoading(true);
    fetch(`/api/candles?symbol=${symbol}&tf=${tf}&days=${days}`)
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
  }, [symbol, tf, days]);

  // החלפת סוג הגרף
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

  // הצגת הנתונים, וקביעת התצוגה מחדש לכל הטווח
  useEffect(() => {
    if (!seriesRef.current || bars.length === 0) return;
    const data =
      type === 'line' || type === 'area'
        ? bars.map((b) => ({ time: b.time, value: b.c }))
        : bars.map((b) => ({ time: b.time, open: b.o, high: b.h, low: b.l, close: b.c }));
    seriesRef.current.setData(data);
    chartObj.current?.timeScale().fitContent();
  }, [bars, type]);

  // עדכון הנר האחרון לפי המחיר החי
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
        <Dropdown label="מסגרת" current={tf} options={TF_OPTIONS} onChange={changeTf} />
        <Dropdown label="טווח" current={days} options={RANGES_BY_TF[tf]} onChange={setDays} />
        <Dropdown label="סוג גרף" current={type} options={TYPE_OPTIONS} onChange={setType} />
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