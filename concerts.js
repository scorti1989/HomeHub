'use strict';
// KONZERTE / TICKETVERWALTUNG
// ════════════════════════════════════════════
let ticketTab = 'concerts';           // concerts | venues | debts
let editConcertId = null;
let expandedConcertId = null;         // welche Konzertkarte ist aufgeklappt
let formTickets = [];                 // Arbeitskopie der Ticket-Zeilen im Formular

function tkUid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function isMine(name) { const n = (name || '').trim().toLowerCase(); return n === '' || n === 'ich' || n === 'mir'; }
function mineLabel(name) { return isMine(name) ? 'Ich' : name; }

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

function upcomingConcerts() {
  return concerts
    .filter(c => { const d = daysUntil(c.date); return d !== null && d >= 0; })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Home-Banner: nächstes Konzert ──
function renderConcertBanner() {
 try {
  const el = document.getElementById('concertBanner');
  if (!el) return;
  const up = upcomingConcerts();
  if (!up.length) { el.style.display = 'none'; return; }
  const c = up[0];
  const d = daysUntil(c.date);
  const loc = [c.venueId, c.city].filter(Boolean).join(', '); const venue = loc ? ' · ' + esc(loc) : '';
  const when = d === 0 ? 'HEUTE!' : d === 1 ? 'MORGEN' : 'in ' + d + ' Tagen';
  el.style.display = 'flex';
  el.innerHTML = `<span class="cb-days">🎫 ${when}</span>` +
    `<span class="cb-main">${esc(c.artist || 'Konzert')}</span>` +
    `<span class="cb-sub">${fmtConcertDate(c.date)}${c.time ? ' · ' + esc(c.time) : ''}${venue}</span>`;
  el.onclick = () => showPage('tickets');
 } catch (err) {
   console.warn('[Konzerte] Banner:', err);
   const el2 = document.getElementById('concertBanner');
   if (el2) el2.style.display = 'none';
 }
}

function fmtConcertDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Seite rendern ──
// Fehlte in der App (Aufruf beim Speichern der Einstellungen) — sicherer No-op
if (typeof applyRecipeModuleState !== 'function') { window.applyRecipeModuleState = function () {}; }

function renderTickets() {
  if (activePage !== 'tickets') return;
 try {
  const el = document.getElementById('ticketsContent');
  if (!el) return;
  let h = '<div class="tk-wrap"><div class="tk-h">🎫 Konzerte</div>';
  h += renderConcertHero();
  h += renderConcertStats();
  h += '<div class="tk-seg">' +
    `<button data-tktab="concerts" class="${ticketTab === 'concerts' ? 'on' : ''}">Konzerte</button>` +
    `<button data-tktab="venues" class="${ticketTab === 'venues' ? 'on' : ''}">Venues</button>` +
    `<button data-tktab="debts" class="${ticketTab === 'debts' ? 'on' : ''}">Offene Tickets</button>` +
    '</div>';

  if (ticketTab === 'concerts') {
    if (editConcertId === '__new') h += '<div class="tk-inlineform">' + concertFormHtml(null) + '</div>';
    else h += '<button class="tk-add" data-tkact="new">＋ Neues Konzert</button>';
    h += renderConcertList();
  }
  else if (ticketTab === 'venues') h += renderVenueList();
  else h += renderOpenTickets();

  h += '</div>';
  el.innerHTML = h;
  if (ticketTab === 'concerts' && editConcertId) afterConcertForm();
 } catch (err) {
   console.warn('[Konzerte] Render:', err);
   const el2 = document.getElementById('ticketsContent');
   if (el2) el2.innerHTML = '<div class="tk-wrap"><div class="tk-empty">Anzeige-Fehler. Bitte Seite neu laden.<br><small>' + String(err && err.message || '').slice(0,120) + '</small></div></div>';
 }
}

// ── Kompakte Übersicht: nächstes Konzert oben, ggf. Konzerttag-Modus ──
function renderConcertHero() {
  try {
    const up = upcomingConcerts();
    if (!up.length) return '';
    const c = up[0];
    const d = daysUntil(c.date);
    const loc = [c.venueId, c.city].filter(Boolean).join(', ');
    const iHold = isMine(c.ticketHolder);
    const tickets = iHold ? (c.tickets || []) : [];
    const openHandover = tickets.filter(t => t && !isMine(t.owner) && !t.handedOver).length;
    const tixCount = iHold ? tickets.length : (c.ticketHolder ? 1 : 0);
    const isDayMode = d !== null && d >= 0 && d <= 1;
    const when = d === 0 ? 'Heute' : d === 1 ? 'Morgen' : d !== null ? `in ${d} Tagen` : '';

    let h = `<div class="tk-hero${isDayMode ? ' tk-hero-today' : ''}">`;
    h += `<div class="tk-hero-eyebrow">${isDayMode ? when : 'Nächstes Konzert'}</div>`;
    h += `<div class="tk-hero-artist">${esc(c.artist || 'Konzert')}</div>`;
    h += `<div class="tk-hero-sub">${!isDayMode && when ? when + ' · ' : ''}${c.time ? esc(c.time) + ' · ' : ''}${esc(loc || '—')}</div>`;
    if (iHold && tixCount) {
      h += `<div class="tk-hero-tix">${tixCount} Ticket${tixCount === 1 ? '' : 's'}${openHandover ? ` · ${openHandover} noch nicht übergeben` : ''}</div>`;
    } else if (c.ticketHolder) {
      h += `<div class="tk-hero-tix">Ticket bei ${esc(mineLabel(c.ticketHolder))}</div>`;
    }
    const maps = (c.city && c.venueId && cities[c.city] && cities[c.city].venues && cities[c.city].venues[c.venueId]) ? cities[c.city].venues[c.venueId].maps : '';
    if (isDayMode) {
      h += `<div class="tk-hero-actions">`;
      if (maps) h += `<a class="tk-hero-btn" href="${esc(safeWebUrl(maps))}" target="_blank" rel="noopener">Route</a>`;
      h += `<button class="tk-hero-btn" data-tkact="focus" data-cid="${esc(c.id)}">Ticketstatus</button>`;
      h += `<button class="tk-hero-btn" data-tkact="edit" data-cid="${esc(c.id)}">Notiz</button>`;
      h += `</div>`;
    } else {
      h += `<button class="tk-hero-btn tk-hero-details" data-tkact="focus" data-cid="${esc(c.id)}">Details</button>`;
    }
    h += `</div>`;
    return h;
  } catch (err) { console.warn('[Konzerte] Hero:', err); return ''; }
}

// ── Kennzahlen-Zeile: bevorstehend / vergangen / offen ──
function renderConcertStats() {
  try {
    if (!concerts.length) return '';
    const upCount = concerts.filter(c => { const d = daysUntil(c.date); return d !== null && d >= 0; }).length;
    const pastCount = concerts.filter(c => { const d = daysUntil(c.date); return d !== null && d < 0; }).length;
    let openPayments = 0;
    concerts.forEach(c => {
      if (!isMine(c.ticketHolder)) return;
      (c.tickets || []).forEach(t => { if (t && !isMine(t.owner) && !t.paid) openPayments++; });
    });
    return `<div class="tk-stats">
      <div class="tk-stat"><b>${upCount}</b> bevorstehend</div>
      <div class="tk-stat"><b>${pastCount}</b> vergangen</div>
      <div class="tk-stat${openPayments ? ' warn' : ''}"><b>${openPayments}</b> offen</div>
    </div>`;
  } catch (err) { console.warn('[Konzerte] Stats:', err); return ''; }
}

// ── Zusammengefasste Statuszeile pro Konzert (statt Einzel-Badges) ──
function concertStatusLine(c) {
  if (!isMine(c.ticketHolder)) return '';
  const tix = (c.tickets || []).filter(t => t && !isMine(t.owner));
  if (!tix.length) return '';
  const unpaid = tix.filter(t => !t.paid).length;
  const notGiven = tix.filter(t => !t.handedOver).length;
  if (!unpaid && !notGiven) return '<span class="tk-status ok">Alles erledigt</span>';
  const parts = [];
  if (unpaid) parts.push(`${unpaid} Zahlung${unpaid === 1 ? '' : 'en'} offen`);
  if (notGiven) parts.push(`${notGiven} Ticket${notGiven === 1 ? '' : 's'} nicht übergeben`);
  return `<span class="tk-status warn">${parts.join(' · ')}</span>`;
}

// ── Kleiner Hinweis bei fehlenden Angaben (kein großer Warnkasten) ──
function concertMissingHint(c) {
  if (!isMine(c.ticketHolder)) return '';
  const missingPrice = (c.tickets || []).some(t => t && !isMine(t.owner) && !t.paid && (t.price === null || t.price === undefined || t.price === ''));
  if (!missingPrice) return '';
  return '<div class="tk-missing">Angaben unvollständig · Ticketpreis fehlt</div>';
}

function renderConcertList() {
  const hasNew = editConcertId === '__new';
  if (!concerts.length && !hasNew) return '<div class="tk-empty">Noch keine Konzerte.<br>Tippe „Neues Konzert" um zu starten. 🎶</div>';
  const up = concerts.filter(c => { const d = daysUntil(c.date); return d === null || d >= 0; })
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));   // chronologisch, ohne Datum ans Ende
  const past = concerts.filter(c => { const d = daysUntil(c.date); return d !== null && d < 0; })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));            // neueste zuerst
  let h = '';
  const card = (c) => {
    // Wird dieses Konzert gerade bearbeitet? -> Inline-Formular statt Karte
    if (editConcertId === c.id) return '<div class="tk-inlineform" id="concert-' + c.id + '">' + concertFormHtml(c.id) + '</div>';
    const d = daysUntil(c.date);
    const isPast = d !== null && d < 0;
    let cd = '', cls = '';
    if (d === null) { cd = 'kein Datum'; }
    else if (isPast) { cd = 'vorbei'; }
    else if (d === 0) { cd = 'HEUTE'; cls = 'today'; }
    else if (d === 1) { cd = 'morgen'; cls = 'soon'; }
    else if (d <= 7) { cd = d + (d === 1 ? ' Tag' : ' Tage'); cls = 'soon'; }
    else { cd = d + ' Tage'; }
    const expanded = expandedConcertId === c.id;
    const iHold = isMine(c.ticketHolder);
    const tixCount = iHold ? (c.tickets || []).length : (c.ticketHolder ? 1 : 0);
    const statusLine = concertStatusLine(c);
    const missing = concertMissingHint(c);

    let html = `<div class="tk-card${isPast ? ' past' : ''}" id="concert-${c.id}">`;
    html += `<div class="tk-top"><div><div class="tk-artist">${esc(c.artist || 'Konzert')}</div>`;
    html += `<div class="tk-venue">${fmtConcertDate(c.date)}${c.time ? ' · ' + esc(c.time) : ''}</div>`;
    html += `<div class="tk-venue">📍 ${esc(c.venueId || '—')}${c.city ? ', ' + esc(c.city) : ''}</div></div>`;
    html += `<div class="tk-cd ${cls}">${cd}</div></div>`;

    html += `<div class="tk-summary">`;
    if (iHold && tixCount) html += `<span>${tixCount} Ticket${tixCount === 1 ? '' : 's'}</span>`;
    else if (c.ticketHolder) html += `<span>Ticket bei ${esc(mineLabel(c.ticketHolder))}</span>`;
    if (statusLine) html += statusLine;
    html += `</div>`;
    if (missing) html += missing;

    // Aufgeklappt: ALLE verfügbaren Infos direkt hier – inkl. Venue/Route,
    // damit man nicht erst über den Venues-Tab gehen muss.
    if (expanded) {
      if (iHold && c.tickets && c.tickets.length) {
        html += '<div class="tk-tix">';
        c.tickets.forEach((t, i) => {
          const mine = isMine(t.owner);
          let badges = '';
          if (!mine) {
            badges += `<span class="tk-b tap ${t.paid ? 'paid' : 'unpaid'}" data-tkact="togglepaid" data-cid="${esc(c.id)}" data-tix="${i}">${t.paid ? '✓ bezahlt' : '✗ offen'}</span>`;
            badges += `<span class="tk-b tap ${t.handedOver ? 'given' : ''}" data-tkact="togglegiven" data-cid="${esc(c.id)}" data-tix="${i}">${t.handedOver ? '✓ übergeben' : 'übergeben?'}</span>`;
          }
          html += `<div class="tk-tix-row"><span class="who">${esc(mineLabel(t.owner))}</span><div class="tk-badges">${badges}</div></div>`;
        });
        html += '</div>';
      }
      if (c.note) html += `<div class="tk-venue" style="margin-top:8px">📝 ${esc(c.note)}</div>`;
      html += renderInlineVenueInfo(c.city, c.venueId);
      html += '<div class="tk-actions">';
      html += `<button class="tk-edit" data-tkact="edit" data-cid="${esc(c.id)}">Bearbeiten</button>`;
      if (c.city && c.venueId) html += `<button class="tk-venuebtn" data-tkact="editvenue" data-city="${esc(c.city)}" data-venue="${esc(c.venueId)}">🎪 Venue bearbeiten</button>`;
      html += '</div>';
    }

    html += `<button class="tk-toggle" data-tkact="toggle" data-cid="${esc(c.id)}">${expanded ? 'Schließen' : 'Öffnen'}</button>`;
    html += '</div>';
    return html;
  };
  up.forEach(c => h += card(c));
  if (past.length) {
    h += renderHistorySummary(past);
    h += '<details class="tk-history"><summary>🕓 Historie (' + past.length + ')</summary><div style="margin-top:10px">';
    past.forEach(c => h += card(c));
    h += '</div></details>';
  }
  return h;
}

