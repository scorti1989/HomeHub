'use strict';
// EXPORT / IMPORT
// ════════════════════════════════════════════
document.getElementById('btnExport').addEventListener('click', () => {
  // recipes, weekPlan und dragon vollständig exportieren
  const data = collectAppSnapshot();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `homehub-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  resetBackupCounter();
});
document.getElementById('btnImport').addEventListener('click', () => {
  document.getElementById('importStatus').style.display = 'none';
  document.getElementById('importFile').value = '';
  openModal('importModal');
});
document.getElementById('pickImportBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const st = document.getElementById('importStatus');

  if (!file.name.endsWith('.json')) {
    st.className = 'alert-box ab-red'; st.style.display = 'block';
    st.textContent = '❌ Bitte eine .json-Datei auswählen (HomeHub-Backup).';
    return;
  }

  const reader = new FileReader();
  reader.onload = function (ev) {
    // Fix Bug 4: Alle Prüfungen BEVOR ein einziger State überschrieben wird.
    try {
      let data;
      try { data = JSON.parse(ev.target.result); }
      catch { throw new Error('Die Datei enthält kein gültiges JSON.'); }

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Ungültige Struktur – kein HomeHub-Backup erkannt.');
      }

      applyAppSnapshot(data);
      onAppDataSaved('vh_recipes');
      st.className = 'alert-box ab-green'; st.style.display = 'block';
      st.textContent = `✅ Import erfolgreich: ${contracts.length} Verträge, ${meters.length} Zähler, ${expenses.length} Ausgaben.`;

      if (meters.length) activeMeterType = meters[0].type;
      renderAmpel();
      renderHome();
      renderContracts();
      if (activePage === 'kasse') renderKasse();
      if (activePage === 'meters') renderMeters();
      if (activePage === 'analysis') renderAnalysis();
      if (activePage === 'tickets') renderTickets();
      if (activePage === 'recipes') renderRecipes();

    } catch (err) {
      // Fix Bug 4: Bei Fehler NICHTS überschreiben – Fehlermeldung anzeigen
      st.className = 'alert-box ab-red'; st.style.display = 'block';
      st.textContent = '❌ Import abgebrochen: ' + err.message + ' Falls eine Übernahme begonnen hatte, liegt der vorherige Stand unter Einstellungen → Sicherung vor.';
    }
  };
  reader.readAsText(file);
});
document.getElementById('cancelImportBtn').addEventListener('click', () => closeModal('importModal'));

// ════════════════════════════════════════════
// ════════════════════════════════════════════
// BACKUP-ERINNERUNG
// ════════════════════════════════════════════
const BACKUP_KEY = 'hh_backup_counter';
// Bestehende Aufrufer dürfen den Zähler weiterhin aktualisieren; keine Export-Erinnerung.
function backupCount(){return parseInt(localStorage.getItem(BACKUP_KEY)||'0',10);}
function resetBackupCounter(){localStorage.setItem(BACKUP_KEY,'0');}
function incrementBackupCounter(n){localStorage.setItem(BACKUP_KEY,String(backupCount()+(n||1)));if(window.hhSync)hhSync.renderStatus();}
