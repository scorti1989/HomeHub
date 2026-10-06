'use strict';
// KASSE
// ════════════════════════════════════════════
let activeHaushalt = 'wir';
let activeKasseTab = 'uebersicht';
// Aktiv angezeigter Monat (YYYY-MM); null = aktueller Monat
let activeViewMonth = null;
function getViewMonth() { return activeViewMonth || currMonth(); }
function isCurrentMonth() { return getViewMonth() === currMonth(); }

// Monatsnavigation: einen Monat zurück/vor
function shiftMonth(delta) {
  const [y, m] = getViewMonth().split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const newM = `${d.getFullYear()}-${_pad(d.getMonth() + 1)}`;
  // Nicht in die Zukunft navigieren
  if (newM > currMonth()) return;
  activeViewMonth = newM === currMonth() ? null : newM;
  renderKasse();
}

// ── Unified 3-Button-Toggle: 'wir' | 'anteil' | 'ich' ──
// activeHaushalt = 'wir' → gesamt-Ansicht gemeinsamer Konto
// activeHaushalt = 'anteil' → Wir-Konto, aber nur mein Anteil
// activeHaushalt = 'ich' → persönliches Konto
function setHaushalt(mode) {
  activeHaushalt = mode === 'anteil' ? 'wir' : mode;
  kasseCostView  = mode === 'anteil' ? 'anteil' : (mode === 'wir' ? 'gesamt' : 'anteil');

  document.getElementById('hb-wir-btn').className    = 'hh-btn' + (mode === 'wir'    ? ' aw' : '');
  document.getElementById('hb-anteil-btn').className = 'hh-btn' + (mode === 'anteil' ? ' aa' : '');
  document.getElementById('hb-ich-btn').className    = 'hh-btn' + (mode === 'ich'    ? ' ai' : '');

  renderKasse();
}
function updateKasseModeHint() {
  const el = document.getElementById('kasseModeHint');
  if (!el) return;
  const mode3 = getHaushaltMode();
  if (mode3 === 'anteil') {
    const pct = (typeof settings.splitPct === 'number' && isFinite(settings.splitPct)) ? Math.round(settings.splitPct) : 50;
    el.textContent = `Zeigt deinen Anteil (${pct} %) an gemeinsamen Ausgaben.`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}
// Aktuellen 3-Toggle-Modus ermitteln (für Konsistenz bei Re-Renders)
function getHaushaltMode() {
  if (activeHaushalt === 'ich') return 'ich';
  return kasseCostView === 'gesamt' ? 'wir' : 'anteil';
}
document.getElementById('hb-wir-btn').addEventListener('click',    () => setHaushalt('wir'));
document.getElementById('hb-anteil-btn').addEventListener('click', () => setHaushalt('anteil'));
document.getElementById('hb-ich-btn').addEventListener('click',    () => setHaushalt('ich'));

document.querySelectorAll('#kasseTabs .ktab').forEach(btn => {
  btn.addEventListener('click', () => { mehrView = null; setKasseTab(btn.dataset.tab); });
});

// ── PERMANENTE Event-Delegation für #kasseContent ──────────────────────────
// Registriert EINMAL – überlebt alle innerHTML-Neuaufbauten.
// Alle renderKasse*-Funktionen dürfen NUR innerHTML setzen,
// niemals selbst addEventListener auf kasseContent aufrufen.
document.getElementById('kasseContent').addEventListener('click', e => {
  // Monatsnavigation (Übersicht + Ausgaben)
  if (e.target.closest('#mnPrev,#mnPrev2'))  { shiftMonth(-1); return; }
  if (e.target.closest('#mnNext,#mnNext2'))  { shiftMonth(+1); return; }

  // Ausgaben – Kategorie-Chip
  const chip = e.target.closest('[data-ausgcat]');
  if (chip) { activeAusgabenCat = chip.dataset.ausgcat; renderKasseAusgaben(); return; }

  // Ausgaben / Analyse – Eintrag bearbeiten
  const expRow = e.target.closest('.exp-row[data-eid]');
  if (expRow) { openEditExpense(expRow.dataset.eid); return; }

  // Analyse – Monat anspringen
  const jumpRow = e.target.closest('[data-jumpmonth]');
  if (jumpRow) {
    const m = jumpRow.dataset.jumpmonth;
    activeViewMonth = m === currMonth() ? null : m;
    setKasseTab('uebersicht');
    return;
  }

  // Einkauf – Checkbox, Löschen, Bearbeiten, Abrechnen
  const chk = e.target.closest('[data-chk]');
  if (chk) { toggleShopItem(parseInt(chk.dataset.chk)); return; }
  const rm  = e.target.closest('[data-rm]');
  if (rm)  { removeShopItem(parseInt(rm.dataset.rm)); return; }
  const editShop = e.target.closest('[data-edit-shop]');
  if (editShop) { openEditShopItem(parseInt(editShop.dataset.editShop)); return; }

  // Übersicht – Buttons und letzte Buchungen
  if (e.target.closest('#uebToBuchungenBtn')) { setKasseTab('ausgaben'); return; }
  if (e.target.closest('#uebAddExpBtn')) { openAddExpense(); return; }
  const recRow = e.target.closest('.hm-recent-row[data-eid]');
  if (recRow) { openEditExpense(recRow.dataset.eid); return; }

  // Budgets – Kategorie antippen
  const bcat = e.target.closest('[data-bcat]');
  if (bcat) { openBudgetModal(bcat.dataset.bcat); return; }

  // Ausgleich – Transfer bearbeiten
  const trow = e.target.closest('.transfer-row[data-tid]');
  if (trow) { openEditTransfer(trow.dataset.tid); return; }
});

// Buchungen – Suche & Filter (input/change-Delegation, einmalig registriert)
document.getElementById('kasseContent').addEventListener('input', e => {
  if (e.target && e.target.id === 'buchungenSearch') {
    buchungenSearchTerm = e.target.value;
    const pos = e.target.selectionStart;
    renderKasseAusgaben();
    const el = document.getElementById('buchungenSearch');
    if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (err) {} }
  }
});
document.getElementById('kasseContent').addEventListener('change', e => {
  if (!e.target) return;
  if (e.target.id === 'buchungenCatFilter') { activeAusgabenCat = e.target.value; renderKasseAusgaben(); }
  else if (e.target.id === 'buchungenSort') { buchungenSort = e.target.value; renderKasseAusgaben(); }
});

function setKasseTab(tab) {
  activeKasseTab = tab;
  document.querySelectorAll('#kasseTabs .ktab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderKasse();
}

let mehrView = null; // null (Kartenübersicht) | 'einkauf' | 'ausgleich' | 'recurring'

function renderKasse() {
  if (activePage !== 'kasse') return;
  // BUG FIX: autoBookRecurring VOR Monatsberechnung aufrufen
  autoBookRecurring();
  updateKasseModeHint();
  if (activeKasseTab === 'uebersicht') renderKasseUebersicht();
  else if (activeKasseTab === 'ausgaben') renderKasseAusgaben();
  else if (activeKasseTab === 'budgets') renderKasseBudgets();
  else if (activeKasseTab === 'mehr') renderKasseMehr();
}

function expensesForMonth(m) { return expenses.filter(e => e.date && e.date.startsWith(m)); }

// Berechnet den angezeigten Betrag einer Ausgabe basierend auf Kostenansicht
function expAmt(e) {
  if (!e) return 0; // BUGFIX 6: null guard
  if (e.account !== 'wir') return Number(e.amount || 0);
  if (kasseCostView === 'gesamt') return Number(e.amount || 0);
  // BUGFIX 6: Ensure splitPct is valid before using it
  const pct = (typeof settings.splitPct === 'number' && isFinite(settings.splitPct))
    ? Math.min(99, Math.max(1, settings.splitPct))
    : 50;
  return Number(e.amount || 0) * (pct / 100);
}

function catLabelShort(cat) {
  const f = EXP_CATS.find(c => c.v === cat);
  return f ? f.l.replace(/^\S+\s/, '') : (cat || 'Kategorie');
}

function fmtDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' });
}

