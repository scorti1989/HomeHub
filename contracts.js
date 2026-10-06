'use strict';
// CONTRACTS PAGE
// ════════════════════════════════════════════
let activeCatFilter = 'alle', activeOwnerFilter = 'alle', activeSort = 'wichtig';
let editContractId = null, currentOwnership = 'solo';
let ctStatusFilter = 'aktiv';   // aktiv | gekuendigt | beendet | archiv | alle
let ctFavOnly = false;
let ctQualityFilter = false;    // "Verträge prüfen": nur Verträge mit fehlenden Angaben

// ── Statische Listener einmalig initialisieren (kein renderContracts-Loop) ──
document.getElementById('contractSearch').addEventListener('input', renderContracts);
document.getElementById('ctSortSel').addEventListener('change', function () {
  activeSort = this.value;
  renderContracts();
});

// BUGFIX 1: Global permanent event delegation for contractList.
document.getElementById('contractList').addEventListener('click', e => {
  const act = e.target.closest('[data-ctact]');
  if (act) return; // wird von der globalen data-ctact-Delegation behandelt
  const favBtn = e.target.closest('[data-fav]');
  if (favBtn) {
    e.stopPropagation();
    const c = contracts.find(x => x.id === favBtn.dataset.fav);
    if (c) { c.favorite = !c.favorite; save('vh_contracts', contracts); renderContracts(); }
    return;
  }
  const item = e.target.closest('.ct-item[data-cid]');
  if (item) openEditContractModal(item.dataset.cid);
});

// BUGFIX 1: Global permanent delegation for archiveList
document.getElementById('archiveList').addEventListener('click', e => {
  const act = e.target.closest('[data-ctact]');
  if (act) return;
  const favBtn = e.target.closest('[data-fav]');
  if (favBtn) {
    e.stopPropagation();
    const c = contracts.find(x => x.id === favBtn.dataset.fav);
    if (c) { c.favorite = !c.favorite; save('vh_contracts', contracts); renderContracts(); }
    return;
  }
  const item = e.target.closest('.ct-item[data-cid]');
  if (item) openEditContractModal(item.dataset.cid);
});

// Energiehistorie: Zeile antippen → Vertrag öffnen
document.getElementById('ctExtra').addEventListener('click', e => {
  const row = e.target.closest('.ct-hist-row[data-cid]');
  if (row) openEditContractModal(row.dataset.cid);
});

// Kostenansicht-Toggle (Verträge): 'anteil' = Meine Belastung · 'gesamt' = Haushaltskosten
let contractCostView = 'anteil';
document.getElementById('costViewToggle').addEventListener('click', e => {
  const btn = e.target.closest('[data-cv]');
  if (!btn) return;
  contractCostView = btn.dataset.cv;
  document.querySelectorAll('#costViewToggle .cvt-btn').forEach(b => b.classList.toggle('active', b.dataset.cv === contractCostView));
  renderContracts();
});

// Kostenansicht-Toggle (Kasse)
let kasseCostView = 'gesamt'; // Muss mit activeHaushalt='wir' übereinstimmen → Wir Gesamt
document.getElementById('kasseCostView').addEventListener('click', e => {
  const btn = e.target.closest('[data-kcv]');
  if (!btn) return;
  kasseCostView = btn.dataset.kcv;
  document.querySelectorAll('#kasseCostView .cvt-btn').forEach(b => b.classList.toggle('active', b.dataset.kcv === kasseCostView));
  renderKasse();
});

// Archiv-Toggle – steuert nur Sichtbarkeit; Inhalt wird in renderContracts immer aktuell gesetzt
let archiveOpen = false;
document.getElementById('archiveToggle').addEventListener('click', () => {
  archiveOpen = !archiveOpen;
  document.getElementById('archiveToggle').classList.toggle('open', archiveOpen);
  document.getElementById('archiveList').style.display = archiveOpen ? 'block' : 'none';
});

// ════════════════════════════════════════════
// VERTRAGS-HELFER: Kosten, Phasen, Fristen, Datenqualität
// ════════════════════════════════════════════

// Realer Zahlungsrhythmus als Text (ohne Monatsumrechnung)
function contractRhythmText(c) {
  if (!c || typeof c !== 'object') return '';
  const cost = Number(c.cost);
  if (!Number.isFinite(cost) || cost <= 0) return '';
  let t = `${fmtEurPlain(cost)} ${c.interval || 'monatlich'}`;
  const extra = Number(c.extraCost);
  if (Number.isFinite(extra) && extra > 0 && c.extraInterval && c.extraInterval !== 'einmalig') {
    t += ` + ${fmtEurPlain(extra)} ${c.extraInterval}`;
  }
  return t;
}

