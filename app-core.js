'use strict';
/* ── HOMEHUB DRAGON Guard ── Fallbacks, falls dragon-game-balanced.js nicht lädt. */
if (typeof window.rewardDragon     !== 'function') window.rewardDragon     = function () {};
if (typeof window.renderDragonCard !== 'function') window.renderDragonCard = function () {};
if (typeof window.loadDragon       !== 'function') window.loadDragon       = function () {};
if (typeof window.saveDragon       !== 'function') window.saveDragon       = function () {};
if (typeof window.DRAGON_DEFAULTS  !== 'object' || !window.DRAGON_DEFAULTS) window.DRAGON_DEFAULTS = { egg: true };
if (typeof window.dragon           !== 'object' || !window.dragon)          window.dragon = Object.assign({}, window.DRAGON_DEFAULTS);

// ════════════════════════════════════════════
// PWA SERVICE WORKER REGISTRIERUNG
// ════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  // BUGFIX 8: Übernimmt ein neuer Service Worker nach einem Deploy die Kontrolle,
  // die Seite EINMAL automatisch neu laden. Sonst läuft alter Code im Speicher
  // gegen neue Dateien → fast leerer Bildschirm. Flag schützt vor Endlosschleife.
  let _swRefreshing = false;
  const SW_RELOAD_KEY = 'homehub_sw_reload';
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swRefreshing) return;
    try {
      if (sessionStorage.getItem(SW_RELOAD_KEY) === '1') {
        console.warn('[PWA] Wiederholter controllerchange erkannt — kein weiterer Reload.');
        return;
      }
      sessionStorage.setItem(SW_RELOAD_KEY, '1');
    } catch (e) { /* sessionStorage gesperrt: einfacher Schutz reicht */ }
    _swRefreshing = true;
    window.location.reload();
  });
  // Nach stabilem Start die Sperre wieder lösen
  setTimeout(() => { try { sessionStorage.removeItem(SW_RELOAD_KEY); } catch (e) {} }, 5000);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      // BUGFIX 7: SW registration error gives actionable info
      .then(reg => {
        // Trigger update check on each load so new deploys propagate
        reg.update().catch(() => {});
      })
      .catch(err => console.warn('[PWA] SW Registrierung fehlgeschlagen:', err.message));
  });
}

// ════════════════════════════════════════════
// ════════════════════════════════════════════

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function cloneDefault(value) {
  if (Array.isArray(value)) return value.slice();
  if (value && typeof value === 'object') return Object.assign({}, value);
  return value;
}
function load(k, d) {
  try {
    const raw = localStorage.getItem(k);
    if (raw === null) return cloneDefault(d);
    const parsed = JSON.parse(raw);
    if (Array.isArray(d)) {
      if (Array.isArray(parsed)) return parsed;
      console.warn('[HomeHub] Erwartete Liste, gefunden ' + (parsed === null ? 'null' : typeof parsed) + ':', k);
      return cloneDefault(d);
    }
    if (d && typeof d === 'object') {
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      console.warn('[HomeHub] Erwartetes Objekt, gefunden ' + (parsed === null ? 'null' : (Array.isArray(parsed) ? 'Liste' : typeof parsed)) + ':', k);
      return cloneDefault(d);
    }
    if (parsed === null || parsed === undefined) return cloneDefault(d);
    if (typeof d !== 'undefined' && typeof parsed !== typeof d) {
      console.warn('[HomeHub] Unerwarteter Datentyp:', k);
      return cloneDefault(d);
    }
    return parsed;
  } catch (e) {
    console.warn('[HomeHub] Beschädigte Daten:', k, e && e.message);
    return cloneDefault(d);
  }
}

function save(k, v) {
  try { const json=JSON.stringify(v); if(localStorage.getItem(k)===json)return true; localStorage.setItem(k,json); onAppDataSaved(k); return true; }
  catch (e) { console.warn('[Storage] Speichern fehlgeschlagen:', k, e); if(window.__hhApplying)throw e; alert('Änderung konnte nicht dauerhaft gespeichert werden. Bitte Speicherplatz prüfen und ein Backup exportieren.'); return false; }
}

// BUGFIX 4: Timezone-safe local date helpers – toISOString() uses UTC which
// can produce the wrong day for users east/west of UTC. Use local year/month/day instead.
function _pad(n) { return String(n).padStart(2, '0'); }
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;
}
// Keep 'today' as the canonical name used everywhere
function today() { return todayLocal(); }

function currMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${_pad(d.getMonth() + 1)}`;
}
function prevMonth() {
  const d = new Date();
  d.setDate(1);          // avoid day-overflow when subtracting a month
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${_pad(d.getMonth() + 1)}`;
}
// BUGFIX 4: Safe local date string from a Date object (avoids UTC shift)
function localDateStr(d) {
  return `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function fmtDate(s) {
  if (!s) return '–';
  try {
    // Parse YYYY-MM-DD as local date (avoid UTC midnight → wrong day)
    const [y, m, day] = s.split('-').map(Number);
    if (!y || !m || !day) return s;
    return new Date(y, m - 1, day).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return s; }
}
function fmtEur(n) { return Number(n || 0).toFixed(2).replace('.', ',') + '&nbsp;€'; }
function fmtEurPlain(n) { return Number(n || 0).toFixed(2).replace('.', ',') + ' €'; }
function diffDays(s) {
  if (!s) return null;
  // BUGFIX 4: Parse as local date to avoid UTC offset shifting the day
  const [y, m, day] = s.split('-').map(Number);
  if (!y || !m || !day) return null;
  const target = new Date(y, m - 1, day);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / 86400000);
}

// ── Deutsche Zahleneingabe sicher parsen ──
// Verarbeitet korrekt: "12,50" → 12.5, "1.234,56" → 1234.56, "9.99" → 9.99
function parseDE(value) {
  if (value === null || value === undefined || value === '') return 0;
  const s = String(value).trim();
  // Enthält Komma → deutsche Schreibweise: Punkte als Tausender entfernen, Komma → Punkt
  if (s.includes(',')) {
    return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // Nur Punkt → englische Schreibweise (z.B. direkte Numpad-Eingabe)
  return Number(s) || 0;
}

// ════════════════════════════════════════════
// ANALYSE-GRUPPEN (HomeHub)
// ════════════════════════════════════════════
const ANALYSIS_GROUPS = [
  { id: 'wohnen',       label: '🏠 Wohnen',               color: '#4A7C5F' },
  { id: 'versicherung', label: '🛡️ Versicherungen',        color: '#5A7EA8' },
  { id: 'mobilitaet',   label: '🚗 Mobilität & Auto',      color: '#C47E3A' },
  { id: 'alltag',       label: '🛒 Lebensmittel & Alltag', color: '#3E8E63' },
  { id: 'freizeit',     label: '🎉 Freizeit & Abos',       color: '#7A5FA8' },
  { id: 'gesundheit',   label: '💊 Gesundheit',            color: '#B05A5A' },
  { id: 'urlaub',       label: '✈️ Urlaub & Reisen',       color: '#C4963A' },
  { id: 'sparen',       label: '💰 Sparen & Vermögen',     color: '#2B7BA8' },
  { id: 'sonstiges',    label: '📋 Sonstiges',             color: '#7A8C84' },
];
// Kategorie → Analysegruppe Mapping (vollständig, rückwärtskompatibel)
const ANALYSIS_GROUP_MAP = {
  // ── Verträge: Wohnen ──
  strom: 'wohnen', gas: 'wohnen', wasser: 'wohnen', internet: 'wohnen',
  miete: 'wohnen', rundfunk: 'wohnen', handy: 'wohnen',
  // ── Verträge: Versicherungen ──
  versicherung: 'versicherung',
  // ── Verträge: Mobilität ──
  transport: 'mobilitaet',
  // ── Verträge: Freizeit & Abos ──
  streaming: 'freizeit', gaming: 'freizeit', fitness: 'freizeit', software: 'freizeit',
  // ── Verträge: Sparen ──
  sparen: 'sparen',
  // ── Ausgaben: Lebensmittel & Alltag ──
  lebensmittel: 'alltag', drogerie: 'alltag', haushalt: 'alltag',
  // ── Ausgaben: Freizeit ──
  restaurant: 'freizeit', kino: 'freizeit', konzerte: 'freizeit', freizeit: 'freizeit',
  lieferdienst: 'freizeit', kleidung: 'freizeit',
  // ── Ausgaben: Mobilität ──
  // transport bereits oben
  // ── Ausgaben: Gesundheit ──
  gesundheit: 'gesundheit',
  // ── Ausgaben: Urlaub ──
  urlaub: 'urlaub',
  // ── Sonstiges (Fallback) ──
  elektronik: 'sonstiges', sonstiges: 'sonstiges',
};

// ════════════════════════════════════════════
// ZENTRALER APP STATE
// ════════════════════════════════════════════
const state = {
  contracts:  migrateContracts(load('vh_contracts', [])),
  meters:     load('vh_meters', []),
  settings:   load('vh_settings', { partnerName: 'Partner', splitPct: 50 }),
  expenses:   migrateExpenses(load('vh_expenses', [])),
  shopLists:  load('vh_shoplists', { items: [] }),
  budgets:    load('vh_budgets', {}),
  priceMemory: load('vh_prices', {}),
  recurring:  load('vh_recurring', []),
  transfers:  load('vh_transfers', []),
};

// Shortcut-Aliase für Legacy-Kompatibilität (Referenzen zeigen auf state-Felder)
// WICHTIG: Alle Zuweisungen müssen state.X setzen UND die Variable neu zuweisen
let contracts  = state.contracts;
let meters     = state.meters;
let settings   = state.settings;
let expenses   = state.expenses;
let shopLists  = state.shopLists;
let budgets    = state.budgets;
let priceMemory = state.priceMemory;
let recurring  = state.recurring;
let transfers  = state.transfers;

function syncState() {
  state.contracts  = contracts;
  state.meters     = meters;
  state.settings   = settings;
  state.expenses   = expenses;
  state.shopLists  = shopLists;
  state.budgets    = budgets;
  state.priceMemory = priceMemory;
  state.recurring  = recurring;
  state.transfers  = transfers;
}

function saveAll() {
  syncState();
  save('vh_contracts',  contracts);
  save('vh_meters',     meters);
  save('vh_expenses',   expenses);
  save('vh_shoplists',  shopLists);
  save('vh_budgets',    budgets);
  save('vh_prices',     priceMemory);
  save('vh_recurring',  recurring);
  save('vh_settings',   settings);
  save('vh_transfers',  transfers);
  save('vh_recipes',    recipes);   // BUGFIX: fehlten in saveAll
  save('vh_weekplan',   weekPlan);  // BUGFIX: fehlten in saveAll
  save('vh_concerts',   concerts);
  save('vh_venues',     venues);
  save('vh_cities',     cities);
  save('vh_ticketpeople', ticketPeople);
}

// ════════════════════════════════════════════
// CATEGORIES
// ════════════════════════════════════════════
const EXP_CATS = [
  { v: 'lebensmittel', l: '🛒 Lebensmittel', bg: '#dcfce7' },
  { v: 'drogerie',     l: '🧴 Drogerie',     bg: '#ede9fe' },
  { v: 'restaurant',   l: '🍽️ Restaurant',   bg: '#fff7ed' },
  { v: 'kino',         l: '🎬 Kino',         bg: '#fef9c3' },
  { v: 'konzerte',     l: '🎵 Konzerte',     bg: '#fae8ff' },
  { v: 'lieferdienst', l: '🛵 Lieferdienst', bg: '#fce7f3' },
  { v: 'transport',    l: '🚗 Transport',    bg: '#dbeafe' },
  { v: 'gesundheit',   l: '💊 Gesundheit',   bg: '#fce7f3' },
  { v: 'freizeit',     l: '🎉 Freizeit',     bg: '#fef9c3' },
  { v: 'kleidung',     l: '👕 Kleidung',     bg: '#e0f2fe' },
  { v: 'haushalt',     l: '🏠 Haushalt',     bg: '#f1f5f9' },
  { v: 'elektronik',   l: '📱 Elektronik',   bg: '#dbeafe' },
  { v: 'sonstiges',    l: '📋 Sonstiges',    bg: '#f1f5f9' },
];
const EXP_ICON = {};
const EXP_BG   = {};
EXP_CATS.forEach(c => { EXP_ICON[c.v] = c.l.split(' ')[0]; EXP_BG[c.v] = c.bg; });

function getAnalysisGroup(category) {
  try { return ANALYSIS_GROUP_MAP[category] || 'sonstiges'; }
  catch (e) { return 'sonstiges'; }   // Sicherheitsnetz gegen Reihenfolge-Fehler
}
function groupLabel(id) {
  const g = ANALYSIS_GROUPS.find(x => x.id === id);
  return g ? g.label : '📋 Sonstiges';
}
function groupColor(id) {
  const g = ANALYSIS_GROUPS.find(x => x.id === id);
  return g ? g.color : '#94a3b8';
}
function fillGroupSelects() {
  const opts = ANALYSIS_GROUPS.map(g => `<option value="${g.id}">${g.label}</option>`).join('');
  ['f-group', 'e-group'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

// ════════════════════════════════════════════
// DATENMIGRATION (läuft beim Start)
// ════════════════════════════════════════════
function migrateContracts(list) {
  return (Array.isArray(list) ? list : []).filter(c => c && typeof c === 'object').map(c => ({
    ...c,
    analysisGroup: c.analysisGroup || getAnalysisGroup(c.category),
  }));
}
function migrateExpenses(list) {
  return (Array.isArray(list) ? list : []).filter(e => e && typeof e === 'object').map(e => ({
    ...e,
    analysisGroup: e.analysisGroup || getAnalysisGroup(e.category),
    tripId: e.tripId || null,
  }));
}


function fillCatSelect(selId, defaultVal) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = EXP_CATS.map(c => `<option value="${c.v}"${c.v === defaultVal ? ' selected' : ''}>${esc(c.l)}</option>`).join('');
}

const CONTRACT_ICONS = {
  strom: '⚡', gas: '🔥', wasser: '💧', internet: '🌐', handy: '📱',
  fitness: '💪', versicherung: '🛡️', streaming: '🎬', gaming: '🎮',
  software: '💻', miete: '🏠', rundfunk: '📺', sparen: '💰', sonstiges: '📋'
};

// ════════════════════════════════════════════
