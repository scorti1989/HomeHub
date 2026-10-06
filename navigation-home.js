'use strict';
// AMPEL STRIP
// ════════════════════════════════════════════
function renderAmpel() {
  // Vertrags-Warnungen (Kündigungsfristen)
  const contractUrgent = contracts
    .filter(c => !isContractArchived(c))
    .map(c => ({ ...c, cd: latestCancelDate(c), tl: trafficLight(c) }))
    .filter(c => c.cd && diffDays(c.cd) !== null && diffDays(c.cd) <= 90)
    .sort((a, b) => new Date(a.cd) - new Date(b.cd));

  // Zähler-Erinnerungen (Ablesung fällig in ≤7 Tagen)
  const icons = { strom: '⚡', gas: '🔥', wasser: '💧' };
  const meterReminders = meters
    .filter(m => {
      if (!m.nextReading) return false;
      const days = diffDays(m.nextReading);
      if (days === null) return false;
      // Zeigen ab 7 Tage vorher bis Datum, und solange noch kein Wert für dieses Datum eingetragen
      if (days > 7 || days < -1) return false;
      // Prüfen ob es bereits eine Ablesung an/nach nextReading gibt
      const readings = (m.readings || []).slice().sort((a, b) => a.date.localeCompare(b.date));
      const hasReadingOnOrAfter = readings.some(r => r.date >= m.nextReading);
      return !hasReadingOnOrAfter;
    })
    .sort((a, b) => new Date(a.nextReading) - new Date(b.nextReading));

  renderConcertBanner();
  const strip = document.getElementById('ampelStrip');
  const totalUrgent = contractUrgent.length + meterReminders.length;

  if (!totalUrgent) {
    const total = contracts.filter(c => !isContractArchived(c)).length;
    strip.innerHTML = `<div class="ampel-dot ampel-ok"></div><div class="ampel-all-ok">${total ? 'Alle Verträge OK' : 'Keine Verträge'}</div>`;
    return;
  }

  let html = '';
  let shown = 0;

  // Zähler-Erinnerungen zuerst (fällig/dringend)
  meterReminders.slice(0, 2).forEach((m, i) => {
    if (shown > 0) html += `<div class="ampel-sep">·</div>`;
    const days = diffDays(m.nextReading);
    const cls = days <= 0 ? 'ampel-crit' : 'ampel-warn';
    const label = days <= 0 ? 'Jetzt ablesen!' : `in ${days}T`;
    html += `<div class="ampel-dot ${cls}"></div><div class="ampel-hint" data-goto="meters">${icons[m.type] || '🔢'} ${esc(m.name || m.type)} – ${label}</div>`;
    shown++;
  });

  // Vertrags-Warnungen
  contractUrgent.slice(0, Math.max(0, 4 - shown)).forEach((c) => {
    if (shown > 0) html += `<div class="ampel-sep">·</div>`;
    const cls = c.tl === 'red' ? 'ampel-crit' : 'ampel-warn';
    const days = diffDays(c.cd);
    html += `<div class="ampel-dot ${cls}"></div><div class="ampel-hint" data-goto="contracts">${esc(c.name)} bis ${fmtDate(c.cd)} (${days}T)</div>`;
    shown++;
  });

  if (totalUrgent > shown) html += `<div class="ampel-sep">·</div><div class="ampel-all-ok">+${totalUrgent - shown} weitere</div>`;
  strip.innerHTML = html;
  strip.querySelectorAll('[data-goto]').forEach(el => el.addEventListener('click', () => showPage(el.dataset.goto)));
}