// Phasen-Infos: Gratis, Rabatt, Testphase – mit Restdauer und Folgekosten
function contractPhaseInfo(c) {
  if (!c || typeof c !== 'object' || !c.startDate) return null;
  const start = new Date(c.startDate + 'T00:00:00');
  if (isNaN(start)) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const base = toMonthly(c.cost, c.interval);
  const extra = (c.extraCost && c.extraInterval !== 'einmalig') ? toMonthly(c.extraCost, c.extraInterval) : 0;
  const free = Number(c.freeMonths) || 0;
  const disc = Number(c.discount) || 0;
  const discMo = Number(c.discountMonths) || 0;

  const addM = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
  const dstr = d => localDateStr(d);

  if (free > 0) {
    const freeEnd = addM(start, free);
    if (now < freeEnd) {
      const after = (disc > 0 && discMo > 0) ? Math.max(0, base - disc) + extra : base + extra;
      const restM = Math.max(1, Math.round((freeEnd - now) / (30.44 * 86400000)));
      return { kind: 'gratis', endDate: dstr(freeEnd), text: `Gratisphase · noch ${restM} Monat${restM === 1 ? '' : 'e'} kostenlos`, after: `danach ${fmtEurPlain(after)} monatlich` };
    }
  }
  if (disc > 0 && discMo > 0) {
    const discStart = addM(start, free);
    const discEnd = addM(discStart, discMo);
    if (now >= discStart && now < discEnd) {
      return { kind: 'rabatt', endDate: dstr(discEnd), text: `Rabatt aktiv · ${fmtEurPlain(disc)} günstiger bis ${fmtDate(dstr(discEnd))}`, after: `danach ${fmtEurPlain(base + extra)} monatlich` };
    }
  }
  // Testphase: erste 30 Tage, ohne Gratis-/Rabattphase
  if (free === 0 && !(disc > 0 && discMo > 0)) {
    const testEnd = new Date(start.getTime() + 30 * 86400000);
    if (now < testEnd && now >= start) {
      const d = Math.ceil((testEnd - now) / 86400000);
      return { kind: 'test', endDate: dstr(testEnd), text: `Testphase endet in ${d} Tag${d === 1 ? '' : 'en'}`, after: `danach ${fmtEurPlain(base + extra)} monatlich` };
    }
  }
  return null;
}

// Fehlende/kritische Angaben je Vertrag
function contractDataIssues(c) {
  if (!c || typeof c !== 'object') return { critical: [], hints: [] };
  const critical = [], hints = [];
  const hasFrist = (Number(c.cancelVal) > 0) || (Number(c.cancelDays) > 0);
  const jederzeit = (c.cancelCond || 'jederzeit') === 'jederzeit';
  if (Number(c.minTerm) > 0 && !c.endDate) critical.push('kein Vertragsende trotz Mindestlaufzeit');
  if (!hasFrist) critical.push('keine Kündigungsfrist');
  if (!jederzeit && !c.endDate && !c.startDate) critical.push('unklare Laufzeit');
  if (((Number(c.discount) > 0 && Number(c.discountMonths) > 0) || Number(c.freeMonths) > 0) && !c.startDate) critical.push('Rabatt/Gratisphase ohne berechenbares Ende');
  if (!c.custNo) hints.push('keine Kundennummer');
  if (!c.provider) hints.push('kein Anbieter');
  if (!c.cancelUrl) hints.push('kein Kündigungslink');
  return { critical, hints };
}

// Priorität für "Wichtigste"-Sortierung + Handlungsbedarf
function contractPriority(c) {
  if (!c || typeof c !== 'object') return { score: 0, line: '' };
  const cd = latestCancelDate(c);
  const days = cd ? diffDays(cd) : null;
  const phase = contractPhaseInfo(c);
  const endD = c.endDate ? diffDays(c.endDate) : null;

  // 7) gekündigt mit künftigem Ende
  if (isContractCancelled(c) && c.cancelledUntil) {
    const d = diffDays(c.cancelledUntil);
    if (d !== null && d >= 0) return { score: 300 + Math.max(0, 200 - d), line: `GEKÜNDIGT · endet am ${fmtDate(c.cancelledUntil)} · noch ${d} Tag${d === 1 ? '' : 'e'}` };
  }
  // 1) Kündigungsfrist kritisch
  if (days !== null && days >= 0 && days <= 60) return { score: 900 - days, line: `Kündbar bis ${fmtDate(cd)} (${days} Tag${days === 1 ? '' : 'e'})`, urgent: true };
  // 2) Vertragsende bald
  if (endD !== null && endD >= 0 && endD <= 90) return { score: 800 - endD, line: `Vertragsende am ${fmtDate(c.endDate)} (${endD} Tage)`, urgent: true };
  // 3–5) Phasen enden
  if (phase) {
    const pd = diffDays(phase.endDate);
    if (phase.kind === 'rabatt' && pd !== null && pd <= 120) return { score: 700 - Math.min(120, pd), line: phase.text, after: phase.after, urgent: pd <= 60 };
    if (phase.kind === 'gratis' && pd !== null && pd <= 60) return { score: 600 - Math.min(60, pd), line: phase.text, after: phase.after, urgent: true };
    if (phase.kind === 'test') return { score: 500, line: phase.text, after: phase.after, urgent: true };
  }
  // 6) unvollständige wichtige Daten
  const issues = contractDataIssues(c);
  if (issues.critical.length) return { score: 400 + issues.critical.length, line: `Angaben unvollständig · ${issues.critical[0]}` };
  // 8) Favoriten
  if (c.favorite) return { score: 200, line: '' };
  // 9) Rest nach Kosten
  return { score: Math.min(199, effectiveMonthly(c, 'gesamt')), line: '' };
}

// Primäre Statuszeile einer Karte (genau eine)
function contractPrimaryLine(c) {
  const p = contractPriority(c);
  if (p.line) return { text: p.line, after: p.after || '', urgent: !!p.urgent };
  const phase = contractPhaseInfo(c);
  if (phase) return { text: phase.text, after: phase.after, urgent: false };
  // Bindung
  if (c.minTerm && c.startDate) {
    const me = new Date(c.startDate + 'T00:00:00'); me.setMonth(me.getMonth() + Number(c.minTerm));
    const meStr = localDateStr(me);
    const d = diffDays(meStr);
    if (d !== null && d > 0) return { text: `Mindestlaufzeit bis ${fmtDate(meStr)}`, after: '', urgent: false };
  }
  const fristVal = c.cancelVal !== undefined && c.cancelVal !== null && c.cancelVal !== '' ? c.cancelVal : c.cancelDays;
  const unit = { tage: 'Tag(en)', wochen: 'Woche(n)', monate: 'Monat(en)' }[c.cancelUnit || 'tage'];
  if ((c.cancelCond || 'jederzeit') === 'jederzeit' && Number(fristVal) > 0) {
    return { text: `Jederzeit mit ${fristVal} ${unit} Frist kündbar`, after: '', urgent: false };
  }
  const cd = latestCancelDate(c);
  if (cd) { const d = diffDays(cd); if (d !== null && d >= 0) return { text: `Kündbar bis ${fmtDate(cd)}`, after: '', urgent: false }; }
  return { text: '', after: '', urgent: false };
}

