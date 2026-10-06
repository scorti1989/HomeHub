'use strict';
// METERS
// ════════════════════════════════════════════
// ════════════════════════════════════════════
// ENERGIE-BERECHNUNGS-ENGINE
// ════════════════════════════════════════════

const SEASON_WEIGHTS = {
  gas:    [16,14,12,8,4,2,1,1,3,7,13,19],
  strom:  [9,8,8,8,8,8,8,8,8,8,9,10],
  wasser: [1,1,1,1,1,1,1,1,1,1,1,1]
};

function getMeterReadingsInPeriod(readings, fromDate, toDate) {
  return (readings || []).filter(r => r.date >= fromDate && r.date <= toDate)
    .slice().sort((a, b) => a.date.localeCompare(b.date));
}

function interpolateReadingAtDate(readings, targetDate) {
  const sorted = (readings || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return null;
  const exact = sorted.find(r => r.date === targetDate);
  if (exact) return exact.value;
  if (targetDate <= sorted[0].date) return sorted[0].value;
  if (targetDate >= sorted[sorted.length-1].date) return sorted[sorted.length-1].value;
  let before = null, after = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].date <= targetDate && sorted[i+1].date >= targetDate) { before = sorted[i]; after = sorted[i+1]; break; }
  }
  if (!before || !after) return null;
  const [by,bm,bd] = before.date.split('-').map(Number);
  const [ay,am,ad] = after.date.split('-').map(Number);
  const [ty,tm,td] = targetDate.split('-').map(Number);
  const totalDays   = (new Date(ay,am-1,ad) - new Date(by,bm-1,bd)) / 86400000;
  const elapsedDays = (new Date(ty,tm-1,td) - new Date(by,bm-1,bd)) / 86400000;
  if (totalDays <= 0) return before.value;
  return before.value + (after.value - before.value) * (elapsedDays / totalDays);
}

function convertMeterConsumptionToBillingUnit(m3Value, type, gasKwhPerM3) {
  if (type !== 'gas') return m3Value;
  return m3Value * ((gasKwhPerM3 && gasKwhPerM3 > 0) ? gasKwhPerM3 : 10.5);
}

function forecastConsumptionSeasonal(type, consumedMeterUnits, fromDate, toDate, endDate, gasKwhPerM3) {
  const weights = SEASON_WEIGHTS[type] || SEASON_WEIGHTS.wasser;
  const sumAll  = weights.reduce((a,b) => a+b, 0);
  const [fy,fm,fd] = fromDate.split('-').map(Number);
  const [ty,tm,td] = toDate.split('-').map(Number);
  const totalDays = Math.max(1, Math.round((new Date(ty,tm-1,td) - new Date(fy,fm-1,fd)) / 86400000));
  if (totalDays < 1 || consumedMeterUnits <= 0) return null;

  function weightForPeriod(from, to) {
    const [fy2,fm2,fd2] = from.split('-').map(Number);
    const [ty2,tm2,td2] = to.split('-').map(Number);
    let total = 0, d = new Date(fy2,fm2-1,1);
    const endD = new Date(ty2,tm2-1,1);
    while (d <= endD) {
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd   = new Date(d.getFullYear(), d.getMonth()+1, 0);
      const pStart = new Date(fy2,fm2-1,fd2), pEnd = new Date(ty2,tm2-1,td2);
      const oStart = pStart > mStart ? pStart : mStart;
      const oEnd   = pEnd   < mEnd   ? pEnd   : mEnd;
      const mDays  = (mEnd - mStart) / 86400000 + 1;
      const ovDays = Math.max(0, (oEnd - oStart) / 86400000 + 1);
      total += weights[d.getMonth()] * (ovDays / mDays);
      d.setMonth(d.getMonth() + 1);
    }
    return total;
  }

  const consumedWeight = weightForPeriod(fromDate, toDate);
  if (consumedWeight <= 0) return null;
  const forecastYearly    = (consumedMeterUnits / consumedWeight) * sumAll;
  const forecastYearlyKwh = convertMeterConsumptionToBillingUnit(forecastYearly, type, gasKwhPerM3);
  const consumedKwh       = convertMeterConsumptionToBillingUnit(consumedMeterUnits, type, gasKwhPerM3);
  let forecastToEnd = null;
  if (endDate && endDate > toDate) {
    forecastToEnd = forecastYearly * (weightForPeriod(toDate, endDate) / sumAll);
  }
  return { forecastYearly, forecastYearlyKwh, consumedMeterUnits, consumedKwh, forecastToEnd };
}

