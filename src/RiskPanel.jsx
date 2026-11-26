import { useState } from 'react';
import { calcPosition } from './lib/risk';

export default function RiskPanel({ symbol, price }) {
  const [budget, setBudget] = useState(500);
  const [stopPct, setStopPct] = useState(8);
  const [rr, setRr] = useState(2);

  const result = calcPosition({
    price,
    budget: Number(budget),
    stopPct: Number(stopPct) / 100,
    rr: Number(rr),
  });

  return (
    <section className="panel risk">
      <h2>מחשבון סיכון ({symbol})</h2>
      <div className="risk-inputs">
        <label>
          תקציב הפסד מקסימלי ($)
          <input type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </label>
        <label>
          סטופ-לוס (%)
          <input type="number" min="1" max="50" step="0.5" value={stopPct} onChange={(e) => setStopPct(e.target.value)} />
        </label>
        <label>
          יחס סיכוי לסיכון (1 ל-)
          <input type="number" min="1" max="10" step="0.5" value={rr} onChange={(e) => setRr(e.target.value)} />
        </label>
      </div>

      {!price && <p className="note">ממתין למחיר...</p>}
      {result && result.error && <p className="error">{result.error}</p>}
      {result && !result.error && (
        <div className="risk-out">
          <div><span>כמות מניות</span><strong>{result.shares}</strong></div>
          <div><span>שווי פוזיציה</span><strong>${result.positionValue.toFixed(2)}</strong></div>
          <div><span>סטופ-לוס</span><strong className="neg">${result.stop.toFixed(2)}</strong></div>
          <div><span>טייק-פרופיט</span><strong className="pos">${result.take.toFixed(2)}</strong></div>
          <div><span>הפסד מקסימלי</span><strong className="neg">-${result.maxLoss.toFixed(2)}</strong></div>
          <div><span>רווח יעד</span><strong className="pos">+${result.maxGain.toFixed(2)}</strong></div>
        </div>
      )}
      <p className="note">סימולציה בלבד. קבע את הסטופ לפני הכניסה, ואל תשנה אותו אחרי שנפתחה העסקה.</p>
    </section>
  );
}