// ── Venue- & Ort-Infos kompakt direkt in der Konzertkarte (kein Tab-Wechsel nötig) ──
function renderInlineVenueInfo(cityName, venueName) {
  if (!cityName && !venueName) return '';
  const city = cities[cityName] || null;
  const v = (city && city.venues && city.venues[venueName]) || null;
  const asp = (v && v.aspects) || {};
  const stars = n => n ? '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n) : '';

  let h = '<div class="tk-inline-venue">';
  if (city && city.note) h += `<div class="tk-venue" style="margin-top:6px">🏙 ${esc(city.note)}</div>`;

  if (v) {
    if (v.maps) h += `<div class="tk-venue" style="margin-top:6px">📍 <a href="${esc(safeWebUrl(v.maps))}" target="_blank" rel="noopener">Route öffnen ↗</a></div>`;
    const rows = [];
    if (asp.parking && asp.parking.rating) rows.push(`🅿️ ${stars(asp.parking.rating)}`);
    if (asp.food && asp.food.rating) rows.push(`🍔 ${stars(asp.food.rating)}${asp.food.where ? ' · ' + esc(asp.food.where) : ''}`);
    if (asp.prices && asp.prices.rating) rows.push(`💶 ${stars(asp.prices.rating)}`);
    if (asp.wardrobe && asp.wardrobe.rating) rows.push(`🧥 ${stars(asp.wardrobe.rating)}`);
    if (asp.trip && asp.trip.rating) rows.push(`🚗 ${stars(asp.trip.rating)}`);
    if (rows.length) h += `<div class="tk-vexp" style="margin-top:6px">${rows.map(r => `<span>${r}</span>`).join('')}</div>`;
    ['parking', 'prices', 'food', 'wardrobe', 'trip'].forEach(key => {
      const a = asp[key];
      if (a && a.note) h += `<div class="tk-anote" style="margin-top:3px">${esc(a.note)}</div>`;
    });
    if (v.note) h += `<div class="tk-venue" style="margin-top:6px">📝 ${esc(v.note)}</div>`;
    if (!v.maps && !rows.length && !v.note) h += `<div class="tk-venue" style="margin-top:6px;color:var(--muted)">Noch keine Venue-Infos hinterlegt.</div>`;
  } else if (venueName) {
    h += `<div class="tk-venue" style="margin-top:6px;color:var(--muted)">Noch keine Venue-Infos hinterlegt.</div>`;
  }
  h += '</div>';
  return h;
}

