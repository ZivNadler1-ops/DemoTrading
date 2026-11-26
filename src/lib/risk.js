export function calcPosition({ price, budget, stopPct, rr }) {
  if (!price || price <= 0 || !budget || budget <= 0 || !stopPct || stopPct <= 0 || stopPct >= 1) {
    return null;
  }
  const stop = price * (1 - stopPct);
  const riskPerShare = price - stop;
  const shares = Math.floor(budget / riskPerShare);
  if (shares < 1) {
    return { error: 'התקציב קטן מדי למניה הזו' };
  }
  const take = price + riskPerShare * rr;
  return {
    shares,
    stop,
    take,
    positionValue: shares * price,
    maxLoss: shares * riskPerShare,
    maxGain: shares * riskPerShare * rr,
  };
}