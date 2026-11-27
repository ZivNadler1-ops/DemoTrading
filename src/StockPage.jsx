import { useEffect, useRef, useState } from 'react';
import { createChart, LineSeries } from 'lightweight-charts';
import TradePanel from './TradePanel';
import { NAMES } from './Market';

export default function StockPage({ symbol, quote, history, userId, onBack, onTraded }) {
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [tradeOpen, setTradeOpen] = useState(false);

  useEffect(() => {
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 420,
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
    seriesRef.current?.setData((history || []).map((p) => ({ time: p.time, value: p.value })));
    const up = quote ? quote.change >= 0 : true;
    seriesRef.current?.applyOptions({ color: up ? '#22c55e' : '#ef4444' });
  }, [history, quote]);

  return (
    <div>
      <button className="back" onClick={onBack}>חזרה לשוק</button>

      <div className="stock-head">
        <h2>
          {NAMES[symbol]} ({symbol})
        </h2>
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

      <div ref={chartRef} dir="ltr" className="chart" />
      <p className="note">
        הגרף מתעדכן כל 15 שניות, ומתחיל ברגע שפתחת את הדף. מחוץ לשעות המסחר של ארה"ב המחירים לא מתעדכנים.
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