function calculateEnergyContractStats(meter, linkedContractId, opts) {
  // opts.mode: 'real' (default) | 'interpolated' | 'live'
  // 'real'         → nur echte Ablesungen, Analyse endet am Datum der letzten Ablesung
  // 'interpolated' → Startwert wird interpoliert wenn keine exakte Ablesung vorhanden
  // 'live'         → (vorbereitet) würde virtuellen Stand bis heute hochrechnen
  const mode = (opts && opts.mode) || 'real';

  const c  = linkedContractId ? contracts.find(x => x.id === linkedContractId) : null;
  const en = meter.energy || {};
  const readings = (meter.readings || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!readings.length) return null;

  const unitPriceCt = en.unitPrice ?? meter.price ?? null;
  const basePrice   = en.basePriceMonthly || 0;
  const monthlyPay  = en.monthlyPayment   || 0;
  const gasKwhPerM3 = en.gasKwhPerM3      || 10.5;
  const usingDefaultGasFactor = meter.type === 'gas' && !en.gasKwhPerM3;

  const fromDate = en.startDate || c?.startDate || readings[0].date;
  const endDate  = en.endDate   || c?.endDate   || null;

  // ── Basis: letzte echte Ablesung ──────────────────────────────────────
  // Keine Mischung mit today(). Alle Berechnungen enden hier.
  // 'live'-Modus würde hier einen interpolierten Stand bis today() ergänzen.
  const currentReading = readings[readings.length - 1];
  const currentDate    = currentReading.date;   // Datum der letzten echten Ablesung
  const currentValue   = currentReading.value;  // Wert der letzten echten Ablesung

  // toDate = currentDate (nicht today()), damit alle Zeit- und Kostenberechnungen
  // exakt mit den real vorhandenen Messdaten übereinstimmen.
  const toDate = currentDate;
  if(!validDate(fromDate) || !validDate(toDate) || fromDate>=toDate || (endDate && (!validDate(endDate) || endDate<=fromDate))) return {error:"Bitte Startdatum und Ablesedatum prüfen. Für diesen Zeitraum ist keine Energieprognose möglich."};

  // Startwert: explizit gepflegt > interpoliert > erste Ablesung
  let startValue;
  if (en.startReading !== undefined && en.startReading !== null && en.startReading !== '') {
    startValue = Number(en.startReading);
  } else if (mode === 'interpolated' || mode === 'real') {
    startValue = interpolateReadingAtDate(readings, fromDate);
    if (startValue === null) startValue = readings[0].value;
  } else {
    startValue = readings[0].value;
  }

  if (currentValue <= startValue) return null;

  const consumedMeterUnits = currentValue - startValue;
  const consumedKwh        = convertMeterConsumptionToBillingUnit(consumedMeterUnits, meter.type, gasKwhPerM3);

  // Saisonale Prognose – fromDate bis toDate (= letzter echter Messwert)
  const forecast = forecastConsumptionSeasonal(
    meter.type, consumedMeterUnits, fromDate, toDate, endDate, gasKwhPerM3
  );

  // Zeit seit Vertragsstart bis letzter Ablesung (nicht bis heute)
  const [fy,fm,fd2] = fromDate.split('-').map(Number);
  const [cy,cm,cd]  = toDate.split('-').map(Number);
  const daysSoFar   = Math.max(1, Math.round(
    (new Date(cy,cm-1,cd) - new Date(fy,fm-1,fd2)) / 86400000
  ));
  const monthsSoFar = daysSoFar / 30.44;

  // Kosten basieren auf daysSoFar bis zur letzten Ablesung
  const workCostSoFar  = unitPriceCt !== null ? (consumedKwh * unitPriceCt / 100) : null;
  const baseCostSoFar  = basePrice   > 0      ? (basePrice * monthsSoFar)         : 0;
  const totalCostSoFar = workCostSoFar !== null ? (workCostSoFar + baseCostSoFar) : null;
  // Gezahlte Abschläge ebenfalls nur bis zur letzten Ablesung
  const paidSoFar      = monthlyPay   > 0      ? (monthlyPay * monthsSoFar)       : null;

  // Prognose bis Vertragsende (totalMonths = gesamte Vertragslaufzeit)
  let forecastTotalCost = null, forecastTotalConsumption = null;
  let forecastDiff = null, forecastTotalPaid = null;
  if (forecast && endDate) {
    const [ey,em,ed] = endDate.split('-').map(Number);
    const totalDaysContract = Math.max(1, Math.round(
      (new Date(ey,em-1,ed) - new Date(fy,fm-1,fd2)) / 86400000
    ));
    const totalMonths = totalDaysContract / 30.44;
    forecastTotalConsumption = consumedMeterUnits + (forecast.forecastToEnd || 0);
    const totalKwh  = convertMeterConsumptionToBillingUnit(forecastTotalConsumption, meter.type, gasKwhPerM3);
    const workTotal = unitPriceCt !== null ? (totalKwh * unitPriceCt / 100) : null;
    forecastTotalCost = workTotal !== null ? (workTotal + basePrice * totalMonths) : null;
    forecastTotalPaid = monthlyPay > 0     ? (monthlyPay * totalMonths)           : null;
    forecastDiff      = (forecastTotalCost !== null && forecastTotalPaid !== null)
      ? (forecastTotalPaid - forecastTotalCost) : null; // positiv = Guthaben
  }

  // Abschlagsstatus – auf Basis real gemessener Zeitspanne
  let abschlagStatus = null;
  if (totalCostSoFar !== null && paidSoFar !== null && paidSoFar > 0) {
    const ratio = totalCostSoFar / paidSoFar;
    abschlagStatus = ratio < 0.85 ? 'guthaben' : ratio < 1.1 ? 'passt' : 'nachzahlung';
  }

  return {
    // Zeitraum
    fromDate, toDate,         // toDate = letzte echte Ablesung (nicht today())
    endDate, dataMode: mode,  // dataMode für spätere Erweiterung (live/interpolated)
    // Ablesungen
    startValue, currentValue, currentDate,
    // Verbrauch
    consumedMeterUnits, consumedKwh,
    // Tarif
    unitPriceCt, basePrice, monthlyPay,
    // Kosten bis zur letzten Ablesung
    workCostSoFar, baseCostSoFar, totalCostSoFar, paidSoFar,
    // Zeitspanne bis zur letzten Ablesung
    daysSoFar, monthsSoFar,
    // Prognose
    forecast, forecastTotalCost, forecastTotalConsumption,
    forecastDiff, forecastTotalPaid,
    // Status
    abschlagStatus, gasKwhPerM3, usingDefaultGasFactor,
    meterUnit: meter.unit, meterType: meter.type,
    contractName: c?.name || null
  };
}

