'use strict';
// ANALYSIS
// ════════════════════════════════════════════
// ── Hilfsfunktion: Aktive Verträge für Analyse ──
function activeContractsOnly() {
  return contracts.filter(c => !isContractArchived(c));
}

// ── Hilfsfunktion: Vertrags-Status-Badge HTML ──
function contractStatusBadge(c) {
  if (isContractArchived(c)) return '<span class="st-badge st-archiv">ARCHIV</span>';
  if (c.cancelledStatus) return '<span class="st-badge st-gekuendigt">GEKÜNDIGT</span>';
  const now = new Date();
  if (c.freeMonths && c.startDate) {
    const freeEnd = new Date(c.startDate);
    freeEnd.setMonth(freeEnd.getMonth() + Number(c.freeMonths));
    if (now < freeEnd) return '<span class="st-badge st-gratis">GRATISMONATE</span>';
  }
  if (c.discount && c.discountMonths && c.startDate) {
    const discStart = new Date(c.startDate);
    discStart.setMonth(discStart.getMonth() + Number(c.freeMonths || 0));
    const discEnd = new Date(discStart);
    discEnd.setMonth(discEnd.getMonth() + Number(c.discountMonths));
    if (now >= discStart && now < discEnd) return '<span class="st-badge st-rabatt">RABATT</span>';
  }
  if (c.startDate) {
    const start = new Date(c.startDate);
    const diffMs = now - start;
    if (diffMs < 30 * 24 * 3600 * 1000) return '<span class="st-badge st-testphase">TESTPHASE</span>';
  }
  return '<span class="st-badge st-aktiv">AKTIV</span>';
}

// ── Monatliche Vertragskosten rückwirkend für einen Monat (YYYY-MM) ──
function contractCostForMonth(month) {
  // Alle aktiven + noch nicht archivierten Verträge (auch teilweise aktive)
  const relevant = contracts.filter(c => {
    const [y, m] = month.split('-').map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd   = new Date(y, m, 0); // letzter Tag des Monats
    if (c.startDate && new Date(c.startDate) > monthEnd) return false;
    if (c.endDate   && new Date(c.endDate)   < monthStart) return false;
    if (c.cancelledStatus && c.cancelledUntil && new Date(c.cancelledUntil) < monthStart) return false;
    return true;
  });
  const [y, m] = month.split('-').map(Number);
  return relevant.reduce((s, c) => s + effectiveMonthly(c, undefined, new Date(y, m - 1, 1)), 0);
}

