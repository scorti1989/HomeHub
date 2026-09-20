'use strict';
// Shared validation for local imports and cloud snapshots.
const HH_DATA_KEYS = {
  contracts:'vh_contracts', meters:'vh_meters', expenses:'vh_expenses', shopLists:'vh_shoplists',
  budgets:'vh_budgets', priceMemory:'vh_prices', recurring:'vh_recurring', settings:'vh_settings',
  transfers:'vh_transfers', recipes:'vh_recipes', weekPlan:'vh_weekplan', concerts:'vh_concerts',
  venues:'vh_venues', cities:'vh_cities', ticketPeople:'vh_ticketpeople', dragon:'vh_dragon'
};
function safeWebUrl(value, image) {
  if (typeof value !== 'string') return '';
  const s = value.trim();
  if (image && /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(s)) return s;
  try { const u = new URL(s); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; }
  catch (_) { return ''; }
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
}
function strictNumber(raw) {
  const s = String(raw ?? '').trim();
  if (!s || !/^[+-]?(?:\d+(?:[.,]\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?)$/.test(s)) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g,'').replace(',','.') : s);
  return Number.isFinite(n) ? n : null;
}
function readingError(meter, date, value, exclude) {
  if (!validDate(date)) return 'Bitte ein gültiges Ablesedatum eingeben.';
  if (value === null || !Number.isFinite(value) || value < 0) return 'Bitte einen gültigen, nicht negativen Zählerstand eingeben.';
  const other = (meter.readings || []).filter(r => r !== exclude);
  if (other.some(r => r.date === date)) return 'Für dieses Datum existiert bereits eine Ablesung. Bitte diesen Eintrag bearbeiten.';
  if (other.some(r => (r.date < date && r.value > value) || (r.date > date && r.value < value)))
    return 'Der Zählerstand passt nicht zu den zeitlich benachbarten Ablesungen. Bitte Datum und Wert prüfen.';
  const en = meter.energy || {};
  if (validDate(en.startDate) && typeof en.startReading === 'number' &&
      ((date >= en.startDate && value < en.startReading) || (date <= en.startDate && value > en.startReading)))
    return 'Der Zählerstand widerspricht dem hinterlegten Startstand. Bitte auch die Zählereinstellungen prüfen.';
  return '';
}
function prepareAppSnapshot(input) {
  const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  if (!obj(input) || !Object.keys(HH_DATA_KEYS).some(k => Object.hasOwn(input,k))) throw new Error('Kein HomeHub-Datenstand erkannt.');
  // Reject dangerous keys before copying or merging any imported object.
  function inspect(x, depth=0) {
    if (depth > 35) throw new Error('Daten sind zu tief verschachtelt.');
    if (!x || typeof x !== 'object') return;
    for (const k of Object.keys(x)) {
      if (['__proto__','prototype','constructor'].includes(k)) throw new Error('Unzulässiger Schlüssel in den Daten.');
      inspect(x[k],depth+1);
    }
  }
  inspect(input);
  const d = JSON.parse(JSON.stringify(input));
  const arrays = ['contracts','meters','expenses','recurring','transfers','recipes','concerts','ticketPeople'];
  for (const key of arrays) {
    if (d[key] === undefined) d[key]=[];
    if (!Array.isArray(d[key])) throw new Error(key + ': Liste erwartet.');
    if (key === 'ticketPeople') {
      if (d[key].some(x => typeof x !== 'string')) throw new Error('Ungültige Person in der Ticketliste.');
      continue;
    }
    const ids = new Set();
    for (const row of d[key]) {
      if (!obj(row)) throw new Error(key + ': ungültiger Eintrag.');
      if (typeof row.id !== 'string' || !/^[\w.-]+$/.test(row.id) || ids.has(row.id)) throw new Error(key + ': fehlende, ungültige oder doppelte ID.');
      ids.add(row.id);
    }
  }
  for (const key of ['shopLists','budgets','priceMemory','settings','weekPlan','venues','cities','dragon']) {
    if (d[key] === undefined) d[key] = key === 'dragon' ? JSON.parse(JSON.stringify(DRAGON_DEFAULTS)) : {};
    if (!obj(d[key])) throw new Error(key + ': Objekt erwartet.');
  }
  const strings = ['name','title','artist','provider','note','notes','owner','ticketHolder','city','venueId','unit','type','category','account','desc','paidBy','frequency','interval','partnerName','sourceName'];
  function fields(row, label) {
    for (const key of strings) if (row[key] != null && typeof row[key] !== 'string') throw new Error(label + ': ' + key + ' muss Text sein.');
    for (const key of ['date','startDate','endDate','nextReading','settledDate','cancelledOn','cancelledUntil'])
      if (row[key] != null && row[key] !== '' && !validDate(row[key])) throw new Error(label + ': ungültiges Datum (' + key + ').');
    for (const key of ['cost','extraCost','amount','price','value','unitPrice','basePriceMonthly','monthlyPayment','startReading','gasKwhPerM3','servings','baseServings','time']) {
      if (key === 'time' && label === 'Konzert') continue;
      if (row[key] == null || row[key] === '') continue;
      const n = strictNumber(row[key]);
      if (n === null || (n < 0 && !(key === 'amount' && label === 'Transfer'))) throw new Error(label + ': ungültiger Zahlenwert (' + key + ').');
      row[key]=n;
    }
    for (const key of ['maps','sourceUrl','cancelUrl','imageUrl']) if (row[key] != null) row[key]=safeWebUrl(row[key],key==='imageUrl');
  }
  for (const [key,label] of [['contracts','Vertrag'],['expenses','Ausgabe'],['recurring','Wiederholung'],['transfers','Transfer'],['concerts','Konzert']]) d[key].forEach(r=>fields(r,label));
  d.shopLists.items ??= [];
  if (!Array.isArray(d.shopLists.items) || d.shopLists.items.some(r=>!obj(r))) throw new Error('Ungültige Einkaufsliste.');
  d.shopLists.items.forEach(r=>{fields(r,'Einkauf'); if(typeof r.name !== 'string') throw new Error('Einkaufsartikel ohne Namen.');});
  const meterTypes = new Set();
  for (const m of d.meters) {
    fields(m,'Zähler');
    if (!['gas','strom','wasser'].includes(m.type) || meterTypes.has(m.type)) throw new Error('Unbekannter oder doppelter Zählertyp.');
    meterTypes.add(m.type);
    m.readings ??= [];
    if (!Array.isArray(m.readings)) throw new Error('Ablesungen müssen eine Liste sein.');
    const dates = new Set(); let prev=-Infinity;
    for (const r of m.readings) { if (!obj(r)) throw new Error('Ungültige Ablesung.'); fields(r,'Ablesung'); if(!validDate(r.date) || !Number.isFinite(r.value)) throw new Error('Ablesung ohne Datum oder Wert.'); }
    m.readings.sort((a,b)=>a.date.localeCompare(b.date));
    for (const r of m.readings) { if(dates.has(r.date) || r.value<prev) throw new Error('Doppelte Ablesung oder rückläufiger Zählerstand.'); dates.add(r.date);prev=r.value; }
    if (m.energy != null) { if(!obj(m.energy)) throw new Error('Ungültige Zählereinstellungen.'); fields(m.energy,'Zählertarif'); }
  }
  for (const r of d.recipes) {
    fields(r,'Rezept');
    for (const key of ['ingredients','steps','ingredientsRaw']) if(r[key]!=null && typeof r[key]!=='string' && !Array.isArray(r[key])) throw new Error('Ungültiges Rezeptfeld: '+key);
    r.ingredients=getRecipeIngredientLines(r); r.steps=getRecipeStepLines(r);
    r.tags ??= [];
    if(!Array.isArray(r.tags) || r.tags.some(t=>typeof t!=='string')) throw new Error('Ungültige Rezept-Tags.');
  }
  for (const c of d.concerts) {
    c.tickets ??= [];
    if(!Array.isArray(c.tickets)) throw new Error('Ungültige Ticketliste.');
    c.tickets.forEach(t=>{if(!obj(t)) throw new Error('Ungültiges Ticket.');fields(t,'Ticket');if(t.paid!=null && typeof t.paid!=='boolean') throw new Error('Ungültiger Ticket-Bezahlstatus.');});
  }
  for (const day of ['Mo','Di','Mi','Do','Fr','Sa','So']) {
    if(d.weekPlan[day] != null && (typeof d.weekPlan[day]!=='string' || !d.recipes.some(r=>r.id===d.weekPlan[day]))) throw new Error('Wochenplan verweist auf ein fehlendes Rezept.');
    d.weekPlan[day] ??= null;
  }
  function places(map) {
    for(const place of Object.values(map)) {
      if(!obj(place)) throw new Error('Ungültiger Ort.'); fields(place,'Ort');
      if(place.venues!=null) {if(!obj(place.venues)) throw new Error('Ungültige Venue-Liste.');places(place.venues);}
      if(place.aspects!=null && (!obj(place.aspects) || Object.values(place.aspects).some(v=>!obj(v)))) throw new Error('Ungültige Ortsbewertungen.');
    }
  }
  places(d.cities); places(d.venues);
  fields(d.settings,'Einstellungen');
  for(const group of Object.values(d.budgets)) {
    if(!obj(group))throw new Error('Ungültiger Budgetbereich.');
    for(const amount of Object.values(group))if(typeof amount!=='number' || !Number.isFinite(amount) || amount<0)throw new Error('Ungültiger Budgetbetrag.');
  }
  for(const entry of Object.values(d.priceMemory)) {
    if(!obj(entry))throw new Error('Ungültiger Preisverlauf.');
    for(const key of ['avg','last','count'])if(entry[key]!=null && (typeof entry[key]!=='number' || !Number.isFinite(entry[key]) || entry[key]<0))throw new Error('Ungültiger Preisverlauf.');
  }
  d.settings={...d.settings,partnerName:d.settings.partnerName || 'Partner',splitPct:Number.isFinite(d.settings.splitPct)?Math.min(99,Math.max(1,d.settings.splitPct)):50};
  if(d.settings.startArea!==undefined && !['home','einkauf','household','recipes','tickets'].includes(d.settings.startArea))d.settings.startArea='home';
  if(d.settings.quickExpenseAccount!==undefined && !['wir','ich'].includes(d.settings.quickExpenseAccount))d.settings.quickExpenseAccount='wir';
  return d;
}
function collectAppSnapshot() {
  return {contracts,meters,expenses,shopLists,budgets,priceMemory,recurring,settings,transfers,recipes,weekPlan,concerts,venues,cities,ticketPeople,dragon,exported:new Date().toISOString(),schemaVersion:40};
}
function snapshotHasData(d) {
  if(['contracts','meters','expenses','recurring','transfers','recipes','concerts','ticketPeople'].some(k=>d[k]?.length))return true;
  if(d.shopLists?.items?.length || Object.values(d.weekPlan || {}).some(Boolean))return true;
  if(['budgets','priceMemory','venues','cities'].some(k=>Object.keys(d[k] || {}).length))return true;
  if(Object.entries(d.settings || {}).some(([k,v])=>k==='partnerName'?v && v!=='Partner':k==='splitPct'?v!==50: v!==false && v!=null && v!==''))return true;
  const p=d.dragon || {};
  return !!(p.xp || p.stage || p.prestige || p.stardust || p.streak || p.expActive ||
    ['deko','toys','costumes','unlocked'].some(k=>Object.values(p[k] || {}).some(Boolean)));
}
function saveRecoverySnapshot(data, key='hh_recovery_local') {
  // If quota is exhausted, abort before replacing the user's current data.
  localStorage.setItem(key,JSON.stringify({savedAt:new Date().toISOString(),data}));
}
function downloadRecovery(key) {
  const item=JSON.parse(localStorage.getItem(key) || 'null');
  if(!item) { alert('Noch kein Sicherungsstand vorhanden.'); return; }
  const url=URL.createObjectURL(new Blob([JSON.stringify(item.data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='homehub-sicherung-'+item.savedAt.slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function installAppSnapshot(d) {
  contracts=migrateContracts(d.contracts); meters=d.meters; expenses=migrateExpenses(d.expenses);
  shopLists=d.shopLists; budgets=d.budgets; priceMemory=d.priceMemory; recurring=d.recurring;settings=d.settings;
  transfers=d.transfers;recipes=d.recipes;weekPlan=d.weekPlan;concerts=d.concerts;venues=d.venues;cities=d.cities;ticketPeople=d.ticketPeople;
  loadDragon(d.dragon);
  migrateCitiesFromVenues();migrateCitiesV2();
  if(typeof normalizeAppData==='function')normalizeAppData();
}
function applyAppSnapshot(input) {
  const data=prepareAppSnapshot(input);
  const old=JSON.parse(JSON.stringify(collectAppSnapshot()));
  const stored=Object.values(HH_DATA_KEYS).map(k=>[k,localStorage.getItem(k)]);
  saveRecoverySnapshot(old);
  window.__hhApplying=true;
  try {
    installAppSnapshot(data);
    const current=collectAppSnapshot();
    for(const [field,key] of Object.entries(HH_DATA_KEYS)) localStorage.setItem(key,JSON.stringify(current[field]));
  } catch(err) {
    try { installAppSnapshot(old); } catch(_) {}
    for(const [key,value] of stored) { try { if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value); }catch(_){} }
    throw new Error('Übernahme fehlgeschlagen. Der vorherige Stand wurde gesichert: '+err.message);
  } finally { window.__hhApplying=false; }
  if(meters.length)activeMeterType=meters[0].type;
  try {
    renderAmpel();renderHome();renderContracts();applyRecipeModuleState();
    if(activePage==='kasse')renderKasse();if(activePage==='meters')renderMeters();if(activePage==='analysis')renderAnalysis();
    if(activePage==='tickets')renderTickets();if(activePage==='recipes')renderRecipes();
  }catch(e){console.warn('[HomeHub] Ansicht nach Import:',e);}
  return true;
}
var hhBackupTimer=null;
function onAppDataSaved(key) {
  if(!window.__hhReady || window.__hhApplying || window.__eggSilentWrite) return;
  if(!Object.values(HH_DATA_KEYS).includes(key)) return;
  if(window.hhSync) window.hhSync.touch();
  if(hhBackupTimer===null) hhBackupTimer=setTimeout(()=>{hhBackupTimer=null;incrementBackupCounter(2);},0);
}