function renderEnergyCard(stats, meterType) {
  if (!stats) return '';
  if(stats.error)return '<div class="energy-card">'+esc(stats.error)+'</div>';
  const unit    = meterType === 'gas' ? 'm³' : (meterType === 'strom' ? 'kWh' : 'm³');
  const gasFactor = meterType === 'gas'
    ? `<div style="font-size:11px;color:${stats.usingDefaultGasFactor ? '#f4a261' : 'var(--muted)'};margin-bottom:5px">
        ${stats.usingDefaultGasFactor
          ? '⚠ Standard-Faktor 10,5 kWh/m³ verwendet – bitte in Zählereinstellungen anpassen'
          : `Gasfaktor: ${stats.gasKwhPerM3} kWh/m³`}</div>` : '';

  const abschlagHtml = stats.abschlagStatus ? `<div class="abschlag-${
      stats.abschlagStatus === 'guthaben' ? 'ok' : stats.abschlagStatus === 'passt' ? 'warn' : 'crit'}">
    ${stats.abschlagStatus === 'guthaben' ? '🟢 Guthaben wahrscheinlich'
    : stats.abschlagStatus === 'passt'   ? '🟡 Abschlag ungefähr passend'
    :                                      '🔴 Nachzahlung möglich'}
    ${stats.totalCostSoFar !== null ? ` · bisher ${fmtEurPlain(stats.totalCostSoFar)}` : ''}
    ${stats.paidSoFar      !== null ? ` · gezahlt ${fmtEurPlain(stats.paidSoFar)}` : ''}
  </div>` : '';

  const diffHtml = stats.forecastDiff !== null && stats.endDate ? `
    <div style="font-size:11px;color:${stats.forecastDiff >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:600;margin-top:5px">
      ${stats.forecastDiff >= 0
        ? `✅ Voraussichtliches Guthaben: ${fmtEurPlain(stats.forecastDiff)}`
        : `⚠ Voraussichtliche Nachzahlung: ${fmtEurPlain(Math.abs(stats.forecastDiff))}`}
    </div>` : '';

  return `<div class="energy-card ${meterType}">
    <div class="energy-label">${stats.contractName ? '🔗 ' + esc(stats.contractName) : '📊 Energieauswertung'}</div>
    ${gasFactor}
    <div style="font-size:11px;color:var(--muted);margin-bottom:7px">
      ${fmtDate(stats.fromDate)} – ${fmtDate(stats.toDate)} · ${stats.daysSoFar} Tage
      ${stats.toDate < today() ? `<span style="color:#f4a261;font-weight:600"> · Letzte Ablesung ${fmtDate(stats.toDate)}</span>` : ''}
    </div>
    <div class="energy-stat-row">
      <div class="energy-stat">
        <div class="esv">${stats.consumedMeterUnits.toFixed(1)}</div>
        <div class="esl">${unit} verbraucht</div>
      </div>
      ${meterType === 'gas' ? `<div class="energy-stat">
        <div class="esv">${stats.consumedKwh.toFixed(0)}</div>
        <div class="esl">kWh</div>
      </div>` : ''}
      ${stats.forecast ? `<div class="energy-stat">
        <div class="esv">${stats.forecast.forecastYearly.toFixed(0)}</div>
        <div class="esl">${unit}/Jahr ±</div>
      </div>` : ''}
      ${stats.totalCostSoFar !== null ? `<div class="energy-stat">
        <div class="esv" style="font-size:13px">${fmtEurPlain(stats.totalCostSoFar).replace('&nbsp;',' ')}</div>
        <div class="esl">Kosten bisher</div>
      </div>` : ''}
    </div>
    ${abschlagHtml}${diffHtml}
    ${stats.forecastTotalCost && stats.endDate ? `<div style="font-size:11px;color:var(--muted);margin-top:7px;padding-top:7px;border-top:1px solid var(--border)">
      Prognose bis ${fmtDate(stats.endDate)}: <strong>${fmtEurPlain(stats.forecastTotalCost)}</strong>
      · ${(stats.forecastTotalConsumption||0).toFixed(0)} ${unit} gesamt
      ${stats.forecastTotalPaid ? ` · Abschläge: ${fmtEurPlain(stats.forecastTotalPaid)}` : ''}
    </div>` : ''}
  </div>`;
}

// ════════════════════════════════════════════
let activeMeterType = null;

