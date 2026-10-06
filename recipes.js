'use strict';
let recipes   = load('vh_recipes', []);
let weekPlan  = load('vh_weekplan', { Mo:null,Di:null,Mi:null,Do:null,Fr:null,Sa:null,So:null });

// ── Tag-Definitionen ───────────────────────
const RECIPE_TAGS = [
  { id:'schnell',      label:'⚡ Schnell',        cls:'t-schnell' },
  { id:'vegetarisch',  label:'🥦 Vegetarisch',    cls:'t-vegetarisch' },
  { id:'vegan',        label:'🌱 Vegan',           cls:'t-vegan' },
  { id:'fisch',        label:'🐟 Fisch',           cls:'t-fisch' },
  { id:'fleisch',      label:'🥩 Fleisch',         cls:'t-fleisch' },
  { id:'geflügel',     label:'🍗 Geflügel',        cls:'t-geflügel' },
  { id:'proteinreich', label:'💪 Proteinreich',    cls:'t-proteinreich' },
  { id:'low-carb',     label:'📉 Low Carb',        cls:'t-low-carb' },
  { id:'glutenfrei',   label:'🌾 Glutenfrei',      cls:'t-glutenfrei' },
  { id:'pasta',        label:'🍝 Pasta',           cls:'t-pasta' },
  { id:'suppe',        label:'🍲 Suppe',           cls:'t-suppe' },
  { id:'salat',        label:'🥗 Salat',           cls:'t-salat' },
  { id:'backen',       label:'🧁 Backen',          cls:'t-backen' },
  { id:'grillen',      label:'🔥 Grillen',         cls:'t-grillen' },
  { id:'asiatisch',    label:'🍜 Asiatisch',       cls:'t-asiatisch' },
  { id:'italienisch',  label:'🇮🇹 Italienisch',   cls:'t-italienisch' },
  { id:'mediterran',   label:'🫒 Mediterran',      cls:'t-mediterran' },
  { id:'mealprep',     label:'📦 Meal Prep',       cls:'t-mealprep' },
  { id:'favorit',      label:'⭐ Favorit',         cls:'t-favorit' },
  { id:'aufwendig',    label:'👨‍🍳 Aufwendig',     cls:'t-aufwendig' },
];
const TAG_MAP = {};
RECIPE_TAGS.forEach(t => { TAG_MAP[t.id] = t; });

// ── Tag-Vorschlag aus Schema.org-Daten ─────
function autoTagsFromSchema(schema) {
  const tags = new Set();
  const totalMin = parseDuration(schema.totalTime || schema.cookTime);
  if (totalMin && totalMin <= 25) tags.add('schnell');
  const kw = ((schema.keywords || '') + ' ' + (schema.recipeCategory || '') + ' ' +
              (schema.recipeCuisine || '')).toLowerCase();
  if (/vegetar/i.test(kw)) tags.add('vegetarisch');
  if (/vegan/i.test(kw))   tags.add('vegan');
  if (/fisch|fish|lachs|thunfisch|forelle/i.test(kw)) tags.add('fisch');
  if (/pasta|nudel|spaghet|penne|linguine/i.test(kw)) tags.add('pasta');
  if (/suppe|soup|eintopf|chili/i.test(kw)) tags.add('suppe');
  if (/salat|salad/i.test(kw)) tags.add('salat');
  if (/asian|japanisch|chinesisch|thai|ramen|wok/i.test(kw)) tags.add('asiatisch');
  if (/italian|italia/i.test(kw)) tags.add('italienisch');
  if (/mediterran|griechisch/i.test(kw)) tags.add('mediterran');
  if (/back|kuchen|brot|cookie|cake/i.test(kw)) tags.add('backen');
  if (/grill|bbq/i.test(kw)) tags.add('grillen');
  if (/low.carb|keto/i.test(kw)) tags.add('low-carb');
  if (/protein|high.protein|eiweiß/i.test(kw)) tags.add('proteinreich');
  if (/gluten.free|glutenfrei/i.test(kw)) tags.add('glutenfrei');
  if (/meal.prep/i.test(kw)) tags.add('mealprep');
  // Zutaten auswerten
  const ing = recipeLines(schema.recipeIngredient).join(' ').toLowerCase();
  if (/lachs|kabeljau|thunfisch|garnele|fisch/i.test(ing)) tags.add('fisch');
  if (/hähnchen|hühnchen|pute|chicken/i.test(ing)) tags.add('geflügel');
  if (/rind|schwein|hackfleisch|steak|lammfleisch/i.test(ing)) tags.add('fleisch');
  return [...tags];
}

function parseDuration(value){return recipeImportMinutes(value);}

// ── State für Rezept-Modal ─────────────────
let editRecipeId     = null;
let currentRecipeTags= [];
let currentRecipeStar= 0;
let activeRecipeFilter = 'alle';
let recipeViewMode   = 'liste'; // 'liste' | 'grid' | 'woche'
let weekPickerTarget = null; // Wochentag der befüllt werden soll

// ── Tag-Picker rendern ─────────────────────
function renderTagPicker(selected) {
  return RECIPE_TAGS.map(t => {
    const on = selected.includes(t.id);
    return `<button class="rfpill${on?' active':''}" data-rtag="${t.id}"
      style="padding:5px 11px;font-size:11px;margin-bottom:4px">${t.label}</button>`;
  }).join('');
}

// ── Sterne-Anzeige ─────────────────────────
function renderStars(n) {
  return Array.from({length:5}, (_,i) => i < n ? '★' : '☆').join('');
}
function updateStarUI(n) {
  document.querySelectorAll('.rstar').forEach(b => {
    b.textContent = parseInt(b.dataset.v) <= n ? '★' : '☆';
    b.style.color  = parseInt(b.dataset.v) <= n ? '#F5C842' : 'var(--border)';
  });
}

