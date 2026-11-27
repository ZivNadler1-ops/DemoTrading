import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

const START = 300000;

const money = (n) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Dashboard({ quotes, userId }) {
  const [cash, setCash] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    async function load() {
      const { data: acc, error: e1 } = await supabase
        .from('accounts')
        .select('cash')
        .eq('user_id', userId)
        .maybeSingle();
      const { data: hold, error: e2 } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', userId)
        .gt('shares', 0);

      if (e1 || e2) setErr('לא הצלחנו לטעון את הנתונים');
      setCash(acc ? Number(acc.cash) : null);
      setHoldings(hold || []);
      setLoaded(true);
    }
    load();
  }, [userId]);

  if (!loaded) return <p className="note">טוען נתונים...</p>;
  if (err) return <p className="error">{err}</p>;
  if (cash === null) return <p className="error">החשבון שלך עדיין לא נוצר. נסה להתנתק ולהתחבר שוב.</p>;

  const rows = holdings.map((h) => {
    const price = quotes[h.symbol]?.price ?? Number(h.avg_price);
    const value = Number(h.shares) * price;
    const cost = Number(h.shares) * Number(h.avg_price);
    return { ...h, price, value, cost, pnl: value - cost };
  });

  const holdingsValue = rows.reduce((s, r) => s + r.value, 0);
  const total = cash + holdingsValue;
  const totalPnl = total - START;
  const totalPct = (totalPnl / START) * 100;

  return (
    <>
      <div className="cards">
        <div className="card">
          <span>שווי תיק כולל</span>
          <strong>{money(total)}</strong>
        </div>
        <div className="card">
          <span>מזומן זמין</span>
          <strong>{money(cash)}</strong>
        </div>
        <div className="card">
          <span>רווח/הפסד כולל</span>
          <strong className={totalPnl >= 0 ? 'pos' : 'neg'}>
            {totalPnl >= 0 ? '+' : ''}
            {money(totalPnl)} ({totalPct.toFixed(2)}%)
          </strong>
        </div>
        <div className="card">
          <span>מושקע בנכסים</span>
          <strong>{money(holdingsValue)}</strong>
        </div>
      </div>

      <section className="panel">
        <h2>ההחזקות שלי</h2>
        {rows.length === 0 ? (
          <p className="note">אין החזקות עדיין. עבור לשוק כדי לבצע עסקה ראשונה.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>מניה</th>
                <th>כמות</th>
                <th>מחיר ממוצע</th>
                <th>מחיר נוכחי</th>
                <th>שווי</th>
                <th>רווח/הפסד</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol}>
                  <td>{r.symbol}</td>
                  <td>{Number(r.shares)}</td>
                  <td>{money(r.avg_price)}</td>
                  <td>{money(r.price)}</td>
                  <td>{money(r.value)}</td>
                  <td className={r.pnl >= 0 ? 'pos' : 'neg'}>
                    {r.pnl >= 0 ? '+' : ''}
                    {money(r.pnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}