// ════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════
let activePage = 'home';
function showPage(id, {render = true, history = true} = {}) {
  if (!['home','kasse','contracts','meters','analysis','tickets','recipes'].includes(id)) return;
  if (history && activePage !== id) window.history.pushState({homehubPage:id}, '', '#'+id);
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id)?.classList.add('active');
  document.querySelector(`.nav-btn[data-page="${id}"]`)?.classList.add('active');
  document.querySelectorAll('.nav-btn[data-page]').forEach(button => {
    if (button.dataset.page === id) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  activePage = id;
  const fab = document.getElementById('fabBtn');
  if (fab) { fab.style.display = id === 'analysis' ? 'none' : 'flex';
    const label = {home:'Ausgabe erfassen',kasse:'Eintrag erfassen',contracts:'Vertrag anlegen',meters:'Ablesung erfassen',recipes:'Rezept anlegen',tickets:'Konzert anlegen'}[id];
    fab.setAttribute('aria-label',label || 'Eintrag erfassen'); fab.title=label || 'Eintrag erfassen';
  }
  if (!render) return;
  // Ein Fehler in EINER Seite darf die App nicht unbrauchbar machen
  try {
    if (id === 'home') renderHome();
    if (id === 'kasse') renderKasse();
    if (id === 'contracts') renderContracts();
    if (id === 'meters') renderMeters();
    if (id === 'analysis') renderAnalysis();
    if (id === 'tickets') {
      if (!showPage._ticketsInit) { initTicketsDelegation(); showPage._ticketsInit = true; }
      renderTickets();
    }
    if (id === 'recipes') {
      if (!showPage._recipesInit) { initRecipesDelegation(); showPage._recipesInit = true; }
      renderRecipes();
    }
  } catch (err) {
    console.warn('[HomeHub] Seite "' + id + '" konnte nicht vollständig aufgebaut werden:', err);
  }
}
document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', () => { if (activePage !== btn.dataset.page) showPage(btn.dataset.page); });
});