// ── Kompakte Jahresübersicht über der Historie ──
function renderHistorySummary(past) {
  try {
    const years = {};
    past.forEach(c => {
      const y = (c.date || '').slice(0, 4) || '—';
      if (!years[y]) years[y] = { count: 0, cities: new Set(), venues: {} };
      years[y].count++;
      if (c.city) years[y].cities.add(c.city);
      if (c.venueId) years[y].venues[c.venueId] = (years[y].venues[c.venueId] || 0) + 1;
    });
    const yKeys = Object.keys(years).sort().reverse();
    if (!yKeys.length) return '';
    let h = '<div class="tk-year-summary">';
    yKeys.forEach(y => {
      const yd = years[y];
      const venueKeys = Object.keys(yd.venues);
      const topVenue = venueKeys.length ? venueKeys.sort((a, b) => yd.venues[b] - yd.venues[a])[0] : null;
      h += `<div class="tk-year-row"><b>${esc(y)}</b> · ${yd.count} Konzert${yd.count === 1 ? '' : 'e'} · ${yd.cities.size} Stadt${yd.cities.size === 1 ? '' : 'e'}${topVenue ? ` · häufigste Venue: ${esc(topVenue)}` : ''}</div>`;
    });
    h += '</div>';
    return h;
  } catch (err) { console.warn('[Konzerte] Jahresübersicht:', err); return ''; }
}