// Zu einem Energievertrag verknüpften Zähler finden
function meterForContract(cid) {
  if (!Array.isArray(meters)) return null;
  return meters.find(m => m && m.energy && m.energy.linkedContractId === cid) || null;
}

// ════════════════════════════════════════════
// VERTRÄGE RENDERN
// ════════════════════════════════════════════
function renderContracts() {
  if (activePage !== 'contracts') return;
  const query = (document.getElementById('contractSearch')?.value || '').toLowerCase().trim();
  const cv = contractCostView; // 'anteil' = Meine Belastung | 'gesamt' = Haushaltskosten
  const cvLabel = cv === 'gesamt' ? 'Haushalt' : 'Meine Belastung';
  const split = (typeof settings.splitPct === 'number' && isFinite(settings.splitPct)) ? settings.splitPct : 50;

  const allContracts = Array.isArray(contracts) ? contracts.filter(c => c && typeof c === 'object') : [];
  const activeContracts = allContracts.filter(c => !isContractArchived(c));
  const archived = allContracts.filter(c => isContractArchived(c));

  // ── Kopfbereich ──
  const monthlyGesamt = activeContracts.reduce((s, c) => s + effectiveMonthly(c, 'gesamt'), 0);
  const meineBelastung = activeContracts.reduce((s, c) => s + effectiveMonthly(c, 'anteil'), 0);
  const fristen90 = activeContracts.filter(c => {
    const cd = latestCancelDate(c); const d = cd ? diffDays(cd) : null;
    return d !== null && d >= 0 && d <= 90;
  }).length;
  document.getElementById('ctHeader').innerHTML = activeContracts.length ? `
    <div class="ct-head-card">
      <div class="ct-head-row"><b>${activeContracts.length}</b> aktive Verträge</div>
      <div class="ct-head-row"><b>${fmtEurPlain(monthlyGesamt)}</b> monatlich gesamt</div>
      <div class="ct-head-row"><b>${fmtEurPlain(meineBelastung)}</b> deine monatliche Belastung <span class="ct-head-note">(${Math.round(split)} % Anteil an Gemeinsamem)</span></div>
      <div class="ct-head-row${fristen90 ? ' warn' : ''}"><b>${fristen90}</b> wichtige Frist${fristen90 === 1 ? '' : 'en'} <span class="ct-head-note">(90 Tage)</span></div>
      <div class="mehr-card-actions" style="margin-top:10px">
        ${fristen90 ? '<button class="kb-btn" data-ctact="checkfristen">Fristen prüfen</button>' : ''}
        <button class="kb-btn" data-ctact="addcontract">+ Vertrag</button>
      </div>
    </div>` : '';

  // ── Filter anwenden ──
  let list = activeContracts;
  if (ctStatusFilter === 'gekuendigt') list = list.filter(c => isContractCancelled(c));
  else if (ctStatusFilter === 'beendet' || ctStatusFilter === 'archiv') list = archived;
  else if (ctStatusFilter === 'aktiv') list = activeContracts;
  // 'alle' → aktiv + archiviert
  else if (ctStatusFilter === 'alle') list = allContracts;
  if (activeCatFilter !== 'alle') list = list.filter(c => c.category === activeCatFilter);
  if (activeOwnerFilter === 'solo') list = list.filter(c => c.ownership !== 'shared');
  if (activeOwnerFilter === 'shared') list = list.filter(c => c.ownership === 'shared');
  if (ctFavOnly) list = list.filter(c => !!c.favorite);
  if (ctQualityFilter) list = list.filter(c => !isContractArchived(c) && (contractDataIssues(c).critical.length || contractDataIssues(c).hints.length));
  if (query) list = list.filter(c =>
    (c.name || '').toLowerCase().includes(query) ||
    (c.provider || '').toLowerCase().includes(query) ||
    (c.category || '').toLowerCase().includes(query) ||
    (c.custNo || '').toLowerCase().includes(query) ||
    (c.notes || '').toLowerCase().includes(query));

  // Qualitäts-Banner
  document.getElementById('ctQualityBanner').innerHTML = ctQualityFilter
    ? `<div class="tip tip-warn" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>Gefiltert: Verträge mit fehlenden Angaben</span><button class="tk-link-mini" data-ctact="quality-off">Filter aufheben</button></div>`
    : '';

  // ── Sortierung ──
  list = [...list];
  if (activeSort === 'wichtig') list.sort((a, b) => contractPriority(b).score - contractPriority(a).score);
  else if (activeSort === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else if (activeSort === 'cost') list.sort((a, b) => effectiveMonthly(b, 'gesamt') - effectiveMonthly(a, 'gesamt'));
  else if (activeSort === 'frist') {
    list.sort((a, b) => {
      const da = latestCancelDate(a), db = latestCancelDate(b);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
      return new Date(da) - new Date(db);
    });
  }

  // ── Karten-Renderer ──
  function cardCost(c) {
    // anteil = Meine Belastung (myShare), gesamt = Vollpreis
    return effectiveMonthly(c, cv === 'anteil' ? 'anteil' : 'gesamt');
  }
  function renderContractItem(c, isArch) {
    const prim = isArch ? { text: '', after: '', urgent: false } : contractPrimaryLine(c);
    const eff = cardCost(c);
    const avgFull = averageMonthly(c, 'gesamt');
    const effFull = effectiveMonthly(c, 'gesamt');
    const ownLabel = c.ownership === 'shared' ? 'Gemeinsam' : 'Persönlich';
    const nonMonthly = c.interval && c.interval !== 'monatlich';
    const hasExtra = Number(c.extraCost) > 0 && c.extraInterval && c.extraInterval !== 'einmalig';
    const favStar = c.favorite ? '⭐' : '☆';

    // Statuszeile für Archiv
    let archLine = '';
    if (isArch) {
      if (isContractCancelled(c) && c.cancelledUntil) archLine = `Gekündigt · beendet am ${fmtDate(c.cancelledUntil)}`;
      else if (c.endDate) archLine = `Abgelaufen am ${fmtDate(c.endDate)}`;
      else archLine = 'Beendet';
    }

    // Anteil-Hinweis bei geteilten Verträgen in "Meine Belastung"
    const shareHint = (!isArch && cv === 'anteil' && c.ownership === 'shared')
      ? `<div class="ct-share">Dein Anteil: ${fmtEurPlain(eff)} · Gesamt: ${fmtEurPlain(effFull)}</div>` : '';

    // Realer Rhythmus + Monatsdurchschnitt bei nicht-monatlicher Zahlung
    let rhythmHtml = '';
    if (!isArch && (nonMonthly || hasExtra)) {
      rhythmHtml = `<div class="ct-rhythm">${esc(contractRhythmText(c))}<br>aktuell umgerechnet ${fmtEurPlain(effFull)} pro Monat</div>`;
    }

    if (!isArch && (c.freeMonths || c.discountMonths)) rhythmHtml += `<div class="ct-rhythm">Durchschnitt im ersten Vertragsjahr: ${fmtEurPlain(avgFull)} pro Monat</div>`;

    // Energieverträge: Zähler-Verknüpfung
    let energyHtml = '';
    if (!isArch && (c.category === 'strom' || c.category === 'gas')) {
      const m = meterForContract(c.id);
      if (m) {
        const en = m.energy || {};
        const parts = [];
        if (Number.isFinite(Number(en.unitPrice)) && Number(en.unitPrice) > 0) parts.push(`Arbeitspreis ${String(en.unitPrice).replace('.', ',')} ct/kWh`);
        if (Number.isFinite(Number(en.basePrice)) && Number(en.basePrice) > 0) parts.push(`Grundpreis ${fmtEurPlain(en.basePrice)}/Monat`);
        energyHtml = `<div class="ct-energy">${parts.length ? parts.join(' · ') + '<br>' : ''}<button class="tk-link-mini" data-ctact="tometer" data-mtype="${esc(m.type)}">Zum Zähler</button> · <button class="tk-link-mini" data-ctact="follow" data-cid="${esc(c.id)}">Neuen Folgevertrag anlegen</button></div>`;
      } else {
        energyHtml = `<div class="ct-energy">Noch nicht mit einem Zähler verbunden. · <button class="tk-link-mini" data-ctact="follow" data-cid="${esc(c.id)}">Neuen Folgevertrag anlegen</button></div>`;
      }
    }

    return `<div class="ct-item${isArch ? ' archived' : ''}" data-cid="${esc(c.id)}">
      <div class="ct-ico">${CONTRACT_ICONS[c.category] || '📋'}</div>
      <div style="flex:1;min-width:0">
        <div class="ct-name" style="white-space:normal;word-break:break-word">${esc(c.name)}${c.provider ? ' · ' + esc(c.provider) : ''}</div>
        <div class="ct-sub">${ownLabel} · ${esc(c.interval || 'monatlich')}</div>
        ${prim.text ? `<div class="ct-primline${prim.urgent ? ' urgent' : ''}">${prim.text}${prim.after ? `<br><span class="ct-after">${prim.after}</span>` : ''}</div>` : ''}
        ${archLine ? `<div class="ct-primline">${archLine}</div>` : ''}
        ${shareHint}${rhythmHtml}${energyHtml}
        ${isArch ? `<button class="tk-link-mini" data-ctact="template" data-cid="${esc(c.id)}" style="margin-top:4px">Als Vorlage für neuen Vertrag verwenden</button>` : ''}
      </div>
      <div class="ct-price">
        <div class="ct-eur">${fmtEurPlain(eff)}</div>
        <div class="ct-per">/Mo · ${cvLabel}</div>
      </div>
      <button class="fav-star" data-fav="${esc(c.id)}" aria-label="Favorit">${favStar}</button>
    </div>`;
  }

  // ── Handlungsbedarf ──
  let mainHtml = '';
  if (!ctQualityFilter && activeSort === 'wichtig' && ctStatusFilter === 'aktiv') {
    const urgent = list.filter(c => contractPriority(c).score >= 440);
    if (urgent.length) {
      mainHtml += `<div class="an-sec" style="color:#d97706">Handlungsbedarf</div>`;
      mainHtml += urgent.map(c => renderContractItem(c, false)).join('');
      const rest = list.filter(c => contractPriority(c).score < 440);
      if (rest.length) {
        mainHtml += `<div class="an-sec" style="margin-top:12px">Aktive Verträge</div>`;
        mainHtml += rest.map(c => renderContractItem(c, false)).join('');
      }
    } else {
      mainHtml += list.map(c => renderContractItem(c, false)).join('');
    }
  } else {
    mainHtml += list.map(c => renderContractItem(c, ctStatusFilter === 'beendet' || ctStatusFilter === 'archiv')).join('');
  }
  if (!list.length) {
    mainHtml = `<div class="empty"><div class="ei">📄</div><p>${query ? 'Keine Treffer für „' + esc(query) + '".<br><span class="empty-cta">Anderen Suchbegriff versuchen.</span>' : (ctQualityFilter ? 'Alle Angaben sind vollständig. ✅' : 'Noch keine Verträge angelegt.<br><span class="empty-cta">Tippe <strong>+</strong> um den ersten Vertrag hinzuzufügen.</span>')}</p></div>`;
  } else if (cv === 'gesamt') {
    const sharedTotal = list.filter(c => c.ownership === 'shared' && !isContractArchived(c)).reduce((s, c) => s + effectiveMonthly(c, 'gesamt'), 0);
    mainHtml = `<div class="ct-listsum">Haushaltskosten (nur gemeinsame Verträge): <b>${fmtEurPlain(sharedTotal)}/Mo</b></div>` + mainHtml;
  } else {
    const myTotal = list.filter(c => !isContractArchived(c)).reduce((s, c) => s + effectiveMonthly(c, 'anteil'), 0);
    mainHtml = `<div class="ct-listsum">${list.length} ${list.length === 1 ? 'Vertrag' : 'Verträge'} · Meine Belastung: <b>${fmtEurPlain(myTotal)}/Mo</b></div>` + mainHtml;
  }

  // ── Datenqualität ──
  let qCritEnde = 0, qCritFrist = 0, qCritLaufzeit = 0, qAffected = 0;
  activeContracts.forEach(c => {
    const iss = contractDataIssues(c);
    if (iss.critical.some(x => x.includes('Vertragsende'))) qCritEnde++;
    if (iss.critical.some(x => x.includes('Kündigungsfrist'))) qCritFrist++;
    if (iss.critical.some(x => x.includes('Laufzeit'))) qCritLaufzeit++;
    if (iss.critical.length || iss.hints.length) qAffected++;
  });
  if (!ctQualityFilter && (qCritEnde || qCritFrist || qCritLaufzeit)) {
    const lines = [];
    if (qCritEnde) lines.push(`${qCritEnde} Vertrag${qCritEnde === 1 ? '' : 'e'} ohne Vertragsende`);
    if (qCritFrist) lines.push(`${qCritFrist} Vertrag${qCritFrist === 1 ? '' : 'e'} ohne Kündigungsfrist`);
    if (qCritLaufzeit) lines.push(`${qCritLaufzeit} Vertrag${qCritLaufzeit === 1 ? '' : 'e'} mit unklarer Laufzeit`);
    mainHtml += `<div class="card" style="margin-top:12px"><div class="card-label">Angaben ergänzen</div>
      ${lines.map(l => `<div style="font-size:12.5px;padding:3px 0">${l}</div>`).join('')}
      <button class="kb-btn" data-ctact="quality-on" style="margin-top:8px">Verträge prüfen</button>
    </div>`;
  }

  document.getElementById('contractList').innerHTML = mainHtml;

  // ── Energiehistorie (Strom & Gas getrennt, chronologisch) ──
  let extraHtml = '';
  ['strom', 'gas'].forEach(cat => {
    const hist = allContracts.filter(c => c.category === cat && Number.isFinite(Number(c.cost)) && Number(c.cost) > 0)
      .sort((a, b) => (a.startDate || '0000').localeCompare(b.startDate || '0000'));
    if (hist.length < 2) return;
    let rows = '';
    hist.forEach((c, i) => {
      const isCurr = !isContractArchived(c);
      const y1 = c.startDate ? c.startDate.slice(0, 4) : '';
      const endRef = c.endDate || c.cancelledUntil || '';
      const y2 = endRef ? endRef.slice(0, 4) : '';
      const period = isCurr ? 'Aktuell' : (y1 && y2 ? `${y1}–${y2}` : (y1 || '—'));
      const avg = averageMonthly(c, 'gesamt');
      let diffStr = '';
      if (i > 0) {
        const prevAvg = averageMonthly(hist[i - 1], 'gesamt');
        const d = avg - prevAvg;
        if (Math.abs(d) >= 0.5) diffStr = ` <span style="color:${d > 0 ? 'var(--red)' : 'var(--green)'}">(${d > 0 ? '+' : '−'}${fmtEurPlain(Math.abs(d))})</span>`;
      }
      rows += `<div class="ct-hist-row${isCurr ? ' curr' : ''}" data-cid="${esc(c.id)}">
        <span class="ct-hist-period">${period}</span>
        <span class="ct-hist-name">${esc(c.provider || c.name || '')}</span>
        <span class="ct-hist-amt">${fmtEurPlain(avg)}${diffStr}</span>
      </div>`;
    });
    extraHtml += `<div class="card" style="margin-top:12px"><div class="card-label">${cat === 'strom' ? '⚡ Strom' : '🔥 Gas'} · Energiehistorie (Ø erstes Vertragsjahr)</div>${rows}</div>`;
  });
  document.getElementById('ctExtra').innerHTML = extraHtml;

  // ── Archiv: nach Jahr gruppiert ──
  const archSec = document.getElementById('archiveSection');
  if (archived.length) {
    archSec.style.display = 'block';
    document.getElementById('archiveCount').textContent = `· ${archived.length} frühere Verträge`;
    const byYear = {};
    archived.forEach(c => {
      const ref = c.cancelledUntil || c.endDate || c.startDate || '';
      const y = ref ? ref.slice(0, 4) : 'Ohne Datum';
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(c);
    });
    let archHtml = '';
    Object.keys(byYear).sort().reverse().forEach(y => {
      archHtml += `<div class="an-sec">${esc(y)}</div>` + byYear[y].map(c => renderContractItem(c, true)).join('');
    });
    document.getElementById('archiveList').innerHTML = archHtml;
    document.getElementById('archiveList').style.display = archiveOpen ? 'block' : 'none';
  } else {
    archSec.style.display = 'none';
    document.getElementById('archiveList').innerHTML = '';
  }
}

// ── Filterdialog ──
function openContractFilterDialog() {
  const catSet = ['alle', ...new Set((Array.isArray(contracts) ? contracts : []).filter(c => c && c.category).map(c => c.category))];
  const catOpts = catSet.map(c => `<option value="${esc(c)}"${c === activeCatFilter ? ' selected' : ''}>${c === 'alle' ? 'Alle Kategorien' : (CONTRACT_ICONS[c] || '') + ' ' + esc(c)}</option>`).join('');
  const h = `
    <div class="fg"><label>Zugehörigkeit</label><select id="ctf-owner">
      <option value="alle"${activeOwnerFilter === 'alle' ? ' selected' : ''}>Alle</option>
      <option value="solo"${activeOwnerFilter === 'solo' ? ' selected' : ''}>Persönlich</option>
      <option value="shared"${activeOwnerFilter === 'shared' ? ' selected' : ''}>Gemeinsam</option>
    </select></div>
    <div class="fg"><label>Kategorie</label><select id="ctf-cat">${catOpts}</select></div>
    <div class="fg"><label>Status</label><select id="ctf-status">
      <option value="aktiv"${ctStatusFilter === 'aktiv' ? ' selected' : ''}>Aktiv</option>
      <option value="gekuendigt"${ctStatusFilter === 'gekuendigt' ? ' selected' : ''}>Gekündigt</option>
      <option value="beendet"${ctStatusFilter === 'beendet' ? ' selected' : ''}>Beendet / Archiv</option>
      <option value="alle"${ctStatusFilter === 'alle' ? ' selected' : ''}>Alle (inkl. Archiv)</option>
    </select></div>
    <div class="fg"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input autocomplete="off" type="checkbox" id="ctf-fav" ${ctFavOnly ? 'checked' : ''} style="width:18px;height:18px"> Nur Favoriten</label></div>
    <div style="display:flex;gap:9px;margin-top:8px">
      <button type="button" class="kb-btn" data-ctact="filter-reset" style="flex:0 0 auto">Zurücksetzen</button>
      <button type="button" class="kb-btn-primary" data-ctact="filter-apply" style="flex:1">Anwenden</button>
    </div>`;
  openKasseModal('Verträge filtern', h);
}

// ── Kündigungs-Dialog ──
let cancelFlowId = null;
function openCancelContractDialog(id) {
  const c = contracts.find(x => x && x.id === id);
  if (!c) return;
  cancelFlowId = id;
  const suggestedEnd = c.cancelledUntil || latestCancelDate(c) || c.endDate || '';
  const h = `
    <div style="font-size:13px;margin-bottom:12px"><b>${esc(c.name)}</b>${c.provider ? ' · ' + esc(c.provider) : ''}</div>
    <div class="fg"><label for="cf-on">Gekündigt am</label><input autocomplete="off" id="cf-on" type="date" value="${today()}"></div>
    <div class="fg"><label for="cf-until">Vertragsende</label><input autocomplete="off" id="cf-until" type="date" value="${esc(suggestedEnd)}"></div>
    <div class="fg"><label for="cf-note">Notiz / Bestätigung</label><input autocomplete="off" id="cf-note" placeholder="z.B. per E-Mail gekündigt, Bestätigung erhalten"></div>
    <div style="display:flex;gap:9px;margin-top:8px">
      <button type="button" class="kb-btn" data-ctact="cancelflow-abort" style="flex:0 0 auto">Abbrechen</button>
      <button type="button" class="kb-btn-primary" data-ctact="cancelflow-save" style="flex:1">Als gekündigt markieren</button>
    </div>`;
  openKasseModal('Kündigung', h);
}
function saveCancelFlow() {
  const c = contracts.find(x => x && x.id === cancelFlowId);
  if (!c) { closeKasseModal(); return; }
  c.cancelledStatus = true;
  c.cancelledOn = document.getElementById('cf-on')?.value || today();
  c.cancelledUntil = document.getElementById('cf-until')?.value || '';
  c.cancelNote = document.getElementById('cf-note')?.value.trim() || '';
  save('vh_contracts', contracts);
  closeKasseModal();
  closeModal('contractModal');
  renderContracts(); renderAmpel();
}

// ── Vorlage / Folgevertrag ──
function useContractAsTemplate(id, isFollowUp) {
  const c = contracts.find(x => x && x.id === id);
  if (!c) return;
  openAddContractModal(); // setzt alles zurück, neue ID, kein Kündigungsstatus
  document.getElementById('f-name').value = c.name || '';
  document.getElementById('f-category').value = c.category || 'sonstiges';
  document.getElementById('f-group').value = c.analysisGroup || getAnalysisGroup(c.category || 'sonstiges');
  setOwnership(c.ownership === 'shared' ? 'shared' : 'solo');
  document.getElementById('f-start').value = today();
  if (isFollowUp) {
    // Folgevertrag: Anbieter & Kundennummer bewusst NICHT übernehmen
  } else {
    // Vorlage: Grunddaten inkl. Kosten übernehmen
    document.getElementById('f-provider').value = c.provider || '';
    document.getElementById('f-cost').value = c.cost || '';
    document.getElementById('f-interval').value = c.interval || 'monatlich';
    document.getElementById('f-extracost').value = c.extraCost || '';
    document.getElementById('f-extrainterval').value = c.extraInterval || 'einmalig';
  }
  document.getElementById('ctModalTitle').textContent = isFollowUp ? 'Folgevertrag anlegen' : 'Vertrag aus Vorlage';
}

// ── Globale Delegation für Vertrags-Aktionen ──
document.addEventListener('click', e => {
 try {
  const b = e.target.closest('[data-ctact]');
  if (!b) return;
  e.stopPropagation();
  const act = b.dataset.ctact;
  if (act === 'openfilter') openContractFilterDialog();
  else if (act === 'filter-apply') {
    activeOwnerFilter = document.getElementById('ctf-owner')?.value || 'alle';
    activeCatFilter = document.getElementById('ctf-cat')?.value || 'alle';
    ctStatusFilter = document.getElementById('ctf-status')?.value || 'aktiv';
    ctFavOnly = !!document.getElementById('ctf-fav')?.checked;
    closeKasseModal(); renderContracts();
  }
  else if (act === 'filter-reset') {
    activeOwnerFilter = 'alle'; activeCatFilter = 'alle'; ctStatusFilter = 'aktiv'; ctFavOnly = false; ctQualityFilter = false;
    closeKasseModal(); renderContracts();
  }
  else if (act === 'checkfristen') { activeSort = 'frist'; const s = document.getElementById('ctSortSel'); if (s) s.value = 'frist'; renderContracts(); }
  else if (act === 'addcontract') openAddContractModal();
  else if (act === 'quality-on') { ctQualityFilter = true; renderContracts(); }
  else if (act === 'quality-off') { ctQualityFilter = false; renderContracts(); }
  else if (act === 'tometer') { activeMeterType = b.dataset.mtype || activeMeterType; showPage('meters'); }
  else if (act === 'follow') useContractAsTemplate(b.dataset.cid, true);
  else if (act === 'template') useContractAsTemplate(b.dataset.cid, false);
  else if (act === 'startcancel') { if (editContractId) openCancelContractDialog(editContractId); }
  else if (act === 'cancelflow-save') saveCancelFlow();
  else if (act === 'cancelflow-abort') closeKasseModal();
 } catch (err) {
   console.warn('[Verträge] Aktion fehlgeschlagen:', err);
 }
});
// ── Kündigungsstatus-Toggle im Modal ──
let currentCancelledStatus = false;
function setCancelledStatus(val) {
  currentCancelledStatus = val;
  document.getElementById('cs-nein').className = 'acc-btn' + (!val ? ' ai' : '');
  document.getElementById('cs-ja').className = 'acc-btn' + (val ? ' ai' : '');
  document.getElementById('cancelledFields').style.display = val ? 'block' : 'none';
}
document.getElementById('cs-nein').addEventListener('click', () => setCancelledStatus(false));
document.getElementById('cs-ja').addEventListener('click', () => setCancelledStatus(true));

function setOwnership(type) {
  currentOwnership = type;
  document.getElementById('own-solo').className = 'own-btn' + (type === 'solo' ? ' active-solo' : '');
  document.getElementById('own-shared').className = 'own-btn' + (type === 'shared' ? ' active-shared' : '');
  document.getElementById('sharedHint').style.display = type === 'shared' ? 'block' : 'none';
}
document.getElementById('own-solo').addEventListener('click', () => setOwnership('solo'));
document.getElementById('own-shared').addEventListener('click', () => setOwnership('shared'));

function openAddContractModal() {
  editContractId = null;
  document.getElementById('ctModalTitle').textContent = 'Vertrag hinzufügen';
  document.getElementById('deleteContractBtn').style.display = 'none';
  ['f-name', 'f-provider', 'f-custno', 'f-cancelurl', 'f-notes', 'f-cancelNote'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['f-cost', 'f-extracost', 'f-discount', 'f-discountmonths', 'f-freemonths', 'f-minterm'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('f-cancelval').value = '3';
  document.getElementById('f-cancelunit').value = 'monate';
  document.getElementById('f-cancelcond').value = 'jederzeit';
  document.getElementById('f-start').value = today();
  document.getElementById('f-end').value = '';
  document.getElementById('f-cancelledOn').value = '';
  document.getElementById('f-cancelledUntil').value = '';
  document.getElementById('f-category').value = 'streaming';
  document.getElementById('f-group').value = getAnalysisGroup('streaming');
  document.getElementById('f-interval').value = 'monatlich';
  document.getElementById('f-extrainterval').value = 'einmalig';
  document.getElementById('f-autorenew').value = 'ja';
  document.getElementById('costPreview').style.display = 'none';
  document.getElementById('cancelDatePreview').textContent = '';
  document.getElementById('mintermHint').textContent = '';
  setOwnership('solo');
  setCancelledStatus(false);
  const fav = document.getElementById('f-fav'); if (fav) fav.checked = false;
  const scb = document.getElementById('startCancelBtn'); if (scb) scb.style.display = 'none';
  document.querySelectorAll('#contractModal details.cf-sec').forEach((d, i) => { d.open = i < 2; });
  openModal('contractModal');
}

function openEditContractModal(id) {
  const c = contracts.find(x => x.id === id);
  if (!c) return;
  editContractId = id;
  document.getElementById('ctModalTitle').textContent = 'Vertrag bearbeiten';
  document.getElementById('deleteContractBtn').style.display = 'block';
  document.getElementById('f-name').value = c.name || '';
  document.getElementById('f-provider').value = c.provider || '';
  document.getElementById('f-category').value = c.category || 'streaming';
  document.getElementById('f-group').value = c.analysisGroup || getAnalysisGroup(c.category || 'streaming');
  document.getElementById('f-cost').value = c.cost || '';
  document.getElementById('f-interval').value = c.interval || 'monatlich';
  document.getElementById('f-extracost').value = c.extraCost || '';
  document.getElementById('f-extrainterval').value = c.extraInterval || 'einmalig';
  document.getElementById('f-discount').value = c.discount || '';
  document.getElementById('f-discountmonths').value = c.discountMonths || '';
  document.getElementById('f-freemonths').value = c.freeMonths || '';
  document.getElementById('f-minterm').value = c.minTerm || '';
  document.getElementById('f-start').value = c.startDate || '';
  document.getElementById('f-end').value = c.endDate || '';
  document.getElementById('f-cancelval').value = c.cancelVal !== undefined ? c.cancelVal : (c.cancelDays || '');
  document.getElementById('f-cancelunit').value = c.cancelUnit || 'tage';
  document.getElementById('f-cancelcond').value = c.cancelCond || 'jederzeit';
  document.getElementById('f-autorenew').value = c.autoRenew || 'ja';
  document.getElementById('f-custno').value = c.custNo || '';
  document.getElementById('f-cancelurl').value = c.cancelUrl || '';
  document.getElementById('f-notes').value = c.notes || '';
  // Kündigungsstatus
  document.getElementById('f-cancelledOn').value = c.cancelledOn || '';
  document.getElementById('f-cancelledUntil').value = c.cancelledUntil || '';
  document.getElementById('f-cancelNote').value = c.cancelNote || '';
  setCancelledStatus(!!c.cancelledStatus);
  setOwnership(c.ownership || 'solo');
  const fav = document.getElementById('f-fav'); if (fav) fav.checked = !!c.favorite;
  const scb = document.getElementById('startCancelBtn'); if (scb) scb.style.display = c.cancelledStatus ? 'none' : 'block';
  document.querySelectorAll('#contractModal details.cf-sec').forEach((d, i) => { d.open = i < 2; });
  if (c.cancelledStatus) { const st = document.getElementById('cf-status-sec'); if (st) st.open = true; }
  updateCostPreview();
  updateCancelPreview();
  openModal('contractModal');
}
document.getElementById('saveContractBtn').addEventListener('click', () => {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { alert('Bitte Vertragsname eingeben.'); return; }
  const existing = editContractId ? contracts.find(c => c.id === editContractId) : null;
  const entry = {
    id: editContractId || uid(), name,
    provider: document.getElementById('f-provider').value.trim(),
    category: document.getElementById('f-category').value,
    cost: parseDE(document.getElementById('f-cost').value),
    interval: document.getElementById('f-interval').value,
    extraCost: parseDE(document.getElementById('f-extracost').value),
    extraInterval: document.getElementById('f-extrainterval').value,
    discount: parseDE(document.getElementById('f-discount').value),
    discountMonths: parseInt(document.getElementById('f-discountmonths').value) || 0,
    freeMonths: parseInt(document.getElementById('f-freemonths').value) || 0,
    minTerm: parseInt(document.getElementById('f-minterm').value) || 0,
    startDate: document.getElementById('f-start').value,
    endDate: document.getElementById('f-end').value,
    cancelVal: parseInt(document.getElementById('f-cancelval').value) || 0,
    cancelUnit: document.getElementById('f-cancelunit').value,
    cancelCond: document.getElementById('f-cancelcond').value,
    cancelDays: cancelValToDays({ cancelVal: parseInt(document.getElementById('f-cancelval').value) || 0, cancelUnit: document.getElementById('f-cancelunit').value }),
    autoRenew: document.getElementById('f-autorenew').value,
    custNo: document.getElementById('f-custno').value.trim(),
    cancelUrl: safeWebUrl(document.getElementById('f-cancelurl').value.trim()),
    notes: document.getElementById('f-notes').value.trim(),
    ownership: currentOwnership,
    favorite: document.getElementById('f-fav') ? !!document.getElementById('f-fav').checked : (existing?.favorite || false),
    analysisGroup: document.getElementById('f-group').value || getAnalysisGroup(document.getElementById('f-category').value),
    // Kündigungsstatus
    cancelledStatus: currentCancelledStatus,
    cancelledOn: currentCancelledStatus ? (document.getElementById('f-cancelledOn').value || '') : '',
    cancelledUntil: currentCancelledStatus ? (document.getElementById('f-cancelledUntil').value || '') : '',
    cancelNote: currentCancelledStatus ? (document.getElementById('f-cancelNote').value.trim() || '') : '',
  };
  if (editContractId) contracts = contracts.map(c => c.id === editContractId ? entry : c);
  else contracts.push(entry);
  if(!save('vh_contracts', contracts))return;
  // HOMEHUB DRAGON
  if (editContractId) rewardDragon('contractUpdate', { id: entry.id }); else rewardDragon('contractCreate', { id: entry.id });
  closeModal('contractModal');
  renderContracts(); renderAmpel(); renderHome();
});
document.getElementById('deleteContractBtn').addEventListener('click', () => {
  if (!editContractId || !confirm('Vertrag löschen?')) return;
  contracts = contracts.filter(c => c.id !== editContractId);
  save('vh_contracts', contracts);
  closeModal('contractModal');
  renderContracts(); renderAmpel();
});
document.getElementById('cancelContractBtn').addEventListener('click', () => closeModal('contractModal'));

// Kategorie-Wechsel → Lebensbereich automatisch vorschlagen
document.getElementById('f-category').addEventListener('change', function() {
  document.getElementById('f-group').value = getAnalysisGroup(this.value);
});

// ════════════════════════════════════════════
