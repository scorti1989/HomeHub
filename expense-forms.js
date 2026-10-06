'use strict';
// EXPENSE MODAL
// ════════════════════════════════════════════
let editExpId = null, currentAccount = 'ich';

fillCatSelect('e-cat', 'lebensmittel');

function setAccount(acc) {
  currentAccount = acc;
  document.getElementById('acc-ich').className = 'acc-btn' + (acc === 'ich' ? ' ai' : '');
  document.getElementById('acc-wir').className = 'acc-btn' + (acc === 'wir' ? ' aw' : '');
  // Fix Bug 3: Wenn Modus "Mein Anteil" aktiv ist, klar kommunizieren dass Buchung
  // trotzdem auf das gemeinsame Konto geht – die Anteil-Ansicht ist nur eine Filteransicht.
  const isAnteilModus = activeHaushalt === 'wir' && kasseCostView === 'anteil';
  document.getElementById('accHint').textContent = acc === 'wir'
    ? `Gemeinsames Konto (${settings.partnerName || 'Partner'} & ich)${isAnteilModus ? ' – Ansicht zeigt deinen Anteil' : ''}`
    : 'Persönliches Konto';
}
document.getElementById('acc-ich').addEventListener('click', () => setAccount('ich'));
document.getElementById('acc-wir').addEventListener('click', () => setAccount('wir'));

function getLastAccountForCat(cat) {
  const last = [...expenses].reverse().find(e => e.category === cat);
  return last ? last.account : 'ich';
}
function updateTripSuggestions() {
  const trips = [...new Set(expenses.filter(e => e.tripId).map(e => e.tripId))];
  document.getElementById('tripSuggestions').innerHTML = trips.map(t => `<option value="${esc(t)}">`).join('');
}
function openAddExpense(prefill) {
  editExpId = null;
  document.getElementById('expModalTitle').textContent = 'Ausgabe eintragen';
  document.getElementById('deleteExpBtn').style.display = 'none';
  document.getElementById('e-date').value = today();
  document.getElementById('e-amount').value = prefill?.amount || '';
  document.getElementById('e-desc').value = prefill?.desc || '';
  document.getElementById('e-note').value = '';
  document.getElementById('e-trip').value = '';
  document.getElementById('fromShoppingInfo').style.display = prefill?.fromShopping ? 'block' : 'none';
  const cat = prefill?.category || 'lebensmittel';
  document.getElementById('e-cat').value = cat;
  document.getElementById('e-group').value = getAnalysisGroup(cat);
  const defaultAcc = activeHaushalt === 'wir' ? 'wir' : (activeHaushalt || getLastAccountForCat(cat));
  setAccount(defaultAcc);
  updateTripSuggestions();
  openModal('expenseModal');
}
function openEditExpense(id) {
  const e = expenses.find(x => x.id === id);
  if (!e) return;
  editExpId = id;
  document.getElementById('expModalTitle').textContent = 'Ausgabe bearbeiten';
  document.getElementById('deleteExpBtn').style.display = 'block';
  document.getElementById('e-amount').value = e.amount || '';
  document.getElementById('e-date').value = e.date || today();
  document.getElementById('e-desc').value = e.desc || '';
  document.getElementById('e-cat').value = e.category || 'lebensmittel';
  document.getElementById('e-group').value = e.analysisGroup || getAnalysisGroup(e.category);
  document.getElementById('e-trip').value = e.tripId || '';
  document.getElementById('e-note').value = e.note || '';
  document.getElementById('fromShoppingInfo').style.display = 'none';
  setAccount(e.account || 'ich');
  updateTripSuggestions();
  openModal('expenseModal');
}
// Kategorie-Wechsel → Gruppe automatisch vorschlagen
document.getElementById('e-cat').addEventListener('change', function() {
  document.getElementById('e-group').value = getAnalysisGroup(this.value);
});
document.getElementById('saveExpBtn').addEventListener('click', () => {
  const amount = parseDE(document.getElementById('e-amount').value);
  const desc = document.getElementById('e-desc').value.trim();
  if (!amount || !desc) { alert('Bitte Betrag und Beschreibung eingeben.'); return; }
  const tripVal = document.getElementById('e-trip').value.trim();
  const entry = {
    id: editExpId || uid(), amount, desc,
    date: document.getElementById('e-date').value || today(),
    category: document.getElementById('e-cat').value,
    analysisGroup: document.getElementById('e-group').value || getAnalysisGroup(document.getElementById('e-cat').value),
    tripId: tripVal || null,
    account: currentAccount,
    paidBy: 'ich',
    note: document.getElementById('e-note').value.trim()
  };
  if (editExpId) expenses = expenses.map(e => e.id === editExpId ? entry : e);
  else expenses.push(entry);
  if(!save('vh_expenses', expenses))return;
  if (!editExpId) { rewardDragon('expense', {id:entry.id}); } // HOMEHUB DRAGON
  closeModal('expenseModal');
  renderKasse(); renderHome();
});
document.getElementById('deleteExpBtn').addEventListener('click', () => {
  if (!editExpId || !confirm('Ausgabe löschen?')) return;
  expenses = expenses.filter(e => e.id !== editExpId);
  save('vh_expenses', expenses);
  closeModal('expenseModal');
  renderKasse();
});
document.getElementById('cancelExpBtn').addEventListener('click', () => closeModal('expenseModal'));

// ════════════════════════════════════════════