// ── Städte-/Venue-Datenbank rendern ──
function renderVenueList() {
  const names = Object.keys(cities).sort();
  if (!names.length) return '<div class="tk-empty">Noch keine Venues gespeichert.<br>Sie entstehen automatisch, sobald du bei einem Konzert eine Stadt einträgst. 🏙</div>';
  const stars = (n) => n ? '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n) : '–';
  let h = '';
  names.forEach(cn => {
    const city = cities[cn] || {};
    const venuesObj = city.venues || {};
    const vNames = Object.keys(venuesObj).sort();
    h += `<div class="tk-vcard"><div class="tk-vname-row"><div class="tk-vname">🏙 ${esc(cn)}</div><button class="tk-link-mini" data-tkact="editcity" data-city="${esc(cn)}">✎ Ort bearbeiten</button></div>`;
    if (city.note) h += `<div class="tk-venue" style="margin-bottom:8px">📝 ${esc(city.note)}</div>`;
    if (!vNames.length) h += '<div class="tk-venue" style="color:#aaa;margin-bottom:8px">Noch keine Venue-Infos.</div>';
    vNames.forEach(vn => {
      const v = venuesObj[vn] || {};
      const asp = v.aspects || {};
      const concertsHere = concerts.filter(x => x.city === cn && x.venueId === vn).map(x => x.artist).filter(Boolean);
      const extraCount = ['wardrobe', 'trip'].filter(k => asp[k] && (asp[k].rating || asp[k].note)).length + (v.note ? 1 : 0);
      h += `<div class="tk-venuebox"><div class="tk-venuename">🎪 ${esc(vn)}</div>`;
      if (concertsHere.length) h += `<div class="tk-venue" style="margin:2px 0 6px">🎤 ${esc(concertsHere.join(', '))}</div>`;

      // Venue-Erfahrung: kompakte Sterne-Zeile
      h += `<div class="tk-vexp">`;
      h += `<span>🅿️ ${stars(asp.parking && asp.parking.rating)}</span>`;
      h += `<span>🍔 ${stars(asp.food && asp.food.rating)}</span>`;
      h += `<span>💶 ${stars(asp.prices && asp.prices.rating)}</span>`;
      if (extraCount) h += `<span class="tk-vexp-more">Weitere Infos · ${extraCount}</span>`;
      h += `</div>`;

      h += `<details class="tk-vdetails"><summary>Details anzeigen</summary>`;
      h += '<div class="tk-vgrid" style="margin-top:8px">';
      const row = (icon, label, a) => {
        if (!a || (!a.rating && !a.note && !a.where)) return '';
        let val = a.rating ? `<span class="tk-stars">${stars(a.rating)}</span>` : '';
        if (a.where) val += (val ? ' ' : '') + esc(a.where);
        if (a.note) val += `<div class="tk-anote">${esc(a.note)}</div>`;
        return `<span class="k">${icon} ${label}</span><span class="v">${val || '—'}</span>`;
      };
      if (v.maps) h += `<span class="k">📍 Route</span><span class="v"><a href="${esc(safeWebUrl(v.maps))}" target="_blank" rel="noopener">Route öffnen ↗</a></span>`;
      h += row('🅿️', 'Parken', asp.parking);
      h += row('💶', 'Preise', asp.prices);
      h += row('🍔', 'Essen', asp.food);
      h += row('🧥', 'Garderobe', asp.wardrobe);
      h += row('🚗', 'Heimfahrt', asp.trip);
      if (v.note) h += `<span class="k">📝 Tipp</span><span class="v">${esc(v.note)}</span>`;
      h += '</div>';
      h += `<div class="tk-actions" style="margin-top:8px"><button class="tk-edit" data-tkact="editvenue" data-city="${esc(cn)}" data-venue="${esc(vn)}">Bearbeiten & bewerten</button></div>`;
      h += `</details>`;
      h += '</div>';
    });
    h += `<button class="tkf-addtix" style="margin-top:9px" data-tkact="addvenue" data-city="${esc(cn)}">＋ Venue in ${esc(cn)} hinzufügen</button>`;
    h += '</div>';
  });
  return h;
}

// ── Offene Tickets: Andere schulden mir / Ich schulde anderen ──
function renderOpenTickets() {
  const toMe = [];
  const iOweList = [];
  const missing = [];
  concerts.forEach(c => {
    (c.tickets || []).forEach(t => {
      if (!t) return;
      const owner = (t.owner || '').trim();
      const holderMine=isMine(c.ticketHolder);
      if(holderMine ? isMine(owner) : !isMine(owner))return;
      if (t.paid) return;
      const hasPrice = t.price !== null && t.price !== undefined && t.price !== '';
      if (!hasPrice) { missing.push({ name: holderMine?owner:c.ticketHolder, concert: c.artist || 'Konzert' }); return; }
      const amt = Number(t.price || 0);
      if (!amt) return;
      const entry = { name: holderMine?owner:c.ticketHolder, concert: c.artist || 'Konzert', amount: amt };
      if (isMine(c.ticketHolder)) toMe.push(entry);
      else iOweList.push(entry);
    });
  });

  let h = '';
  if (missing.length) {
    h += `<div class="tk-missing-box"><span>${missing.length} Ticket${missing.length === 1 ? '' : 's'} ohne Preis</span><button class="tk-link-mini" data-tkact="gotoconcerts">Preise ergänzen</button></div>`;
  }
  if (!toMe.length && !iOweList.length) {
    h += '<div class="tk-empty">Keine offenen Tickets. 🎉<br><span style="font-size:12px">Trage bei Tickets einen Preis ein und lasse „bezahlt" offen, dann wird hier abgerechnet.</span></div>';
    return h;
  }
  if (toMe.length) {
    h += '<div class="tk-debt"><div class="tk-debt-h">Andere schulden mir</div>';
    toMe.forEach(x => {
      h += `<div class="tk-debt-row"><span>${esc(x.name)} · ${esc(x.concert)}</span><span class="pos">${x.amount.toFixed(2)} €</span></div>`;
    });
    h += '</div>';
  }
  if (iOweList.length) {
    h += '<div class="tk-debt"><div class="tk-debt-h">Ich schulde anderen</div>';
    iOweList.forEach(x => {
      h += `<div class="tk-debt-row"><span>${esc(x.name)} · ${esc(x.concert)}</span><span class="neg">${x.amount.toFixed(2)} €</span></div>`;
    });
    h += '</div>';
  }
  h += '<div style="font-size:11.5px;color:#999;padding:0 4px">Nur unbezahlte Tickets mit Preis. Als „bezahlt" markieren entfernt den Eintrag.</div>';
  return h;
}
// ════════════════════════════════════════════
// KONZERT-FORMULAR (inline)
// ════════════════════════════════════════════
function venueDlOptions(cityName) {
  const vNames = (cityName && cities[cityName] && cities[cityName].venues) ? Object.keys(cities[cityName].venues) : [];
  return vNames.sort().map(n => `<option value="${esc(n)}">`).join('');
}