// ── Rezept-Modal öffnen ────────────────────
function openRecipeModal(id) {
  cancelRecipeImport();
  recipeImportSession++;
  recipeImportDraft = null;
  document.getElementById('importRecipeUrlBtn').disabled = false;
  const r = id ? recipes.find(x => x.id === id) : null;
  editRecipeId = id || null;
  document.getElementById('recipeImportPreview').hidden = true;
  document.getElementById('r-paste').value = '';
  document.getElementById('r-servings')._originalServings = r?.originalServings ?? null;
  document.getElementById('r-servings')._ingredientsRaw = r?.ingredientsRaw ?? null;
  currentRecipeTags = r?.tags ? [...r.tags] : [];
  currentRecipeStar = r?.stars || 0;

  document.getElementById('recipeModalTitle').textContent = r ? 'Rezept bearbeiten' : 'Rezept speichern';
  document.getElementById('deleteRecipeBtn').style.display = r ? 'block' : 'none';
  document.getElementById('r-url').value         = r?.sourceUrl || '';
  document.getElementById('r-title').value       = r?.title || '';
  document.getElementById('r-time').value        = r?.time || '';
  document.getElementById('r-servings').value    = r?.servings || '';
  document.getElementById('recipe-note').value        = r?.note || '';
  document.getElementById('r-ingredients').value = getRecipeIngredientLines(r).join('\n');
  document.getElementById('r-steps').value       = getRecipeStepLines(r).join('\n');
  document.getElementById('r-imageurl').value    = r?.imageUrl || '';
  document.getElementById('recipeImportStatus').textContent = '';
  document.getElementById('recipeImportStatus').className = 'import-status';
  if (r) {
    const signature = getRecipeIngredientLines(r).join('\n').toLowerCase();
    const duplicate = signature && recipes.some(x => x.id !== r.id && x.title !== r.title && getRecipeIngredientLines(x).join('\n').toLowerCase() === signature);
    const warnings = [];
    if (duplicate) warnings.push('Zutaten sind mit einem anderen Rezept identisch. Bitte anhand der Quelle prüfen.');
    if (!getRecipeStepLines(r).length) warnings.push('Zubereitungsschritte fehlen.');
    document.getElementById('recipeImportStatus').textContent = warnings.join(' ');
  }
  document.getElementById('recipeTagPicker').innerHTML = renderTagPicker(currentRecipeTags);
  updateStarUI(currentRecipeStar);
  openModal('recipeModal');
}

