'use strict';
// CLOUD-SYNC (Cloudflare Worker)
// Speichert alle Daten automatisch online und holt sie auf jedem Gerät.
// ════════════════════════════════════════════
const hhSync = (function () {
  const APP = 'homehub';
  let timer = null, busy = false, checkpointBusy = false, retryTimer = null;
  const BACKUP_STATE_KEY = 'hh_online_backup';
  function backupState() {
    try { const x=JSON.parse(localStorage.getItem(BACKUP_STATE_KEY) || '{}'); return x.server===cfg().url ? x : {}; } catch (_) {return {};}
  }
  function updateBackupState(patch) { localStorage.setItem(BACKUP_STATE_KEY,JSON.stringify({...backupState(),...patch,server:cfg().url})); renderStatus(); }
  function dataSignature(data) {
    function stable(value) { if(Array.isArray(value))return value.map(stable); if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])); return value; }
    const normalized=prepareAppSnapshot(data);
    return JSON.stringify(stable(Object.fromEntries(Object.keys(HH_DATA_KEYS).map(k=>[k,normalized[k]]))));
  }
  function isBackedUp() {
    const b=backupState();
    return active() && !changedAt() && !b.error && !!b.verifiedAt && !!b.snapshotVerifiedAt && Date.now()-Date.parse(b.snapshotVerifiedAt)<36*60*60*1000;
  }
  function renderStatus() {
    const el=document.getElementById('onlineSaveStatus'); if(!el)return;
    const b=backupState(); let text,kind;
    if(!active()){text='Online-Sicherung nicht eingerichtet';kind='pending';}
    else if(navigator.onLine===false){text=changedAt()?'Offline: Änderungen warten auf Upload':'Offline: Daten auf diesem Gerät verfügbar';kind='pending';}
    else if(b.error){text=b.verifiedAt && !changedAt()?'Online gespeichert; Sicherungspunkt ausstehend':'Online-Sicherung prüfen';kind='error';}
    else if(changedAt()){text=busy?'Wird online gespeichert …':'Änderungen warten auf Online-Sicherung';kind='pending';}
    else if(isBackedUp()){text='Online gespeichert · Sicherungspunkt vorhanden';kind='ok';}
    else {text='Online-Sicherung wird geprüft';kind='pending';}
    el.textContent=text;el.dataset.state=kind;
  }
  function retryLater() {
    clearTimeout(retryTimer);
    if(active() && navigator.onLine!==false)retryTimer=setTimeout(()=>run(false),60000);
  }

  function cfg() {
    try { return JSON.parse(localStorage.getItem('vh_sync') || '{}') || {}; }
    catch (e) { return {}; }
  }
  function setCfg(url, token) {
    url=String(url || '').trim().replace(/\/+$/,'');
    if(url && !safeWebUrl(url))throw new Error('Bitte eine gültige HTTP- oder HTTPS-Serveradresse eingeben.');
    const previous=cfg();
    if(previous.url!==url || previous.token!==token){localStorage.removeItem('vh_sync_at');localStorage.removeItem(BACKUP_STATE_KEY);}
    localStorage.setItem('vh_sync', JSON.stringify({ url, token }));
    renderStatus();
    if (url && token) { setTimeout(() => run(true), 300); }
  }
  const active = () => { const c = cfg(); return !!(c.url && c.token); };

  const syncedAt  = () => localStorage.getItem('vh_sync_at') || '';
  const changedAt = () => localStorage.getItem('vh_sync_dirty') || '';

  function status(txt, col) {
    renderStatus();
    const el = document.getElementById('syncStatus');
    if (el) { el.textContent = txt; el.style.color = col || '#666'; }
  }
  function showStatus() {
    if (!active()) { status('Nicht eingerichtet — Adresse und Passwort eintragen.'); return; }
    const a = syncedAt();
    if (!a) { status('Eingerichtet, noch nicht abgeglichen.'); return; }
    const d = new Date(a), b=backupState();
    status('Zuletzt abgeglichen: ' + d.toLocaleString('de-DE') + (b.snapshotVerifiedAt ? ' · Sicherungspunkt geprüft: '+new Date(b.snapshotVerifiedAt).toLocaleString('de-DE') : ' · Sicherungspunkt noch nicht bestätigt'), isBackedUp()?'#166534':'#92400e');
  }

  // ---------- Daten einsammeln (gleiche Struktur wie das Backup) ----------
  function collect() { return JSON.parse(JSON.stringify(collectAppSnapshot())); }
  function hasLocalData() {
    return snapshotHasData(collect());
  }
  function apply(data) { return applyAppSnapshot(data); }

  // ---------- Netz ----------
  async function pull() {
    const c = cfg();
    let r;
    try {
      r = await fetch(c.url + '/load?app=' + APP, { headers: { 'X-Sync-Token': c.token } });
    } catch (e) {
      throw new Error('Server nicht erreichbar — Adresse prüfen oder offline?');
    }
    if (r.status === 401) throw new Error('Passwort stimmt nicht');
    if (!r.ok) throw new Error('Server antwortet mit ' + r.status);
    return await r.json();
  }
  async function push(force) {
    const c = cfg();
    const dirtyBefore=changedAt();
    const submitted=collect();
    // Schutz: nach einem Absturz nie versehentlich leere Daten hochladen
    if (!force && !hasLocalData() && localStorage.getItem('vh_sync_hadData') === '1') {
      status('Sicherheitsstopp: keine Daten auf dem Gerät — nichts hochgeladen.', '#991b1b');
      throw new Error('Sicherheitsstopp: lokale Daten sind leer');
    }
    let r;
    try {
      r = await fetch(c.url + '/save?app=' + APP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Token': c.token },
        body: JSON.stringify(submitted),
      });
    } catch (e) {
      throw new Error('Server nicht erreichbar — Adresse prüfen oder offline?');
    }
    if (r.status === 401) throw new Error('Passwort stimmt nicht');
    if (!r.ok) throw new Error('Server antwortet mit ' + r.status);
    const res = await r.json();
    if(!res.savedAt)throw new Error("Server bestätigt keinen Speicherzeitpunkt.");
    if (!Number.isFinite(Date.parse(res.savedAt))) throw new Error('Server bestätigt keinen gültigen Speicherzeitpunkt.');
    const stored = await pull();
    if (stored._savedAt !== res.savedAt || dataSignature(stored) !== dataSignature(submitted)) throw new Error('Der gespeicherte Online-Stand konnte nicht bestätigt werden. Bitte erneut abgleichen.');
    if (res.savedAt) {
      localStorage.setItem('vh_sync_at', res.savedAt);
      if(changedAt()===dirtyBefore)localStorage.removeItem('vh_sync_dirty');
      if (hasLocalData()) localStorage.setItem('vh_sync_hadData', '1');
    }
    updateBackupState({verifiedAt:new Date().toISOString(),error:''});
    await ensureDailySnapshot();
    return res;
  }

  // ---------- Sicherungspunkte ----------
  async function createSnapshot(name) {
    const c=cfg(), expected=collect();
    const r=await fetch(c.url+'/snapshot?app='+APP+'&name='+encodeURIComponent(name),{method:'POST',headers:{'X-Sync-Token':c.token}});
    if(!r.ok)throw new Error('Sicherungspunkt konnte nicht angelegt werden ('+r.status+').');
    const res=await r.json();
    if(res.name!==name)throw new Error('Server bestätigt den Sicherungspunkt nicht.');
    const verified=await verifySnapshot(name,expected);
    rewardDragon('backup',{id:'online:'+name});
    return verified;
  }
  async function verifySnapshot(name,expected) {
    const c=cfg();
    const r=await fetch(c.url+'/load?app='+APP+'&snap='+encodeURIComponent(name),{headers:{'X-Sync-Token':c.token}});
    if(!r.ok)throw new Error('Sicherungspunkt konnte nicht gelesen werden.');
    const data=await r.json();
    if(data.empty || !snapshotHasData(prepareAppSnapshot(data)))throw new Error('Sicherungspunkt enthält keinen gültigen Datenstand.');
    if(expected && dataSignature(data)!==dataSignature(expected))throw new Error('Sicherungspunkt stimmt nicht mit dem gespeicherten Stand überein.');
    updateBackupState({snapshotName:name,snapshotVerifiedAt:new Date().toISOString(),error:''});
    return name;
  }
  async function ensureDailySnapshot() {
    if(checkpointBusy || !active() || changedAt() || !hasLocalData())return;
    const day=todayLocal(), state=backupState();
    if(state.snapshotDay===day && state.snapshotVerifiedAt && !state.error)return;
    checkpointBusy=true;
    try {
      const list=await snapshots();
      const existing=list.filter(n=>typeof n==='string' && n.startsWith(day+'_')).sort().at(-1);
      if(existing)await verifySnapshot(existing);
      else {const d=new Date();await createSnapshot(day+'_'+_pad(d.getHours())+_pad(d.getMinutes()));}
      updateBackupState({snapshotDay:day,error:''});
    } catch(err) {
      updateBackupState({error:err.message});retryLater();
    } finally {checkpointBusy=false;renderStatus();}
  }
  async function makeSnapshot() {
    if(!await run(true))throw new Error('Abgleich nicht abgeschlossen.');
    if(changedAt())throw new Error('Bitte zuerst den Synchronisierungskonflikt lösen.');
    const d=new Date();
    return createSnapshot(todayLocal()+'_'+_pad(d.getHours())+_pad(d.getMinutes())+_pad(d.getSeconds()));
  }

  async function snapshots() {
    const c = cfg();
    let r;
    try { r = await fetch(c.url + '/snapshots?app=' + APP, { headers: { 'X-Sync-Token': c.token } }); }
    catch (e) { throw new Error('Server nicht erreichbar'); }
    if (r.status === 401) throw new Error('Passwort stimmt nicht');
    if (!r.ok) throw new Error('Server antwortet mit ' + r.status);
    const j = await r.json();
    return Array.isArray(j.snapshots) ? j.snapshots : [];
  }

  async function restore(name) {
    if(busy)throw new Error('Ein Abgleich läuft bereits. Bitte kurz warten.');
    busy=true;
    const before=changedAt();
    try {
    const c = cfg();
    let r;
    try { r = await fetch(c.url + '/load?app=' + APP + '&snap=' + encodeURIComponent(name), { headers: { 'X-Sync-Token': c.token } }); }
    catch (e) { throw new Error('Server nicht erreichbar'); }
    if (!r.ok) throw new Error('Server antwortet mit ' + r.status);
    const data = await r.json();
    if (!data || data.empty) throw new Error('Sicherungspunkt ist leer');
    prepareAppSnapshot(data);
    const current=await pull();
    if(before!==changedAt())throw new Error('Auf diesem Gerät wurden inzwischen Daten geändert. Bitte Wiederherstellung erneut starten.');
    if(current && !current.empty){prepareAppSnapshot(current);saveRecoverySnapshot(current,'hh_recovery_cloud');}
    apply(data);
    touch();
    await push();
    return true;
    } finally {busy=false;}
  }

  // ---------- Abgleich ----------
  async function run(manual) {
    if (!active()) {
      if (manual) status('Bitte zuerst Server-Adresse und Passwort eintragen und speichern.', '#991b1b');
      return;
    }
    if (busy) { if (manual) status('Läuft bereits …'); return; }
    busy = true;
    renderStatus();
    if (manual) status('Wird abgeglichen …');
    try {
      const cloud = await pull();
      const dirty = !!changedAt();

      if (cloud && cloud.empty) {
        if (hasLocalData()) { await push(); status('Daten hochgeladen ✓', '#166534'); }
        else status('Noch keine Daten vorhanden.');
      } else {
        if(!cloud || typeof cloud!=='object')throw new Error('Ungültiger Serverstand.');
        prepareAppSnapshot(cloud);
        const cloudAt = cloud._savedAt || '';
        if(!cloudAt)throw new Error('Serverstand ohne Änderungszeitpunkt. Bitte Server prüfen.');
        const cloudNewer = cloudAt && cloudAt > syncedAt();
        if (cloudNewer && (dirty || (!syncedAt() && hasLocalData()))) {
          if(!manual){status('Konflikt: Gerät und Server enthalten Daten. Bitte Jetzt abgleichen wählen.', '#991b1b');return;}
          saveRecoverySnapshot(cloud,'hh_recovery_cloud');
          const ok = confirm(
            'Auf dem Server liegt ein neuerer Stand (' + new Date(cloudAt).toLocaleString('de-DE') + '),\n' +
            'aber auf diesem Gerät gibt es ungespeicherte Änderungen.\n\n' +
            'OK = Server-Stand übernehmen (lokale Änderungen gehen verloren)\n' +
            'Abbrechen = lokalen Stand behalten (Upload separat bestätigen)' 
          );
          if (ok) { apply(cloud); localStorage.setItem('vh_sync_at', cloudAt); localStorage.removeItem('vh_sync_dirty'); if(cloud.dragon?.egg&&!cloud.dragon.companion)touch(); status('Server-Stand übernommen ✓', '#166534'); }
          else if(confirm('Lokalen Stand wirklich auf den Server übertragen? Der bisherige Serverstand wurde lokal gesichert.')) { await push(); status('Eigener Stand hochgeladen ✓', '#166534'); }
          else {status('Abgleich abgebrochen – beide Stände bleiben erhalten.');return false;}
        } else if (cloudNewer) {
          apply(cloud);
          if (hasLocalData()) localStorage.setItem('vh_sync_hadData', '1');
          localStorage.setItem('vh_sync_at', cloudAt);
          localStorage.removeItem('vh_sync_dirty');
          if(cloud.dragon?.egg&&!cloud.dragon.companion)touch();
          status('Neuer Stand geladen ✓', '#166534');
        } else if (dirty) {
          saveRecoverySnapshot(cloud,'hh_recovery_cloud');
          await push(); status('Änderungen hochgeladen ✓', '#166534');
        } else {
          if (manual) status('Alles aktuell ✓', '#166534');
        }
      }
      if(!changedAt() && hasLocalData()) { updateBackupState({verifiedAt:new Date().toISOString()}); await ensureDailySnapshot(); }
      return true;
    } catch (err) {
      updateBackupState({error:err.message}); retryLater();
      status('Fehler: ' + err.message, '#991b1b');
      console.warn('[Sync]', err);
      return false;
    }
    finally { busy = false; renderStatus(); if(changedAt()) retryLater(); }
  }

  // ---------- Änderung merken + zeitversetzt hochladen ----------
  function touch() {
    if(window.__hhApplying)return;
    localStorage.setItem('vh_sync_dirty', String(Date.now())+'-'+Math.random().toString(36).slice(2));
    renderStatus();
    if (!active()) return;
    clearTimeout(timer);
    timer = setTimeout(() => run(false), 4000);
  }

  return { cfg, setCfg, run, touch, showStatus, push, pull, apply, active, makeSnapshot, snapshots, restore, isBackedUp, renderStatus, backupState };
})();
window.hhSync = hhSync;
hhSync.renderStatus();
window.addEventListener('online',()=>hhSync.run(false));
window.addEventListener('offline',()=>hhSync.renderStatus());
document.getElementById('onlineSaveStatus')?.addEventListener('click',()=>document.getElementById('btnSettings').click());

