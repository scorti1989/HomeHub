'use strict';
// CONTRACT HELPERS
// ════════════════════════════════════════════

// Wandelt Kündigungsfrist in Tage um
function cancelValToDays(c) {
  const val = Number(c.cancelVal || c.cancelDays || 0);
  const unit = c.cancelUnit || 'tage';
  if (unit === 'monate') return val * 30;
  if (unit === 'wochen') return val * 7;
  return val; // tage
}

// Berechnet das nächste gültige Kündigungszieldatum nach der Bedingung
function nextCancelTarget(c, fromDate) {
  const cond = c.cancelCond || 'jederzeit';
  const base = fromDate ? new Date(fromDate) : new Date();
  if (cond === 'jederzeit') return null;
  if (cond === 'vertragsende' || cond === 'vertragslaufzeit') {
    return c.endDate ? new Date(c.endDate) : null;
  }
  if (cond === 'monatsende') {
    const d = new Date(base); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(0);
    return d;
  }
  if (cond === 'quartalsende') {
    const d = new Date(base);
    const q = Math.floor(d.getMonth() / 3);
    d.setMonth((q + 1) * 3, 0);
    if (d <= base) d.setMonth(d.getMonth() + 3 + 1, 0);
    return d;
  }
  if (cond === 'jahresende') {
    const d = new Date(base.getFullYear(), 11, 31);
    if (d <= base) return new Date(base.getFullYear() + 1, 11, 31);
    return d;
  }
  return null;
}

// Gibt das späteste Datum zurück, an dem gekündigt werden muss.
// Bei "jederzeit" immer null → keine Ampel-Warnung.
function latestCancelDate(c) {
  const cond = c.cancelCond || 'jederzeit';

  // Jederzeit kündbar → keine Frist, keine Warnung
  if (cond === 'jederzeit') return null;

  const fristTage = cancelValToDays(c);
  const target = nextCancelTarget(c);

  if (target) {
    // BUGFIX 4: use localDateStr instead of toISOString()
    const deadline = new Date(target);
    deadline.setDate(deadline.getDate() - fristTage);
    return localDateStr(deadline);
  }

  // Fallback: altes Verhalten mit endDate
  if (!c.endDate || !fristTage) return null;
  const d = new Date(c.endDate);
  d.setDate(d.getDate() - fristTage);
  return localDateStr(d);
}

function trafficLight(c) {
  const cd = latestCancelDate(c);
  if (!cd) return 'green';
  const days = diffDays(cd);
  if (days === null) return 'green';
  if (days < 0) return 'red';
  if (days <= 30) return 'red';
  if (days <= 60) return 'yellow';
  return 'green';
}

// Berechnet den Hinweistext zum Kündigungsdatum für die Vorschau im Modal
function buildCancelPreview(startDate, endDate, cancelVal, cancelUnit, cancelCond, minTermMonths) {
  const frist = Number(cancelVal || 0);
  const cond = cancelCond || 'jederzeit';
  const unitLabel = { tage: 'T', wochen: 'W', monate: 'Mo.' }[cancelUnit || 'tage'];
  if (!frist && cond === 'jederzeit') return '';

  const fristTage = cancelUnit === 'monate' ? frist * 30 : cancelUnit === 'wochen' ? frist * 7 : frist;
  const condLabel = { jederzeit:'Jederzeit', vertragsende:'zum Vertragsende', quartalsende:'zum Quartalsende', monatsende:'zum Monatsende', jahresende:'zum Jahresende', vertragslaufzeit:'zum Ende der Laufzeit' }[cond] || cond;

  let deadlineStr = '';
  if (cond !== 'jederzeit' && endDate) {
    const target = new Date(endDate);
    const deadline = new Date(target);
    deadline.setDate(deadline.getDate() - fristTage);
    // BUGFIX 4: use localDateStr
    deadlineStr = ` → Kündigung bis ${fmtDate(localDateStr(deadline))}`;
  }

  let mintermStr = '';
  if (minTermMonths && startDate) {
    const me = new Date(startDate);
    me.setMonth(me.getMonth() + Number(minTermMonths));
    // BUGFIX 4: use localDateStr
    mintermStr = ` · Bindung bis ${fmtDate(localDateStr(me))}`;
  }

  return `${frist}${unitLabel} Frist · ${condLabel}${deadlineStr}${mintermStr}`;
}