function renderMeters() {
  if (activePage !== 'meters') return;
  const allTypes = ['strom', 'gas', 'wasser'];
  const icons = { strom: '⚡', gas: '🔥', wasser: '💧' };
  document.getElementById('meterTabs').innerHTML = allTypes.map(t => {
    const has = meters.some(m => m.type === t);
    const isAct = activeMeterType === t;
    // Zeige roten Punkt auf Tab wenn Ablesung fällig
    const m = meters.find(x => x.type === t);
    const isDue = m?.nextReading && (() => {
      const days = diffDays(m.nextReading);
      if (days === null || days > 7) return false;
      const readings = (m.readings || []).slice().sort((a, b) => a.date.localeCompare(b.date));
      return !readings.some(r => r.date >= m.nextReading);
    })();
    return has
      ? `<button class="mtab${isAct ? ' active' : ''}" data-mt="${t}" style="position:relative">${icons[t]} ${t.charAt(0).toUpperCase() + t.slice(1)}${isDue ? '<span style="position:absolute;top:4px;right:4px;width:7px;height:7px;border-radius:50%;background:#ef4444;display:block"></span>' : ''}</button>`
      : `<button class="mtab" data-add-meter="${t}" style="border-style:dashed">${icons[t]} + ${t.charAt(0).toUpperCase() + t.slice(1)}</button>`;
  }).join('');
  document.querySelectorAll('[data-mt]').forEach(el => el.addEventListener('click', () => { activeMeterType = el.dataset.mt; renderMeters(); }));
  document.querySelectorAll('[data-add-meter]').forEach(el => el.addEventListener('click', () => openMeterModal(el.dataset.addMeter)));

  // C3: Kompakte Übersicht aller Zähler (letzter Stand) – immer sichtbar
  // BUGFIX: Alten Overview zuerst entfernen (verhindert Duplikate bei erneutem Render)
  const oldOverview = document.getElementById('meterOverviewSummary');
  if (oldOverview) oldOverview.remove();

  const mIcons2 = { strom: '⚡', gas: '🔥', wasser: '💧' };
  const existingMeters = meters.filter(m => (m.readings || []).length > 0);
  if (existingMeters.length > 0) {
    const overviewHtml = `<div id="meterOverviewSummary" class="ct-summary" style="margin-bottom:14px">
      ${existingMeters.map(m => {
        const sorted = [...(m.readings || [])].sort((a,b) => a.date.localeCompare(b.date));
        const last = sorted[sorted.length - 1];
        return `<div class="ct-sum-item">
          <div class="ct-sum-val" style="font-size:14px">${last ? last.value.toLocaleString('de-DE') : '–'} ${m.unit || ''}</div>
          <div class="ct-sum-lbl">${mIcons2[m.type] || '◎'} ${esc(m.name || m.type)}</div>
        </div>`;
      }).join('<div class="ct-sum-divider"></div>')}
    </div>`;
    // Vor meterContent einfügen (innerhalb des Zähler-Containers)
    const mc = document.getElementById('meterContent');
    if (mc) mc.insertAdjacentHTML('beforebegin', overviewHtml);
  }

  if (!activeMeterType || !meters.some(m => m.type === activeMeterType)) {
    document.getElementById('meterContent').innerHTML = `<div class="empty"><div class="ei">⚡</div><p>Wähle oben einen Zählertyp.<br><span class="empty-cta">Strom, Gas oder Wasser – dann erscheinen hier die Ablesungen.</span></p></div>`; return;
  }
  const meter = meters.find(m => m.type === activeMeterType);
  const readings = (meter.readings || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const latest = readings[readings.length - 1];
  const prev = readings[readings.length - 2];

  // ── Letzter Zeitraum (zwischen den zwei neuesten Ablesungen) ──
  const rawDiff = latest && prev ? latest.value - prev.value : null;
  const lastPeriodConsumption = rawDiff !== null && rawDiff >= 0 ? rawDiff : null;

  // ── Jahreshochrechnung: max. 730 Tage (≈ 2 Jahre), Startwert interpoliert ──
  function calcYearEst(rds) {
    if (!rds || rds.length < 2) return null;
    const last = rds[rds.length - 1];
    const [ly, lm, ld] = last.date.split('-').map(Number);
    const lastTs = new Date(ly, lm - 1, ld);

    // Fenster: max. 730 Tage zurück ab letzter Ablesung
    const MAX_DAYS = 730;
    const windowStart = new Date(lastTs);
    windowStart.setDate(windowStart.getDate() - MAX_DAYS);
    const windowStartStr = `${windowStart.getFullYear()}-${_pad(windowStart.getMonth()+1)}-${_pad(windowStart.getDate())}`;

    // Startpunkt: älteste Ablesung oder Beginn des Fensters (interpoliert)
    let firstValue, firstDateStr;
    const oldest = rds[0];
    if (oldest.date >= windowStartStr) {
      // Alle Daten liegen innerhalb des Fensters → gesamten Zeitraum nutzen
      firstValue   = oldest.value;
      firstDateStr = oldest.date;
    } else {
      // Daten älter als 730 Tage → Startwert am Fensterstart interpolieren
      const interpolated = interpolateReadingAtDate(rds, windowStartStr);
      if (interpolated === null) return null;
      firstValue   = interpolated;
      firstDateStr = windowStartStr;
    }

    const verbrauch = last.value - firstValue;
    if (verbrauch <= 0) return null;
    const [fy, fm, fd] = firstDateStr.split('-').map(Number);
    const tage = Math.round((lastTs - new Date(fy, fm - 1, fd)) / 86400000);
    if (tage <= 0) return null;
    return (verbrauch / tage) * 365;
  }

  const yearEst = calcYearEst(readings);

  // ── Kostenhochrechnung: Gas m³ → kWh; alle Typen + Grundpreis ──
  function calcCostEst(yearEstM3OrKwh) {
    if (yearEstM3OrKwh === null) return null;
    const gasKwhPerM3 = meter.energy?.gasKwhPerM3 || 10.5;
    const unitPrice   = meter.energy?.unitPrice ?? meter.price;   // ct/kWh (oder ct/m³ für Wasser)
    const baseMonthly = meter.energy?.basePriceMonthly || 0;       // €/Mo
    if (!unitPrice) return null;

    let jahresKwh;
    if (meter.type === 'gas') {
      // Gas: m³/Jahr → kWh/Jahr → € (Arbeitspreis in ct/kWh)
      jahresKwh = yearEstM3OrKwh * gasKwhPerM3;
    } else {
      // Strom (kWh) oder Wasser (m³ mit eigenem Preis)
      jahresKwh = yearEstM3OrKwh;
    }

    const arbeitspreis = jahresKwh * unitPrice / 100;   // ct → €
    const grundpreis   = baseMonthly * 12;               // €/Jahr
    return (arbeitspreis + grundpreis).toFixed(0);
  }

  const costEst = calcCostEst(yearEst);

  // Info: wird Gas über Brennwert umgerechnet?
  const gasKwhInfo = meter.type === 'gas' && yearEst !== null
    ? (() => {
        const f = meter.energy?.gasKwhPerM3 || 10.5;
        const using = meter.energy?.gasKwhPerM3 ? '' : ' (Standard)';
        return `${(yearEst * f).toFixed(0)} kWh/Jahr · Faktor ${f} kWh/m³${using}`;
      })()
    : null;

  // ── Messzeitraum-Info für Anzeige ──
  let zeitraumInfo = '';
  if (readings.length >= 2) {
    const first = readings[0], last = readings[readings.length - 1];
    const [fy, fm, fd] = first.date.split('-').map(Number);
    const [ly, lm, ld] = last.date.split('-').map(Number);
    const tage = Math.round((new Date(ly, lm - 1, ld) - new Date(fy, fm - 1, fd)) / 86400000);
    const genutzteTage = Math.min(tage, 730);
    zeitraumInfo = `<div style="font-size:10px;color:var(--muted);text-align:center;margin-top:3px">
      Messzeitraum: ${fmtDate(first.date)} – ${fmtDate(last.date)} (${tage} Tage${tage > 730 ? ', Hochrechnung nutzt letzten 2 Jahre' : ''})
      ${gasKwhInfo ? `<br>${gasKwhInfo}` : ''}
    </div>`;
  }

  // ── Plausibilitätsprüfung ──
  let plausWarn = '';
  if (rawDiff !== null && rawDiff < 0) {
    plausWarn = `<div class="alert-box ab-red">⚠️ Rückwärtiger Zählerstand erkannt! Bitte prüfen.</div>`;
  } else if (rawDiff !== null && rawDiff > 1000) {
    plausWarn = `<div class="alert-box ab-yellow">⚠️ Ungewöhnlich hoher Verbrauch (${rawDiff.toFixed(1)} ${meter.unit}). Bitte prüfen.</div>`;
  }

  // ── Nächste Ablesung – Status ──
  let nextReadingHtml = '';
  if (meter.nextReading) {
    const days = diffDays(meter.nextReading);
    const hasReadingOnOrAfter = readings.some(r => r.date >= meter.nextReading);
    if (hasReadingOnOrAfter) {
      nextReadingHtml = `<div class="alert-box ab-green" style="margin-bottom:10px">✅ Ablesung für ${fmtDate(meter.nextReading)} bereits eingetragen.</div>`;
    } else if (days !== null && days <= 0) {
      nextReadingHtml = `<div class="alert-box ab-red" style="margin-bottom:10px">🔴 Ablesung fällig! Termin war ${fmtDate(meter.nextReading)} – bitte jetzt eintragen.</div>`;
    } else if (days !== null && days <= 7) {
      nextReadingHtml = `<div class="alert-box ab-yellow" style="margin-bottom:10px">🟡 Ablesung fällig in ${days} Tag${days !== 1 ? 'en' : ''} (${fmtDate(meter.nextReading)})</div>`;
    } else if (days !== null) {
      nextReadingHtml = `<div style="font-size:12px;color:var(--muted);margin-bottom:10px;padding:8px 12px;background:white;border-radius:9px;box-shadow:var(--shadow)">📅 Nächste Ablesung: <strong>${fmtDate(meter.nextReading)}</strong> (in ${days} Tagen)</div>`;
    }
  }

  let html = plausWarn + nextReadingHtml;

  if (latest) {
    // Energie-Vertrags-Auswertung (wenn Tarifdaten vorhanden)
    const linkedId = meter.energy?.linkedContractId || null;
    const hasEnergyData = meter.energy && (
      meter.energy.unitPrice || meter.energy.monthlyPayment || meter.energy.startReading !== undefined
    );
    const energyStats = (hasEnergyData || linkedId) ? calculateEnergyContractStats(meter, linkedId) : null;
    const energyHtml  = energyStats ? renderEnergyCard(energyStats, meter.type) : '';

    html += `<div class="card" style="text-align:center;padding:18px 14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <div></div>
        <div class="card-label" style="margin:0">${esc(meter.name || meter.type)}${meter.provider ? ' · ' + esc(meter.provider) : ''}</div>
        <button id="editMeterBtn" style="background:none;border:none;font-size:13px;color:var(--muted);cursor:pointer;padding:0;min-height:28px" title="Zähler bearbeiten">✏️</button>
      </div>
      <div style="font-size:44px;font-weight:800;letter-spacing:-2px;color:var(--accent)">${Number(latest.value).toLocaleString('de-DE')}</div>
      <div style="font-size:14px;color:var(--muted)">${meter.unit} · ${fmtDate(latest.date)}</div>
    </div>
    ${energyHtml}
    <div class="stat-grid">
      <div class="stat-box">
        <div class="stat-lbl">Letzter Zeitraum</div>
        <div class="stat-val">${lastPeriodConsumption !== null ? lastPeriodConsumption.toFixed(1) : '–'}</div>
        <div class="stat-sub">${meter.unit}${prev ? ' · ' + fmtDate(prev.date) + ' – ' + fmtDate(latest.date) : ''}</div>
      </div>
      <div class="stat-box">
        <div class="stat-lbl">Jahreshochrechnung</div>
        <div class="stat-val">${yearEst !== null ? yearEst.toFixed(0) : readings.length < 2 ? '–' : 'Fehler'}</div>
        <div class="stat-sub">${yearEst !== null ? meter.unit + '/Jahr' : readings.length < 2 ? 'Zu wenig Daten' : 'Prüfe Werte'}</div>
      </div>
      ${costEst ? `<div class="stat-box"><div class="stat-lbl">Geschätzte Kosten</div><div class="stat-val">${costEst} €</div><div class="stat-sub">/Jahr${meter.type === 'gas' ? ' (via kWh)' : ''}</div></div>` : ''}
    </div>
    ${zeitraumInfo}`;
  } else {
    html += `<div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button id="editMeterBtn" style="background:none;border:none;font-size:13px;color:var(--muted);cursor:pointer;padding:4px">✏️ Zähler bearbeiten</button></div>`;
    html += `<div class="alert-box ab-green">Noch keine Ablesungen. Trage den ersten Stand ein!</div>`;
  }

  html += `<button class="btn-p" id="addReadingBtn">+ Zählerstand eintragen</button>`;

  if (readings.length) {
    html += `<div class="sec" style="margin-top:14px">Ablesungen <span style="font-size:10px;font-weight:400;color:var(--muted)">(antippen zum Bearbeiten)</span></div>`;
    [...readings].reverse().forEach((r, i, arr) => {
      // arr ist reversed, also "älterer" Eintrag ist arr[i+1] (noch weiter zurück)
      // Im originalen (nicht-reversed) Array: Index im readings-Array berechnen
      const origIdx = readings.length - 1 - i;
      const olderReading = origIdx > 0 ? readings[origIdx - 1] : null;
      const delta = olderReading !== null ? r.value - olderReading.value : null;
      const deltaOk = delta !== null && delta >= 0;
      // Eindeutigen Identifier für die Ablesung: originalindex im readings-Array
      html += `<div class="reading-entry" data-ridx="${origIdx}">
        <div>
          <div style="font-size:12px;color:var(--muted)">${fmtDate(r.date)}</div>
          ${r.note ? `<div style="font-size:11px;color:var(--muted)">${esc(r.note)}</div>` : ''}
        </div>
        <div style="text-align:right;display:flex;align-items:center;gap:10px">
          <div>
            <div style="font-weight:700">${Number(r.value).toLocaleString('de-DE')} ${meter.unit}</div>
            ${delta !== null
              ? `<div style="font-size:11px;color:${deltaOk ? 'var(--green)' : 'var(--red)'}">
                  ${deltaOk ? '+' : ''}${delta.toFixed(1)} ${meter.unit}
                 </div>`
              : '<div style="font-size:11px;color:var(--muted)">Erstablesung</div>'
            }
          </div>
          <div style="color:var(--muted);font-size:16px">›</div>
        </div>
      </div>`;
    });
  }

  document.getElementById('meterContent').innerHTML = html;
  document.getElementById('addReadingBtn')?.addEventListener('click', openReadingModal);
  document.getElementById('editMeterBtn')?.addEventListener('click', () => openMeterModal(activeMeterType));

  // Delegation für Ablesungen: klickbar zum Bearbeiten
  document.getElementById('meterContent').onclick = e => {
    const entry = e.target.closest('.reading-entry[data-ridx]');
    if (entry && !e.target.closest('#addReadingBtn') && !e.target.closest('#editMeterBtn')) {
      const idx = parseInt(entry.dataset.ridx);
      openEditReadingModal(idx);
    }
  };
}

let editMeterId = null;
function openMeterModal(type) {
  const ex = type ? meters.find(m => m.type === type) : null;
  editMeterId = ex?.id || null;
  const en = ex?.energy || {};
  document.getElementById('m-type').value = type || 'strom';
  document.getElementById('m-name').value = ex?.name || '';
  document.getElementById('m-provider').value = ex?.provider || '';
  document.getElementById('m-number').value = ex?.number || '';
  document.getElementById('m-unit').value = ex?.unit || (type === 'gas' || type === 'wasser' ? 'm³' : 'kWh');
  document.getElementById('m-nextreading').value = ex?.nextReading || '';
  document.getElementById('m-reading-interval').value = String(ex?.readingIntervalMonths || 0);
  // Tarif-Felder
  document.getElementById('m-unit-price').value    = en.unitPrice    ?? ex?.price ?? '';
  document.getElementById('m-base-price').value    = en.basePriceMonthly ?? '';
  document.getElementById('m-monthly-pay').value   = en.monthlyPayment   ?? '';
  document.getElementById('m-start-reading').value = en.startReading !== undefined && en.startReading !== null ? en.startReading : '';
  document.getElementById('m-gas-factor').value    = en.gasKwhPerM3      ?? '';
  // Gas-Faktor-Zeile nur bei Gas sichtbar
  document.getElementById('m-gas-factor-row').style.display = (type === 'gas') ? 'block' : 'none';
  // Vertragsauswahl befüllen
  const sel = document.getElementById('m-linked-contract');
  const energyCats = ['strom','gas','wasser'];
  const energyContracts = contracts.filter(c => energyCats.includes(c.category) && !isContractArchived(c));
  sel.innerHTML = '<option value="">– kein –</option>' +
    energyContracts.map(c => `<option value="${esc(c.id)}"${en.linkedContractId === c.id ? ' selected' : ''}>${esc(c.name)}${c.provider ? ' · ' + esc(c.provider) : ''}</option>`).join('');
  // Typ-Change: Gas-Faktor ein-/ausblenden
  document.getElementById('m-type').onchange = function() {
    document.getElementById('m-gas-factor-row').style.display = this.value === 'gas' ? 'block' : 'none';
  };
  openModal('meterModal');
}

document.getElementById('saveMeterBtn').addEventListener('click', () => {
  const type = document.getElementById('m-type').value;
  const ex = editMeterId ? meters.find(m => m.id === editMeterId) : null;
  if (editMeterId && !ex) { alert('Zähler nicht mehr vorhanden. Bitte erneut öffnen.'); return; }
  if (meters.some(m => m.type === type && m.id !== editMeterId)) { alert('Für diesen Typ existiert bereits ein Zähler. Bitte einen anderen Typ wählen.'); return; }
  const nextReading = document.getElementById('m-nextreading').value;
  if(nextReading && !validDate(nextReading)){alert('Bitte gültiges Ablesedatum wählen.');return;}
  for(const id of ['m-unit-price','m-base-price','m-monthly-pay','m-start-reading','m-gas-factor']) {
    const raw=document.getElementById(id).value.trim(),n=strictNumber(raw);
    if(raw && (n===null || n<0 || (id==='m-gas-factor' && n===0))){alert('Bitte gültige, nicht negative Tarifwerte eingeben; der Gasfaktor muss größer als null sein.');return;}
  }


  // Legacy price für Rückwärtskompatibilität erhalten
  const unitPrice = parseDE(document.getElementById('m-unit-price').value) || null;

  // energy-Objekt nur speichern wenn mindestens ein Feld ausgefüllt
  const basePrice    = parseDE(document.getElementById('m-base-price').value)    || null;
  const monthlyPay   = parseDE(document.getElementById('m-monthly-pay').value)   || null;
  const startReadRaw = document.getElementById('m-start-reading').value.trim();
  const startReading = startReadRaw !== '' ? parseDE(startReadRaw) : null;
  const gasFactorRaw = document.getElementById('m-gas-factor').value.trim();
  const gasKwhPerM3  = gasFactorRaw !== '' ? parseDE(gasFactorRaw) : null;
  const linkedCId    = document.getElementById('m-linked-contract').value || null;

  // Verlinken: Startdatum aus Vertrag übernehmen wenn vorhanden
  const linkedContract = linkedCId ? contracts.find(c => c.id === linkedCId) : null;

  const hasEnergyData = unitPrice || basePrice || monthlyPay || startReading !== null || gasKwhPerM3 || linkedCId;
  const energyObj = hasEnergyData ? {
    linkedContractId: linkedCId || undefined,
    unitPrice:        unitPrice   || undefined,
    basePriceMonthly: basePrice   || undefined,
    monthlyPayment:   monthlyPay  || undefined,
    startReading:     startReading !== null ? startReading : undefined,
    startDate:        linkedContract?.startDate || undefined,
    endDate:          linkedContract?.endDate   || undefined,
    gasKwhPerM3:      gasKwhPerM3  || undefined,
  } : undefined;

  const data = {
    ...ex,
    id:          ex?.id || uid(), type,
    name:        document.getElementById('m-name').value.trim(),
    provider:    document.getElementById('m-provider').value.trim(),
    number:      document.getElementById('m-number').value.trim(),
    unit:        document.getElementById('m-unit').value,
    price:       unitPrice || ex?.price || 0, // Legacy-Feld erhalten
    nextReading,
    readingIntervalMonths: Number(document.getElementById('m-reading-interval').value),
    readings:    ex?.readings || [],
    energy:      energyObj,
  };
  if (ex) meters = meters.map(m => m.id === editMeterId ? data : m);
  else meters.push(data);
  save('vh_meters', meters);
  activeMeterType = type;
  closeModal('meterModal');
  renderMeters();
  renderAmpel();
});
document.getElementById('cancelMeterBtn').addEventListener('click', () => closeModal('meterModal'));

// ─── READING MODAL: Hinzufügen UND Bearbeiten ───
let editReadingIdx = null; // Index in meter.readings (sortiert nach Datum)

function openReadingModal() {
  editReadingIdx = null;
  document.getElementById('readingModalTitle').textContent = 'Zählerstand erfassen';
  document.getElementById('deleteReadingBtn').style.display = 'none';
  document.getElementById('r-date').value = today();
  document.getElementById('r-value').value = '';
  document.getElementById('reading-note').value = '';
  document.getElementById('readingWarning').style.display = 'none';
  openModal('readingModal');
}

function openEditReadingModal(idx) {
  const meter = meters.find(m => m.type === activeMeterType);
  if (!meter) return;
  const readings = (meter.readings || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const r = readings[idx];
  if (!r) return;
  // idx bezieht sich auf das sortierte readings-Array;
  // wir speichern ihn, um beim Speichern/Löschen den richtigen Eintrag zu finden.
  editReadingIdx = idx;
  document.getElementById('readingModalTitle').textContent = 'Zählerstand bearbeiten';
  document.getElementById('deleteReadingBtn').style.display = 'block';
  document.getElementById('r-date').value = r.date || today();
  document.getElementById('r-value').value = r.value !== undefined ? r.value : '';
  document.getElementById('reading-note').value = r.note || '';
  document.getElementById('readingWarning').style.display = 'none';
  openModal('readingModal');
}

function validateReadingForm() {
  const meter=meters.find(m=>m.type===activeMeterType);
  if(!meter)return '';
  const value=strictNumber(document.getElementById('r-value').value);
  const date=document.getElementById('r-date').value;
  const sorted=(meter.readings || []).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const error=readingError(meter,date,value,editReadingIdx===null?null:sorted[editReadingIdx]);
  const warn=document.getElementById('readingWarning');warn.style.display=error?'block':'none';warn.textContent=error;
  return error;
}
document.getElementById('r-value').addEventListener('input',validateReadingForm);
document.getElementById('r-date').addEventListener('input',validateReadingForm);

document.getElementById('saveReadingBtn').addEventListener('click', () => {
  const error=validateReadingForm(); if(error){alert(error);return;}
  const val = strictNumber(document.getElementById('r-value').value);
  const meter = meters.find(m => m.type === activeMeterType);
  if (!meter) return;
  if (!meter.readings) meter.readings = [];

  if (editReadingIdx !== null) {
    // Bearbeiten: sortiertes Array, Index ermitteln und Originalarray aktualisieren
    const sorted = meter.readings.slice().sort((a, b) => a.date.localeCompare(b.date));
    const targetReading = sorted[editReadingIdx];
    if(!targetReading){alert("Ablesung nicht mehr vorhanden. Bitte erneut öffnen.");return;}
    // Originalindex im unsorted meter.readings-Array finden
    const origIdx = meter.readings.findIndex(r =>
      r.date === targetReading.date &&
      r.value === targetReading.value &&
      (r.note || '') === (targetReading.note || '')
    );
    if (origIdx !== -1) {
      meter.readings[origIdx] = {
        date: document.getElementById('r-date').value,
        value: val,
        note: document.getElementById('reading-note').value.trim()
      };
    }
  } else {
    // Neu hinzufügen
    meter.readings.push({
      date: document.getElementById('r-date').value,
      value: val,
      note: document.getElementById('reading-note').value.trim()
    });
  }

  advanceReadingDate(meter);
  if(!save('vh_meters', meters))return;
  if (editReadingIdx === null) rewardDragon('meter', { id: meter.id + ':' + document.getElementById('r-date').value }); // nur neue Messwerte
  closeModal('readingModal');
  renderMeters();
  renderAmpel();
});

document.getElementById('deleteReadingBtn').addEventListener('click', () => {
  if (editReadingIdx === null) return;
  if (!confirm('Diesen Zählerstand löschen?')) return;
  const meter = meters.find(m => m.type === activeMeterType);
  if (!meter || !meter.readings) return;
  const sorted = meter.readings.slice().sort((a, b) => a.date.localeCompare(b.date));
  const targetReading = sorted[editReadingIdx];
  // Originalindex finden und entfernen
  const origIdx = meter.readings.findIndex(r =>
    r.date === targetReading.date &&
    r.value === targetReading.value &&
    (r.note || '') === (targetReading.note || '')
  );
  if (origIdx !== -1) meter.readings.splice(origIdx, 1);
  save('vh_meters', meters);
  closeModal('readingModal');
  renderMeters();
  renderAmpel();
});

document.getElementById('cancelReadingBtn').addEventListener('click', () => closeModal('readingModal'));

// ════════════════════════════════════════════