// ── Genau EIN wichtigster Hinweis für die Übersicht, nach fester Priorität ──
function getUebersichtHint(hb, vm) {
  const hbBudgets = (budgets && budgets[hb] && typeof budgets[hb] === 'object') ? budgets[hb] : {};
  const exps = expensesForMonth(vm).filter(e => e && e.account === hb);
  const byCat = {};
  exps.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + expAmt(e); });

  // 1) Budget deutlich überschritten
  let worstOver = null;
  Object.keys(hbBudgets).forEach(cat => {
    const limit = Number(hbBudgets[cat] || 0);
    if (!limit) return;
    const spent = byCat[cat] || 0;
    if (spent > limit) {
      const over = spent - limit;
      if (!worstOver || over > worstOver.over) worstOver = { cat, over };
    }
  });
  if (worstOver) {
    if (worstOver.cat === 'gesundheit') return 'Gesundheitsbudget überschritten – Budgethöhe prüfen';
    return `${catLabelShort(worstOver.cat)}budget um ${fmtEurPlain(worstOver.over)} überschritten`;
  }

  // 2) Budget über 90 %
  let closest = null;
  Object.keys(hbBudgets).forEach(cat => {
    const limit = Number(hbBudgets[cat] || 0);
    if (!limit) return;
    const spent = byCat[cat] || 0;
    const pct = spent / limit;
    if (pct >= 0.9) { if (!closest || pct > closest.pct) closest = { cat, pct }; }
  });
  if (closest) {
    if (closest.cat === 'gesundheit') return 'Gesundheitsbudget fast erreicht';
    return `${catLabelShort(closest.cat)}budget zu ${Math.round(closest.pct * 100)} % ausgeschöpft`;
  }

  // 3) Außergewöhnlich hoher Einzelkauf (als solcher erklärt, kein Trend)
  const totalCm = exps.reduce((s, e) => s + expAmt(e), 0);
  if (totalCm > 0) {
    const sorted = [...exps].sort((a, b) => expAmt(b) - expAmt(a));
    const top = sorted[0];
    if (top && expAmt(top) >= 50 && expAmt(top) >= totalCm * 0.3) {
      return `Einzelkauf „${top.desc || 'Ausgabe'}" prägt den Monat (${fmtEurPlain(expAmt(top))})`;
    }
  }

  // 4) Starke Abweichung zum Vergleichszeitraum (zeitbereinigt bei laufendem Monat)
  const isCurr = (vm === currMonth());
  const now = new Date();
  const dayCutoff = isCurr ? now.getDate() : null;
  const [vy, vmo] = vm.split('-').map(Number);
  const pmDate = new Date(vy, vmo - 2, 1);
  const pmKey = `${pmDate.getFullYear()}-${_pad(pmDate.getMonth() + 1)}`;
  const pmExpsAll = expensesForMonth(pmKey).filter(e => e && e.account === hb);
  const dayOf = e => Number((e.date || '').slice(8, 10)) || 0;
  const pmExps = dayCutoff ? pmExpsAll.filter(e => dayOf(e) <= dayCutoff) : pmExpsAll;
  const curExps = dayCutoff ? exps.filter(e => dayOf(e) <= dayCutoff) : exps;
  const byCatPm = {}, byCatCur = {};
  pmExps.forEach(e => { byCatPm[e.category] = (byCatPm[e.category] || 0) + expAmt(e); });
  curExps.forEach(e => { byCatCur[e.category] = (byCatCur[e.category] || 0) + expAmt(e); });
  let biggestDev = null;
  new Set([...Object.keys(byCatPm), ...Object.keys(byCatCur)]).forEach(cat => {
    const prev = byCatPm[cat] || 0, cur = byCatCur[cat] || 0;
    const d = cur - prev;
    if (prev > 0 && Math.abs(d) >= 20 && Math.abs(d) >= prev * 0.2) {
      if (!biggestDev || Math.abs(d) > Math.abs(biggestDev.d)) biggestDev = { cat, d };
    }
  });
  if (biggestDev) {
    const dir = biggestDev.d > 0 ? 'mehr' : 'weniger';
    return `${catLabelShort(biggestDev.cat)} ${fmtEurPlain(Math.abs(biggestDev.d))} ${dir} als im Vergleichszeitraum`;
  }

  // 5) kein Hinweis
  return null;
}

