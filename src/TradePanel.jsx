import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export default function TradePanel({ symbol, name, quote, userId, onClose, onTraded }) {
  const [side, setSide] = useState('buy');
  const [shares, setShares] = useState(1);
  const [stop, setStop] = useState('');
  const [take, setTake] = useState('');
  const [cash, setCash] = useState(0);
  const [held, setHeld] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const price = quote?.price || 0;
  const qty = Math.max(0, Number(shares) || 0);
  const value = qty * price;

  useEffect(() => {
    async function load() {
      const { data: acc } = await supabase
        .from('accounts').select('cash').eq('user_id', userId).maybeSingle();
      const { data: h } = await supabase
        .from('holdings').select('shares').eq('user_id', userId).eq('symbol', symbol).maybeSingle();
      setCash(acc ? Number(acc.cash) : 0);
      setHeld(h ? Number(h.shares) : 0);
    }
    load();
  }, [userId, symbol]);

  function validate() {
    const s = Number(stop) || null;
    const t = Number(take) || null;
    if (!price) return 'אין מחיר עדכני כרגע';
    if (qty <= 0) return 'הכמות חייבת להיות גדולה מ-0';
    if (side === 'buy' && value > cash) return 'אין מספיק מזומן לעסקה הזו';
    if (side === 'sell' && qty > held) return 'אין לך מספיק מניות למכירה';
    if (s !== null && (side === 'buy' ? s >= price : s <= price)) {
      return side === 'buy' ? 'סטופ-לוס לקנייה חייב להיות מתחת למחיר' : 'סטופ-לוס למכירה חייב להיות מעל המחיר';
    }
    if (t !== null && (side === 'buy' ? t <= price : t >= price)) {
      return side === 'buy' ? 'טייק-פרופיט לקנייה חייב להיות מעל המחיר' : 'טייק-פרופיט למכירה חייב להיות מתחת למחיר';
    }
    return '';
  }

  function askConfirm() {
    const v = validate();
    setError(v);
    if (!v) setConfirming(true);
  }

  async function execute() {
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('place_trade', {
      p_symbol: symbol,
      p_side: side,
      p_shares: qty,
      p_price: price,
      p_stop: Number(stop) || null,
      p_take: Number(take) || null,
    });
    setBusy(false);
    setConfirming(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    onTraded?.();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="trade-panel" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{name} ({symbol})</h3>
          <button className="back" onClick={onClose}>סגור</button>
        </header>

        {done ? (
          <>
            <p className="ok">העסקה בוצעה בהצלחה.</p>
            <button className="submit" onClick={onClose}>סגור</button>
          </>
        ) : (
          <>
            <div className="seg">
              <button className={side === 'buy' ? 'on-buy' : ''} onClick={() => setSide('buy')}>קנה</button>
              <button className={side === 'sell' ? 'on-sell' : ''} onClick={() => setSide('sell')}>מכור</button>
            </div>

            <div className="qty">
              <button onClick={() => setShares(Math.max(1, qty - 1))}>−</button>
              <input type="number" min="1" value={shares} onChange={(e) => setShares(e.target.value)} />
              <button onClick={() => setShares(qty + 1)}>+</button>
            </div>

            <div className="info">
              <div><span>מחיר נוכחי</span><strong>${price.toFixed(2)}</strong></div>
              <div><span>שווי העסקה</span><strong>${value.toFixed(2)}</strong></div>
              {side === 'buy' ? (
                <div><span>מזומן זמין</span><strong>${cash.toFixed(2)}</strong></div>
              ) : (
                <div><span>מניות שבידך</span><strong>{held}</strong></div>
              )}
            </div>

            <label className="field">
              סטופ-לוס (אופציונלי, במחיר)
              <input type="number" step="0.01" value={stop} onChange={(e) => setStop(e.target.value)} />
            </label>
            <label className="field">
              טייק-פרופיט (אופציונלי, במחיר)
              <input type="number" step="0.01" value={take} onChange={(e) => setTake(e.target.value)} />
            </label>

            {error && <p className="error">{error}</p>}

            {!confirming ? (
              <button className="submit" onClick={askConfirm}>בצע הזמנה</button>
            ) : (
              <div className="confirm">
                <span>
                  {side === 'buy' ? 'לקנות' : 'למכור'} {qty} מניות של {symbol} במחיר ${price.toFixed(2)}
                  {' '}(סה"כ ${value.toFixed(2)})?
                </span>
                <div className="row-btns">
                  <button className="ghost" onClick={() => setConfirming(false)}>ביטול</button>
                  <button onClick={execute} disabled={busy}>{busy ? 'מבצע...' : 'אישור'}</button>
                </div>
              </div>
            )}

            <p className="note">
              סטופ-לוס וטייק-פרופיט נשמרים עם העסקה כיעדים. ביצוע אוטומטי שלהם יתווסף בשלב הבא.
            </p>
          </>
        )}
      </div>
    </div>
  );
}