'use strict';
// INIT
{ const _sp3 = document.getElementById('sharedPill'); if (_sp3) _sp3.textContent = '👫 ' + (settings.partnerName || 'Partner'); }
if (meters.length) activeMeterType = meters[0].type;

// Garantiert dass UI-Buttons, kasseCostView und activeHaushalt beim Start synchron sind.
// setHaushalt ist die einzige autorisierte Stelle für diesen State.
setHaushalt('wir');
fillGroupSelects();

autoBookRecurring();
// ── Aufgabe 5/6: Daten vor dem ersten Rendern absichern (ohne etwas zu löschen) ──
function safeArray(v) { return Array.isArray(v) ? v : []; }
function normalizeAppData() {
  const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
  const clean = (name, arr) => {
    const src = safeArray(arr);
    const out = src.filter(isObj);
    if (out.length !== src.length) console.warn('[HomeHub] ' + (src.length - out.length) + ' unbrauchbare Einträge übersprungen:', name);
    return out;
  };
  contracts   = clean('vh_contracts', contracts);
  expenses    = clean('vh_expenses', expenses);
  recurring   = clean('vh_recurring', recurring);
  transfers   = clean('vh_transfers', transfers);
  meters      = clean('vh_meters', meters).map(m => { if (!Array.isArray(m.readings)) m.readings = []; return m; });
  recipes     = clean('vh_recipes', recipes).map(r => {
    r.ingredients = getRecipeIngredientLines(r);
    r.steps = getRecipeStepLines(r);
    return r;
  });
  concerts    = clean('vh_concerts', concerts).map(c => { if (!Array.isArray(c.tickets)) c.tickets = []; return c; });
  ticketPeople = safeArray(ticketPeople).filter(x => typeof x === 'string' && x.trim());
  if (!isObj(shopLists)) shopLists = { items: [] };
  if (!Array.isArray(shopLists.items)) shopLists.items = [];
  shopLists.items = shopLists.items.filter(isObj);
  if (!isObj(budgets))     budgets = {};
  if (!isObj(priceMemory)) priceMemory = {};
  if (!isObj(venues))      venues = {};
  if (!isObj(cities))      cities = {};
  if (!isObj(settings))    settings = { partnerName: 'Partner', splitPct: 50 };
  if (!isObj(weekPlan))    weekPlan = { Mo:null,Di:null,Mi:null,Do:null,Fr:null,Sa:null,So:null };
  try {
    if (typeof state === 'object' && state) {
      state.contracts = contracts; state.meters = meters; state.expenses = expenses;
      state.shopLists = shopLists; state.budgets = budgets; state.priceMemory = priceMemory;
      state.recurring = recurring; state.transfers = transfers; state.settings = settings;
    }
  } catch (e) { /* state optional */ }
}

try { normalizeAppData(); } catch (err) { console.warn('[HomeHub] Datenprüfung fehlgeschlagen:', err); }
try { repairKnownLiveData(); } catch (err) { console.warn('[HomeHub] Datenkorrektur fehlgeschlagen:', err); }
try { renderAmpel(); } catch (err) { console.warn('[HomeHub] Ampel konnte nicht aufgebaut werden:', err); }
try { renderHome(); }  catch (err) { console.warn('[HomeHub] Startseite konnte nicht aufgebaut werden:', err); }

// Boot abgeschlossen — ab hier gelten Fehler als Laufzeitfehler, nicht als Startabsturz
window.__HOMEHUB_BOOTING__ = false;
window.__HOMEHUB_READY__ = true;

// ════════════════════════════════════════════

if (location.hash) showPage(location.hash.slice(1), {history:false});