function renderKasseUebersicht() {
  const vm = getViewMonth(), hb = activeHaushalt;
  const [vy, vm2] = vm.split('-').map(Number);
  const vmDate = new Date(vy, vm2 - 1, 1);
  const isCurr = isCurrentMonth();
  const mode3 = getHaushaltMode();

  const exCm = expensesForMonth(vm).filter(e => e && e.account === hb);
  const totalCm = exCm.reduce((s, e) => s + expAmt(e), 0);
  const hbBudgets = (budgets && budgets[hb] && typeof budgets[hb] === 'object') ? budgets[hb] : {};
  const budgetSum = Object.values(hbBudgets).reduce((s, v) => s + (Number.isFinite(Number(v)) ? Number(v) : 0), 0);

  const byCat = {};
  exCm.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + expAmt(e); });
  const top3 = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const hint = getUebersichtHint(hb, vm);
  const recent3 = [...exCm].filter(e => e && e.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  let html = `
  <div class="month-nav">
    <button class="month-nav-btn" id="mnPrev">‹</button>
    <div>
      <div class="month-nav-label">${vmDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</div>
      <div class="month-nav-sub">${isCurr ? 'Aktueller Monat' : 'Vergangener Monat'}</div>
    </div>
    <button class="month-nav-btn" id="mnNext" ${isCurr ? 'disabled' : ''}>›</button>
  </div>
  <div class="hero-card ${mode3 === 'ich' ? 'ich' : 'wir'}">
    <div class="hero-amount">${fmtEurPlain(totalCm)}</div>
    <div class="hero-sub">${exCm.length} Buchung${exCm.length === 1 ? '' : 'en'}</div>
  </div>`;

  if (budgetSum > 0) {
    const rest = budgetSum - totalCm;
    const pct = budgetSum > 0 ? Math.min(100, totalCm / budgetSum * 100) : 0;
    html += `<div class="card">
      <div class="card-label">Budget</div>
      <div style="font-size:16px;font-weight:700">${fmtEurPlain(totalCm)} <span style="font-weight:400;color:var(--muted);font-size:13px">von ${fmtEurPlain(budgetSum)}</span></div>
      <div style="font-size:12.5px;margin-top:2px;color:${rest < 0 ? 'var(--red)' : 'var(--muted)'}">${rest < 0 ? 'überschritten um ' + fmtEurPlain(Math.abs(rest)) : 'noch ' + fmtEurPlain(rest)}</div>
      <div class="bar-track" style="margin-top:8px"><div class="bar-fill" style="width:${pct}%;background:${rest < 0 ? 'var(--red)' : 'var(--accent)'}"></div></div>
    </div>`;
  }

  if (top3.length) {
    html += `<div class="card"><div class="card-label">Größte Bereiche</div>`;
    top3.forEach(([cat, amt]) => {
      html += `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid var(--border)"><span>${EXP_ICON[cat] || '📋'} ${esc(cat)}</span><span style="font-weight:600">${fmtEurPlain(amt)}</span></div>`;
    });
    html += `</div>`;
  }

  if (hint) {
    html += `<div class="tip tip-warn"><div class="tip-title">Wichtig</div>${esc(hint)}</div>`;
  }

  if (recent3.length) {
    html += `<div class="card">
      <div class="hm-card-head"><span class="card-label" style="margin:0">Letzte Buchungen</span><button class="hm-link-btn" id="uebToBuchungenBtn">Alle</button></div>`;
    recent3.forEach(e => {
      html += `<div class="hm-recent-row" data-eid="${esc(e.id)}">
        <div class="exp-ico" style="background:${EXP_BG[e.category] || '#f1f5f9'}">${EXP_ICON[e.category] || '📋'}</div>
        <div class="hm-recent-info"><div class="hm-recent-name">${esc(e.desc)}</div><div class="hm-recent-date">${fmtDate(e.date)}</div></div>
        <div class="hm-recent-amt">${fmtEurPlain(expAmt(e))}</div>
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<div class="empty"><div class="ei">💸</div><p>Noch keine Ausgaben diesen Monat.<br><span class="empty-cta">Tippe unten, um die erste Ausgabe zu erfassen.</span></p></div>`;
  }

  html += `<button class="kb-btn-primary" id="uebAddExpBtn" style="margin-top:4px">+ Ausgabe hinzufügen</button>`;

  document.getElementById('kasseContent').innerHTML = html;
}
// Aktiver Kategorie-Filter + Suche + Sortierung in der Buchungen-Liste
let activeAusgabenCat = 'alle';
let buchungenSearchTerm = '';
let buchungenSort = 'neueste'; // neueste | aelteste | hoechster | niedrigster

function renderKasseAusgaben() {
  const vm = getViewMonth(), hb = activeHaushalt;
  const [vy, vm2] = vm.split('-').map(Number);
  const vmDate = new Date(vy, vm2 - 1, 1);
  const isCurr = isCurrentMonth();
  const mode3 = getHaushaltMode();
  const modeLabel = mode3 === 'wir' ? 'Gemeinsam' : mode3 === 'anteil' ? 'Mein Anteil' : 'Persönlich';

  let allList = expensesForMonth(vm).filter(e => e && e.account === hb);
  const totalAll = allList.reduce((s, e) => s + expAmt(e), 0);

  const cats = ['alle', ...new Set(allList.map(e => e.category).filter(Boolean))];
  if (!cats.includes(activeAusgabenCat)) activeAusgabenCat = 'alle';
  let list = activeAusgabenCat === 'alle' ? allList : allList.filter(e => e.category === activeAusgabenCat);

  // Suche über Beschreibung, Notiz, Kategorie, Analysegruppe, Reise, Betrag
  const term = (buchungenSearchTerm || '').trim().toLowerCase();
  if (term) {
    list = list.filter(e => {
      const amtStr = (e.amount !== null && e.amount !== undefined) ? String(e.amount).replace('.', ',') : '';
      const hay = [e.desc, e.note, e.category, e.analysisGroup, e.tripId, amtStr].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
  }

  const sortFns = {
    neueste:     (a, b) => (b.date || '').localeCompare(a.date || ''),
    aelteste:    (a, b) => (a.date || '').localeCompare(b.date || ''),
    hoechster:   (a, b) => expAmt(b) - expAmt(a),
    niedrigster: (a, b) => expAmt(a) - expAmt(b),
  };
  list = [...list].sort(sortFns[buchungenSort] || sortFns.neueste);
  const total = list.reduce((s, e) => s + expAmt(e), 0);

  let html = `
  <div class="month-nav">
    <button class="month-nav-btn" id="mnPrev2">‹</button>
    <div>
      <div class="month-nav-label">${vmDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</div>
      <div class="month-nav-sub">${modeLabel} · ${allList.length} Buchungen · ${fmtEurPlain(totalAll)}</div>
    </div>
    <button class="month-nav-btn" id="mnNext2" ${isCurr ? 'disabled' : ''}>›</button>
  </div>
  <input class="search-bar" id="buchungenSearch" type="search" placeholder="🔍 Buchungen durchsuchen …" autocomplete="off" value="${esc(buchungenSearchTerm)}">
  <div class="buchungen-filters">
    <select id="buchungenCatFilter">
      ${cats.map(c => `<option value="${esc(c)}"${c === activeAusgabenCat ? ' selected' : ''}>${c === 'alle' ? 'Kategorie: Alle' : 'Kategorie: ' + esc(c)}</option>`).join('')}
    </select>
    <select id="buchungenSort">
      <option value="neueste"${buchungenSort === 'neueste' ? ' selected' : ''}>Sortierung: Neueste</option>
      <option value="aelteste"${buchungenSort === 'aelteste' ? ' selected' : ''}>Sortierung: Älteste</option>
      <option value="hoechster"${buchungenSort === 'hoechster' ? ' selected' : ''}>Sortierung: Höchster Betrag</option>
      <option value="niedrigster"${buchungenSort === 'niedrigster' ? ' selected' : ''}>Sortierung: Niedrigster Betrag</option>
    </select>
  </div>`;

  if (!list.length) {
    html += term
      ? `<div class="empty"><div class="ei">🔍</div><p>Keine Treffer für „${esc(buchungenSearchTerm)}".</p></div>`
      : `<div class="empty"><div class="ei">💸</div><p>Noch keine Ausgaben diesen Monat.<br><span class="empty-cta">Tippe <strong>+</strong> um die erste Ausgabe einzutragen.</span></p></div>`;
  } else {
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 8px">
      <div style="font-size:12px;color:var(--muted)">${list.length} Buchung${list.length === 1 ? '' : 'en'}</div>
      <div style="font-weight:700;color:${hb === 'wir' ? 'var(--pink)' : 'var(--accent)'}">${fmtEurPlain(total)}</div>
    </div>`;

    // Gruppierung nach Datum: Heute / Gestern / Datum
    const groups = [];
    let curKey = null, curGroup = null;
    const todayStr = today();
    const yestD = new Date(); yestD.setDate(yestD.getDate() - 1);
    const yestStr = `${yestD.getFullYear()}-${_pad(yestD.getMonth() + 1)}-${_pad(yestD.getDate())}`;
    list.forEach(e => {
      const key = e.date || '—';
      if (key !== curKey) {
        curKey = key;
        const label = key === todayStr ? 'Heute' : key === yestStr ? 'Gestern' : fmtDateShort(key);
        curGroup = { label, items: [] };
        groups.push(curGroup);
      }
      curGroup.items.push(e);
    });

    groups.forEach(g => {
      html += `<div class="buchungen-daygroup">${esc(g.label)}</div>`;
      g.items.forEach(e => {
        html += `<div class="exp-row" data-eid="${esc(e.id)}">
          <div class="exp-ico" style="background:${EXP_BG[e.category] || '#f1f5f9'}">${esc(EXP_ICON[e.category] || '📋')}</div>
          <div style="flex:1;min-width:0">
            <div class="exp-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.desc)}${e.recurringId ? '<span class="rec-badge">🔄</span>' : ''}</div>
            <div class="exp-sub2">${esc(e.category || '')} · ${e.account === 'wir' ? 'Gemeinsam' : 'Persönlich'}</div>
          </div>
          <div class="exp-right"><div class="exp-eur">${fmtEurPlain(expAmt(e))}</div></div>
        </div>`;
      });
    });
  }

  document.getElementById('kasseContent').innerHTML = html;
}
function renderKasseEinkauf(){
 const items=shopLists.items||[],open=items.filter(i=>!i.checked),done=items.filter(i=>i.checked);
 const sum=list=>list.reduce((n,i)=>n+(Number(i.price)||0),0);
 const suggestions=shopSuggestions().filter(i=>!open.some(x=>shopKey(x.name)===shopKey(i.name))).slice(0,6);
 let html=`<div class="shop-quick"><input id="shopQuickName" aria-label="Artikel schnell hinzufügen" placeholder="Was brauchst du?" list="shopQuickNames"><button class="kb-btn" data-shop-action="add">Hinzufügen</button></div>
 <datalist id="shopQuickNames">${shopSuggestions().map(i=>`<option value="${esc(i.name)}"></option>`).join('')}</datalist>
 <div class="shop-suggestions">${suggestions.map(i=>`<button class="kb-btn" data-shop-action="suggest" data-name="${esc(i.name)}">${esc(i.name)}</button>`).join('')}</div>
 <p class="shop-summary">${open.length} offen${sum(open)>0?` · notierte Preise ca. ${fmtEurPlain(sum(open))}`:''}</p>`;
 function rows(checked){
  let h='';for(const store of ['supermarkt','drogerie','baumarkt','sonstiges']){
   const entries=items.map((item,idx)=>({item,idx})).filter(({item})=>!!item.checked===checked&&(STORE_LABELS[item.store]?item.store:'sonstiges')===store);
   if(!entries.length)continue;
   h+=`<h4 class="shop-store">${esc(STORE_LABELS[store].replace(/[🟢🟣🟡⚪]/gu,''))}</h4>`;
   for(const {item,idx} of entries)h+=`<div class="shop-item${checked?' chk':''}"><button class="schk${checked?' done':''}" data-chk="${idx}" aria-pressed="${checked}" aria-label="${esc(item.name)} ${checked?'wieder öffnen':'als gekauft markieren'}">${checked?'✓':''}</button><button class="shop-name" data-edit-shop="${idx}"><span class="sname">${esc(item.name)}</span><small>${esc(item.qty||'')}</small></button>${item.price?`<span class="sprice">${fmtEurPlain(item.price)}</span>`:''}<button class="shop-remove" data-rm="${idx}" aria-label="${esc(item.name)} entfernen">×</button></div>`;
  }return h;
 }
 html+=open.length?rows(false):'<p class="empty">Alles auf der Liste ist erledigt. Neue Artikel oben hinzufügen.</p>';
 if(done.length)html+=`<details open class="shop-done"><summary>${done.length} gekauft${sum(done)>0?` · notierte Preise ca. ${fmtEurPlain(sum(done))}`:''}</summary>${rows(true)}</details><button class="kb-btn-primary" data-shop-action="checkout">Gekaufte Artikel abrechnen</button>`;
 document.getElementById('kasseContent').innerHTML=html;
}

// ── Budgetvorschlag: nur wenn 3 vollständige Vormonate mit Daten vorhanden sind ──
function getBudgetSuggestion(hb) {
  const hbBudgets = (budgets && budgets[hb] && typeof budgets[hb] === 'object') ? budgets[hb] : {};
  const months = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${_pad(d.getMonth() + 1)}`);
  }
  let best = null;
  EXP_CATS.forEach(cat => {
    if (hbBudgets[cat.v]) return; // nur Kategorien ohne bestehendes Budget vorschlagen
    const sums = months.map(m => expensesForMonth(m).filter(e => e && e.account === hb && e.category === cat.v).reduce((s, e) => s + expAmt(e), 0));
    if (sums.some(s => s === 0)) return; // unvollständige Datengrundlage
    const avg = sums.reduce((a, b) => a + b, 0) / sums.length;
    if (avg < 20) return; // zu gering, um sinnvoll zu sein
    if (!best || avg > best.avg) best = { cat: cat.v, avg };
  });
  if (!best) return null;
  const suggested = Math.ceil(best.avg / 5) * 5;
  return `${catLabelShort(best.cat)} lagen zuletzt durchschnittlich bei ${fmtEurPlain(best.avg)}. Budget auf ${fmtEurPlain(suggested)} anpassen?`;
}

function renderKasseBudgets() {
  const vm = getViewMonth(), hb = activeHaushalt;
  const hbBudgets = (budgets && budgets[hb] && typeof budgets[hb] === 'object') ? budgets[hb] : {};
  const mode3 = getHaushaltMode();
  const modeLabel = mode3 === 'wir' ? 'Gemeinsam' : mode3 === 'anteil' ? 'Mein Anteil' : 'Persönlich';

  const spentByCat = {};
  expensesForMonth(vm).filter(e => e && e.account === hb).forEach(e => {
    spentByCat[e.category] = (spentByCat[e.category] || 0) + expAmt(e);
  });

  const allCats = new Set([...EXP_CATS.map(c => c.v), ...Object.keys(hbBudgets), ...Object.keys(spentByCat)]);
  const rows = [...allCats].map(cat => ({
    cat,
    limit: Number.isFinite(Number(hbBudgets[cat])) ? Number(hbBudgets[cat]) : 0,
    spent: spentByCat[cat] || 0,
  }));

  const totalSpent = Object.values(spentByCat).reduce((s, v) => s + v, 0);
  const totalBudget = Object.values(hbBudgets).reduce((s, v) => s + (Number.isFinite(Number(v)) ? Number(v) : 0), 0);

  const over  = rows.filter(r => r.limit > 0 && r.spent > r.limit).sort((a, b) => (b.spent - b.limit) - (a.spent - a.limit));
  const near  = rows.filter(r => r.limit > 0 && r.spent <= r.limit && r.spent >= r.limit * 0.8).sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit));
  const rest  = rows.filter(r => r.limit > 0 && r.spent < r.limit * 0.8).sort((a, b) => b.spent - a.spent);
  const noBudgetSpend   = rows.filter(r => !r.limit && r.spent > 0).sort((a, b) => b.spent - a.spent);
  const noBudgetNoSpend = rows.filter(r => !r.limit && !r.spent);

  const catLbl = c => { const f = EXP_CATS.find(x => x.v === c); return f ? f.l : '📋 ' + c; };
  const rowHtml = (r, opts) => {
    opts = opts || {};
    const pct = r.limit > 0 ? Math.min(100, r.spent / r.limit * 100) : 0;
    let sub;
    if (r.limit > 0 && r.spent > r.limit) sub = `${fmtEurPlain(r.spent - r.limit)} darüber`;
    else if (r.limit > 0) sub = `${fmtEurPlain(Math.max(0, r.limit - r.spent))} übrig`;
    else sub = fmtEurPlain(r.spent);
    return `<div class="bgt-row" data-bcat="${esc(r.cat)}">
      <div class="bgt-lbl"><span>${catLbl(r.cat)}</span><span style="color:${opts.subColor || 'var(--muted)'};font-size:11px">${r.limit > 0 ? fmtEurPlain(r.spent) + ' von ' + fmtEurPlain(r.limit) : 'Kein Budget'}</span></div>
      ${r.limit > 0 ? `<div class="bgt-track"><div class="bgt-fill" style="width:${pct}%;background:${opts.color || 'var(--accent)'}"></div></div><div style="font-size:11px;color:${opts.subColor || 'var(--muted)'};margin-top:2px">${sub}</div>` : `<div style="font-size:11px;color:var(--muted);margin-top:2px">${sub}</div>`}
    </div>`;
  };

  let html = `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">${modeLabel} · Budgets · ${new Date(vm + '-01').toLocaleDateString('de-DE', { month: 'long' })}</div>`;
  html += `<div class="card" style="margin-bottom:12px">
    <div class="card-label">Gesamt</div>
    <div style="font-size:18px;font-weight:800">${fmtEurPlain(totalSpent)}${totalBudget > 0 ? ` <span style="font-size:13px;font-weight:400;color:var(--muted)">von ${fmtEurPlain(totalBudget)}</span>` : ''}</div>
    ${totalBudget > 0 ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${Math.round(totalSpent / totalBudget * 100)} % verbraucht</div>` : ''}
  </div>`;

  if (over.length) { html += `<div class="an-sec" style="color:#dc2626">Überschritten</div>`; over.forEach(r => html += rowHtml(r, { color: '#dc2626', subColor: '#dc2626' })); }
  if (near.length) { html += `<div class="an-sec" style="color:#d97706">Fast erreicht</div>`; near.forEach(r => html += rowHtml(r, { color: '#d97706', subColor: '#d97706' })); }

  const suggestion = getBudgetSuggestion(hb);
  if (suggestion) html += `<div class="tip tip-warn"><div class="tip-title">Budgetvorschlag</div>${esc(suggestion)}</div>`;

  let restHtml = '';
  if (rest.length) restHtml += `<div class="an-sec">Im Rahmen</div>` + rest.map(r => rowHtml(r, { color: 'var(--green)' })).join('');
  if (noBudgetSpend.length) restHtml += `<div class="an-sec">Ohne Budget</div>` + noBudgetSpend.map(r => rowHtml(r)).join('');
  if (noBudgetNoSpend.length) restHtml += `<div class="an-sec">Weitere Kategorien</div>` + noBudgetNoSpend.map(r => rowHtml(r)).join('');
  if (restHtml) html += `<details class="an-details"><summary>Alle Budgets anzeigen</summary>${restHtml}</details>`;

  if (!over.length && !near.length && !restHtml) {
    html += `<div class="empty"><div class="ei">🎯</div><p>Noch keine Budgets gesetzt.<br><span class="empty-cta">Tippe eine Kategorie an, um ein Budget festzulegen.</span></p></div>`;
  }

  document.getElementById('kasseContent').innerHTML = html;
}
function renderKasseAusgleich() {
  const partnerName = settings.partnerName || 'Partner';
  const allTransfers = Array.isArray(transfers) ? transfers.filter(t => t && typeof t === 'object') : [];
  const trAmt = t => { const n = Number(t && t.amount); return Number.isFinite(n) ? n : 0; };
  const open = allTransfers.filter(t => !t.settled);
  const balance = open.reduce((s, t) => s + (t.direction === 'ich' ? trAmt(t) : -trAmt(t)), 0);

  const typeInfo = {
    ueberweisung: { icon: '💸', bg: '#dbeafe', label: 'Überweisung' },
    leihen:       { icon: '🤝', bg: '#fef9c3', label: 'Leihen' },
    rueckzahlung: { icon: '✅', bg: '#dcfce7', label: 'Rückzahlung' },
    sonstiges:    { icon: '📋', bg: '#f1f5f9', label: 'Sonstiges' },
  };

  let html = '<div class="card-label">Aktueller Ausgleich</div>';
  const isBalanced = Math.abs(balance) < 0.005;
  const balColor = balance > 0.005 ? 'var(--green)' : balance < -0.005 ? 'var(--red)' : 'var(--muted)';
  const balLead = isBalanced ? '' : balance > 0 ? `${esc(partnerName)} schuldet dir` : `Du schuldest ${esc(partnerName)}`;

  html += `<div style="background:white;border-radius:14px;padding:16px;margin-bottom:11px;box-shadow:var(--shadow);text-align:center">
    ${isBalanced
      ? `<div style="font-size:15px;font-weight:700;color:var(--green)">Ihr seid ausgeglichen.</div>`
      : `<div style="font-size:12.5px;color:var(--muted);margin-bottom:4px">${balLead}</div><div style="font-size:28px;font-weight:800;color:${balColor}">${fmtEurPlain(Math.abs(balance))}</div>`}
    ${open.length ? `<button class="kb-btn-primary" style="margin-top:12px" data-coact="settle-all">Ausgleich verbuchen</button>` : ''}
  </div>`;

  if (open.length) {
    html += `<div class="an-sec">Offen</div>`;
    [...open].sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(t => {
      const ti = typeInfo[t.type] || typeInfo.sonstiges;
      const dirLabel = t.direction === 'ich' ? `Partner schuldet dir` : `Du schuldest ${esc(partnerName)}`;
      html += `<div class="transfer-row" data-tid="${esc(t.id)}">
        <div class="transfer-ico" style="background:${ti.bg}">${ti.icon}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${esc(t.desc)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">${fmtEurPlain(trAmt(t))} · ${fmtDate(t.date)}</div>
          <div style="font-size:11px;color:var(--muted)">${dirLabel}</div>
        </div>
      </div>`;
    });
  }

  const settled = allTransfers.filter(t => t.settled);
  if (settled.length) {
    html += `<details class="tk-history" style="margin-top:14px"><summary>Erledigt · ${settled.length} ${settled.length === 1 ? 'Eintrag' : 'Einträge'}</summary><div style="margin-top:10px">`;
    [...settled].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30).forEach(t => {
      const ti = typeInfo[t.type] || typeInfo.sonstiges;
      html += `<div class="transfer-row settled" data-tid="${esc(t.id)}">
        <div class="transfer-ico" style="background:#f1f5f9;opacity:.6">${ti.icon}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px;color:var(--muted)">${esc(t.desc)}</div>
          <div style="font-size:11px;color:var(--muted)">${fmtEurPlain(trAmt(t))} · ${fmtDate(t.date)}${t.settledDate ? ' · beglichen ' + fmtDate(t.settledDate) : ''}</div>
        </div>
      </div>`;
    });
    html += `</div></details>`;
  }

  if (!allTransfers.length) {
    html += `<div class="empty"><div class="ei">🤝</div><p>Noch kein Ausgleich erfasst.<br><span class="empty-cta">Tippe <strong>+</strong> um eine Zahlung einzutragen.</span></p></div>`;
  } else if (!open.length && !settled.length) {
    html += `<div class="empty" style="padding:20px 16px"><p>Keine offenen Einträge.</p></div>`;
  }

  document.getElementById('kasseContent').innerHTML = html;
}

function settleAllTransfers() {
  const open = (Array.isArray(transfers) ? transfers : []).filter(t => t && !t.settled);
  if (!open.length) return;
  if (!confirm(`${open.length} offene Eintrag${open.length === 1 ? '' : 'e'} als beglichen markieren?`)) return;
  const d = today();
  open.forEach(t => { t.settled = true; t.settledDate = d; });
  save('vh_transfers', transfers);
  renderKasse();
}

// ════════════════════════════════════════════
// KASSE "MEHR": Einkauf, Ausgleich, Wiederkehrend, Analyse-Einstieg
// ════════════════════════════════════════════

// Zurück-Leiste, wenn ein Unterbereich innerhalb von "Mehr" geöffnet ist
function wrapMehrBack(title, innerRender) {
  const el = document.getElementById('kasseContent');
  if (!el) return;
  innerRender(); // Unterbereich rendert selbst nach kasseContent
  el.insertAdjacentHTML('afterbegin',
    `<button class="mehr-back" data-coact="mehr-home">‹ Mehr</button>
     <div class="card-label" style="margin-bottom:8px">${esc(title)}</div>`);
}

// Nach Speichern/Löschen die richtige Ansicht neu aufbauen (Mehr-Unterbereich oder direkt)
function refreshEinkaufView() {
  if (activePage !== 'kasse') { if (activePage === 'home') renderHome(); return; }
  if (activeKasseTab === 'mehr' && mehrView === 'einkauf') wrapMehrBack('Einkaufsliste', renderKasseEinkauf);
  else if (activeKasseTab === 'mehr') renderKasseMehr();
  else renderKasse();
  try { renderHome && activePage === 'home' && renderHome(); } catch (e) {}
}
function refreshAusgleichView() {
  if (activePage !== 'kasse') return;
  if (activeKasseTab === 'mehr' && mehrView === 'ausgleich') wrapMehrBack('Ausgleich', renderKasseAusgleich);
  else if (activeKasseTab === 'mehr') renderKasseMehr();
  else renderKasse();
}

// ── Wiederkehrende Buchungen: Fälligkeit ─────────────────────────────────
function recurringNextDate(r) {
  if (!r || typeof r !== 'object') return null;
  const freq = r.frequency || 'monatlich';
  const now = new Date();
  if (freq === 'jaehrlich') {
    let due = recurringDueDate(r, today());
    if (!due) return null;
    const booked = expenses.some(e => e.recurringId === r.id && e.date === due);
    if (due < today() || booked) due = anniversaryDate(r.startDate || '2000-01-01', now.getFullYear() + 1);
    if (r.startDate && due < r.startDate) due = r.startDate;
    return due;
  }
  // monatlich: automatische Buchung erfolgt am Monatsersten
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${_pad(next.getMonth() + 1)}-01`;
}

function renderKasseMehr() {
  // Unterbereich aktiv? Dann diesen rendern
  if (mehrView === 'einkauf')   { wrapMehrBack('Einkaufsliste', renderKasseEinkauf); return; }
  if (mehrView === 'ausgleich') { wrapMehrBack('Ausgleich', renderKasseAusgleich); return; }
  if (mehrView === 'recurring') { wrapMehrBack('Wiederkehrende Buchungen', renderKasseRecurring); return; }

  const items = (shopLists && Array.isArray(shopLists.items)) ? shopLists.items.filter(i => i && typeof i === 'object') : [];
  const openCount = items.filter(i => !i.checked).length;

  const allTransfers = Array.isArray(transfers) ? transfers.filter(t => t && typeof t === 'object') : [];
  const balance = allTransfers.filter(t => !t.settled)
    .reduce((s, t) => { const n = Number(t.amount); return s + (t.direction === 'ich' ? 1 : -1) * (Number.isFinite(n) ? n : 0); }, 0);
  const partnerName = settings.partnerName || 'Partner';
  const balText = Math.abs(balance) < 0.005
    ? 'Ihr seid ausgeglichen'
    : balance > 0
      ? `${esc(partnerName)} schuldet dir ${fmtEurPlain(balance)}`
      : `Du schuldest ${esc(partnerName)} ${fmtEurPlain(Math.abs(balance))}`;

  const recList = Array.isArray(recurring) ? recurring.filter(r => r && typeof r === 'object') : [];
  const activeRec = recList.filter(r => r.active !== false).length;

  let html = '';
  html += `<div class="mehr-card">
    <div class="mehr-card-title">🛒 Einkaufsliste</div>
    <div class="mehr-card-sub">${openCount ? `${openCount} Artikel offen` : 'Keine offenen Artikel'}</div>
    <div class="mehr-card-actions">
      <button class="kb-btn" data-coact="mehr-einkauf">Liste öffnen</button>
    </div>
  </div>`;
  html += `<div class="mehr-card">
    <div class="mehr-card-title">⚖️ Ausgleich</div>
    <div class="mehr-card-sub">${balText}</div>
    <div class="mehr-card-actions"><button class="kb-btn" data-coact="mehr-ausgleich">Ausgleich öffnen</button></div>
  </div>`;
  html += `<div class="mehr-card">
    <div class="mehr-card-title">🔄 Wiederkehrende Buchungen</div>
    <div class="mehr-card-sub">${activeRec ? `${activeRec} aktive${activeRec === 1 ? 'r' : ''} Eintr${activeRec === 1 ? 'ag' : 'äge'}` : 'Keine Einträge'}</div>
    <div class="mehr-card-actions"><button class="kb-btn" data-coact="mehr-recurring">Verwalten</button></div>
  </div>`;
  html += `<div class="mehr-card">
    <div class="mehr-card-title">📈 Ausführliche Analyse</div>
    <div class="mehr-card-sub">Trends, Vergleiche und Fixkosten</div>
    <div class="mehr-card-actions"><button class="kb-btn" data-coact="open-analysis">Analyse öffnen</button></div>
  </div>`;

  document.getElementById('kasseContent').innerHTML = html;
}

// ── Wiederkehrende Buchungen: Verwaltung ─────────────────────────────────
function renderKasseRecurring() {
  const recList = Array.isArray(recurring) ? recurring.filter(r => r && typeof r === 'object') : [];
  let html = `<button class="kb-btn-primary" data-coact="rec-add" style="margin-bottom:12px">+ Wiederkehrende Buchung</button>`;

  if (!recList.length) {
    html += `<div class="empty"><div class="ei">🔄</div><p>Noch keine wiederkehrenden Buchungen.<br><span class="empty-cta">Sie werden am Monatsanfang automatisch als Ausgabe verbucht.</span></p></div>`;
  } else {
    const act = recList.filter(r => r.active !== false);
    const paused = recList.filter(r => r.active === false);
    const row = (r) => {
      const idx = recurring.indexOf(r);
      const freq = r.frequency === 'jaehrlich' ? 'jährlich' : 'monatlich';
      const next = r.active === false ? null : recurringNextDate(r);
      return `<div class="rec-row" data-coact="rec-edit" data-ridx="${idx}">
        <div class="exp-ico" style="background:${EXP_BG[r.category] || '#f1f5f9'}">${EXP_ICON[r.category] || '🔄'}</div>
        <div style="flex:1;min-width:0">
          <div class="exp-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.desc || 'Buchung')}</div>
          <div class="exp-sub2">${fmtEurPlain(r.amount)} ${freq}${next ? ' · Nächste Buchung: ' + fmtDate(next) : ' · pausiert'}</div>
        </div>
        <div class="exp-right"><span class="exp-badge ${r.active === false ? '' : 'bw'}">${r.active === false ? 'Pausiert' : 'Aktiv'}</span></div>
      </div>`;
    };
    if (act.length)   { html += `<div class="an-sec">Aktiv</div>` + act.map(row).join(''); }
    if (paused.length){ html += `<div class="an-sec" style="margin-top:10px">Pausiert</div>` + paused.map(row).join(''); }
  }
  document.getElementById('kasseContent').innerHTML = html;
}

let editRecurringIdx = null;
function openRecurringModal(idx) {
  editRecurringIdx = (Number.isInteger(idx) && idx >= 0 && recurring[idx]) ? idx : null;
  const r = editRecurringIdx !== null ? recurring[editRecurringIdx] : null;
  const catOpts = EXP_CATS.map(c => `<option value="${c.v}"${r && r.category === c.v ? ' selected' : ''}>${c.l}</option>`).join('');
  const freq = r ? (r.frequency || 'monatlich') : 'monatlich';
  let h = `
    <div class="fg"><label for="rec-desc">Beschreibung</label><input autocomplete="off" id="rec-desc" value="${esc(r ? r.desc || '' : '')}" placeholder="z.B. Haushaltsgeld"></div>
    <div class="fg"><label for="rec-amount">Betrag (€)</label><input autocomplete="off" id="rec-amount" type="number" step=".01" inputmode="decimal" value="${esc(r && r.amount != null ? r.amount : '')}"></div>
    <div class="fg"><label for="rec-cat">Kategorie</label><select id="rec-cat">${catOpts}</select></div>
    <div class="fg"><label for="rec-freq">Rhythmus</label><select id="rec-freq">
      <option value="monatlich"${freq !== 'jaehrlich' ? ' selected' : ''}>Monatlich (am Monatsersten)</option>
      <option value="jaehrlich"${freq === 'jaehrlich' ? ' selected' : ''}>Jährlich</option>
    </select></div>
    <div class="fg" id="rec-start-wrap" style="display:${freq === 'jaehrlich' ? 'block' : 'none'}"><label for="rec-start">Stichtag (für jährlich)</label><input autocomplete="off" id="rec-start" type="date" value="${esc(r ? r.startDate || '' : '')}"></div>
    <div class="fg"><label>Konto</label><div class="quick-acc" style="width:fit-content">
      <button type="button" class="qacc${(r ? r.account : activeHaushalt) !== 'wir' ? ' ai' : ''}" id="rec-acc-ich">Persönlich</button>
      <button type="button" class="qacc${(r ? r.account : activeHaushalt) === 'wir' ? ' aw' : ''}" id="rec-acc-wir">Gemeinsam</button>
    </div></div>
    <div class="fg"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input autocomplete="off" type="checkbox" id="rec-active" ${!r || r.active !== false ? 'checked' : ''} style="width:18px;height:18px"> Aktiv (automatisch buchen)</label></div>
    <div style="display:flex;gap:9px;margin-top:8px">
      ${editRecurringIdx !== null ? '<button type="button" class="tk-del-btn" data-coact="rec-delete">Löschen</button>' : ''}
      <button type="button" class="kb-btn" data-coact="rec-cancel" style="flex:0 0 auto">Abbrechen</button>
      <button type="button" class="kb-btn-primary" data-coact="rec-save" style="flex:1">Speichern</button>
    </div>`;
  openKasseModal(editRecurringIdx !== null ? '🔄 Buchung bearbeiten' : '🔄 Neue wiederkehrende Buchung', h);
  document.getElementById('rec-freq')?.addEventListener('change', function () {
    const w = document.getElementById('rec-start-wrap');
    if (w) w.style.display = this.value === 'jaehrlich' ? 'block' : 'none';
  });
  let acc = r ? (r.account || 'ich') : (activeHaushalt || 'ich');
  const setAcc = a => {
    acc = a;
    document.getElementById('rec-acc-ich').className = 'qacc' + (a !== 'wir' ? ' ai' : '');
    document.getElementById('rec-acc-wir').className = 'qacc' + (a === 'wir' ? ' aw' : '');
  };
  document.getElementById('rec-acc-ich')?.addEventListener('click', () => setAcc('ich'));
  document.getElementById('rec-acc-wir')?.addEventListener('click', () => setAcc('wir'));
  openRecurringModal._getAcc = () => acc;
}

function saveRecurringForm() {
  const desc = document.getElementById('rec-desc')?.value.trim();
  const amount = parseDE(document.getElementById('rec-amount')?.value);
  if (!desc || !amount) { alert('Bitte Beschreibung und Betrag eingeben.'); return; }
  const entry = {
    id: editRecurringIdx !== null && recurring[editRecurringIdx] ? recurring[editRecurringIdx].id : uid(),
    desc, amount,
    category: document.getElementById('rec-cat')?.value || 'sonstiges',
    account: (openRecurringModal._getAcc && openRecurringModal._getAcc()) || 'ich',
    frequency: document.getElementById('rec-freq')?.value || 'monatlich',
    startDate: document.getElementById('rec-start')?.value || '',
    active: !!document.getElementById('rec-active')?.checked,
  };
  if (!Array.isArray(recurring)) recurring = [];
  if (editRecurringIdx !== null && recurring[editRecurringIdx]) recurring[editRecurringIdx] = { ...recurring[editRecurringIdx], ...entry };
  else recurring.push(entry);
  save('vh_recurring', recurring);
  closeKasseModal();
  if (activeKasseTab === 'mehr' && mehrView === 'recurring') wrapMehrBack('Wiederkehrende Buchungen', renderKasseRecurring);
  else renderKasse();
}

function deleteRecurringForm() {
  if (editRecurringIdx === null || !recurring[editRecurringIdx]) return;
  if (!confirm('Diese wiederkehrende Buchung löschen?\n\nBereits verbuchte Ausgaben bleiben erhalten.')) return;
  recurring.splice(editRecurringIdx, 1);
  save('vh_recurring', recurring);
  closeKasseModal();
  if (activeKasseTab === 'mehr' && mehrView === 'recurring') wrapMehrBack('Wiederkehrende Buchungen', renderKasseRecurring);
  else renderKasse();
}

// ── Einkauf intelligent abrechnen: nach Geschäft gruppiert ────────────────
const STORE_CAT_DEFAULT = { supermarkt: 'lebensmittel', drogerie: 'drogerie', baumarkt: 'haushalt', sonstiges: 'sonstiges' };
const STORE_LABELS = { supermarkt: 'Supermarkt', drogerie: 'Drogerie', baumarkt: 'Baumarkt', sonstiges: 'Sonstiges' };
let checkoutAcc = 'wir';

function openStoreCheckout() {
  const items = (shopLists && Array.isArray(shopLists.items)) ? shopLists.items : [];
  const open = items.map((item, idx) => ({ item, idx })).filter(({ item }) => item && typeof item === 'object' && item.checked);
  if (!open.length) { alert('Bitte zuerst die gekauften Artikel abhaken.'); return; }

  checkoutAcc = activeHaushalt === 'wir' ? 'wir' : 'ich';
  const groups = {};
  open.forEach(({ item, idx }) => {
    const store = STORE_LABELS[item.store] ? item.store : 'sonstiges';
    if (!groups[store]) groups[store] = { items: [], sum: 0 };
    groups[store].items.push({ item, idx, signature:JSON.stringify(item) });
    groups[store].sum += Number(item.price) || 0;
  });
  const storeKeys = ['supermarkt', 'drogerie', 'baumarkt', 'sonstiges'].filter(s => groups[s]);
  const totalEst = storeKeys.reduce((s, k) => s + groups[k].sum, 0);
  const catOpts = sel => EXP_CATS.map(c => `<option value="${c.v}"${c.v === sel ? ' selected' : ''}>${c.l}</option>`).join('');

  let h = `
    <div class="fg"><label for="co-date">Datum</label><input autocomplete="off" id="co-date" type="date" value="${today()}"></div>
    <div class="fg"><label>Konto</label><div class="quick-acc" style="width:fit-content">
      <button type="button" class="qacc${checkoutAcc !== 'wir' ? ' ai' : ''}" id="co-acc-ich">Persönlich</button>
      <button type="button" class="qacc${checkoutAcc === 'wir' ? ' aw' : ''}" id="co-acc-wir">Gemeinsam</button>
    </div></div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Pro Geschäft entsteht eine eigene Buchung. Gib den Gesamtbetrag vom Kassenbon ein; Artikelpreise sind optional.</div>`;
  storeKeys.forEach(store => {
    const g = groups[store];
    h += `<div class="checkout-group" data-costore="${store}">
      <div class="checkout-group-head">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1">
          <input autocomplete="off" type="checkbox" class="co-include" data-costorechk="${store}" checked style="width:18px;height:18px">
          <span style="font-weight:700">${STORE_LABELS[store]}</span>
        </label>
        <span style="font-size:11px;color:var(--muted)">${g.items.length} Artikel</span>
      </div>
      <div style="font-size:11.5px;color:var(--muted);margin:2px 0 7px;padding-left:26px">${g.items.slice(0, 4).map(({ item }) => esc(item.name || '')).join(', ')}${g.items.length > 4 ? ' …' : ''}</div>
      <div class="tkf-two">
        <div class="fg" style="margin:0"><label>Betrag (€)</label><input autocomplete="off" class="co-amount" data-costore-amt="${store}" type="number" step=".01" inputmode="decimal" value="${g.sum > 0 ? g.sum.toFixed(2) : ''}" placeholder="0,00"></div>
        <div class="fg" style="margin:0"><label>Kategorie</label><select class="co-cat" data-costore-cat="${store}">${catOpts(STORE_CAT_DEFAULT[store] || 'sonstiges')}</select></div>
      </div>
    </div>`;
  });
  h += `<div style="font-size:12px;color:var(--muted);margin:6px 0 12px">Geschätzte Summe: <b id="co-total">${fmtEurPlain(totalEst)}</b></div>
    <div style="display:flex;gap:9px">
      <button type="button" class="kb-btn" data-coact="co-cancel" style="flex:0 0 auto">Abbrechen</button>
      <button type="button" class="kb-btn-primary" data-coact="co-save" style="flex:1">Abrechnung speichern</button>
    </div>`;
  openKasseModal('🛒 Einkauf abrechnen', h);
  openStoreCheckout._groups = groups;

  const setAcc = a => {
    checkoutAcc = a;
    document.getElementById('co-acc-ich').className = 'qacc' + (a !== 'wir' ? ' ai' : '');
    document.getElementById('co-acc-wir').className = 'qacc' + (a === 'wir' ? ' aw' : '');
  };
  document.getElementById('co-acc-ich')?.addEventListener('click', () => setAcc('ich'));
  document.getElementById('co-acc-wir')?.addEventListener('click', () => setAcc('wir'));
  // Live-Summe
  const updateTotal = () => {
    let sum = 0;
    document.querySelectorAll('.checkout-group').forEach(gr => {
      const store = gr.dataset.costore;
      const inc = gr.querySelector(`[data-costorechk="${store}"]`);
      const amt = parseDE(gr.querySelector(`[data-costore-amt="${store}"]`)?.value);
      if (inc && inc.checked && amt) sum += amt;
    });
    const t = document.getElementById('co-total');
    if (t) t.textContent = fmtEurPlain(sum);
  };
  document.querySelectorAll('.co-amount, .co-include').forEach(el => el.addEventListener('input', updateTotal));
  updateTotal();
}

function saveStoreCheckout(){
 const groups=openStoreCheckout._groups||{},dateVal=document.getElementById('co-date')?.value;
 if(!dateVal||!Number.isFinite(Date.parse(dateVal))){alert('Bitte ein gültiges Datum wählen.');return;}
 const bookings=[];
 for(const store of Object.keys(groups)){
  if(!document.querySelector(`[data-costorechk="${store}"]`)?.checked)continue;
  const amt=parseDE(document.querySelector(`[data-costore-amt="${store}"]`)?.value);
  if(!Number.isFinite(amt)||amt<=0){alert('Bitte für jedes ausgewählte Geschäft einen Betrag über 0 € eingeben.');return;}
  if(groups[store].items.some(({item,idx,signature})=>shopLists.items[idx]!==item||JSON.stringify(item)!==signature)){alert('Die Liste wurde inzwischen geändert. Bitte die Abrechnung erneut öffnen.');return;}
  bookings.push({store,amt,cat:document.querySelector(`[data-costore-cat="${store}"]`).value,items:groups[store].items,sum:groups[store].sum});
 }
 if(!bookings.length){alert('Bitte mindestens ein Geschäft auswählen.');return;}
 const next=JSON.parse(JSON.stringify(collectAppSnapshot())),removed=new Set();next.shopLists.history=next.shopLists.history||{};
 for(const b of bookings){
  for(const {item,idx} of b.items){
   removed.add(idx);const key=shopKey(item.name),old=next.shopLists.history[key];
   next.shopLists.history[key]={name:item.name,qty:item.qty,store:item.store,price:item.price,count:(old?.count||0)+1,lastBought:dateVal};
   // Ein abweichender Kassenbon erlaubt keine Aussage über einzelne Artikelpreise.
   if(item.price>0&&Math.abs(b.amt-b.sum)<0.005){const pm=next.priceMemory[key];next.priceMemory[key]=pm?{avg:(pm.avg*pm.count+Number(item.price))/(pm.count+1),last:Number(item.price),count:pm.count+1}:{avg:Number(item.price),last:Number(item.price),count:1};}
  }
  next.expenses.push({id:uid(),amount:b.amt,account:checkoutAcc,desc:`Einkauf ${STORE_LABELS[b.store]}`,date:dateVal,category:b.cat,paidBy:'ich',analysisGroup:getAnalysisGroup(b.cat),note:b.items.map(x=>x.item.name).slice(0,3).join(', ')});
 }
 next.shopLists.history=Object.fromEntries(Object.entries(next.shopLists.history).sort((a,b)=>String(b[1].lastBought).localeCompare(String(a[1].lastBought))).slice(0,100));
 next.shopLists.items=next.shopLists.items.filter((_,idx)=>!removed.has(idx));
 const checkoutRewardId=next.expenses.slice(expenses.length).map(x=>x.id).join(':');
 try{applyAppSnapshot(next);}catch(err){alert(err.message);return;}
 onAppDataSaved('vh_shoplists');rewardDragon('shoppingComplete',{id:checkoutRewardId});closeKasseModal();refreshEinkaufView();
}

// ── Kasse-Modal (nutzt bestehendes .modal-bg/.modal-Design) ───────────────
function openKasseModal(title, bodyHtml) {
  let m = document.getElementById('kasseModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'kasseModal';
    m.className = 'modal-bg';
    m.innerHTML = '<div class="modal"><div class="modal-handle"></div>' +
      '<button class="modal-close-btn" aria-label="Schließen" data-coact="km-close">×</button>' +
      '<h2 id="kasseModalTitle"></h2><div id="kasseModalBody"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) closeKasseModal(); });
  }
  document.getElementById('kasseModalTitle').textContent = title;
  document.getElementById('kasseModalBody').innerHTML = bodyHtml;
  openModal(m.id);
}
function closeKasseModal() {
  closeModal('kasseModal');
}

// ── Event-Delegation für alle neuen Kasse-Aktionen (einmalig registriert) ──
document.addEventListener('click', e => {
 try {
  const b = e.target.closest('[data-coact]');
  if (!b) return;
  const act = b.dataset.coact;
  if (act === 'mehr-home')      { mehrView = null; renderKasseMehr(); }
  else if (act === 'mehr-einkauf')   { mehrView = 'einkauf'; renderKasseMehr(); }
  else if (act === 'mehr-ausgleich') { mehrView = 'ausgleich'; renderKasseMehr(); }
  else if (act === 'mehr-recurring') { mehrView = 'recurring'; renderKasseMehr(); }
  else if (act === 'open-analysis')  { showPage('analysis'); }
  else if (act === 'co-save')        { saveStoreCheckout(); }
  else if (act === 'co-cancel')      { closeKasseModal(); }
  else if (act === 'km-close')       { closeKasseModal(); }
  else if (act === 'rec-add')        { openRecurringModal(null); }
  else if (act === 'rec-edit')       { openRecurringModal(Number(b.dataset.ridx)); }
  else if (act === 'rec-save')       { saveRecurringForm(); }
  else if (act === 'rec-delete')     { deleteRecurringForm(); }
  else if (act === 'rec-cancel')     { closeKasseModal(); }
  else if (act === 'settle-all')     { settleAllTransfers(); }
 } catch (err) {
   console.warn('[Kasse] Aktion fehlgeschlagen:', err);
 }
});

// ════════════════════════════════════════════
// TRANSFER MODAL
// ════════════════════════════════════════════
let editTransferId = null;
let currentTransferType = 'ueberweisung';
let currentTransferDir  = 'ich';   // 'ich' = ich zahle/strecke vor, 'partner' = Partner zahlt
let currentTransferSettled = false;

function setTransferType(type) {
  currentTransferType = type;
  document.querySelectorAll('.transfer-type-btn').forEach(b => b.classList.toggle('active', b.dataset.ttype === type));
}

function setTransferDir(dir) {
  currentTransferDir = dir;
  const pn = settings.partnerName || 'Partner';
  document.getElementById('tr-dir-ich').className     = 'acc-btn' + (dir === 'ich'     ? ' ai' : '');
  document.getElementById('tr-dir-partner').className = 'acc-btn' + (dir === 'partner' ? ' aw' : '');
  document.getElementById('tr-dir-hint').textContent  = dir === 'ich'
    ? `Du zahlst / streckst vor → ${pn} schuldet dir`
    : `${pn} zahlt / streckt vor → Du schuldest ${pn}`;
}

function setTransferSettled(val) {
  currentTransferSettled = val;
  document.getElementById('tr-open').className    = 'acc-btn' + (!val ? ' ai' : '');
  document.getElementById('tr-settled').className = 'acc-btn' + (val  ? ' ai' : '');
  document.getElementById('tr-settled-date-row').style.display = val ? 'block' : 'none';
  if (val && !document.getElementById('tr-settled-date').value) {
    document.getElementById('tr-settled-date').value = today();
  }
}

// Type-Buttons Delegation
document.getElementById('transferTypeGrid').addEventListener('click', e => {
  const btn = e.target.closest('[data-ttype]');
  if (btn) setTransferType(btn.dataset.ttype);
});
document.getElementById('tr-dir-ich').addEventListener('click',     () => setTransferDir('ich'));
document.getElementById('tr-dir-partner').addEventListener('click', () => setTransferDir('partner'));
document.getElementById('tr-open').addEventListener('click',        () => setTransferSettled(false));
document.getElementById('tr-settled').addEventListener('click',     () => setTransferSettled(true));

function openAddTransfer() {
  editTransferId = null;
  document.getElementById('transferModalTitle').textContent = 'Eintrag hinzufügen';
  document.getElementById('deleteTransferBtn').style.display = 'none';
  document.getElementById('tr-amount').value = '';
  document.getElementById('tr-date').value   = today();
  document.getElementById('tr-desc').value   = '';
  document.getElementById('tr-note').value   = '';
  document.getElementById('tr-settled-date').value = '';
  document.getElementById('tr-partner-label').textContent = settings.partnerName || 'Partner';
  setTransferType('ueberweisung');
  setTransferDir('ich');
  setTransferSettled(false);
  openModal('transferModal');
}

function openEditTransfer(id) {
  const t = transfers.find(x => x.id === id);
  if (!t) return;
  editTransferId = id;
  document.getElementById('transferModalTitle').textContent = 'Eintrag bearbeiten';
  document.getElementById('deleteTransferBtn').style.display = 'block';
  document.getElementById('tr-amount').value = t.amount || '';
  document.getElementById('tr-date').value   = t.date || today();
  document.getElementById('tr-desc').value   = t.desc || '';
  document.getElementById('tr-note').value   = t.note || '';
  document.getElementById('tr-settled-date').value = t.settledDate || '';
  document.getElementById('tr-partner-label').textContent = settings.partnerName || 'Partner';
  setTransferType(t.type || 'ueberweisung');
  setTransferDir(t.direction || 'ich');
  setTransferSettled(!!t.settled);
  openModal('transferModal');
}

document.getElementById('saveTransferBtn').addEventListener('click', () => {
  const amount = parseDE(document.getElementById('tr-amount').value);
  const desc   = document.getElementById('tr-desc').value.trim();
  if (!amount || !desc) { alert('Bitte Betrag und Beschreibung eingeben.'); return; }
  const entry = {
    id:          editTransferId || uid(),
    type:        currentTransferType,
    direction:   currentTransferDir,
    amount,
    date:        document.getElementById('tr-date').value || today(),
    desc,
    note:        document.getElementById('tr-note').value.trim(),
    settled:     currentTransferSettled,
    settledDate: currentTransferSettled ? (document.getElementById('tr-settled-date').value || today()) : '',
  };
  if (editTransferId) transfers = transfers.map(t => t.id === editTransferId ? entry : t);
  else transfers.push(entry);
  save('vh_transfers', transfers);
  closeModal('transferModal');
  refreshAusgleichView();
});

document.getElementById('deleteTransferBtn').addEventListener('click', () => {
  if (!editTransferId || !confirm('Eintrag löschen?')) return;
  transfers = transfers.filter(t => t.id !== editTransferId);
  save('vh_transfers', transfers);
  closeModal('transferModal');
  refreshAusgleichView();
});

document.getElementById('cancelTransferBtn').addEventListener('click', () => closeModal('transferModal'));

function generateTips(hb, viewMonth) {
  const tips = [];
  const cm = viewMonth || currMonth();
  const [vy, vm2] = cm.split('-').map(Number);
  const pmDate3 = new Date(vy, vm2 - 2, 1);
  const pm = `${pmDate3.getFullYear()}-${_pad(pmDate3.getMonth() + 1)}`;
  const hbBudgets = budgets[hb] || {};
  EXP_CATS.forEach(cat => {
    const now  = expensesForMonth(cm).filter(e => e.account === hb && e.category === cat.v).reduce((s, e) => s + expAmt(e), 0);
    const prev = expensesForMonth(pm).filter(e => e.account === hb && e.category === cat.v).reduce((s, e) => s + expAmt(e), 0);
    if (prev > 0 && now > prev * 1.2) tips.push({ type: 'tip-warn', title: `${EXP_ICON[cat.v]} ${cat.v} +${Math.round((now / prev - 1) * 100)}%`, text: `${fmtEurPlain(now)} vs. ${fmtEurPlain(prev)} Vormonat.` });
    const budget = hbBudgets[cat.v];
    if (budget && now > budget * .9) { const left = budget - now; tips.push({ type: 'tip-warn', title: `🎯 ${cat.v} ${left < 0 ? 'überzogen' : 'fast voll'}`, text: left < 0 ? `${fmtEurPlain(Math.abs(left))} über Budget.` : `Noch ${fmtEurPlain(left)} übrig.` }); }
  });
  if (!tips.length && expensesForMonth(cm).filter(e => e.account === hb).length > 3) tips.push({ type: 'tip-good', title: '✅ Alles im Rahmen', text: 'Ausgaben im normalen Bereich.' });
  return tips.slice(0, 3);
}

// BUG FIX: autoBookRecurring – nur einmal pro Monat, keine Duplikate
// Erweitert: respektiert active-Flag und jährlichen Rhythmus (alte Einträge ohne
// diese Felder verhalten sich unverändert: aktiv + monatlich)
function autoBookRecurring() {
  if (!Array.isArray(recurring)) return;
  const cm = currMonth();
  let changed = false;
  recurring.forEach(r => {
    if (!r || typeof r !== 'object') return;
    if (r.active === false || (r.startDate && r.startDate > today())) return;
    if (r.frequency === 'jaehrlich') {
      // Nur im Jubiläumsmonat des Stichtags buchen
      const due = recurringDueDate(r, today());
      if (!due || due > today() || due.slice(0, 7) !== cm) return;
    }
    if (!expenses.some(e => e && e.recurringId === r.id && e.date && e.date.startsWith(cm))) {
      const day = r.frequency === 'jaehrlich' ? recurringDueDate(r, today()).slice(8, 10) : '01';
      expenses.push({ id: uid(), recurringId: r.id, desc: r.desc, amount: r.amount, category: r.category, account: r.account, analysisGroup: r.analysisGroup || getAnalysisGroup(r.category), date: cm + '-' + day, note: '🔄 Auto', paidBy: 'ich' });
      changed = true;
    }
  });
  if (changed) save('vh_expenses', expenses);
}

// ════════════════════════════════════════════
