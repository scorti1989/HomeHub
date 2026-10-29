'use strict';
// Vertragswechsel werden mit einer einzigen Vertrags-Speicherung übernommen.
// Der bisherige Zähler bleibt erhalten; Tarife werden pro Vertrag aufbewahrt.
let switchFromId = null;
function shiftContractDate(value, days) {
  const [y, m, d] = value.split('-').map(Number);
  return localDateStr(new Date(y, m - 1, d + days, 12));
}
function contractEndDate(c) {
  return c.cancelledStatus && c.cancelledUntil ? c.cancelledUntil : c.endDate || '';
}
function isContractPlanned(c) { return !!c.startDate && c.startDate > today(); }
function showContractSwitch(old) {
  const meter = meterForContract(old.id);
  const en = old.energyTariff || meter?.energy || {};
  const energy = !!meter && ['gas', 'strom', 'wasser'].includes(old.category);
  const field = (id, label, value = '') => `<div class="fg"><label for="${id}">${label}</label><input id="${id}" inputmode="decimal" value="${esc(String(value ?? ''))}" autocomplete="off"></div>`;
  const box = document.getElementById('contractSwitchFields');
  box.hidden = false;
  box.innerHTML = `<div class="card" style="margin:12px 0;padding:14px">
    <b>Wechsel von ${esc(old.provider || old.name)}</b>
    <p>Beginn des neuen Vertrags oben eintragen. Der alte Vertrag endet am Vortag. Erst „Speichern“ übernimmt den Wechsel.</p>
    <p id="switchDatePreview" aria-live="polite"></p>
    <label style="display:block;margin:12px 0"><input id="sw-confirmed" type="checkbox"> Der Übergangstermin ist bestätigt.</label>
    ${energy ? `<b>Neuer Tarif · ${esc(meter.name || meter.type)}</b>
      ${field('sw-price', 'Arbeitspreis in ct/kWh')}
      ${field('sw-base', 'Grundpreis pro Monat in €')}
      ${old.category === 'gas' ? field('sw-factor', 'Gasfaktor in kWh/m³', en.gasKwhPerM3 || '') : ''}
      ${field('sw-reading', 'Zählerstand am Wechseltermin (optional)')}
      <p>Den monatlichen Abschlag oben als Kosten eintragen. Der Wechselstand gilt als Schlussstand des alten und Anfangsstand des neuen Tarifs. Einen zukünftigen Stand erst nach der Ablesung ergänzen. Bisherige Ablesungen bleiben erhalten.</p>` : ''}
    </div>`;
  updateContractSwitchPreview();
}
function updateContractSwitchPreview() {
  const box = document.getElementById('switchDatePreview');
  if (!box || !switchFromId) return;
  const start = document.getElementById('f-start').value;
  box.textContent = start ? `Altvertrag bis ${fmtDate(shiftContractDate(start, -1))} · Neuvertrag ab ${fmtDate(start)}` : 'Bitte den Wechselbeginn eintragen.';
}
document.getElementById('f-start').addEventListener('input', updateContractSwitchPreview);
function prepareContractSwitch(entry, oldId) {
  const old = contracts.find(c => c.id === oldId);
  if (!old || contracts.some(c => c.previousContractId === oldId)) { alert('Für diesen Altvertrag kann kein weiterer Wechsel angelegt werden.'); return null; }
  if (!validDate(entry.startDate) || (old.startDate && entry.startDate <= old.startDate)) { alert('Bitte einen gültigen Beginn nach dem Start des Altvertrags eintragen.'); return null; }
  if (!document.getElementById('sw-confirmed')?.checked) { alert('Bitte den bestätigten Übergangstermin prüfen und bestätigen.'); return null; }
  if (entry.category !== old.category) { alert('Alt- und Neuvertrag müssen dieselbe Kategorie haben.'); return null; }
  const updated = {...old, endDate: shiftContractDate(entry.startDate, -1), autoRenew: 'nein'};
  if (old.cancelledStatus) updated.cancelledUntil = updated.endDate;
  entry.switchPreviousState = {endDate: old.endDate || '', autoRenew: old.autoRenew || 'ja', cancelledUntil: old.cancelledUntil || '', energyTariff: old.energyTariff || null, energyMeterId: old.energyMeterId || null};
  entry.previousContractId = old.id;
  entry.switchConfirmed = true;
  const meter = meterForContract(old.id);
  if (meter && ['gas', 'strom', 'wasser'].includes(old.category)) {
    const number = id => {
      const raw = document.getElementById(id)?.value.trim() || '';
      return raw === '' ? null : strictNumber(raw);
    };
    const price = number('sw-price'), base = number('sw-base'), reading = number('sw-reading'), factor = number('sw-factor');
    if (price === null || price < 0 || base === null || base < 0 || (old.category === 'gas' && !(factor > 0))) { alert('Bitte Arbeitspreis, monatlichen Grundpreis und bei Gas den gültigen Umrechnungsfaktor eintragen.'); return null; }
    const raw = document.getElementById('sw-reading').value.trim();
    if (raw && (reading === null || reading < 0 || entry.startDate > today())) { alert('Bitte einen gültigen, bereits abgelesenen Wechselstand eintragen.'); return null; }
    const knownReadings = [...(meter.readings || []), ...meterEnergyContracts(meter).filter(c => c.switchReading != null).map(c => ({date: c.startDate, value: c.switchReading}))];
    const before = knownReadings.filter(r => r.date < entry.startDate).sort((a,b) => a.date.localeCompare(b.date)).at(-1);
    const after = knownReadings.filter(r => r.date >= entry.startDate).sort((a,b) => a.date.localeCompare(b.date))[0];
    if (raw && ((before && reading < before.value) || (after && reading > after.value) || (after?.date === entry.startDate && reading !== after.value))) { alert('Der Wechselstand passt nicht zu den vorhandenen Ablesungen. Bitte prüfen.'); return null; }
    if (entry.interval !== 'monatlich' || entry.discountMonths || entry.freeMonths || entry.extraCost) { alert('Beim Energie-Wechsel bitte den regelmäßigen Abschlag als monatliche Kosten ohne Rabatt- oder Zusatzkostenfelder erfassen.'); return null; }
    updated.energyMeterId = meter.id;
    updated.energyTariff = {...(old.energyTariff || meter.energy || {}), unitPrice: old.energyTariff?.unitPrice ?? meter.energy?.unitPrice ?? meter.price, endDate: updated.endDate};
    entry.energyMeterId = meter.id;
    entry.energyTariff = {unitPrice: price, basePriceMonthly: base, monthlyPayment: entry.cost, gasKwhPerM3: factor || undefined, startReading: reading, startDate: entry.startDate, endDate: entry.endDate || undefined};
    entry.switchReading = reading;
  }
  return updated;
}
function contractSwitchSummary(c) {
  const prev = contracts.find(x => x.id === c.previousContractId);
  const next = contracts.find(x => x.previousContractId === c.id);
  let html = '';
  if (prev) html += `<div class="ct-rhythm">Wechsel von ${esc(prev.provider || prev.name)} am ${fmtDate(c.startDate)}</div>${!next ? `<button type="button" class="tk-link-mini" data-ctact="undo-switch" data-cid="${esc(c.id)}">Wechsel zurücknehmen</button>` : ''}`;
  if (next) html += `<div class="ct-rhythm">Folgevertrag: ${esc(next.provider || next.name)} ab ${fmtDate(next.startDate)}</div>`;
  if (c.energyTariff && prev && c.switchReading == null && !(meterForContract(c.id)?.readings || []).some(r => r.date === c.startDate)) html += `<div class="ct-rhythm">Wechselzählerstand fehlt · am Zähler unter „Vertragswechsel“ ergänzen.</div>`;
  return html;
}
// Berechnung eines einzelnen Tarifzeitraums, ohne den ursprünglichen Zähler umzuschreiben.
function energyMeterPeriod(meter, c) {
  const en = {...(c.energyTariff || meter.energy || {}), linkedContractId: c.id, startDate: c.startDate || c.energyTariff?.startDate || meter.energy?.startDate, endDate: contractEndDate(c) || undefined};
  const next = contracts.find(x => x.previousContractId === c.id);
  const start = en.startDate || '0000-01-01';
  const boundary = next?.startDate || en.endDate;
  // Der gemeinsame Messwert am Wechselbeginn begrenzt den alten Verbrauch exakt.
  let readings = (meter.readings || []).filter(r => r.date >= start && (!boundary || r.date <= boundary));
  for (const contract of [c, next]) {
    if (contract?.switchReading != null && !readings.some(r => r.date === contract.startDate)) readings.push({date: contract.startDate, value: contract.switchReading});
  }
  const exactStart = readings.find(r => r.date === start);
  if (exactStart) en.startReading = exactStart.value;
  return {...meter, provider: c.provider, price: en.unitPrice, energy: en, readings};
}
function meterEnergyContracts(meter) {
  return contracts.filter(c => c.energyMeterId === meter.id || c.id === meter.energy?.linkedContractId).sort((a,b) => (a.startDate || '').localeCompare(b.startDate || ''));
}
function renderMeterSwitches(meter) {
  const list = meterEnergyContracts(meter);
  if (!list.some(c => c.previousContractId)) return '';
  return `<div class="card"><div class="card-label">Vertragswechsel &amp; Tarifhistorie</div>${list.map(c => {
    const prev = contracts.find(x => x.id === c.previousContractId);
    const pending = prev && c.switchReading == null && !(meter.readings || []).some(r => r.date === c.startDate);
    const period = energyMeterPeriod(meter, c);
    const stats = c.startDate <= today() ? calculateEnergyContractStats(period, c.id) : null;
    return `<details style="margin:10px 0"><summary>${esc(c.provider || c.name)} · ${fmtDate(c.startDate)}${isContractPlanned(c) ? ' · geplant' : ''}${pending ? ' · Wechselstand fehlt' : ''}</summary>
      ${pending ? `<p>Bitte den tatsächlichen Stand vom ${fmtDate(c.startDate)} als normale Ablesung eintragen. Er wird für beide Tarife verwendet.</p>` : ''}
      ${stats ? renderEnergyCard(stats, meter.type) : '<p>Für diesen Tarif fehlen noch Ablesungen nach Vertragsbeginn.</p>'}
      <button type="button" class="kb-btn" data-ctact="editlinked" data-cid="${esc(c.id)}">Vertrag bearbeiten</button>
    </details>`;
  }).join('')}</div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ctact="editlinked"]');
  if (b) openEditContractModal(b.dataset.cid);
});

function showEnergyTariffEditor(c) {
  const en = c.energyTariff;
  const box = document.getElementById('contractSwitchFields');
  box.hidden = false;
  box.innerHTML = `<details class="cf-sec" open><summary>Energietarif dieses Vertrags</summary>
    <p>Tarifdaten gelten nur für diesen Vertragszeitraum. Den monatlichen Abschlag oben unter Kosten ändern.</p>
    <div class="fg"><label for="et-price">Arbeitspreis in ct/kWh</label><input id="et-price" inputmode="decimal" value="${esc(String(en.unitPrice ?? ''))}"></div>
    <div class="fg"><label for="et-base">Grundpreis pro Monat in €</label><input id="et-base" inputmode="decimal" value="${esc(String(en.basePriceMonthly ?? ''))}"></div>
    ${c.category === 'gas' ? `<div class="fg"><label for="et-factor">Gasfaktor in kWh/m³</label><input id="et-factor" inputmode="decimal" value="${esc(String(en.gasKwhPerM3 ?? ''))}"></div>` : ''}
    <p>Wechselstände als Ablesung am Zähler pflegen. Ein beim Wechsel erfasster Stand: ${c.switchReading == null ? 'nicht hinterlegt' : esc(String(c.switchReading))}.</p>
    </details>`;
}
function readEnergyTariffEditor(entry) {
  const price = strictNumber(document.getElementById('et-price').value);
  const base = strictNumber(document.getElementById('et-base').value);
  const factor = document.getElementById('et-factor') ? strictNumber(document.getElementById('et-factor').value) : null;
  if (price === null || price < 0 || base === null || base < 0 || (entry.category === 'gas' && !(factor > 0))) { alert('Bitte gültige Tarifwerte eintragen.'); return false; }
  if (entry.interval !== 'monatlich' || entry.discountMonths || entry.freeMonths || entry.extraCost) { alert('Bitte den Energie-Abschlag monatlich ohne Rabatt- und Zusatzkostenfelder erfassen.'); return false; }
  entry.energyTariff = {...entry.energyTariff, unitPrice: price, basePriceMonthly: base, monthlyPayment: entry.cost, gasKwhPerM3: factor || undefined};
  return true;
}
function undoContractSwitch(id) {
  const c = contracts.find(x => x.id === id);
  const prev = contracts.find(x => x.id === c?.previousContractId);
  if (!prev || !c.switchPreviousState || contracts.some(x => x.previousContractId === id)) { alert('Nur der letzte Wechsel einer Vertragsfolge kann zurückgenommen werden.'); return; }
  if (!confirm('Diesen Wechsel zurücknehmen? Der Folgevertrag wird entfernt, der vorherige Vertrag wiederhergestellt. Ablesungen bleiben erhalten.')) return;
  const restored = {...prev, ...c.switchPreviousState};
  const before = contracts;
  contracts = contracts.filter(x => x.id !== id).map(x => x.id === prev.id ? restored : x);
  if (!save('vh_contracts', contracts)) { contracts = before; return; }
  closeModal('contractModal'); renderContracts(); renderAmpel(); renderHome();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ctact="undo-switch"]');
  if (b) undoContractSwitch(b.dataset.cid);
});