// ── Import-Button ──────────────────────────
const recipeImportFields = [
  ['title', 'Titel', 'r-title'], ['servings', 'Portionen', 'r-servings'],
  ['ingredients', 'Zutaten', 'r-ingredients'], ['steps', 'Zubereitung', 'r-steps'],
  ['time', 'Minuten', 'r-time'], ['note', 'Notizen', 'recipe-note'],
  ['imageUrl', 'Bild-URL', 'r-imageurl'], ['tags', 'Tags', null]
];
let recipeImportDraft = null;
let recipeImportSession = 0;
function parsePastedRecipe(text) {
  const input = text.trim();
  if(/^<!doctype|^<html|^<script|^<div|^<article/i.test(input))return extractRecipeFromHTML(input,recipeImportUrl(document.getElementById('r-url').value.trim())||'');
  if (!input) throw new Error('Bitte zuerst Rezepttext einfügen.');
  if (/^[\[{]/.test(input)) {
    let raw;
    try { raw = JSON.parse(input); } catch (_) { throw new Error('Das JSON ist unvollständig oder ungültig.'); }
    const nodes=recipeSchemaNodes(raw),refs=new Map(nodes.filter(n=>n['@id']).map(n=>[n['@id'],n]));
    const r=nodes.find(x=>[].concat(x['@type']||[]).some(t=>/(^|[/#:])Recipe$/i.test(String(t)))||x.ingredients||x.recipeIngredient);
    if(!r)throw new Error('Keine Rezeptdaten im JSON gefunden.');
    return recipeFromSchema(r,recipeImportUrl(document.getElementById('r-url').value.trim())||'',null,refs);
  }

  const result = {title:'', ingredients:[], steps:[], note:[], servings:'', time:''};
  let section = 'note';
  for (const line of input.split(/\r?\n/).map(x => x.trim()).filter(Boolean)) {
    if (/^(zutaten|ingredients)\s*:?(?:\s+für.*)?$/i.test(line)) { section='ingredients'; continue; }
    if (/^(zubereitung|anleitung|zubereitungsschritte|instructions|directions)\s*:?$/i.test(line)) { section='steps'; continue; }
    const portions = line.match(/^(?:portionen|servings)\s*:?\s*(\d+)|^(\d+)\s*portionen$/i);
    if (portions) { result.servings=Number(portions[1] || portions[2]); continue; }
    const minutes = line.match(/^(?:zeit|zubereitungszeit|gesamtzeit)\s*:?\s*(\d+)\s*(?:min|minuten)?$/i);
    if (minutes) { result.time=Number(minutes[1]); continue; }
    if (!result.title && section === 'note') { result.title=line; continue; }
    result[section].push(line.replace(/^[•*]\s*/, ''));
  }
  return {...result, ingredients:result.ingredients.join('\n'), steps:result.steps.join('\n'), note:result.note.join('\n')};
}
document.getElementById('r-url').addEventListener('input', () => {
  cancelRecipeImport(); recipeImportSession++; recipeImportDraft = null;
  document.getElementById('recipeImportStatus').textContent='';
  document.getElementById('recipeImportStatus').className='import-status';
  document.getElementById('recipeImportPreview').hidden = true;
  document.getElementById('importRecipeUrlBtn').disabled = false;
});
function showRecipeImportPreview(data) {
  recipeImportDraft = {...data, _session: recipeImportSession, _sourceUrl: document.getElementById('r-url').value.trim()};
  const preview = document.getElementById('recipeImportPreview');
  preview.innerHTML = '<p><strong>Import prüfen</strong> – ausgewählte Angaben werden ins Formular übernommen. Gespeichert wird erst mit „Rezept speichern“.</p>' +
    ((data.alternatives||[]).length>1 ? '<label for="recipeImportChoice">Mehrere Rezepte gefunden</label><select id="recipeImportChoice">'+data.alternatives.map((r,i)=>'<option value="'+i+'"'+(r.title===data.title&&r.ingredients===data.ingredients?' selected':'')+'>'+esc(r.title)+'</option>').join('')+'</select>' : '') +
    recipeImportFields.map(([key,label,id]) => {
      const value = Array.isArray(data[key]) ? data[key].join(key === 'tags' ? ', ' : '\n') : String(data[key] ?? '');
      const existing = id ? document.getElementById(id).value.trim() : currentRecipeTags.length;
      return '<label style="display:block;margin:10px 0"><input type="checkbox" data-import-field="'+key+'" '+(value && !existing ? 'checked ' : '')+(!value ? 'disabled ' : '')+'>'+label+(existing ? ' (eigene Angabe vorhanden)' : '')+'</label><div style="white-space:pre-wrap;max-height:140px;overflow:auto;font-size:12px">'+esc(value || 'Nicht gefunden')+'</div>';
    }).join('') + '<p>Portionen und Zutaten gehören zusammen. Wenn du beides ersetzt, wähle beide Felder aus.</p><button type="button" class="btn-s" id="applyRecipeImportBtn">Auswahl übernehmen</button>';
  preview.hidden = false;
}
document.getElementById('parseRecipeTextBtn').addEventListener('click', () => {
  const status = document.getElementById('recipeImportStatus');
  cancelRecipeImport();
  recipeImportSession++;
  recipeImportDraft = null;
  document.getElementById('importRecipeUrlBtn').disabled = false;
  try { showRecipeImportPreview(parsePastedRecipe(document.getElementById('r-paste').value)); status.textContent='Vorschau bereit. Bitte Angaben prüfen.'; }
  catch(e) { status.textContent=e.message; }
});
document.getElementById('recipeImportPreview').addEventListener('change',e=>{
 if(e.target.id!=='recipeImportChoice'||!recipeImportDraft)return;
 const alternatives=recipeImportDraft.alternatives,r=alternatives?.[Number(e.target.value)];
 if(r){showRecipeImportPreview({...setRecipeBaseline(r),alternatives});showRecipeImportMessage(r);}
});
document.getElementById('recipeImportPreview').addEventListener('click', e => {
  if (!e.target.closest('#applyRecipeImportBtn') || !recipeImportDraft) return;
  if (recipeImportDraft._session !== recipeImportSession || recipeImportDraft._sourceUrl !== document.getElementById('r-url').value.trim()) { alert('Die Quelle wurde geändert. Bitte den Import erneut laden.'); return; }
  const selects = key => document.querySelector('[data-import-field="'+key+'"]')?.checked;
  if (selects('ingredients') !== selects('servings') && recipeImportDraft.servings) { alert('Bitte Zutaten und Portionen zusammen übernehmen, damit die Mengen zur Portionszahl passen.'); return; }
  recipeImportFields.forEach(([key,label,id]) => {
    if (!document.querySelector('[data-import-field="'+key+'"]').checked) return;
    if (key === 'tags') {
      currentRecipeTags = (recipeImportDraft.tags || []).filter(t => TAG_MAP[t]);
      document.getElementById('recipeTagPicker').innerHTML=renderTagPicker(currentRecipeTags);
    } else document.getElementById(id).value = Array.isArray(recipeImportDraft[key]) ? recipeImportDraft[key].join('\n') : recipeImportDraft[key] ?? '';
  });
  const el=document.getElementById('r-servings');
  if(selects('ingredients')||selects('servings'))el._originalServings=parseInt(el.value)||null;
  if(selects('ingredients'))el._ingredientsRaw=document.getElementById('r-ingredients').value;
  document.getElementById('recipeImportPreview').hidden=true;
  document.getElementById('recipeImportStatus').textContent='Übernommen. Passe Zutaten, Schritte, Portionen und Notizen nach deinen Wünschen an und speichere das Rezept.';
});
function showRecipeImportMessage(data){
 const missing=[!data.ingredients&&'Zutaten',!data.steps&&'Zubereitung',!data.servings&&'Portionen'].filter(Boolean);
 document.getElementById('recipeImportStatus').textContent=missing.length?'Vorschau bereit. Bitte ergänzen: '+missing.join(', ')+'.':'Vorschau bereit. Wähle die Angaben, die du übernehmen möchtest.';
}
document.getElementById('importRecipeUrlBtn').addEventListener('click', async () => {
  cancelRecipeImport();
  const session = ++recipeImportSession;
  recipeImportDraft = null;
  document.getElementById('recipeImportPreview').hidden = true;
  const url = document.getElementById('r-url').value.trim();
  try {recipePublicUrl(url);} catch(err) {
    document.getElementById('recipeImportStatus').textContent = err.message;
    document.getElementById('recipeImportStatus').className = 'import-status err';
    return;
  }
  const st = document.getElementById('recipeImportStatus');
  const controller=new AbortController();window.recipeImportController=controller;
  st.textContent = 'Lade Rezept …'; st.className = 'import-status loading';
  document.getElementById('importRecipeUrlBtn').disabled = true;

  try {
    const raw  = await fetchRecipeFromUrl(url,{signal:controller.signal,onProgress:message=>{if(session===recipeImportSession)st.textContent=message;}});
    if (session !== recipeImportSession || url !== document.getElementById('r-url').value.trim() || !document.getElementById('recipeModal').classList.contains('open')) return;
    // Zutatenmengen NICHT verändern — Original-Portionen beibehalten
    // baseServings = originalServings, damit Skalierung korrekt vom Original ausgeht
    const data = raw.partial ? raw : setRecipeBaseline(raw);
    showRecipeImportPreview(data);
    showRecipeImportMessage(data);
    st.className = 'import-status ok';
  } catch(e) {
    if (session !== recipeImportSession || url !== document.getElementById('r-url').value.trim()) return;
    // Benutzerfreundliche Fehlermeldung — kein Absturz
    const msg = (e.message || 'Unbekannter Fehler').split('\n')[0];
    if(e.name==='AbortError')return;
    document.getElementById('recipePasteFallback').open=true;
    st.textContent = msg; st.className = 'import-status err';
  } finally {
    if(window.recipeImportController===controller)window.recipeImportController=null;
    if (session === recipeImportSession) document.getElementById('importRecipeUrlBtn').disabled = false;
  }
});

// ── Tag-Picker Klicks (Delegation) ─────────
document.getElementById('recipeTagPicker').addEventListener('click', e => {
  const btn = e.target.closest('[data-rtag]');
  if (!btn) return;
  const id = btn.dataset.rtag;
  if (currentRecipeTags.includes(id)) currentRecipeTags = currentRecipeTags.filter(x => x !== id);
  else currentRecipeTags.push(id);
  document.getElementById('recipeTagPicker').innerHTML = renderTagPicker(currentRecipeTags);
});

// ── Sterne-Klicks ──────────────────────────
document.getElementById('recipeStarPicker').addEventListener('click', e => {
  const btn = e.target.closest('.rstar');
  if (!btn) return;
  currentRecipeStar = parseInt(btn.dataset.v);
  updateStarUI(currentRecipeStar);
});

// ── Speichern ──────────────────────────────
document.getElementById('saveRecipeBtn').addEventListener('click', async () => {
  const title = document.getElementById('r-title').value.trim();
  if (!title) { alert('Bitte Titel eingeben.'); return; }
  const btn = document.getElementById('saveRecipeBtn');
  btn.disabled = true; btn.textContent = 'Speichern…';
  try {
    const existing = editRecipeId ? recipes.find(x => x.id === editRecipeId) : null;
    const sEl = document.getElementById('r-servings');
    const entry = await buildRecipeEntry({
      id:          editRecipeId || uid(),
      title,
      sourceUrl:   safeWebUrl(document.getElementById('r-url').value.trim()),
      time:        parseInt(document.getElementById('r-time').value) || null,
      servings:    parseInt(sEl.value) || 2,
      originalServings: sEl._originalServings ?? existing?.originalServings ?? null,
      ingredientsRaw:   sEl._ingredientsRaw   ?? existing?.ingredientsRaw   ?? null,
      note:        document.getElementById('recipe-note').value.trim(),
      ingredients: document.getElementById('r-ingredients').value.trim(),
      steps:       document.getElementById('r-steps').value.trim(),
      imageUrl:    safeWebUrl(document.getElementById('r-imageurl').value.trim(),true),
      tags:        [...currentRecipeTags],
      stars:       currentRecipeStar,
    }, existing);
    if (editRecipeId) recipes = recipes.map(r => r.id === editRecipeId ? entry : r);
    else recipes.unshift(entry);
    if(!save('vh_recipes', recipes))return;
    if (!editRecipeId) rewardDragon('recipe', {id:entry.id});
    closeModal('recipeModal');
    renderRecipes();
  } finally {
    btn.disabled = false; btn.textContent = 'Rezept speichern';
  }
});

// ── Löschen ────────────────────────────────
document.getElementById('deleteRecipeBtn').addEventListener('click', () => {
  if (!editRecipeId || !confirm('Rezept löschen?')) return;
  recipes = recipes.filter(r => r.id !== editRecipeId);
  // Aus Wochenplan entfernen
  Object.keys(weekPlan).forEach(d => { if (weekPlan[d] === editRecipeId) weekPlan[d] = null; });
  save('vh_recipes', recipes);
  save('vh_weekplan', weekPlan);
  closeModal('recipeModal');
  renderRecipes();
});

document.getElementById('cancelRecipeBtn').addEventListener('click', () => closeModal('recipeModal'));

// ── Zufälliges Rezept ───────────────────────
function randomRecipe(filterTags) {
  let pool = filterTags?.length
    ? recipes.filter(r => filterTags.every(t => r.tags?.includes(t)))
    : recipes;
  if (!pool.length) pool = recipes;
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Zutaten → Einkaufsliste ────────────────
// LEGACY-Wrapper: openRecipeShoppingPicker ersetzt addRecipeToShoppingList.
// Wird noch aus älterem Code-Pfad aufgerufen.
function addRecipeToShoppingList(recipeId) {
  openRecipeShoppingPicker(recipeId);
}

// ════════════════════════════════════════════
// REZEPT HELPER — robuste Datenleser
// ════════════════════════════════════════════
function recipeLines(value) {
  if (typeof value === 'string') return value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!Array.isArray(value)) {
    if (!value || typeof value !== 'object') return [];
    if (value.itemListElement) return recipeLines(value.itemListElement);
    return recipeLines(value.text || value.name || '');
  }
  return value.flatMap(x => {
    if (x && typeof x === 'object' && ('amount' in x || 'unit' in x))
      return [[x.amount, x.unit, x.name].filter(v => v !== undefined && v !== null && v !== '').join(' ')];
    return recipeLines(x);
  });
}
function getRecipeIngredientLines(r) {
  if (!r) return [];
  const lines = recipeLines(r.ingredients);
  return lines.length ? lines : recipeLines(r.ingredientsRaw);
}
function getRecipeStepLines(r) { return recipeLines(r?.steps); }

// ════════════════════════════════════════════
// PORTIONEN-SKALIERUNG
// ════════════════════════════════════════════

let _rvCurrentServings = 2;  // aktuell angezeigte Portionen in der Kochansicht

// Robuster Mengen-Parser (deutsch, Brüche, Kommazahlen)
function parseAmount(str) {
  const symbols={'½':0.5,'¼':0.25,'¾':0.75,'⅓':1/3,'⅔':2/3,'⅛':0.125,'⅜':0.375,'⅝':0.625,'⅞':0.875};
  const s=String(str ?? '').trim();
  if(Object.hasOwn(symbols,s))return symbols[s];
  const mixed=s.match(/^(\d+)\s*(½|¼|¾|⅓|⅔|⅛|⅜|⅝|⅞)$/);
  if(mixed)return Number(mixed[1])+symbols[mixed[2]];
  const frac=s.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if(frac)return Number(frac[3]) ? Number(frac[1] || 0)+Number(frac[2])/Number(frac[3]) : null;
  return strictNumber(s);
}

// Zahl schön formatieren (Komma statt Punkt, keine unnötigen Nachkommastellen)
function fmtAmount(n) {
  if (n === null || n === undefined) return '';
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',');
}

// Zeile skalieren: "250 g rote Linsen" mit factor 0.5 → "125 g rote Linsen"
function scaleIngredientLine(line, factor) {
  if(factor===1)return line;
  const p=parseIngredientLine(line),n=parseAmount(p.amount);
  return n===null?line:[fmtAmount(n*factor),p.unit,p.name].filter(Boolean).join(' ');
}

// Zutaten eines Rezepts auf targetServings skalieren → Zeilen-Array
function scaledIngredientLines(r, targetServings) {
  const base  = r.baseServings || r.servings || 2;
  const lines = getRecipeIngredientLines(r);
  if (!base || !targetServings || base === targetServings) return lines;
  const factor = targetServings / base;
  return lines.map(l => scaleIngredientLine(l, factor));
}

// Setzt baseServings/originalServings beim Import — ändert Mengen NICHT.
// Alle Zutaten bleiben wie von der Quellseite. Skalierung erfolgt erst in der Anzeige.
function setRecipeBaseline(data) {
  const origServings = parseInt(data.servings) || null;
  return {
    ...data,
    servings:         origServings,
    baseServings:     origServings,      // Basis für spätere Skalierung
    originalServings: origServings,
    ingredientsRaw:   data.ingredients || '',
  };
}

// Migration: alte Rezepte ohne baseServings erhalten es beim Lesen
function migrateRecipe(r) {
  if (!r) return r;
  return {
    ...r,
    baseServings:     r.baseServings     ?? r.servings ?? 2,
    originalServings: r.originalServings ?? r.servings ?? null,
    ingredientsRaw:   r.ingredientsRaw   ?? r.ingredients ?? '',
    updatedAt:        r.updatedAt        ?? r.createdAt ?? today(),
  };
}

// ════════════════════════════════════════════
// KOCHANSICHT (erweitert mit Skalierung)
// ════════════════════════════════════════════
let _rvRecipeId = null;
let _cookSteps  = [];
let _cookIdx    = 0;
let _cookEl     = null;
let _doneSteps  = new Set();

function openRecipeView(id) {
  const r = recipes.find(x => x.id === id);
  if (!r) return;
  const rm = migrateRecipe(r);
  _rvRecipeId = id;
  _doneSteps  = new Set();
  _rvCurrentServings = rm.servings || rm.baseServings || 2;

  const imgArea = document.getElementById('rvImageArea');
  imgArea.innerHTML = rm.imageUrl
    ? `<img class="rv-image" src="${esc(safeWebUrl(rm.imageUrl,true))}" alt="${esc(rm.title)}" onerror="this.style.display='none'">`
    : `<div class="rv-image-placeholder">🍳</div>`;

  document.getElementById('rvTitle').textContent = rm.title || '';
  document.getElementById('rvTags').innerHTML =
    (rm.tags || []).map(t => TAG_MAP[t] ? `<span class="recipe-tag ${TAG_MAP[t].cls}">${TAG_MAP[t].label}</span>` : '').join('');

  // Portionen-Zeile
  const base = rm.baseServings || rm.servings || 2;
  document.getElementById('rvServCount').textContent = _rvCurrentServings;
  document.getElementById('rvServingsRow').style.display = base ? 'flex' : 'none';

  // Source-Link
  const srcLink = document.getElementById('rvSourceLink');
  if (rm.sourceUrl) { srcLink.href = safeWebUrl(rm.sourceUrl) || "#"; srcLink.style.display = 'flex'; }
  else               srcLink.style.display = 'none';

  renderRvMeta(rm);
  renderRvIngredients(rm);
  _cookSteps = getRecipeStepLines(rm);
  renderRvStepsFull();

  const noteSection = document.getElementById('rvNoteSection');
  if (rm.note && rm.note.trim()) {
    noteSection.style.display = 'block';
    document.getElementById('rvNote').textContent = rm.note;
  } else {
    noteSection.style.display = 'none';
  }

  openModal('recipeViewModal');
}

function renderRvMeta(r) {
  const meta = [];
  if (r.time)     meta.push(`⏱ ${r.time} Min`);
  if (r.stars)    meta.push(renderStars(r.stars));
  document.getElementById('rvMeta').innerHTML = meta.map(m => `<span>${m}</span>`).join('');
  document.getElementById('rvServCount').textContent = _rvCurrentServings;
}

function renderRvIngredients(r) {
  const lines = scaledIngredientLines(r, _rvCurrentServings);
  document.getElementById('rvIngredients').innerHTML = lines.length
    ? lines.map(l => {
        const { name, amount, unit } = parseIngredientLine(l);
        const qty = [amount, unit].filter(Boolean).join('\u202F'); // narrow-space
        return `<div class="rv-ingredient">
          <span style="min-width:72px;font-size:12px;color:var(--muted);font-weight:600">${esc(qty)}</span>
          <span style="flex:1">${esc(name)}</span>
        </div>`;
      }).join('')
    : `<div style="font-size:13px;color:var(--muted);padding:8px 0">Keine Zutaten eingetragen.</div>`;
}

function renderRvStepsFull() {
  const stepsTitle  = document.getElementById('rvStepsTitle');
  const cookModeRow = document.getElementById('rvCookModeRow');
  if (_cookSteps.length) {
    stepsTitle.style.display  = 'block';
    cookModeRow.style.display = 'block';
    renderRvSteps();
  } else {
    stepsTitle.style.display  = 'none';
    document.getElementById('rvSteps').innerHTML = '';
    cookModeRow.style.display = 'none';
  }
}

function renderRvSteps() {
  document.getElementById('rvSteps').innerHTML = _cookSteps.map((s, i) => {
    const done = _doneSteps.has(i);
    const text = s.replace(/^\d+[\.\)]\s*/, '');
    return `<div class="rv-step${done?' done':''}" data-stepidx="${i}">
      <div class="rv-step-num">${done ? '✓' : i+1}</div>
      <div class="rv-step-text">${esc(text)}</div>
    </div>`;
  }).join('');
}

document.getElementById('rvSteps').addEventListener('click', e => {
  const step = e.target.closest('[data-stepidx]');
  if (!step) return;
  const i = parseInt(step.dataset.stepidx);
  if (_doneSteps.has(i)) _doneSteps.delete(i); else _doneSteps.add(i);
  renderRvSteps();
});

// Portionen +/−
document.getElementById('rvServMinus').addEventListener('click', () => {
  if (_rvCurrentServings <= 1) return;
  _rvCurrentServings--;
  document.getElementById('rvServCount').textContent = _rvCurrentServings;
  const r = recipes.find(x => x.id === _rvRecipeId);
  if (r) renderRvIngredients(migrateRecipe(r));
});
document.getElementById('rvServPlus').addEventListener('click', () => {
  _rvCurrentServings++;
  document.getElementById('rvServCount').textContent = _rvCurrentServings;
  const r = recipes.find(x => x.id === _rvRecipeId);
  if (r) renderRvIngredients(migrateRecipe(r));
});

document.getElementById('rvShopBtn').addEventListener('click', () => {
  if (_rvRecipeId) openRecipeShoppingPicker(_rvRecipeId, _rvCurrentServings);
});
document.getElementById('rvEditBtn').addEventListener('click', () => {
  closeModal('recipeViewModal');
  openRecipeModal(_rvRecipeId);
});
document.getElementById('rvCookModeBtn').addEventListener('click', startCookMode);

function startCookMode() {
  const cookedRecipeId=_rvRecipeId;
  if(!cookedRecipeId || !_cookSteps.length)return;
  _cookIdx = 0;
  if (_cookEl) _cookEl.remove();
  _cookEl = document.createElement('div');
  _cookEl.className = 'cook-mode-overlay';
  _cookEl.innerHTML = `
    <button id="cmClose" style="align-self:flex-end;background:var(--bg2);border:none;border-radius:50%;width:36px;height:36px;font-size:20px;cursor:pointer;margin-bottom:8px">×</button>
    <div class="cook-step-counter" id="cmCounter"></div>
    <div class="cook-step-text" id="cmText"></div>
    <div class="cook-nav">
      <button class="cook-nav-btn" id="cmPrev" style="background:var(--bg2);color:var(--muted)">◀ Zurück</button>
      <button class="cook-nav-btn" id="cmNext" style="background:var(--accent);color:white">Weiter ▶</button>
    </div>`;
  document.body.appendChild(_cookEl);
  updateCookMode();
  _cookEl.querySelector('#cmNext').addEventListener('click', () => {
    if (_cookIdx < _cookSteps.length - 1) { _cookIdx++; updateCookMode(); }
    else { rewardDragon('recipeCooked', {id:cookedRecipeId}); _cookEl.remove(); _cookEl = null; }
  });
  _cookEl.querySelector('#cmPrev').addEventListener('click', () => {
    if (_cookIdx > 0) { _cookIdx--; updateCookMode(); }
  });
  _cookEl.querySelector('#cmClose').addEventListener('click', () => { _cookEl.remove(); _cookEl = null; });
}
function updateCookMode() {
  if (!_cookEl) return;
  _cookEl.querySelector('#cmCounter').textContent = `Schritt ${_cookIdx + 1} von ${_cookSteps.length}`;
  _cookEl.querySelector('#cmText').textContent = _cookSteps[_cookIdx].replace(/^\d+[\.\)]\s*/, '');
  _cookEl.querySelector('#cmPrev').style.opacity = _cookIdx === 0 ? '.3' : '1';
  _cookEl.querySelector('#cmNext').textContent = _cookIdx === _cookSteps.length - 1 ? 'Als gekocht abschließen' : 'Weiter ▶';
}

// ════════════════════════════════════════════
// REZEPT-DATENMODELL (einheitlich)
// ════════════════════════════════════════════
//
// ShoppingItem:  { id, name, qty, store, price, checked }   ← name ist das Pflichtfeld
// Ingredient:    { name, amount, unit }                      ← strukturiert
// Recipe.ingredients: string (Freitext, eine Zutat pro Zeile) — abwärtskompatibel
//
// parseIngredientLine("200g Milch")  → { name:"Milch", amount:"200", unit:"g" }
// ingredientsToLines(recipe)         → ["200g Milch", "3 Eier", …]

function parseIngredientLine(line) {
  const text=String(line).trim();
  const m=text.match(/^((?:\d+\s+)?\d+\/\d+|\d*\s*[½¼¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?)\s*(.*)$/);
  if(!m || !m[2] || parseAmount(m[1])===null)return {name:text,amount:'',unit:''};
  const rest=m[2].trim();
  const u=rest.match(/^(kg|g|mg|ml|cl|dl|l|EL|TL|Stk\.?|Stück|Bund|Prise[n]?|Dose[n]?|Packung[en]*|Pck\.?|Pkg\.?|Becher)\s+(.+)$/i);
  return {name:u?u[2]:rest,amount:m[1].trim(),unit:u?u[1]:''};
}

function ingredientsToLines(recipe) { return getRecipeIngredientLines(recipe); }

// Thumbnail: lädt Bild in Canvas, skaliert auf max. 600px, JPEG 75%
// Gibt Data-URL zurück oder '' bei Fehler
async function makeThumb(imageUrl) {
  if (!imageUrl || imageUrl.startsWith('data:')) return imageUrl || '';
  try {
    const img = await new Promise((res, rej) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload  = () => res(el);
      el.onerror = () => rej(new Error('img load fail'));
      el.src = imageUrl;
      setTimeout(() => rej(new Error('timeout')), 5000);
    });
    const MAX = 600;
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.75);
  } catch { return imageUrl; } // Fallback: original URL behalten
}

// ════════════════════════════════════════════
// ZUTATEN-AUSWAHL-DIALOG
// ════════════════════════════════════════════

let _ipIngredients  = [];  // { name, amount, unit, selected }
let _ipOnConfirm    = null; // callback(selectedLines[])
let _ipExistingNames= new Set();

function openIngredientPicker(title, lines, onConfirm) {
  // Bestehende Einkaufslisten-Einträge für "Nur Fehlende"
  _ipExistingNames = new Set(
    shopLists.items.filter(i => !i.checked).map(i => (i.name || '').toLowerCase())
  );
  _ipIngredients = lines.map(l => {
    const parsed = parseIngredientLine(l);
    const missing = !_ipExistingNames.has(parsed.name.toLowerCase());
    return { ...parsed, rawLine: l, selected: missing }; // fehlende vorauswählen
  });
  _ipOnConfirm = onConfirm;

  document.getElementById('ingredientPickTitle').textContent = title;
  renderIngredientPickList();
  openModal('ingredientPickModal');
}

function renderIngredientPickList() {
  document.getElementById('ingredientPickList').innerHTML =
    _ipIngredients.map((ing, i) => `
      <label style="display:flex;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px solid var(--border);cursor:pointer">
        <input autocomplete="off" type="checkbox" data-ipidx="${i}" ${ing.selected?'checked':''} style="width:18px;height:18px;accent-color:var(--accent);flex-shrink:0">
        <span style="flex:1;font-size:13px;color:var(--text)">${esc(ing.rawLine)}</span>
        ${_ipExistingNames.has(ing.name.toLowerCase())
          ? '<span style="font-size:10px;color:var(--muted);flex-shrink:0">bereits vorhanden</span>' : ''}
      </label>`).join('');
}

// Delegation für Checkbox-Klicks im Picker
document.getElementById('ingredientPickList').addEventListener('change', e => {
  const chk = e.target.closest('[data-ipidx]');
  if (!chk) return;
  _ipIngredients[parseInt(chk.dataset.ipidx)].selected = chk.checked;
});
document.getElementById('ipSelectAll').addEventListener('click', () => {
  _ipIngredients.forEach(i => i.selected = true);
  renderIngredientPickList();
});
document.getElementById('ipSelectNone').addEventListener('click', () => {
  _ipIngredients.forEach(i => i.selected = false);
  renderIngredientPickList();
});
document.getElementById('ipSelectMissing').addEventListener('click', () => {
  _ipIngredients.forEach(i => { i.selected = !_ipExistingNames.has(i.name.toLowerCase()); });
  renderIngredientPickList();
});
document.getElementById('ipConfirmBtn').addEventListener('click', () => {
  const selected = _ipIngredients.filter(i => i.selected).map(i => i.rawLine);
  closeModal('ingredientPickModal');
  if (_ipOnConfirm) _ipOnConfirm(selected);
  _ipOnConfirm = null;
});

// ── Zutaten in Einkaufsliste schreiben (einheitlich) ──────────────────────
// FIX: nutzt name (nicht desc), qty-Format "200 ml"
function pushLinesToShoppingList(lines, sourceTitle) {
  lines.forEach(l => {
    const { name, amount, unit } = parseIngredientLine(l);
    if (!name) return;
    const qty = [amount, unit].filter(Boolean).join(' ');
    // ShoppingItem mit name (nicht desc) — konsistent mit openEditShopItem
    shopLists.items.push({
      id: uid(), name, qty, store: 'supermarkt',
      price: '', checked: false,
      note: sourceTitle || ''
    });
  });
  save('vh_shoplists', shopLists);
}

// ── Zutaten addieren (für Wochenplan: gleiche Zutaten zusammenführen) ────
function mergeIngredientLines(allLines) {
  const groups=new Map(),output=[];
  for(const line of allLines) {
    const p=parseIngredientLine(line),n=parseAmount(p.amount);
    if(n===null){output.push({raw:line});continue;}
    const key=p.name.toLocaleLowerCase('de')+'|'+p.unit.toLocaleLowerCase('de');
    if(groups.has(key))groups.get(key).total+=n;
    else {const group={...p,total:n};groups.set(key,group);output.push(group);}
  }
  return output.map(p=>p.raw ?? [fmtAmount(p.total),p.unit,p.name].filter(Boolean).join(' '));
}

// ── Einzel-Rezept → Einkaufsliste (mit Auswahldialog) ───────────────────
// ERSETZT die alte addRecipeToShoppingList(id) ohne Dialog
function openRecipeShoppingPicker(recipeId, currentServings) {
  const r = recipes.find(x => x.id === recipeId);
  if (!r) return;
  const rm    = migrateRecipe(r);
  const lines = scaledIngredientLines(rm, currentServings || rm.servings || rm.baseServings || 2);
  if (!lines.length) { alert('Dieses Rezept hat keine Zutaten eingetragen.'); return; }
  const portNote = currentServings ? ` (${currentServings} Portionen)` : '';
  openIngredientPicker(
    `🛒 ${rm.title}${portNote}`,
    lines,
    selected => { pushLinesToShoppingList(selected, rm.title); refreshEinkaufView(); }
  );
}

// ── Wochenplan → Einkaufsliste (zusammengeführt + Auswahldialog) ─────────
function openWeekPlanShoppingPicker() {
  const recipeIds = Object.values(weekPlan).filter(Boolean);
  if (!recipeIds.length) { alert('Keine Rezepte im Wochenplan.'); return; }
  const allLines = [];
  const usedTitles = [];
  recipeIds.forEach(rid => {
    const r = recipes.find(x => x.id === rid);
    if (!r) return;
    usedTitles.push(r.title);
    ingredientsToLines(r).forEach(l => allLines.push(l));
  });
  const mergedLines = mergeIngredientLines(allLines);
  const title = `🗓 Wochenplan (${usedTitles.slice(0,2).join(', ')}${usedTitles.length > 2 ? '…' : ''})`;
  openIngredientPicker(
    title,
    mergedLines,
    selected => {
      pushLinesToShoppingList(selected, 'Wochenplan');
      refreshEinkaufView();
    }
  );
}

// ── Thumbnail beim Speichern erzeugen ────────────────────────────────────
async function buildRecipeEntry(formData, existingEntry) {
  let imageUrl = formData.imageUrl;
  if (imageUrl && !imageUrl.startsWith('data:')) {
    imageUrl = await makeThumb(imageUrl).catch(() => formData.imageUrl);
  }
  const servings   = formData.servings || existingEntry?.servings || 2;
  const base       = servings;
  const origServ   = formData.originalServings ?? existingEntry?.originalServings ?? servings;
  const ingRaw     = recipeLines(formData.ingredients).join('\n');
  return {
    id:               formData.id || uid(),
    title:            formData.title,
    sourceUrl:        formData.sourceUrl   || '',
    sourceName:       formData.sourceName  || '',
    imageUrl,
    ingredients:      recipeLines(formData.ingredients),
    ingredientsRaw:   ingRaw,
    steps:            recipeLines(formData.steps),
    note:             formData.note        || '',
    tags:             formData.tags        || [],
    stars:            formData.stars       || 0,
    time:             formData.time        || null,
    servings,
    baseServings:     base,
    originalServings: origServ,
    createdAt:        existingEntry?.createdAt || today(),
    updatedAt:        today(),
  };
}

// ════════════════════════════════════════════
function renderWeekPlan() {
  const days = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  return days.map(d => {
    const rid = weekPlan[d];
    const r   = rid ? recipes.find(x => x.id === rid) : null;
    return `<div class="week-day-slot">
      <div class="week-day-name">${d}</div>
      ${r ? `<div class="week-slot-recipe">${esc(r.title)}</div>
             <button style="background:none;border:none;font-size:14px;cursor:pointer;color:var(--muted);min-width:32px;min-height:32px" data-wday="${d}" data-waction="clear">✕</button>`
          : `<div class="week-slot-empty">Kein Rezept</div>
             <button class="week-add-btn" data-wday="${d}" data-waction="pick">+ Wählen</button>`}
    </div>`;
  }).join('');
}

function openWeekPicker(day) {
  weekPickerTarget = day;
  document.getElementById('weekPickerTitle').textContent = `Rezept für ${day}`;
  const sorted = [...recipes].sort((a,b) => (a.title||'').localeCompare(b.title||''));
  document.getElementById('weekPickerList').innerHTML = sorted.length
    ? sorted.map(r => `<div class="ct-item" data-wpick="${esc(r.id)}" style="margin-bottom:6px">
        <div style="font-size:22px">${r.imageUrl ? `<img src="${esc(safeWebUrl(r.imageUrl,true))}" style="width:36px;height:36px;border-radius:8px;object-fit:cover">` : '🍳'}</div>
        <div style="flex:1"><div style="font-weight:600;font-size:13px">${esc(r.title)}</div>
          <div style="font-size:11px;color:var(--muted)">${r.time ? r.time+'Min' : ''} ${r.stars ? renderStars(r.stars) : ''}</div></div>
      </div>`).join('')
    : '<div style="text-align:center;padding:20px;color:var(--muted)">Noch keine Rezepte gespeichert.</div>';
  openModal('weekPickerModal');
}

document.getElementById('weekPickerList').addEventListener('click', e => {
  const row = e.target.closest('[data-wpick]');
  if (!row) return;
  weekPlan[weekPickerTarget] = row.dataset.wpick;
  save('vh_weekplan', weekPlan);
  closeModal('weekPickerModal');
  renderRecipes();
});

// ── Hauptrender ────────────────────────────
function renderRecipes() {
  if (activePage !== 'recipes') return;
  const tabs = ['liste','grid','woche'];
  // Filter
  const filtered = activeRecipeFilter === 'alle'
    ? recipes
    : activeRecipeFilter === 'favorit'
      ? recipes.filter(r => r.stars >= 4 || r.tags?.includes('favorit'))
      : recipes.filter(r => r.tags?.includes(activeRecipeFilter));

  // Zufalls-Button Shortlist
  let html = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div style="font-size:20px;font-weight:800;color:var(--text)">🍳 Rezepte</div>
    <div style="display:flex;gap:7px">
      <button id="rndRecipeBtn" title="Zufälliges Rezept" style="padding:7px 12px;background:var(--bg2);border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-weight:600;color:var(--accent);cursor:pointer;min-height:36px">🎲 Zufällig</button>
      <button id="addRecipeBtn" style="padding:7px 14px;background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);font-size:12px;font-weight:700;cursor:pointer;min-height:36px">+ Neu</button>
    </div>
  </div>

  <!-- View-Toggle -->
  <div style="display:flex;gap:6px;margin-bottom:12px">
    <button class="rfpill${recipeViewMode==='liste'?' active':''}" data-rview="liste">☰ Liste</button>
    <button class="rfpill${recipeViewMode==='grid'?' active':''}" data-rview="grid">⊞ Kacheln</button>
    <button class="rfpill${recipeViewMode==='woche'?' active':''}" data-rview="woche">📅 Wochenplan</button>
  </div>`;

  if (recipeViewMode === 'woche') {
    // Wochenplan-Ansicht
    const weekTotal = Object.values(weekPlan).filter(Boolean).length;
    html += `<div class="card" style="margin-bottom:12px">
      <div class="card-label">Wochenplan — ${weekTotal}/7 Tage geplant</div>
      <div id="weekPlanContent">${renderWeekPlan()}</div>
      ${weekTotal > 0 ? `<button id="weekShopBtn" class="btn-p" style="margin-top:10px">🛒 Alle Zutaten in Einkaufsliste</button>` : ''}
    </div>`;
  } else {
    // Filter-Bar
    html += `<div class="recipe-filter-bar">
      <button class="rfpill${activeRecipeFilter==='alle'?' active':''}" data-rfil="alle">Alle (${recipes.length})</button>
      <button class="rfpill${activeRecipeFilter==='favorit'?' active':''}" data-rfil="favorit">⭐ Favoriten</button>`;
    RECIPE_TAGS.filter(t => t.id !== 'favorit').forEach(t => {
      const cnt = recipes.filter(r => r.tags?.includes(t.id)).length;
      if (cnt > 0) html += `<button class="rfpill${activeRecipeFilter===t.id?' active':''}" data-rfil="${t.id}">${t.label} (${cnt})</button>`;
    });
    html += `</div>`;

    if (!filtered.length) {
      html += `<div class="recipe-list-empty"><div style="font-size:44px;margin-bottom:12px;opacity:.6">🍳</div>
        <div style="font-size:14px;color:var(--muted)">${recipes.length ? 'Keine Rezepte mit diesem Filter.' : 'Noch keine Rezepte.<br>Tippe „+ Neu" um loszulegen.'}</div></div>`;
    } else if (recipeViewMode === 'grid') {
      html += `<div class="recipe-grid">`;
      filtered.forEach(r => { html += recipeCardHTML(r, true); });
      html += `</div>`;
    } else {
      filtered.forEach(r => { html += recipeCardHTML(r, false); });
    }
  }

  document.getElementById('recipesContent').innerHTML = html;
  // Delegation wird permanent beim ersten Render registriert (s. initRecipesDelegation)
}

// Permanente Event-Delegation für #recipesContent
// Einmalig registriert, überlebt alle innerHTML-Neuaufbauten
function initRecipesDelegation() {
  document.getElementById('recipesContent').addEventListener('click', e => {
    const vb = e.target.closest('[data-rview]');
    if (vb) { recipeViewMode = vb.dataset.rview; renderRecipes(); return; }
    const fb = e.target.closest('[data-rfil]');
    if (fb) { activeRecipeFilter = fb.dataset.rfil; renderRecipes(); return; }
    const wbtn = e.target.closest('[data-wday]');
    if (wbtn) {
      if (wbtn.dataset.waction === 'clear') { weekPlan[wbtn.dataset.wday] = null; save('vh_weekplan', weekPlan); renderRecipes(); return; }
      if (wbtn.dataset.waction === 'pick')  { openWeekPicker(wbtn.dataset.wday); return; }
    }
    if (e.target.closest('#weekShopBtn'))  { openWeekPlanShoppingPicker(); return; }
    if (e.target.closest('#rndRecipeBtn')) {
      const r = randomRecipe(activeRecipeFilter !== 'alle' ? [activeRecipeFilter] : []);
      if (r) openRecipeView(r.id); return;
    }
    if (e.target.closest('#addRecipeBtn')) { openRecipeModal(null); return; }
    const card = e.target.closest('[data-rid]');
    if (card) {
      if (e.target.closest('.rcp-link-btn'))   return;
      if (e.target.closest('[data-shopadd]'))  { openRecipeShoppingPicker(card.dataset.rid, _rvCurrentServings); return; }
      if (e.target.closest('[data-edit-card]')){ openRecipeModal(card.dataset.rid); return; }
      openRecipeView(card.dataset.rid);
    }
  });
}

function recipeCardHTML(r, compact) {
  const timeStr = r.time ? `⏱ ${r.time} Min` : '';
  const servStr = r.servings ? `👤 ${r.servings}` : '';
  const tags    = (r.tags || []).slice(0, compact ? 2 : 5).map(t => {
    const td = TAG_MAP[t];
    return td ? `<span class="recipe-tag ${td.cls}">${td.label}</span>` : '';
  }).join('');
  const starsHtml = r.stars ? `<span class="recipe-stars">${renderStars(r.stars)}</span>` : '';
  const img = r.imageUrl
    ? `<img class="recipe-thumb" src="${esc(safeWebUrl(r.imageUrl,true))}" alt="${esc(r.title)}" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="recipe-thumb-placeholder">🍳</div>`;

  if (compact) {
    return `<div class="recipe-card" data-rid="${esc(r.id)}">
      ${img}
      <div class="recipe-body">
        <div class="recipe-title">${esc(r.title)}</div>
        ${starsHtml}
        <div class="recipe-tags">${tags}</div>
      </div>
    </div>`;
  }
  return `<div class="recipe-card" data-rid="${esc(r.id)}">
    ${img}
    <div class="recipe-body">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">
        <div class="recipe-title" style="flex:1">${esc(r.title)}</div>
        <button data-edit-card="1" style="background:none;border:none;font-size:13px;color:var(--muted);cursor:pointer;padding:2px 4px;flex-shrink:0;min-width:32px;min-height:32px" title="Bearbeiten">✏️</button>
      </div>
      <div class="recipe-meta">
        ${timeStr ? `<span class="recipe-meta-item">${timeStr}</span>` : ''}
        ${servStr ? `<span class="recipe-meta-item">${servStr}</span>` : ''}
        ${starsHtml}
      </div>
      ${r.note ? `<div style="font-size:11px;color:var(--muted);margin-bottom:6px;line-height:1.4">${esc(r.note.slice(0,80))}${r.note.length>80?'…':''}</div>` : ''}
      <div class="recipe-tags">${tags}</div>
      <div style="display:flex;gap:7px;margin-top:10px">
        ${r.ingredients ? `<button data-shopadd="1" style="flex:1;padding:10px;background:var(--bg2);border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-weight:600;color:var(--accent);cursor:pointer;font-family:inherit;min-height:44px">🛒 Zutaten</button>` : ''}
        ${r.sourceUrl ? `<a href="${esc(safeWebUrl(r.sourceUrl))}" target="_blank" rel="noopener" class="rcp-link-btn" style="padding:10px 12px;font-size:12px">🔗</a>` : ''}
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════
// REZEPTE MODUL-TOGGLE (An/Aus)
// ══════════════════════════════════════════
// ════════════════════════════════════════════
