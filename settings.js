'use strict';
// SETTINGS
// ════════════════════════════════════════════
document.getElementById('btnSettings').addEventListener('click', () => {
  document.getElementById('s-recipeimporturl').value=localStorage.getItem('vh_recipe_import_url')||'';
  document.getElementById('s-partnername').value = settings.partnerName || '';
  document.getElementById('s-splitpct').value = settings.splitPct || 50;
  try {
    const c = hhSync.cfg();
    document.getElementById('s-syncurl').value = c.url || '';
    document.getElementById('s-synctoken').value = c.token || '';
    hhSync.showStatus();
  } catch (e) {}
  openModal('settingsModal');
});
document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  const syncUrl=document.getElementById('s-syncurl').value.trim();
  const recipeEndpoint=document.getElementById('s-recipeimporturl').value.trim();
  if(recipeEndpoint && (!safeWebUrl(recipeEndpoint)||!recipeEndpoint.startsWith('https://'))){alert('Bitte eine gültige HTTPS-Adresse für den Rezept-Importdienst eingeben.');return;}
  if(syncUrl && !safeWebUrl(syncUrl)){alert('Bitte eine gültige HTTP- oder HTTPS-Serveradresse eingeben.');return;}
  if(recipeEndpoint)localStorage.setItem('vh_recipe_import_url',recipeEndpoint);else localStorage.removeItem('vh_recipe_import_url');
  settings.partnerName    = document.getElementById('s-partnername').value.trim() || 'Partner';
  settings.splitPct       = Math.min(99, Math.max(1, parseInt(document.getElementById('s-splitpct').value) || 50));
  save('vh_settings', settings);
  const _sp = document.getElementById('sharedPill'); if (_sp) _sp.textContent = '👫 ' + settings.partnerName;
  try {
    hhSync.setCfg(
      document.getElementById('s-syncurl').value.trim().replace(/\/+$/, ''),
      document.getElementById('s-synctoken').value.trim()
    );
  } catch (e) {alert('Synchronisierungseinstellungen konnten nicht gespeichert werden: '+e.message);return;}
  applyRecipeModuleState();
  closeModal('settingsModal');
  renderHome();
});
document.getElementById('cancelSettingsBtn').addEventListener('click', () => closeModal('settingsModal'));



// ════════════════════════════════════════════