function concertFormHtml(id) {
  const c = id ? concerts.find(x => x.id === id) : null;
  formTickets = c && c.tickets ? JSON.parse(JSON.stringify(c.tickets)) : [{ owner: 'Ich', price: '', paid: false, handedOver: false }];
  const cityNames = Object.keys(cities).sort();
  const cityDl = cityNames.map(n => `<option value="${esc(n)}">`).join('');
  const peopleOpts = ['Ich', ...ticketPeople.filter(pp => !isMine(pp))];
  const curHolder = c ? (c.ticketHolder || 'Ich') : 'Ich';
  const iHold = isMine(curHolder);

  let h = '<div class="tkf-formhead">' + (id ? '✏️ Konzert bearbeiten' : '🎫 Neues Konzert') + '</div>';
  h += '<div class="tkf-row"><label>Künstler / Konzert</label><input autocomplete="off" id="tkfArtist" value="' + esc(c ? c.artist || '' : '') + '" placeholder="z.B. Die Ärzte"></div>';
  h += '<div class="tkf-two"><div class="tkf-row"><label>Stadt</label><input autocomplete="off" id="tkfCity" list="tkfCityList" value="' + esc(c ? c.city || '' : '') + '" placeholder="z.B. Hamm"><datalist id="tkfCityList">' + cityDl + '</datalist></div>';
  h += '<div class="tkf-row"><label>Venue</label><input autocomplete="off" id="tkfVenue" list="tkfVenueList" value="' + esc(c ? c.venueId || '' : '') + '" placeholder="z.B. Kurpark"><datalist id="tkfVenueList">' + venueDlOptions(c ? c.city : '') + '</datalist></div></div>';
  h += '<div class="tkf-two"><div class="tkf-row"><label>Datum</label><input autocomplete="off" type="date" id="tkfDate" value="' + esc(c ? c.date || '' : '') + '"></div>';
  h += '<div class="tkf-row"><label>Uhrzeit</label><input autocomplete="off" type="time" id="tkfTime" value="' + esc(c ? c.time || '' : '') + '"></div></div>';
  // Wer hat die Tickets
  h += '<div class="tkf-row"><label>Wer hat die Tickets?</label><select id="tkfHolder">';
  peopleOpts.forEach(o => { h += `<option value="${esc(o)}"${(isMine(o) && iHold) || o === curHolder ? ' selected' : ''}>${esc(mineLabel(o))}</option>`; });
  h += '<option value="__new"' + (!peopleOpts.some(o => o === curHolder || (isMine(o) && iHold)) ? ' selected' : '') + '>+ Andere Person …</option>';
  h += '</select><input autocomplete="off" id="tkfHolderNew" placeholder="Name eingeben" style="display:none;margin-top:7px" value="' + (iHold ? '' : esc(curHolder)) + '"></div>';
  // Ticket-Besitzer-Bereich NUR wenn ich die Tickets halte
  h += '<div id="tkfTixSection">';
  // Ein Preis gilt für alle Tickets des Konzerts
  const prices = [...new Set(formTickets.map(t => (t.price !== '' && t.price != null) ? String(t.price) : null).filter(v => v !== null))];
  const priceAll = prices.length === 1 ? prices[0] : '';
  h += '<div class="tkf-row"><label>Preis pro Ticket (€) – gilt für alle Tickets</label><input autocomplete="off" id="tkfPriceAll" type="number" step="0.01" inputmode="decimal" value="' + esc(priceAll) + '" placeholder="optional"></div>';
  h += '<div class="tkf-row"><label>Wem gehören die Tickets?</label><button type="button" class="tkf-addtix" data-tkact="addtix">＋ Ticket hinzufügen</button><div id="tkfTixList"></div></div>';
  h += '</div>';
  h += '<div class="tkf-row"><label>Notiz (optional)</label><textarea id="tkfNote" placeholder="Sitzplatz, Block …">' + esc(c ? c.note || '' : '') + '</textarea></div>';
  h += '<div style="display:flex;gap:9px;margin-top:6px">';
  h += '<button type="button" class="tk-edit" style="flex:0 0 auto;padding:11px 16px" data-tkact="canceledit">Abbrechen</button>';
  if (id) h += '<button type="button" class="tk-del-btn" data-tkact="delete" data-cid="' + esc(id) + '">Löschen</button>';
  h += '<button type="button" class="tk-add" style="margin:0" data-tkact="save">Speichern</button></div>';
  return h;
}

function renderFormTickets() {
  const box = document.getElementById('tkfTixList');
  if (!box) return;
  const peopleOpts = ['Ich', ...ticketPeople.filter(pp => !isMine(pp))];
  let h = '';
  formTickets.forEach((t, i) => {
    // _isNew: Nutzer hat "+ Andere …" gewählt → Auswahl NICHT auf "Ich" zurückspringen lassen,
    // auch wenn der Name (noch) leer ist (isMine('') wäre sonst true)
    const isNew = !!t._isNew;
    const mine = !isNew && isMine(t.owner);
    const holderSelect=document.getElementById('tkfHolder');
    const holder=holderSelect?.value==='__new'?document.getElementById('tkfHolderNew').value:holderSelect?.value;
    const sameHolder = isMine(holder) ? mine : t.owner === holder;
    h += '<div class="tkf-tix"><div class="tkf-tix-hd"><span>Ticket ' + (i + 1) + '</span>' +
      (formTickets.length > 1 ? '<button type="button" data-tkact="rmtix" data-tix="' + i + '">entfernen</button>' : '') + '</div>';
    // Für wen — select + optionales Freitextfeld
    h += '<div class="tkf-row" style="margin:0 0 7px"><label>Für wen</label><select class="tkfTixOwner" data-tix="' + i + '">';
    let matched = false;
    peopleOpts.forEach(o => { const setSel = !isNew && ((isMine(o) && mine) || o === t.owner); if (setSel) matched = true; h += `<option value="${esc(o)}"${setSel ? ' selected' : ''}>${esc(mineLabel(o))}</option>`; });
    const showNew = isNew || !matched;
    h += `<option value="__new"${showNew ? ' selected' : ''}>+ Andere …</option></select>`;
    h += `<input autocomplete="off" class="tkfTixOwnerNew" data-tix="${i}" placeholder="Name" style="display:${showNew ? 'block' : 'none'};margin-top:6px" value="${showNew ? esc(t.owner || '') : ''}"></div>`;
    // Bezahlt-Checkbox nur bei fremden Tickets ("+ Andere" gilt als fremd)
    h += '<div class="tkf-row" style="margin:0"><div class="tkf-checks">' +
      (sameHolder ? '<span style="font-size:12px;color:#888">Eigenes Ticket – kein Ausgleich nötig</span>'
            : '<label><input autocomplete="off" type="checkbox" class="tkfTixPaid" data-tix="' + i + '" ' + (t.paid ? 'checked' : '') + '> bezahlt</label>') +
      '</div></div>';
    h += '</div>';
  });
  box.innerHTML = h;
  // Owner-select Umschaltung
  box.querySelectorAll('.tkfTixOwner').forEach(sel => {
    sel.addEventListener('change', () => {
      const i = +sel.dataset.tix;
      if (formTickets[i]) {
        if (sel.value === '__new') { formTickets[i]._isNew = true; formTickets[i].owner = ''; }
        else { formTickets[i]._isNew = false; formTickets[i].owner = sel.value; }
      }
      syncFormTickets(); renderFormTickets();
      if (sel.value === '__new') {
        const ni2 = box.querySelector('.tkfTixOwnerNew[data-tix="' + i + '"]');
        if (ni2) ni2.focus();
      }
    });
  });
  // Freitext-Namen live übernehmen (ohne Neu-Rendern, damit das Tippen nicht unterbrochen wird)
  box.querySelectorAll('.tkfTixOwnerNew').forEach(inp => {
    inp.addEventListener('input', () => {
      const i = +inp.dataset.tix;
      if (formTickets[i]) formTickets[i].owner = inp.value;
    });
  });
}