// ════════════════════════════════════════════
// HOME PAGE
// ════════════════════════════════════════════
function renderHome() {
  if (activePage !== 'home') return;
  const oldQuick = document.getElementById('q-desc');
  const draft = oldQuick ? {amount:document.getElementById('q-amt').value,desc:oldQuick.value,category:document.getElementById('q-cat').value,account:document.getElementById('q-wir').classList.contains('aw')?'wir':'ich',manual:document.getElementById('homeContent').dataset.quickManual==='true'} : null;
  const focusId = document.activeElement?.id;
  renderConcertBanner();
  const cm = currMonth(), pm = prevMonth();
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cmName = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  // ── Monatskarte: Modus wie in der Analyse (Wir / Mein Anteil / Ich) ──
  const mode3 = getHaushaltMode();
  const split = (Number(settings.splitPct) || 50) / 100;
  const modeLabel = mode3 === 'wir' ? 'Wir gesamt' : mode3 === 'anteil' ? 'Mein Anteil' : 'Ich persönlich';
  function hmExpAmt(e) {
    if (mode3 === 'ich') return e.account === 'wir' ? 0 : Number(e.amount || 0);
    if (mode3 === 'anteil' && e.account === 'wir') return Number(e.amount || 0) * split;
    return Number(e.amount || 0);
  }
  const cmExps = expensesForMonth(cm).filter(e => e && (mode3 === 'ich' ? e.account !== 'wir' : true));
  const totalCm = cmExps.reduce((s, e) => s + hmExpAmt(e), 0);
  const dailyAvg = dayOfMonth > 0 ? totalCm / dayOfMonth : 0;
  const forecast = dailyAvg * daysInMonth;

  // ── Wichtigste Budgetinformation (genau eine Zeile) ──
  const budgetKey = mode3 === 'ich' ? 'ich' : 'wir';
  const hbBudgets = (budgets && typeof budgets === 'object' && budgets[budgetKey] && typeof budgets[budgetKey] === 'object') ? budgets[budgetKey] : {};
  const budgetScale = mode3 === 'anteil' ? split : 1;
  const catLbl = c => { const f = EXP_CATS.find(x => x.v === c); return f ? f.l.replace(/^\S+\s/, '') : (c || 'Sonstiges'); };
  const catSpentHome = {};
  cmExps.forEach(e => { if (!e) return; catSpentHome[e.category] = (catSpentHome[e.category] || 0) + hmExpAmt(e); });
  const budgetRowsHome = Object.keys(hbBudgets).map(cat => {
    const limit = Number(hbBudgets[cat] || 0) * budgetScale;
    const spent = catSpentHome[cat] || 0;
    return { cat, limit, spent };
  }).filter(r => r.limit > 0);
  let mainBudgetLine = null;
  const overRows = budgetRowsHome.filter(r => r.spent > r.limit).sort((a, b) => (b.spent - b.limit) - (a.spent - a.limit));
  const nearRows  = budgetRowsHome.filter(r => r.spent <= r.limit && r.spent >= r.limit * 0.8).sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit));
  if (overRows.length) {
    mainBudgetLine = `${catLbl(overRows[0].cat)}: ${fmtEurPlain(overRows[0].spent)} von ${fmtEurPlain(overRows[0].limit)} (überschritten)`;
  } else if (nearRows.length) {
    mainBudgetLine = `${catLbl(nearRows[0].cat)}: ${fmtEurPlain(nearRows[0].spent)} von ${fmtEurPlain(nearRows[0].limit)}`;
  } else if (budgetRowsHome.length) {
    const biggest = [...budgetRowsHome].sort((a, b) => b.spent - a.spent)[0];
    if (biggest && biggest.spent > 0) mainBudgetLine = `${catLbl(biggest.cat)}: ${fmtEurPlain(biggest.spent)} von ${fmtEurPlain(biggest.limit)}`;
  }

  // ── Verträge: Kündigungsfristen ──
  const activeContracts = activeContractsOnly();
  const contractDeadlines = activeContracts.map(c => {
    const lcd = latestCancelDate(c);
    const d = lcd ? diffDays(lcd) : null;
    return { c, d };
  }).filter(x => x.d !== null);
  const overdueDeadlines = contractDeadlines.filter(x => x.d < 0).sort((a, b) => a.d - b.d);
  const soonDeadlines    = contractDeadlines.filter(x => x.d >= 0 && x.d <= 7).sort((a, b) => a.d - b.d);

  // ── Konzerte ──
  const nextConcerts = (typeof upcomingConcerts === 'function') ? upcomingConcerts() : [];
  const nextConcert = nextConcerts.length ? nextConcerts[0] : null;
  const nextConcertDays = nextConcert ? daysUntil(nextConcert.date) : null;

  // ── Rezepte / Wochenplan (heute + morgen) ──
  const dayKeys = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  const todayKey = dayKeys[now.getDay()];
  const tomorrowKey = dayKeys[(now.getDay() + 1) % 7];
  const wp = (weekPlan && typeof weekPlan === 'object') ? weekPlan : {};
  const rc = Array.isArray(recipes) ? recipes : [];
  const todayRecipeId = wp[todayKey];
  const tomorrowRecipeId = wp[tomorrowKey];
  const todayRecipe = todayRecipeId ? rc.find(r => r && r.id === todayRecipeId) : null;
  const tomorrowRecipe = tomorrowRecipeId ? rc.find(r => r && r.id === tomorrowRecipeId) : null;

  // ── Zähler: letzte Ablesung ──
  const meterList = Array.isArray(meters) ? meters : [];
  let lastReadingDaysAgo = null;
  meterList.forEach(m => {
    const readings = Array.isArray(m && m.readings) ? m.readings : [];
    readings.forEach(r => {
      if (!r || !r.date) return;
      const d = diffDays(r.date);
      if (d !== null && d <= 0) {
        const ago = -d;
        if (lastReadingDaysAgo === null || ago < lastReadingDaysAgo) lastReadingDaysAgo = ago;
      }
    });
  });

  // ── "Heute wichtig": max. 3 Hinweise nach Priorität ──
  const todayHints = [];
  overdueDeadlines.slice(0, 1).forEach(x => {
    todayHints.push(`Kündigungsfrist „${esc(x.c.name)}" bereits ${Math.abs(x.d)} Tag${Math.abs(x.d) === 1 ? '' : 'e'} überfällig`);
  });
  if (todayHints.length < 3) {
    soonDeadlines.slice(0, 1).forEach(x => {
      if (todayHints.length >= 3) return;
      const label = x.d === 0 ? 'endet heute' : x.d === 1 ? 'endet morgen' : `endet in ${x.d} Tagen`;
      todayHints.push(`Kündigungsfrist „${esc(x.c.name)}" ${label}`);
    });
  }
  if (todayHints.length < 3 && overRows.length) {
    const r = overRows[0];
    if (r.cat === 'gesundheit') {
      todayHints.push(`Gesundheitsbudget überschritten – ggf. Budget anpassen`);
    } else {
      todayHints.push(`${catLbl(r.cat)}budget um ${fmtEurPlain(r.spent - r.limit)} überschritten`);
    }
  }
  if (todayHints.length < 3 && nextConcert && nextConcertDays !== null && nextConcertDays <= 30) {
    const when = nextConcertDays === 0 ? 'heute' : nextConcertDays === 1 ? 'morgen' : `in ${nextConcertDays} Tagen`;
    todayHints.push(`Nächstes Konzert ${when}`);
  }


  const visibleTodayHints = todayHints.slice(0, 3);

  // ── Kategorie-Schlüsselwörter für Auto-Vorschlag ──
  const CAT_KEYWORDS = {
    lebensmittel: ['rewe','edeka','aldi','lidl','kaufland','penny','netto','supermarkt','markt','lebensmittel','bäcker','metzger','obst','gemüse','milch'],
    drogerie:     ['dm','rossmann','müller','drogerie','shampoo','seife','creme','parfum'],
    restaurant:   ['restaurant','café','cafe','bistro','pizza','sushi','burger','döner','mittagessen','abendessen','brunch'],
    lieferdienst: ['lieferando','uber eats','wolt','dominos','lieferung','bestellt'],
    kino:         ['kino','cinema','film','ticket','eintrittskarte'],
    konzerte:     ['konzert','festival','ticket','veranstaltung','theater','oper'],
    transport:    ['bahn','db','mvv','hvv','hvb','bus','taxi','uber','bolt','parkhaus','parkplatz','benzin','tanken','auto','sprit'],
    gesundheit:   ['apotheke','arzt','zahnarzt','physiotherapie','krankenhaus','medikament','rezept'],
    freizeit:     ['sport','fitnessstudio','gym','schwimmbad','museum','ausflug','urlaub'],
    kleidung:     ['zara','h&m','primark','c&a','kleidung','schuhe','jacke','hose','shirt'],
    haushalt:     ['ikea','bauhaus','obi','hornbach','haushalt','putzmittel','reinigung','möbel'],
    elektronik:   ['saturn','mediamarkt','amazon','handy','laptop','kabel','elektronik'],
  };

  // ── Schnellchips: häufig/zuletzt verwendete Beschreibungen ──
  const expList = Array.isArray(expenses) ? expenses : [];
  const descStats = {};
  [...expList].reverse().slice(0, 80).forEach((e, i) => {
    if (!e || !e.desc) return;
    const key = e.desc.trim();
    if (!key) return;
    if (!descStats[key]) descStats[key] = { count: 0, recentIdx: i, category: e.category, account: e.account };
    descStats[key].count++;
  });
  const chips = Object.keys(descStats)
    .map(k => ({ desc: k, ...descStats[k] }))
    .sort((a, b) => (b.count - a.count) || (a.recentIdx - b.recentIdx))
    .slice(0, 4);

  // ════ HTML aufbauen ════════════════════════════════════════════════════
  let h = '';

  // ── 1. Schnellerfassung ──
  h += `
  <div class="quick-card">
    <div class="hm-quick-label">Ausgabe erfassen</div>
    <div class="quick-row">
      <input aria-label="Betrag der Ausgabe" autocomplete="off" class="quick-amt" id="q-amt" type="number" step=".01" placeholder="0,00" inputmode="decimal">
      <input aria-label="Beschreibung der Ausgabe" class="quick-desc" id="q-desc" placeholder="Wofür?" autocomplete="off" list="q-desc-suggestions">
      <datalist id="q-desc-suggestions"></datalist>
    </div>
    <div class="quick-row2">
      <select aria-label="Kategorie der Ausgabe" class="quick-sel" id="q-cat">${EXP_CATS.map(c => `<option value="${c.v}">${c.l}</option>`).join('')}</select>
      <div class="quick-acc">
        <button class="qacc ai" id="q-ich" type="button">Ich</button>
        <button class="qacc" id="q-wir" type="button">Wir</button>
      </div>
      <button aria-label="Ausgabe speichern" class="qsave" id="qSaveBtn">✓</button>
    </div>
    <div id="q-feedback" class="q-feedback" aria-live="polite"></div>
    ${chips.length ? `<div class="hm-chips">${chips.map((c, i) =>
      `<button class="hm-chip" type="button" data-chipidx="${i}">${esc(c.desc)}</button>`).join('')}</div>` : ''}
  </div>`;

  // ── 2. Kompakte Monatskarte ──
  h += `
  <div class="hh-toggle" style="margin-bottom:10px">
    <button class="hh-btn${mode3==='wir'?' aw':''}" id="hm2-wir-btn">Wir</button>
    <button class="hh-btn${mode3==='anteil'?' aa':''}" id="hm2-anteil-btn">Mein Anteil</button>
    <button class="hh-btn${mode3==='ich'?' ai':''}" id="hm2-ich-btn">Ich</button>
  </div>
  <div class="hero-card ${mode3 === 'ich' ? 'ich' : 'wir'}">
    <div class="hm-hero-eyebrow">${esc(modeLabel)} · ${cmName}</div>
    <div class="hero-amount">${fmtEurPlain(totalCm)}</div>
    ${dayOfMonth < daysInMonth ? `<div class="hm-hero-row"><span class="hm-hero-forecast">Prognose (Schätzung) etwa ${fmtEurPlain(forecast)}</span></div>` : ''}
    ${mainBudgetLine ? `<div class="hm-hero-row" style="margin-top:6px"><span class="hm-hero-diff">${mainBudgetLine}</span></div>` : ''}
    <button class="hm-link-btn" id="homeToAnalysisDetails" style="margin-top:8px;color:rgba(255,255,255,.85)">Details →</button>
  </div>`;

  // ── 3. Heute wichtig ──
  if (visibleTodayHints.length) {
    h += `<div class="card"><div class="card-label">Heute wichtig</div>`;
    visibleTodayHints.forEach(t => { h += `<div class="hm-today-row">• ${t}</div>`; });
    h += `</div>`;
  }

  // ── 6. Wochenplan (nur bei Relevanz) ──
  if (todayRecipe || tomorrowRecipe) {
    h += `<div class="card">
      <div class="hm-card-head">
        <span class="card-label" style="margin:0">Essen</span>
        <button id="homeToRecipes" class="hm-link-btn">Wochenplan öffnen</button>
      </div>`;
    h += `<div class="hm-week-row"><span class="hm-week-day">Heute</span><span class="hm-week-recipe">${todayRecipe ? esc(todayRecipe.title) : 'noch nichts geplant'}</span></div>`;
    h += `<div class="hm-week-row"><span class="hm-week-day">Morgen</span><span class="hm-week-recipe">${tomorrowRecipe ? esc(tomorrowRecipe.title) : 'noch nichts geplant'}</span></div>`;
    h += `</div>`;
  }

  // ── 7. Zuletzt erfasst (max. 3) ──
  const recentExp = [...expList].filter(Boolean)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 3);
  if (recentExp.length > 0) {
    h += `<div class="card">
      <div class="hm-card-head">
        <span class="card-label" style="margin:0">Zuletzt erfasst</span>
        <button id="homeToKasse2" class="hm-link-btn">Alle Ausgaben</button>
      </div>`;
    recentExp.forEach(e => {
      const bg = EXP_BG[e.category] || '#F1F5F9';
      const icon = EXP_ICON[e.category] || '📋';
      h += `<div class="hm-recent-row" data-editexp="${esc(e.id)}">
        <div class="exp-ico" style="background:${bg}">${icon}</div>
        <div class="hm-recent-info">
          <div class="hm-recent-name">${esc(e.desc)}</div>
          <div class="hm-recent-date">${fmtDate(e.date)}</div>
        </div>
        <div class="hm-recent-amt">${fmtEurPlain(Number(e.amount || 0))}</div>
      </div>`;
    });
    h += `</div>`;
  }

  // ── 8. Ei-Spiel ──
  h += `<div class="dragon-card" id="dragonCard"></div>`;

  // ── DOM schreiben ──
  document.getElementById('homeContent').innerHTML = h;
  renderDragonCard();
  if (draft) { document.getElementById('q-amt').value=draft.amount; document.getElementById('q-desc').value=draft.desc; document.getElementById('q-cat').value=draft.category; }
  if (['q-amt','q-desc','q-cat'].includes(focusId)) document.getElementById(focusId)?.focus();

  // ── Event-Listener ──
  document.getElementById('homeToRecipes')?.addEventListener('click', () => showPage('recipes'));
  document.getElementById('homeToKasse2')?.addEventListener('click', () => showPage('kasse'));
  document.getElementById('homeToAnalysisDetails')?.addEventListener('click', () => showPage('analysis'));
  document.getElementById('hm2-wir-btn')?.addEventListener('click', () => { setHaushalt('wir'); renderHome(); });
  document.getElementById('hm2-anteil-btn')?.addEventListener('click', () => { setHaushalt('anteil'); renderHome(); });
  document.getElementById('hm2-ich-btn')?.addEventListener('click', () => { setHaushalt('ich'); renderHome(); });

  // Zuletzt erfasst: antippen zum Bearbeiten
  document.querySelectorAll('[data-editexp]').forEach(row => {
    row.addEventListener('click', () => openEditExpense(row.dataset.editexp));
  });

  // Schnellchips: Beschreibung, Kategorie und Konto vorausfüllen
  document.querySelectorAll('.hm-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const chip = chips[Number(btn.dataset.chipidx)];
      if (!chip) return;
      const descEl = document.getElementById('q-desc');
      const catEl = document.getElementById('q-cat');
      if (descEl) descEl.value = chip.desc;
      if (catEl && chip.category) { catEl.value = chip.category; catAutoSet = true; document.getElementById('homeContent').dataset.quickManual='true'; }
      setQAcc(chip.account === 'wir' ? 'wir' : 'ich');
      descEl?.focus();
    });
  });

  // ── Schnellerfassung: Konto-Toggle ──
  let qAcc = draft?.account || (activeHaushalt === 'wir' ? 'wir' : 'ich');
  const setQAcc = a => {
    qAcc = a;
    document.getElementById('q-ich').className = 'qacc' + (a === 'ich' ? ' ai' : '');
    document.getElementById('q-wir').className = 'qacc' + (a === 'wir' ? ' aw' : '');
  };
  setQAcc(qAcc);
  document.getElementById('q-ich')?.addEventListener('click', () => setQAcc('ich'));
  document.getElementById('q-wir')?.addEventListener('click', () => setQAcc('wir'));

  // ── Schnellerfassung: Kategorie-Auto-Vorschlag aus Beschreibung ──
  const qDescEl  = document.getElementById('q-desc');
  const qCatEl   = document.getElementById('q-cat');
  const qFeedEl  = document.getElementById('q-feedback');
  const qSuggEl  = document.getElementById('q-desc-suggestions');

  const recentDescs = [...new Set([...expList].reverse().slice(0, 50).map(e => e.desc))].slice(0, 10);
  if (qSuggEl) qSuggEl.innerHTML = recentDescs.map(d => `<option value="${esc(d)}">`).join('');

  const guessCategory = desc => suggestExpenseCategory(desc, expenses, CAT_KEYWORDS, EXP_CATS.map(c => c.v));
  let catAutoSet = draft?.manual || false; // preserve explicit choices across dashboard updates
  if (!draft) qCatEl.value = 'sonstiges';
  document.getElementById('q-amt')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); qDescEl?.focus(); }
  });
  qDescEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('qSaveBtn')?.click(); }
  });

  qDescEl?.addEventListener('input', () => {
    const val = qDescEl.value;
    const guessed = guessCategory(val);
    if (!catAutoSet) qCatEl.value = guessed;
    if (qFeedEl && qFeedEl.classList.contains('q-feedback-error')) {
      qFeedEl.textContent = '';
      qFeedEl.className = 'q-feedback';
    }
  });
  qCatEl?.addEventListener('change', () => { catAutoSet = true; document.getElementById('homeContent').dataset.quickManual='true'; });

  document.getElementById('qSaveBtn')?.addEventListener('click', () => {
    const amt = strictNumber(document.getElementById('q-amt').value);
    const desc = qDescEl?.value.trim();

    if (!amt && !desc) {
      if (qFeedEl) { qFeedEl.textContent = 'Bitte Betrag und Beschreibung eingeben.'; qFeedEl.className = 'q-feedback q-feedback-error'; }
      document.getElementById('q-amt')?.focus();
      return;
    }
    if (amt === null || amt <= 0) {
      if (qFeedEl) { qFeedEl.textContent = 'Bitte Betrag eingeben.'; qFeedEl.className = 'q-feedback q-feedback-error'; }
      document.getElementById('q-amt')?.focus();
      return;
    }
    if (!desc) {
      if (qFeedEl) { qFeedEl.textContent = 'Bitte Beschreibung eingeben.'; qFeedEl.className = 'q-feedback q-feedback-error'; }
      qDescEl?.focus();
      return;
    }

    expenses.push({ id: uid(), amount: amt, desc, date: today(), category: qCatEl?.value || 'sonstiges', analysisGroup: getAnalysisGroup(qCatEl?.value || 'sonstiges'), tripId: null, note: '', account: qAcc, paidBy: 'ich' });
    if(!save('vh_expenses', expenses))return;
    rewardDragon('expense', {id:expenses[expenses.length-1].id}); // HOMEHUB DRAGON

    document.getElementById('q-amt').value = '';
    qDescEl.value = '';
    catAutoSet = false;
    qCatEl.value = 'sonstiges';
    document.getElementById('homeContent').dataset.quickManual = 'false';
    renderHome();
    renderAmpel();
    const feedback = document.getElementById('q-feedback');
    if (feedback) {
      feedback.textContent = `${fmtEurPlain(amt)} gespeichert`;
      feedback.className = 'q-feedback q-feedback-ok';
      setTimeout(() => { if (feedback.isConnected) { feedback.textContent=''; feedback.className='q-feedback'; } }, 2500);
    }
    document.getElementById('q-amt')?.focus();
  });
}
function goKasseTab(tab) {
  // Legacy-Ziele auf neue Struktur abbilden
  if (tab === 'einkauf' || tab === 'ausgleich' || tab === 'recurring') {
    showPage('kasse', {render:false});
    mehrView = tab === 'recurring' ? 'recurring' : tab;
    setKasseTab('mehr');
    return;
  }
  if (tab === 'analyse') { showPage('analysis'); return; }
  showPage('kasse');
  setKasseTab(tab);
}

// ════════════════════════════════════════════

window.addEventListener('popstate', () => showPage(location.hash.slice(1) || 'home', {history:false}));
document.querySelectorAll('[data-home-action]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.homeAction === 'expense') openAddExpense();
  if (button.dataset.homeAction === 'contract') openAddContractModal();
  if (button.dataset.homeAction === 'reading') {
    showPage('meters');
    if (meters.length) { if (!meters.some(m => m.type === activeMeterType)) activeMeterType=meters[0].type; openReadingModal(); }
    else openMeterModal(null);
  }
}));

document.getElementById('fabShopAdd')?.addEventListener('click',()=>openAddShopItem());
document.getElementById('fabShopList')?.addEventListener('click',()=>goKasseTab('einkauf'));