// --- Bedienung zuerst verdrahten, damit sie garantiert aktiv ist ---
// Liste der Sicherungspunkte anzeigen
async function hhSnapList(force) {
  const box = document.getElementById('syncSnapList');
  if (!box) return;
  if (box.style.display === 'block' && !force) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = '<div style="font-size:12px;color:#666">Wird geladen …</div>';
  try {
    const list = await hhSync.snapshots();
    if (!list.length) { box.innerHTML = '<div style="font-size:12px;color:#999">Noch keine Sicherungspunkte vorhanden.</div>'; return; }
    box.innerHTML = '<div style="font-size:11.5px;color:#888;margin-bottom:6px">Zum Wiederherstellen antippen:</div>' +
      list.slice(0, 25).map(n =>
        '<button type="button" data-snaprestore="' + esc(n) + '" style="display:block;width:100%;text-align:left;margin-bottom:5px;padding:8px 10px;border:1px solid #e5e5ec;border-radius:8px;background:#fff;font-size:12.5px;cursor:pointer">↩️ ' + esc(n.replace('_', ' um ')) + '</button>'
      ).join('');
  } catch (err) {
    box.innerHTML = '<div style="font-size:12px;color:#991b1b">' + esc(err.message) + '</div>';
  }
}

document.addEventListener('click', (e) => {
  try {
    const t = e.target;
    if (!t || typeof t.closest !== 'function') return;

    if (t.closest('#syncNowBtn')) { hhSync.run(true); return; }

    if (t.closest('#syncSnapBtn')) {
      const el = document.getElementById('syncStatus');
      if (el) { el.textContent = 'Sicherungspunkt wird angelegt …'; el.style.color = '#666'; }
      hhSync.makeSnapshot()
        .then(name => { if (el) { el.textContent = 'Sicherungspunkt „' + name + '" angelegt ✓'; el.style.color = '#166534'; } hhSnapList(true); })
        .catch(err => { if (el) { el.textContent = 'Fehler: ' + err.message; el.style.color = '#991b1b'; } });
      return;
    }

    if (t.closest('#syncSnapListBtn')) { hhSnapList(false); return; }

    const rb = t.closest('[data-snaprestore]');
    if (rb) {
      const name = rb.dataset.snaprestore;
      if (!confirm('Stand vom Sicherungspunkt „' + name + '" wiederherstellen?\n\nDer aktuelle Stand auf diesem Gerät wird dabei ersetzt.')) return;
      const el = document.getElementById('syncStatus');
      if (el) { el.textContent = 'Wird wiederhergestellt …'; el.style.color = '#666'; }
      hhSync.restore(name)
        .then(() => { if (el) { el.textContent = 'Stand vom ' + name + ' wiederhergestellt ✓'; el.style.color = '#166534'; } })
        .catch(err => { if (el) { el.textContent = 'Fehler: ' + err.message; el.style.color = '#991b1b'; } });
      return;
    }
  } catch (err) { console.warn('[Sync] Klick:', err); }
});
document.addEventListener('visibilitychange', () => {
  try {
    if (document.hidden) {
      if (localStorage.getItem('vh_sync_dirty')) hhSync.run(false);
    } else {
      hhSync.run(false);
    }
  } catch (err) { console.warn('[Sync] Wechsel:', err); }
});
setTimeout(() => { try { hhSync.run(false); } catch (e) {} }, 1200);

// Änderungen werden explizit nach erfolgreichem Speichern gemeldet.
window.__hhReady=true;
if(window.__hhCompanionMigrationPending){window.__hhCompanionMigrationPending=false;hhSync.touch();}

setInterval(()=>{hhSync.renderStatus();if(!document.hidden)hhSync.run(false);},60*60*1000);