function syncFormTickets() {
  const box = document.getElementById('tkfTixList');
  if (!box) return;
  box.querySelectorAll('.tkfTixOwner').forEach(sel => {
    const i = +sel.dataset.tix;
    if (!formTickets[i]) return;
    if (sel.value === '__new') {
      const ni = box.querySelector('.tkfTixOwnerNew[data-tix="' + i + '"]');
      formTickets[i].owner = ni ? ni.value : (formTickets[i].owner || '');
      formTickets[i]._isNew = true;
    } else {
      formTickets[i].owner = sel.value;
      formTickets[i]._isNew = false;
    }
  });
  box.querySelectorAll('.tkfTixPaid').forEach(inp => { const i = +inp.dataset.tix; if (formTickets[i]) formTickets[i].paid = inp.checked; });
  // Ein Preis für alle Tickets des Konzerts – nur überschreiben, wenn tatsächlich
  // ein Wert eingegeben wurde (sonst blieben bei uneindeutigen Altpreisen alle leer)
  const pa = document.getElementById('tkfPriceAll');
  if (pa && pa.value !== '') {
    const v = pa.value;
    formTickets.forEach(t => { t.price = v; });
  }
}

// Nach dem Rendern des Inline-Formulars: Holder-Umschaltung + Ticketliste
function afterConcertForm() {
  const cityEl = document.getElementById('tkfCity');
  const venueDlEl = document.getElementById('tkfVenueList');
  if (cityEl && venueDlEl) {
    cityEl.addEventListener('input', () => { venueDlEl.innerHTML = venueDlOptions(cityEl.value.trim()); });
  }
  const sel = document.getElementById('tkfHolder');
  if (!sel) return;
  const ni = document.getElementById('tkfHolderNew');
  const section = document.getElementById('tkfTixSection');
  function refresh() {
    const isNew = sel.value === '__new';
    if (ni) ni.style.display = isNew ? 'block' : 'none';
    // Ticket-Besitzer-Bereich nur wenn ICH die Tickets halte
    const holderMine = isMine(isNew ? (ni ? ni.value : '') : sel.value);
    if (section) section.style.display = 'block';
  }
  sel.addEventListener('change', () => { syncFormTickets();refresh();renderFormTickets();if(sel.value==='__new' && ni)ni.focus(); });
  if (ni) ni.addEventListener('input', () => {syncFormTickets();refresh();renderFormTickets();});
  refresh();
  renderFormTickets();
}

function rememberPerson(name) {
  const n = (name || '').trim();
  if (!n || isMine(n)) return;
  if (!ticketPeople.some(pp => pp.toLowerCase() === n.toLowerCase())) {
    ticketPeople.push(n);
    save('vh_ticketpeople', ticketPeople);
  }
}

function saveConcertForm() {
  syncFormTickets();
  const artist = document.getElementById('tkfArtist').value.trim();
  const venueId = document.getElementById('tkfVenue').value.trim();
  const city = document.getElementById('tkfCity').value.trim();
  const date = document.getElementById('tkfDate').value;
  if (!artist && !date) { alert('Bitte mindestens Künstler oder Datum angeben.'); return; }
  let holder = document.getElementById('tkfHolder').value;
  if (holder === '__new') holder = (document.getElementById('tkfHolderNew').value || '').trim();
  const iHold = isMine(holder);
  if(!holder.trim()){alert('Bitte die Person angeben, die die Tickets hält.');return;}
  if(formTickets.some(t=>!String(t.owner || '').trim())){alert('Bitte für jedes Ticket einen Namen angeben.');return;}
  if(formTickets.some(t=>t.price!=='' && t.price!=null && (strictNumber(t.price)===null || strictNumber(t.price)<0))){alert('Bitte gültige Ticketpreise eingeben.');return;}
  const tickets=formTickets.map(t=>({owner:t.owner.trim(),price:t.price==='' || t.price==null?null:strictNumber(t.price),paid:!!t.paid,handedOver:!!t.handedOver}));
  const obj = {
    id: (editConcertId && editConcertId !== '__new') ? editConcertId : tkUid(),
    artist, venueId, city, date,
    time: document.getElementById('tkfTime').value,
    ticketHolder: iHold ? 'Ich' : holder,
    tickets,
    note: document.getElementById('tkfNote').value.trim()
  };
  if (editConcertId && editConcertId !== '__new') { const i = concerts.findIndex(c => c.id === editConcertId); if (i >= 0) concerts[i] = obj; }
  else concerts.push(obj);
  if (!iHold) rememberPerson(holder);
  tickets.forEach(t => rememberPerson(t.owner));
  // Stadt/Venue-Gerüst anlegen
  if (city) {
    if (!cities[city]) cities[city] = { note: '', venues: {} };
    if (!cities[city].venues) cities[city].venues = {};
    if (venueId && !cities[city].venues[venueId]) cities[city].venues[venueId] = { maps: '', note: '', aspects: {} };
  }
  save('vh_concerts', concerts);
  save('vh_cities', cities);
  editConcertId = null;
  renderTickets();
  renderConcertBanner();
}