function renderAnalysis() {
  if (activePage !== 'analysis') return;
  // ── Haushaltsmodus (konsistent mit Kasse) ──────────────────────────────
  const mode3   = getHaushaltMode(); // 'wir' | 'anteil' | 'ich'
  const hb      = activeHaushalt;    // 'wir' | 'ich'
  const split   = (Number(settings.splitPct) || 50) / 100;
  const modeLabel = mode3 === 'wir' ? '👫 Wir gesamt'
                  : mode3 === 'anteil' ? '👤 Meine Gesamtbelastung'
                  : '👤 Nur ich';

  function expAmt(e) {
    if (hb === 'ich' && e.account === 'wir') return 0;
    if (hb === 'wir' && kasseCostView === 'anteil' && e.account === 'wir')
      return Number(e.amount || 0) * split;
    return Number(e.amount || 0);
  }
  // Verträge: solo zählt voll (außer im Wir-Blick eines fremden Kontos gibt es nicht),
  // shared je nach Modus voll / anteilig / gar nicht
  function contractAmt(c) {
    const avg = effectiveMonthly(c, 'gesamt');
    if (hb === 'ich') return c.ownership === 'shared' ? 0 : avg;
    if (kasseCostView === 'anteil') return c.ownership === 'shared' ? avg * split : avg;
    return avg;
  }

  // ── Urlaubsfilter ──────────────────────────────────────────────────────
  const [includeTravel, setIncludeTravel] = (() => {
    let v = sessionStorage.getItem('hh_incl_travel') !== 'false';
    return [() => v, (x) => { v = x; sessionStorage.setItem('hh_incl_travel', x ? 'true' : 'false'); }];
  })();
  const exclTravel = !includeTravel();
  const isVariable = e => !(exclTravel && e.analysisGroup === 'urlaub');

  // ── Zeitraster: aktueller Monat bis heute, Vormonat bis gleicher Stichtag ──
  const now    = new Date();
  const dayOfM = now.getDate();
  const dim    = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currM  = `${now.getFullYear()}-${_pad(now.getMonth() + 1)}`;
  const prevD  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevM  = `${prevD.getFullYear()}-${_pad(prevD.getMonth() + 1)}`;
  const prevDim = new Date(prevD.getFullYear(), prevD.getMonth() + 1, 0).getDate();
  const prevCutoff = Math.min(dayOfM, prevDim);
  const monthName = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const expDay = e => Number((e.date || '').slice(8, 10)) || 0;

  const currExps   = expenses.filter(e => e.date && e.date.startsWith(currM) && isVariable(e));
  const currAmt    = currExps.reduce((s, e) => s + expAmt(e), 0);
  const prevAllExps  = expenses.filter(e => e.date && e.date.startsWith(prevM) && isVariable(e));
  const prevSameExps = prevAllExps.filter(e => expDay(e) <= prevCutoff);
  const prevSameAmt  = prevSameExps.reduce((s, e) => s + expAmt(e), 0);
  const hasPrev      = prevAllExps.length > 0;

  // ── Prognose (linear, plus Variante ohne Großkäufe) ───────────────────
  const forecast = dayOfM > 0 ? currAmt / dayOfM * dim : currAmt;
  const bigOnes  = currAmt > 0
    ? currExps.filter(e => expAmt(e) >= currAmt * 0.2 && expAmt(e) >= 50)
        .sort((a, b) => expAmt(b) - expAmt(a))
    : [];
  const bigSum = bigOnes.reduce((s, e) => s + expAmt(e), 0);
  const forecastAdj = dayOfM > 0 ? (currAmt - bigSum) / dayOfM * dim + bigSum : currAmt;

  // ── Aufteilung Haushalt / Persönlich ──────────────────────────────────
  const hausAmt = currExps.filter(e => e.account === 'wir').reduce((s, e) => s + expAmt(e), 0);
  const persAmt = currExps.filter(e => e.account !== 'wir').reduce((s, e) => s + expAmt(e), 0);

  // ── Budgets (Monatsstand + Prognose) ──────────────────────────────────
  const budgetKey = hb === 'ich' ? 'ich' : 'wir';
  const hbBudgets = budgets[budgetKey] || {};
  const budgetScale = (mode3 === 'anteil') ? split : 1; // Budget und Ausgaben gleich skalieren
  const catSpent = {};
  currExps.forEach(e => {
    if (budgetKey === 'wir' && e.account !== 'wir') return;
    if (budgetKey === 'ich' && e.account === 'wir') return;
    catSpent[e.category] = (catSpent[e.category] || 0) + expAmt(e);
  });
  const catLabel = c => { const f = EXP_CATS.find(x => x.v === c); return f ? f.l : '📋 ' + c; };
  const budgetRows = Object.keys(hbBudgets).map(cat => {
    const limit = Number(hbBudgets[cat] || 0) * budgetScale;
    const spent = catSpent[cat] || 0;
    const proj  = dayOfM > 0 ? spent / dayOfM * dim : spent;
    let status  = 'ok';
    if (limit > 0 && spent > limit) status = 'over';
    else if (limit > 0 && (spent >= limit * 0.8 || proj > limit)) status = 'knapp';
    return { cat, limit, spent, proj, status };
  }).filter(r => r.limit > 0).sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit));

  // ── Kostentreiber: Gruppen → Kategorien (nur variable Ausgaben) ───────
  const grpTotals = {}, grpCats = {};
  currExps.forEach(e => {
    const g = e.analysisGroup || getAnalysisGroup(e.category || 'sonstiges');
    const a = expAmt(e);
    if (!isFinite(a) || a === 0) return;
    grpTotals[g] = (grpTotals[g] || 0) + a;
    if (!grpCats[g]) grpCats[g] = {};
    grpCats[g][e.category || 'sonstiges'] = (grpCats[g][e.category || 'sonstiges'] || 0) + a;
  });
  const grpPrevSame = {};
  prevSameExps.forEach(e => {
    const g = e.analysisGroup || getAnalysisGroup(e.category || 'sonstiges');
    grpPrevSame[g] = (grpPrevSame[g] || 0) + expAmt(e);
  });

  // ── Hinweis-Engine (max. 3, Regeln laut Konzept) ──────────────────────
  const hints = [];
  const usedCauses = new Set();

  // 1) Einzelkauf ≥ 20 % der Monatsausgaben
  if (bigOnes.length && currExps.length >= 3) {
    const b = bigOnes[0];
    const g = b.analysisGroup || getAnalysisGroup(b.category || 'sonstiges');
    usedCauses.add('big:' + g);
    hints.push({
      icon: EXP_ICON[b.category] || '💸',
      title: `${catLabel(b.category).replace(/^\S+\s/, '')} prägt den ${now.toLocaleDateString('de-DE', { month: 'long' })}`,
      sub: `${fmtEurPlain(expAmt(b))} entfallen auf „${esc(b.desc || 'Einzelkauf')}“ – kein regelmäßiger Kostenanstieg.`
    });
  }
  // 2) Budget überschritten (≥ 10 € oder ≥ 10 %) – Gesundheit neutral formulieren
  budgetRows.filter(r => r.status === 'over')
    .filter(r => (r.spent - r.limit >= 10) || (r.spent - r.limit >= r.limit * 0.1))
    .sort((a, b) => (b.spent - b.limit) - (a.spent - a.limit))
    .forEach(r => {
      if (hints.length >= 3 || usedCauses.has('budget:' + r.cat)) return;
      usedCauses.add('budget:' + r.cat);
      if (r.cat === 'gesundheit') {
        hints.push({ icon: '💊', title: 'Gesundheitsbudget überschritten',
          sub: `${fmtEurPlain(r.spent)} von ${fmtEurPlain(r.limit)} – notwendige Ausgaben, ggf. Budget anpassen.` });
      } else {
        hints.push({ icon: '⚠️', title: `${catLabel(r.cat).replace(/^\S+\s/, '')} über Budget`,
          sub: `Bisher ${fmtEurPlain(r.spent)} bei ${fmtEurPlain(r.limit)} Budget – bereits ${fmtEurPlain(r.spent - r.limit)} darüber.` });
      }
    });
  // 3) Budget voraussichtlich knapp über Limit
  budgetRows.filter(r => r.status === 'knapp' && r.proj > r.limit && r.cat !== 'gesundheit')
    .forEach(r => {
      if (hints.length >= 3 || usedCauses.has('budget:' + r.cat)) return;
      usedCauses.add('budget:' + r.cat);
      hints.push({ icon: '📈', title: `${catLabel(r.cat).replace(/^\S+\s/, '')} voraussichtlich über Budget`,
        sub: `Bisher ${fmtEurPlain(r.spent)} von ${fmtEurPlain(r.limit)} – Prognose rund ${fmtEurPlain(r.proj)}.` });
    });
  // 4) Gruppen-Abweichung ≥ 20 % und ≥ 20 € vs. gleicher Vormonats-Zeitraum – mit Ursache
  if (hasPrev) {
    Object.keys(grpTotals).concat(Object.keys(grpPrevSame))
      .filter((g, i, arr) => arr.indexOf(g) === i && g !== 'urlaub')
      .map(g => ({ g, d: (grpTotals[g] || 0) - (grpPrevSame[g] || 0), prev: grpPrevSame[g] || 0 }))
      .filter(x => Math.abs(x.d) >= 20 && x.prev > 0 && Math.abs(x.d) >= x.prev * 0.2)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      .forEach(x => {
        if (hints.length >= 3 || usedCauses.has('big:' + x.g) || usedCauses.has('grp:' + x.g)) return;
        usedCauses.add('grp:' + x.g);
        let cause = '';
        if (x.d > 0) {
          const inGrp = currExps.filter(e => (e.analysisGroup || getAnalysisGroup(e.category)) === x.g)
            .sort((a, b) => expAmt(b) - expAmt(a));
          if (inGrp.length && expAmt(inGrp[0]) >= x.d * 0.6) cause = ` Hauptgrund: Einzelkauf „${esc(inGrp[0].desc || '')}“ (${fmtEurPlain(expAmt(inGrp[0]))}).`;
          else cause = ' Verteilt auf mehrere kleinere Ausgaben.';
        } else {
          const prevCats = {}, curCats = {};
          prevSameExps.filter(e => (e.analysisGroup || getAnalysisGroup(e.category)) === x.g)
            .forEach(e => { prevCats[e.category] = (prevCats[e.category] || 0) + expAmt(e); });
          currExps.filter(e => (e.analysisGroup || getAnalysisGroup(e.category)) === x.g)
            .forEach(e => { curCats[e.category] = (curCats[e.category] || 0) + expAmt(e); });
          const drop = Object.keys(prevCats).map(c => ({ c, d: prevCats[c] - (curCats[c] || 0) }))
            .sort((a, b) => b.d - a.d)[0];
          if (drop && drop.d > 0) cause = ` Hauptgrund: niedrigere Ausgaben für ${catLabel(drop.c).replace(/^\S+\s/, '')}.`;
        }
        hints.push({
          icon: x.d > 0 ? '📈' : '📉',
          title: `${groupLabel(x.g).replace(/^\S+\s/, '')} ${x.d > 0 ? 'deutlich höher' : 'deutlich niedriger'} als im Vormonat`,
          sub: `${fmtEurPlain(Math.abs(x.d))} ${x.d > 0 ? 'über' : 'unter'} dem vergleichbaren ${prevD.toLocaleDateString('de-DE', { month: 'long' })}-Zeitraum.${cause}`
        });
      });
  }
  // 5) Vertragsfristen
  const activeC = activeContractsOnly();
  const expiring = activeC.filter(c => {
    const cd = latestCancelDate(c); const d = cd ? diffDays(cd) : null;
    return d !== null && d >= 0 && d <= 90;
  });
  if (expiring.length && hints.length < 3) {
    hints.push({ icon: '⏳', title: `${expiring.length} Vertrag${expiring.length > 1 ? 'e' : ''} mit naher Kündigungsfrist`,
      sub: expiring.slice(0, 3).map(c => esc(c.name)).join(', ') + ' – Frist endet in den nächsten 90 Tagen.' });
  }

  // ── Verlauf: letzte 6 Monate (nur variable Ausgaben) ──────────────────
  const hist6 = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = `${d.getFullYear()}-${_pad(d.getMonth() + 1)}`;
    const exps = expenses.filter(e => e.date && e.date.startsWith(m) && isVariable(e));
    hist6.push({ m, name: d.toLocaleDateString('de-DE', { month: 'short' }),
      amt: exps.reduce((s, e) => s + expAmt(e), 0), isCurr: m === currM });
  }
  const maxHist = Math.max(...hist6.map(h => h.amt), 1);

  // ── Fixkosten (Verträge, ohne Sparen) ─────────────────────────────────
  const sparVertraege = activeC.filter(c => c.category === 'sparen');
  const fixVertraege  = activeC.filter(c => c.category !== 'sparen');
  const fixShown  = hb === 'ich' ? fixVertraege.filter(c => c.ownership !== 'shared') : fixVertraege;
  const fixFull   = c => effectiveMonthly(c, 'gesamt');
  const fixTotal  = fixShown.reduce((s, c) => s + fixFull(c), 0);
  const fixShared = fixShown.filter(c => c.ownership === 'shared').reduce((s, c) => s + fixFull(c), 0);
  const fixSolo   = fixTotal - fixShared;
  const fixMyPart = fixShared * split + fixSolo;
  const fixGrp = {};
  fixShown.forEach(c => {
    const g = c.analysisGroup || getAnalysisGroup(c.category || 'sonstiges');
    fixGrp[g] = (fixGrp[g] || 0) + fixFull(c);
  });
  const totalSpar = sparVertraege.reduce((s, c) => s + fixFull(c), 0);

  // ════ HTML aufbauen ════════════════════════════════════════════════════
  let html = `
  <div class="hh-toggle" style="margin-bottom:14px">
    <button class="hh-btn${mode3==='wir'?' aw':''}" id="an-wir-btn">👫 Wir<br><span style="font-size:10px;font-weight:500">Gesamt</span></button>
    <button class="hh-btn${mode3==='anteil'?' aa':''}" id="an-anteil-btn">👤 Meine<br><span style="font-size:10px;font-weight:500">Gesamtbelastung</span></button>
    <button class="hh-btn${mode3==='ich'?' ai':''}" id="an-ich-btn">👤 Ich<br><span style="font-size:10px;font-weight:500">Persönlich</span></button>
  </div>`;

  // ── Bereich 1: Monatslage ─────────────────────────────────────────────
  const cmpHtml = hasPrev
    ? (() => {
        const d = currAmt - prevSameAmt;
        const pct = prevSameAmt > 0 ? (d / prevSameAmt * 100) : 0;
        const sign = d > 0 ? '+' : '−';
        const col  = d > 0 ? '#fca5a5' : '#86efac';
        return `<div style="font-size:12px;margin-top:6px"><span style="color:${col};font-weight:700">${sign}${fmtEurPlain(Math.abs(d))} (${sign}${Math.abs(pct).toFixed(1).replace('.', ',')} %)</span> <span style="opacity:.75">gegenüber dem gleichen Zeitraum im ${prevD.toLocaleDateString('de-DE', { month: 'long' })} (${fmtEurPlain(prevSameAmt)})</span></div>`;
      })()
    : '';
  const fcHtml = dayOfM < dim
    ? `<div style="font-size:12px;opacity:.85;margin-top:2px">Prognose: etwa ${fmtEurPlain(forecast)}${bigOnes.length ? ` · ohne Großkäufe ~${fmtEurPlain(forecastAdj)}` : ''} <span style="opacity:.6">(Orientierung)</span></div>`
    : '';
  html += `
  <div class="hero-card wir">
    <div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">${modeLabel} · ${monthName} · Stand ${_pad(dayOfM)}.${_pad(now.getMonth() + 1)}.</div>
    <div class="hero-amount">${fmtEurPlain(currAmt)}</div>
    ${fcHtml}${cmpHtml}
    ${mode3 !== 'ich' ? `<div style="display:flex;gap:14px;margin-top:10px;font-size:12px;opacity:.9">
      <span>🏠 Haushalt <b>${fmtEurPlain(hausAmt)}</b></span>
      <span>👤 Persönlich <b>${fmtEurPlain(persAmt)}</b></span>
    </div>` : ''}
  </div>`;

  // ── Bereich 2: Was diesen Monat auffällt ──────────────────────────────
  if (hints.length) {
    html += `<div class="card"><div class="card-label">Wichtig in diesem Monat</div>`;
    hints.slice(0, 3).forEach(h2 => {
      html += `<div class="spar-hint"><div class="spar-hint-title">${h2.icon} ${h2.title}</div><div class="spar-hint-sub">${h2.sub}</div></div>`;
    });
    html += `</div>`;
  }

  // ── Bereich 3: Budgetstatus ───────────────────────────────────────────
  if (budgetRows.length) {
    const over  = budgetRows.filter(r => r.status === 'over');
    const knapp = budgetRows.filter(r => r.status === 'knapp');
    const rest  = budgetRows.filter(r => r.status === 'ok');
    const row = r => {
      const pct = Math.min(100, r.limit > 0 ? r.spent / r.limit * 100 : 0);
      const col = r.status === 'over' ? '#dc2626' : r.status === 'knapp' ? '#d97706' : 'var(--green)';
      return `<div class="bar-row">
        <div class="bar-lbl"><span>${catLabel(r.cat)}</span><span style="font-weight:600">${fmtEurPlain(r.spent)} / ${fmtEurPlain(r.limit)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div>
      </div>`;
    };
    html += `<div class="card"><div class="card-label">Budgetstatus ${now.toLocaleDateString('de-DE', { month: 'long' })}${mode3 === 'anteil' ? ` · ${Math.round(settings.splitPct)} % Anteil` : ''}</div>`;
    if (over.length)  { html += `<div class="an-sec" style="color:#dc2626">Überschritten</div>` + over.map(row).join(''); }
    if (knapp.length) { html += `<div class="an-sec" style="color:#d97706">Knapp</div>` + knapp.map(row).join(''); }
    if (!over.length && !knapp.length) html += `<div style="font-size:12px;color:var(--muted);padding:4px 0">Alle Budgets im Rahmen. ✅</div>`;
    if (rest.length) {
      html += `<details class="an-details"><summary>Alle Budgets anzeigen (${budgetRows.length})</summary>` + rest.map(row).join('') + `</details>`;
    }
    html += `</div>`;
  }

  // ── Bereich 4: Kostentreiber (zweistufig) ─────────────────────────────
  const sortedGrps = Object.keys(grpTotals).sort((a, b) => grpTotals[b] - grpTotals[a]);
  if (sortedGrps.length) {
    html += `<div class="card"><div class="card-label">Ausgabenstruktur ${now.toLocaleDateString('de-DE', { month: 'long' })} <span style="font-weight:400;color:var(--muted)">· antippen für Details</span></div>`;
    sortedGrps.forEach(g => {
      const amt = grpTotals[g];
      const pct = currAmt > 0 ? amt / currAmt * 100 : 0;
      const cats = Object.keys(grpCats[g] || {}).sort((a, b) => grpCats[g][b] - grpCats[g][a]);
      const catRows = cats.map(c =>
        `<div style="display:flex;justify-content:space-between;padding:4px 0 4px 12px;font-size:12px;border-bottom:1px solid var(--border)">
          <span>${catLabel(c)}</span><span style="font-weight:600">${fmtEurPlain(grpCats[g][c])}</span>
        </div>`).join('');
      html += `<details class="an-grp"><summary>
        <div class="bar-row" style="margin:0">
          <div class="bar-lbl"><span>${groupLabel(g)}</span><span>${fmtEurPlain(amt)} · <span style="color:var(--muted)">${Math.round(pct)}%</span></span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${groupColor(g)}"></div></div>
        </div></summary>${catRows}</details>`;
    });
    html += `</div>`;
  }

  // ── Bereich 5: Entwicklung ────────────────────────────────────────────
  html += `<div class="card"><div class="card-label">Entwicklung (variable Ausgaben)</div>
  <div style="display:flex;align-items:flex-end;gap:5px;height:80px;margin-bottom:4px">`;
  hist6.forEach(h => {
    const hp = Math.max(4, h.amt / maxHist * 66);
    html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="font-size:8px;color:var(--muted);font-weight:600">${h.amt > 0 ? Math.round(h.amt) : ''}</div>
      <div style="width:100%;height:${hp}px;background:var(--accent);opacity:${h.isCurr ? '1' : '.55'};border-radius:3px 3px 0 0"></div>
      <div style="font-size:8px;color:var(--muted);font-weight:${h.isCurr ? '700' : '400'}">${h.name}</div>
    </div>`;
  });
  html += `</div><div style="font-size:10px;color:var(--muted)">Aktueller Monat unvollständig · Fixkosten separat unten</div></div>`;

  // ── Bereich 6: Regelmäßige Kosten ─────────────────────────────────────
  if (fixShown.length) {
    const grpRows = Object.keys(fixGrp).sort((a, b) => fixGrp[b] - fixGrp[a]).map(g =>
      `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid var(--border)">
        <span>${groupLabel(g)}</span><span style="font-weight:600">${fmtEurPlain(fixGrp[g])}</span>
      </div>`).join('');
    const list = [...fixShown].sort((a, b) => fixFull(b) - fixFull(a)).map(c =>
      `<div style="display:flex;align-items:center;gap:8px;padding:6px 0 6px 4px;border-bottom:1px solid var(--border);font-size:12px">
        <span>${CONTRACT_ICONS[c.category] || '📋'}</span>
        <span style="flex:1">${esc(c.name)}${c.ownership === 'shared' ? ' <span style="font-size:10px;color:var(--muted)">👫</span>' : ''}</span>
        <span style="font-weight:600">${fmtEurPlain(fixFull(c))}/Mo</span>
      </div>`).join('');
    html += `<div class="card"><div class="card-label">Regelmäßige Kosten</div>
      <div style="font-size:20px;font-weight:800;margin-bottom:2px">${fmtEurPlain(fixTotal)} <span style="font-size:12px;font-weight:500;color:var(--muted)">pro Monat</span></div>
      ${hb !== 'ich' ? `<div style="font-size:12px;color:var(--muted);margin-bottom:8px">davon gemeinsam ${fmtEurPlain(fixShared)} · persönlich ${fmtEurPlain(fixSolo)}</div>` : `<div style="margin-bottom:8px"></div>`}
      ${grpRows}
      ${mode3 === 'anteil' ? `<div style="margin-top:10px;padding:9px 11px;background:var(--bg);border-radius:9px;font-size:12px">
        <div style="font-weight:700;margin-bottom:4px">Dein rechnerischer Fixkostenanteil</div>
        <div style="display:flex;justify-content:space-between"><span>Gemeinsame Verträge · ${Math.round(settings.splitPct)} %</span><span>${fmtEurPlain(fixShared * split)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Eigene Verträge</span><span>${fmtEurPlain(fixSolo)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid var(--border);margin-top:4px;padding-top:4px"><span>Gesamt</span><span>${fmtEurPlain(fixMyPart)}</span></div>
      </div>` : ''}
      <details class="an-details"><summary>${fixShown.length} aktive Verträge · Details anzeigen</summary>${list}</details>
    </div>`;
  }

  // ── Weitere Details (eingeklappt) ─────────────────────────────────────
  let more = '';
  if (totalSpar > 0) {
    const totalLoad = fixTotal + currAmt;
    const quote = totalLoad + totalSpar > 0 ? Math.round(totalSpar / (totalSpar + totalLoad) * 100) : 0;
    more += `<div style="display:flex;gap:8px;margin:8px 0">
      <div style="flex:1;text-align:center"><div class="stat-lbl">Sparquote</div><div class="stat-val" style="color:var(--green)">${quote}%</div></div>
      <div style="flex:1;text-align:center"><div class="stat-lbl">Sparplan</div><div class="stat-val">${fmtEurPlain(totalSpar)}/Mo</div></div>
      <div style="flex:1;text-align:center"><div class="stat-lbl">Sparen/Jahr</div><div class="stat-val" style="font-size:13px">${fmtEurPlain(totalSpar * 12)}</div></div>
    </div>`;
  }
  const sparHints = [];
  const streamAbos = fixVertraege.filter(c => ['streaming', 'gaming'].includes(c.category));
  if (streamAbos.length >= 2) sparHints.push(`🎬 ${streamAbos.length} Streaming/Gaming-Abos · ${fmtEurPlain(streamAbos.reduce((s, c) => s + fixFull(c), 0))}/Mo – reicht einer?`);
  const smallAbos = fixVertraege.filter(c => fixFull(c) > 0 && fixFull(c) < 5);
  if (smallAbos.length >= 3) sparHints.push(`📋 ${smallAbos.length} Kleinabos unter 5 €/Mo: ${smallAbos.slice(0, 3).map(c => esc(c.name)).join(', ')}${smallAbos.length > 3 ? ' …' : ''}`);
  ['gas', 'strom'].forEach(k => {
    const n = fixVertraege.filter(c => c.category === k).length;
    if (n >= 2) sparHints.push(`⚠️ ${n} ${k === 'gas' ? 'Gas' : 'Strom'}verträge erkannt – doppelter Vertrag möglich`);
  });
  if (sparHints.length) more += `<div class="card-label" style="margin-top:8px">💡 Sparpotenzial</div>` + sparHints.map(s => `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">${s}</div>`).join('');
  const allTripExps = expenses.filter(e => e.tripId);
  if (allTripExps.length) {
    const trips = {};
    allTripExps.forEach(e => {
      if (!trips[e.tripId]) trips[e.tripId] = { total: 0, count: 0 };
      trips[e.tripId].total += Number(e.amount) || 0; trips[e.tripId].count++;
    });
    more += `<div class="card-label" style="margin-top:8px">✈️ Reisen</div>` +
      Object.keys(trips).sort((a, b) => trips[b].total - trips[a].total).map(t =>
        `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)"><span>✈️ ${esc(t)} <span style="color:var(--muted)">(${trips[t].count})</span></span><span style="font-weight:600">${fmtEurPlain(trips[t].total)}</span></div>`).join('');
  }
  if (more) {
    html += `<div class="card"><details class="an-details"><summary style="font-weight:700">Weitere Details</summary>${more}</details></div>`;
  }

  // ── Urlaubs-Toggle & Leerzustand ──────────────────────────────────────
  html += `<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:10px;font-size:12px;color:var(--muted)">
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
      <input autocomplete="off" type="checkbox" id="inclTravelChk" ${includeTravel() ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
      Urlaub einschließen
    </label>
  </div>`;
  if (!activeC.length && !expenses.length) html += `<div class="empty"><div class="ei">📊</div><p>Noch keine Daten vorhanden.<br><span class="empty-cta">Erfasse Ausgaben und Verträge, um hier eine Übersicht zu sehen.</span></p></div>`;
  document.getElementById('analysisContent').innerHTML = html;

  // ── Event-Handler ─────────────────────────────────────────────────────
  document.getElementById('an-wir-btn')?.addEventListener('click', () => { setHaushalt('wir');    renderAnalysis(); });
  document.getElementById('an-anteil-btn')?.addEventListener('click', () => { setHaushalt('anteil'); renderAnalysis(); });
  document.getElementById('an-ich-btn')?.addEventListener('click', () => { setHaushalt('ich');    renderAnalysis(); });
  document.getElementById('inclTravelChk')?.addEventListener('change', function() {
    setIncludeTravel(this.checked);
    renderAnalysis();
  });
}

// ════════════════════════════════════════════
// FAB
// ════════════════════════════════════════════
document.getElementById('fabBtn').addEventListener('click', () => {
  if (activePage === 'contracts') openAddContractModal();
  else if (activePage === 'meters') { if (meters.some(m=>m.type===activeMeterType)) openReadingModal(); else openMeterModal(null); }
  else if (activePage === 'tickets') { ticketTab='concerts'; editConcertId='__new'; renderTickets(); return; }
  else if (activePage === 'recipes') { openRecipeModal(null); return; }
  else if (activePage === 'kasse') {
    if (activeKasseTab === 'mehr' && mehrView === 'einkauf') openAddShopItem();
    else if (activeKasseTab === 'mehr' && mehrView === 'ausgleich') openAddTransfer();
    else if (activeKasseTab === 'mehr' && mehrView === 'recurring') openRecurringModal(null);
    else if (activeKasseTab === 'budgets') openBudgetModal();
    else openAddExpense();
  } else openAddExpense();
});

// ════════════════════════════════════════════
// MODAL HELPERS
// ════════════════════════════════════════════
// ════════════════════════════════════════════
