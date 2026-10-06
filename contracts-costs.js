'use strict';
function toMonthly(amt, iv) {
  if (!amt) return 0;
  const a = Number(amt);
  switch (iv) {
    case 'monatlich': return a;
    case '4-wöchentlich': return a * 13 / 12;
    case 'quartalsweise': return a / 3;
    case 'halbjährlich': return a / 6;
    case 'jährlich': return a / 12;
    default: return a;
  }
}
function myShare(c, amt, viewMode) {
  // viewMode 'gesamt' zeigt immer Vollpreis, 'anteil' (default) zeigt meinen Anteil
  if (viewMode === 'gesamt') return amt;
  return c.ownership === 'shared' ? amt * (settings.splitPct / 100) : amt;
}
function effectiveMonthly(c, viewMode, at = new Date()) {
  const base = toMonthly(c.cost, c.interval);
  const extra = c.extraCost && c.extraInterval !== 'einmalig' ? toMonthly(c.extraCost, c.extraInterval) : 0;
  let inFree = false;
  if (c.freeMonths && c.startDate) { const fe = new Date(c.startDate); fe.setMonth(fe.getMonth() + Number(c.freeMonths)); inFree = at < fe; }
  let disc = 0;
  if (c.discount && c.discountMonths && c.startDate) {
    const de = new Date(c.startDate); de.setMonth(de.getMonth() + Number(c.freeMonths || 0) + Number(c.discountMonths));
    if (at < de) disc = Number(c.discount);
  }
  const raw = inFree ? extra : Math.max(0, base - disc) + extra;
  return myShare(c, raw, viewMode);
}
function averageMonthly(c, viewMode) {
  const base = toMonthly(c.cost, c.interval);
  const extra = c.extraCost && c.extraInterval !== 'einmalig' ? toMonthly(c.extraCost, c.extraInterval) : 0;
  const free = Number(c.freeMonths || 0), disc = Number(c.discount || 0), discMo = Number(c.discountMonths || 0);
  let total = 0;
  for (let m = 0; m < 12; m++) {
    const isFree = m < free, hasDisc = m >= free && m < free + discMo;
    total += (isFree ? 0 : hasDisc ? Math.max(0, base - disc) : base) + extra;
  }
  return myShare(c, total / 12, viewMode);
}

