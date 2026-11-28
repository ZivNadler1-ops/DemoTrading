import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, BarSeries, LineSeries, AreaSeries } from 'lightweight-charts';
import TradePanel from './TradePanel';
import { NAMES } from './Market';

const TF_OPTIONS = [
  { value: '1Min', label: 'דקה' },
  { value: '5Min', label: '5 דקות' },
  { value: '15Min', label: '15 דקות' },
  { value: '1Hour', label: 'שעה' },
  { value: '1Day', label: 'יום' },
  { value: '1Week', label: 'שבוע' },
  { value: '1Month', label: 'חודש' },
];

const INTRADAY = ['1Min', '5Min', '15Min', '1Hour'];

const RANGES_BY_TF = {
  '1Min': [{ value: 1, label: 'יום' }],
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

function fmtTime(seconds, intraday) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(seconds * 1000));
  const get = (k) => parts.find((p) => p.type === k)?.value;
  const date = `${get('day')}.${get('month')}`;
  if (intraday) return `${date} ${get('hour')}:${get('minute')}`;
  return `${date}.${get('year')}`;
}

function toData(bars, type) {
  if (type === 'line' || type === 'area') {
    return bars.map((b) => ({ time: b.time, value: b.c }));
  }
  return bars.map((b) => ({ time: b.time, open: b.o, high: b.h, low: b.l, close: b.c }));
}

function makeSeries(chart, type) {
  const up = '#22c55e';
  const down = '#ef4444';
  if (type === 'candle') {
    return chart.addSeries(CandlestickSeries, {
      upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down,
    });
  }
  if (type === 'bar') {
    return chart.addSeries(BarSeries, { upColor: up, downColor: down });
  }
  if (type === 'line') {
    return chart.addSeries(LineSeries, { color: up, lineWidth: 2 });
  }
  return chart.addSeries(AreaSeries, {
    lineColor: up, topColor: 'rgba(34,197,94,0.25)', bottomColor: 'rgba(34,197,94,0)',
  });
}

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
  const lastBarRef = useRef(null);
  const liveRef = useRef(null);

  const [tf, setTf] = useState('1Day');
  const [days, setDays] = useState(365);
  const [type, setType] = useState('candle');
  const [tradeOpen, setTradeOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function changeTf(next) {
    setTf(next);
    const list = RANGES_BY_TF[next];
    if (!list.some((r) => r.value === days)) {
      setDays(list[list.length - 1].value);
    }
  }

  // בנייה מחדש של הגרף בכל שינוי מניה, מסגרת, טווח או סוג
  useEffect(() => {
    let cancelled = false;
    let bars = [];
    let oldestReached = false;
    let loadingMore = false;
    const intraday = INTRADAY.includes(tf);
    liveRef.current = null;
    lastBarRef.current = null;

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 440,
      handleScroll: false,
      handleScale: false,
      layout: { background: { color: '#0b0f14' }, textColor: '#8a94a6' },
      grid: { vertLines: { color: '#161c26' }, horzLines: { color: '#161c26' } },
      rightPriceScale: { borderColor: '#1f2733' },
      localization: { timeFormatter: (t) => fmtTime(t, intraday) },
      timeScale: {
        borderColor: '#1f2733',
        timeVisible: intraday,
        secondsVisible: false,
        rightOffset: 2,
        fixRightEdge: true,
        tickMarkFormatter: (t) => fmtTime(t, intraday),
      },
    });
    const series = makeSeries(chart, type);
    chartObj.current = chart;
    seriesRef.current = series;

    const resize = () => chart.applyOptions({ width: chartRef.current.clientWidth });
    window.addEventListener('resize', resize);

    setLoading(true);
    fetch(`/api/candles?symbol=${symbol}&tf=${tf}&days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        bars = data;
        series.setData(toData(bars, type));
        chart.timeScale().fitContent();
        lastBarRef.current = bars[bars.length - 1] || null;
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    chart.timeScale().subscribeVisibleLogicalRangeChange(async (range) => {
      if (cancelled || !range || bars.length === 0 || loadingMore || oldestReached) return;
      if (range.from > 15) return;
      loadingMore = true;
      try {
        const r = await fetch(
          `/api/candles?symbol=${symbol}&tf=${tf}&days=${days}&before=${bars[0].time}`
        );
        const older = await r.json();
        if (cancelled || !Array.isArray(older)) return;
        const seen = new Set(bars.map((b) => b.time));
        const fresh = older.filter((b) => !seen.has(b.time));
        if (fresh.length === 0) {
          oldestReached = true;
          return;
        }
        const added = fresh.length;
        bars = [...fresh, ...bars];
        series.setData(toData(bars, type));
        chart.timeScale().setVisibleLogicalRange({
          from: range.from + added,
          to: range.to + added,
        });
      } catch {
        // שגיאה שקטה: אפשר לגלול שוב כדי לנסות
      } finally {
        loadingMore = false;
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener('resize', resize);
      chart.remove();
      chartObj.current = null;
      seriesRef.current = null;
    };
  }, [symbol, tf, days, type]);

  // עדכון הנר האחרון לפי המחיר החי
  useEffect(() => {
    const s = seriesRef.current;
    const last = lastBarRef.current;
    if (!s || !quote || !last) return;
    const price = quote.price;
    const isLine = type === 'line' || type === 'area';

    if (tf === '1Min') {
      const minute = Math.floor(Date.now() / 60000) * 60;
      const prev = liveRef.current;
      let cur;
      if (prev && prev.time === minute) {
        cur = {
          ...prev,
          high: Math.max(prev.high, price),
          low: Math.min(prev.low, price),
          close: price,
        };
      } else {
        const open = prev ? prev.close : last.c;
        cur = {
          time: minute,
          open,
          high: Math.max(open, price),
          low: Math.min(open, price),
          close: price,
        };
      }
      liveRef.current = cur;
      if (isLine) {
        s.update({ time: cur.time, value: cur.close });
      } else {
        s.update(cur);
      }
      return;
    }

    if (isLine) {
      s.update({ time: last.time, value: price });
    } else {
      s.update({
        time: last.time,
        open: last.o,
        high: Math.max(last.h, price),
        low: Math.min(last.l, price),
        close: price,
      });
    }
  }, [quote, tf, type, symbol, days]);

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