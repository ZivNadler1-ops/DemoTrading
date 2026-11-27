import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export const SYMBOLS = ['NVDA', 'AMD', 'AVGO', 'MU', 'INTC'];
export const NAMES = { NVDA: 'אנבידיה', AMD: 'AMD', AVGO: 'ברודקום', MU: 'מיקרון', INTC: 'אינטל' };

export function isMarketOpen() {
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = ny.getDay();
  const mins = ny.getHours() * 60 + ny.getMinutes();
  return day >= 1 && day <= 5 && mins >= 570 && mins < 960;
}

export default function Market({ quotes, onOpen }) {
  const headerRef = useRef(null);
  const open = isMarketOpen();

  useEffect(() => {
    gsap.from(headerRef.current, { opacity: 0, y: -12, duration: 0.5, ease: 'power2.out' });
  }, []);

  return (
    <>
      <header className="top" ref={headerRef}>
        <h1>שוק</h1>
        <span className={open ? 'status open' : 'status closed'}>
          {open ? 'השוק פתוח' : 'השוק סגור'}
        </span>
      </header>
      <div className="tabs">
        {SYMBOLS.map((s) => {
          const x = quotes[s];
          return (
            <button key={s} className="tab" onClick={() => onOpen(s)}>
              <span className="tab-name">
                {NAMES[s]} <small>{s}</small>
              </span>
              {x && <strong>${x.price.toFixed(2)}</strong>}
              {x && <em className={x.change >= 0 ? 'pos' : 'neg'}>{x.changePct.toFixed(2)}%</em>}
            </button>
          );
        })}
      </div>
    </>
  );
}