// ── Stadt-Formular mit Aspekt-Bewertungen ──
function openCityForm(cityName) {
  const city = cities[cityName] || { note: '', venues: {} };
  let h = `<div class="tkf-row"><label>Stadt</label><input autocomplete="off" id="tcfCity" value="${esc(cityName || '')}" placeholder="z.B. Köln" ${cityName ? 'readonly' : ''}></div>`;
  h += `<div class="tkf-row"><label>📝 Notiz zum Ort</label><textarea id="tcfNote" placeholder="z.B. allgemeine Parksituation, Bahnhofsnähe …">${esc(city.note || '')}</textarea></div>`;
  h += `<button type="button" class="tk-add" style="margin-top:4px" data-tkact="savecity" data-oldcity="${esc(cityName || '')}">Speichern</button>`;
  openTicketModal(cityName ? '🏙 ' + cityName : 'Ort bearbeiten', h);
}
function saveCityForm(oldCity) {
  const cityName = document.getElementById('tcfCity').value.trim();
  if (!cityName) { alert('Bitte eine Stadt angeben.'); return; }
  const note = document.getElementById('tcfNote').value.trim();
  if (oldCity && oldCity !== cityName && cities[oldCity]) {
    cities[cityName] = { note, venues: cities[oldCity].venues || {} };
    delete cities[oldCity];
    concerts.forEach(c => { if (c.city === oldCity) c.city = cityName; });
    save('vh_concerts', concerts);
  } else {
    if (!cities[cityName]) cities[cityName] = { note: '', venues: {} };
    cities[cityName].note = note;
  }
  save('vh_cities', cities);
  closeTicketModal();
  renderTickets();
}

function openVenueForm(cityName, venueName) {
  const city = cities[cityName] || { note: '', venues: {} };
  const v = (city.venues && city.venues[venueName]) || { maps: '', note: '', aspects: {} };
  const a = v.aspects || {};
  const starRow = (key, val) => {
    let r = '<div class="tkf-stars" data-aspkey="' + key + '"' + (val ? ' data-val="' + val + '"' : '') + '>';
    for (let i = 1; i <= 5; i++) r += `<span class="tkf-star${(val && val >= i) ? ' on' : ''}" data-star="${i}">★</span>`;
    r += `<span class="tkf-star-clear" data-star="0">✕</span></div>`;
    return r;
  };
  let h = '<div class="tkf-two"><div class="tkf-row"><label>Stadt</label><input autocomplete="off" id="tvfCity" value="' + esc(cityName || '') + '" placeholder="z.B. Köln"></div>';
  h += '<div class="tkf-row"><label>Venue</label><input autocomplete="off" id="tvfVenue" value="' + esc(venueName || '') + '" placeholder="z.B. E-Werk"></div></div>';
  h += '<div class="tkf-row"><label>📍 Maps-Link (Venue/Parkplatz)</label><input autocomplete="off" id="tvfMaps" value="' + esc(v.maps || '') + '" placeholder="https://maps.google.com/…"></div>';
  const aspect = (key, icon, label, withWhere) => {
    const av = a[key] || {};
    let x = `<div class="tkf-aspect"><div class="tkf-aspect-hd">${icon} ${label}</div>`;
    x += starRow(key, av.rating || 0);
    if (withWhere) x += `<input autocomplete="off" class="tvfWhere" data-aspkey="${key}" value="${esc(av.where || '')}" placeholder="Wo? (z.B. Restaurant XY / im Venue)" style="margin-top:7px">`;
    x += `<textarea class="tvfANote" data-aspkey="${key}" placeholder="Notiz …">${esc(av.note || '')}</textarea></div>`;
    return x;
  };
  h += aspect('parking', '🅿️', 'Parken', false);
  h += aspect('prices', '💶', 'Preise vor Ort', false);
  h += aspect('food', '🍔', 'Essen', true);
  h += aspect('wardrobe', '🧥', 'Garderobe / Schließfächer', false);
  h += aspect('trip', '🚗', 'Heimfahrt', false);
  h += '<div class="tkf-row" style="margin-top:11px"><label>📝 Venue-Notiz</label><textarea id="tvfNote" placeholder="Geheimtipps, Einlass …">' + esc(v.note || '') + '</textarea></div>';
  h += '<div style="display:flex;gap:9px;margin-top:4px">';
  if (venueName) h += '<button type="button" class="tk-del-btn" data-tkact="delvenue" data-city="' + esc(cityName) + '" data-venue="' + esc(venueName) + '">Löschen</button>';
  h += '<button type="button" class="tk-add" style="margin:0" data-tkact="savevenue" data-oldcity="' + esc(cityName || '') + '" data-oldvenue="' + esc(venueName || '') + '">Speichern</button></div>';
  openTicketModal(venueName ? '🎪 ' + venueName : (cityName ? 'Venue in ' + cityName : 'Neue Venue'), h);

  document.querySelectorAll('.tkf-stars').forEach(row => {
    row.addEventListener('click', (e) => {
      const st = e.target.closest('[data-star]'); if (!st) return;
      const val = +st.dataset.star;
      row.querySelectorAll('.tkf-star').forEach(sp => sp.classList.toggle('on', val > 0 && +sp.dataset.star <= val));
      row.dataset.val = val;
    });
  });
}