// ════════════════════════════════════════════
// COST CALCULATIONS
// ════════════════════════════════════════════
// ── Vertragsstatus-Klassifizierung ──
// Ein Vertrag gilt als "archiviert" wenn:
// a) er manuell als gekündigt markiert wurde UND das Wirksamkeitsdatum in der Vergangenheit liegt
// b) das Vertragsende in der Vergangenheit liegt (abgelaufen)
function isContractExpired(c) {
  if (!c.endDate) return false;
  return diffDays(c.endDate) !== null && diffDays(c.endDate) < 0;
}
function isContractCancelled(c) {
  return c.cancelledStatus === true;
}
function isContractArchived(c) {
  // Abgelaufen
  if (isContractExpired(c)) return true;
  // Manuell gekündigt UND Wirksamkeitsdatum vergangen
  if (isContractCancelled(c) && c.cancelledUntil) {
    return diffDays(c.cancelledUntil) !== null && diffDays(c.cancelledUntil) < 0;
  }
  return false;
}

function updateCostPreview() {
  const cost = parseDE(document.getElementById('f-cost').value);
  const iv = document.getElementById('f-interval').value;
  const ec = parseDE(document.getElementById('f-extracost').value);
  const ei = document.getElementById('f-extrainterval').value;
  const disc = parseDE(document.getElementById('f-discount').value);
  const discMo = parseInt(document.getElementById('f-discountmonths').value) || 0;
  const free = parseInt(document.getElementById('f-freemonths').value) || 0;
  const box = document.getElementById('costPreview');
  if (!cost && !ec) { box.style.display = 'none'; return; }
  const base = toMonthly(cost, iv), extraM = ei !== 'einmalig' ? toMonthly(ec, ei) : 0, oneOff = ei === 'einmalig' ? ec : 0;
  let rows = '';
  if (free > 0) rows += `<div>Monate 1–${free} (Gratis): ${fmtEurPlain(extraM)}/Mo</div>`;
  if (disc > 0 && discMo > 0) rows += `<div>Monate ${free + 1}–${free + discMo} (Rabatt): ${fmtEurPlain(Math.max(0, base - disc) + extraM)}/Mo</div>`;
  rows += `<div>Normalpreis: ${fmtEurPlain(base + extraM)}/Mo</div>`;
  if (oneOff > 0) rows += `<div>Einmalig: ${fmtEurPlain(oneOff)}</div>`;
  let yr = free * (extraM) + Math.min(discMo, Math.max(0, 12 - free)) * (Math.max(0, base - disc) + extraM) + Math.max(0, 12 - free - discMo) * (base + extraM) + oneOff;
  box.style.display = 'block';
  box.innerHTML = `<strong style="color:var(--accent)">Kostenvorschau</strong>${rows}<div style="border-top:1px solid #b7e4c7;margin-top:5px;padding-top:5px;font-weight:700">Jahr 1: ${fmtEurPlain(yr)}</div>`;
}

// Wire cost preview inputs
['f-cost', 'f-interval', 'f-extracost', 'f-extrainterval', 'f-discount', 'f-discountmonths', 'f-freemonths'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateCostPreview);
});

// Live-Vorschau für Kündigungsdatum & Mindestlaufzeit
function updateCancelPreview() {
  const startDate = document.getElementById('f-start').value;
  const endDate   = document.getElementById('f-end').value;
  const val       = document.getElementById('f-cancelval').value;
  const unit      = document.getElementById('f-cancelunit').value;
  const cond      = document.getElementById('f-cancelcond').value;
  const minTerm   = document.getElementById('f-minterm').value;

  // Kündigungsvorschau
  const prev = document.getElementById('cancelDatePreview');
  if (prev) prev.textContent = buildCancelPreview(startDate, endDate, val, unit, cond, minTerm);

  // Mindestlaufzeit-Hinweis
  const hint = document.getElementById('mintermHint');
  if (hint && minTerm && startDate) {
    const me = new Date(startDate);
    me.setMonth(me.getMonth() + Number(minTerm));
    // BUGFIX 4: use localDateStr
    hint.textContent = `Frühestmögliches Vertragsende: ${fmtDate(localDateStr(me))}`;
  } else if (hint) {
    hint.textContent = '';
  }
}
['f-start','f-end','f-cancelval','f-cancelunit','f-cancelcond','f-minterm'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', updateCancelPreview);
  if (el) el.addEventListener('input', updateCancelPreview);
});

// ════════════════════════════════════════════