function saveVenueForm(oldCity, oldVenue) {
  const cityName = document.getElementById('tvfCity').value.trim();
  const venueName = document.getElementById('tvfVenue').value.trim();
  if (!cityName) { alert('Bitte eine Stadt angeben.'); return; }
  if (!venueName) { alert('Bitte einen Venue-Namen angeben.'); return; }
  const aspects = {};
  const prevAsp = (cities[oldCity] && cities[oldCity].venues && cities[oldCity].venues[oldVenue] && cities[oldCity].venues[oldVenue].aspects) || {};
  ['parking', 'prices', 'food', 'wardrobe', 'trip'].forEach(key => {
    const row = document.querySelector('.tkf-stars[data-aspkey="' + key + '"]');
    const rating = row && row.dataset.val != null ? +row.dataset.val : (prevAsp[key] ? prevAsp[key].rating || 0 : 0);
    const whereEl = document.querySelector('.tvfWhere[data-aspkey="' + key + '"]');
    const noteEl = document.querySelector('.tvfANote[data-aspkey="' + key + '"]');
    const obj = {};
    if (rating) obj.rating = rating;
    if (whereEl && whereEl.value.trim()) obj.where = whereEl.value.trim();
    if (noteEl && noteEl.value.trim()) obj.note = noteEl.value.trim();
    if (Object.keys(obj).length) aspects[key] = obj;
  });
  const vObj = { maps: document.getElementById('tvfMaps').value.trim(), note: document.getElementById('tvfNote').value.trim(), aspects };
  // Ziel-Stadt sicherstellen
  if (!cities[cityName]) cities[cityName] = { note: '', venues: {} };
  if (!cities[cityName].venues) cities[cityName].venues = {};
  // Alte Venue/Stadt ggf. entfernen (bei Umbenennung/Umzug)
  if (oldCity && oldVenue && cities[oldCity] && cities[oldCity].venues && (oldCity !== cityName || oldVenue !== venueName)) {
    delete cities[oldCity].venues[oldVenue];
  }
  cities[cityName].venues[venueName] = vObj;
  // Konzerte umziehen, die auf alte Stadt/Venue zeigten
  if (oldCity && oldVenue && (oldCity !== cityName || oldVenue !== venueName)) {
    concerts.forEach(c => { if (c.city === oldCity && c.venueId === oldVenue) { c.city = cityName; c.venueId = venueName; } });
  }
  save('vh_cities', cities);
  save('vh_concerts', concerts);
  closeTicketModal();
  renderTickets();
}


// ── Modal-Helfer (nutzt das echte, funktionierende .modal-bg/.modal-Design –
//    vorher fehlten die CSS-Regeln für .modal-overlay/.modal-box, wodurch
//    das Formular unformatiert ganz unten im Bildschirm landete) ──
function openTicketModal(title, bodyHtml) {
  let m = document.getElementById('ticketModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'ticketModal';
    m.className = 'modal-bg';
    m.innerHTML = '<div class="modal"><div class="modal-handle"></div>' +
      '<button class="modal-close-btn" aria-label="Schließen" data-tkact="closemodal">×</button>' +
      '<h2 id="tkModalTitle"></h2><div id="tkModalBody"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) closeTicketModal(); });
  }
  document.getElementById('tkModalTitle').textContent = title;
  document.getElementById('tkModalBody').innerHTML = bodyHtml;
  openModal(m.id);
}
function closeTicketModal() {
  const m = document.getElementById('ticketModal');
  if (m) closeModal(m.id);
}

// ── Event-Delegation ──
function initTicketsDelegation() {
  document.addEventListener('click', (e) => {
   // Fehlerfest: darf NIE die restliche App beeinträchtigen
   try {
    const t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    const seg = t.closest('[data-tktab]');
    if (seg) { ticketTab = seg.dataset.tktab; renderTickets(); return; }
    const b = t.closest('[data-tkact]');
    if (!b) return;
    const act = b.dataset.tkact;
    if (act === 'new') { editConcertId = '__new'; renderTickets(); }
    else if (act === 'edit') { editConcertId = b.dataset.cid; renderTickets(); }
    else if (act === 'canceledit') { editConcertId = null; renderTickets(); }
    else if (act === 'save') saveConcertForm();
    else if (act === 'toggle') { expandedConcertId = expandedConcertId === b.dataset.cid ? null : b.dataset.cid; renderTickets(); }
    else if (act === 'focus') {
      ticketTab = 'concerts'; expandedConcertId = b.dataset.cid; renderTickets();
      setTimeout(() => { document.getElementById('concert-' + b.dataset.cid)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    }
    else if (act === 'gotoconcerts') { ticketTab = 'concerts'; editConcertId = null; renderTickets(); }
    else if (act === 'delete') {
      if (confirm('Dieses Konzert wirklich löschen?')) {
        concerts = concerts.filter(c => c.id !== b.dataset.cid);
        save('vh_concerts', concerts); editConcertId = null; renderTickets(); renderConcertBanner();
      }
    }
    else if (act === 'addtix') { syncFormTickets(); formTickets.push({ owner: '', price: '', paid: false, handedOver: false }); renderFormTickets(); }
    else if (act === 'rmtix') { syncFormTickets(); formTickets.splice(+b.dataset.tix, 1); renderFormTickets(); }
    else if (act === 'togglepaid') { const c = concerts.find(x => x.id === b.dataset.cid); const t2 = c && c.tickets ? c.tickets[+b.dataset.tix] : null; if (t2) { t2.paid = !t2.paid; save('vh_concerts', concerts); renderTickets(); } }
    else if (act === 'togglegiven') { const c = concerts.find(x => x.id === b.dataset.cid); const t3 = c && c.tickets ? c.tickets[+b.dataset.tix] : null; if (t3) { t3.handedOver = !t3.handedOver; save('vh_concerts', concerts); renderTickets(); } }
    else if (act === 'viewvenue') { ticketTab = 'venues'; renderTickets(); const cy = b.dataset.city, vn = b.dataset.venue; setTimeout(() => openVenueForm(cy, vn), 60); }
    else if (act === 'editcity') openCityForm(b.dataset.city);
    else if (act === 'savecity') saveCityForm(b.dataset.oldcity);
    else if (act === 'editvenue') openVenueForm(b.dataset.city, b.dataset.venue);
    else if (act === 'addvenue') openVenueForm(b.dataset.city, '');
    else if (act === 'delvenue') {
      if (confirm('Diese Venue-Infos wirklich löschen?')) {
        if (cities[b.dataset.city] && cities[b.dataset.city].venues) delete cities[b.dataset.city].venues[b.dataset.venue];
        save('vh_cities', cities); closeTicketModal(); renderTickets();
      }
    }
    else if (act === 'savevenue') saveVenueForm(b.dataset.oldcity, b.dataset.oldvenue);
    else if (act === 'closemodal') closeTicketModal();
   } catch (err) {
     console.warn('[Konzerte] Aktion fehlgeschlagen:', err);
   }
  });
}

// ════════════════════════════════════════════
