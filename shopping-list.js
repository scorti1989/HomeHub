'use strict';
// A continuing list: purchased items become reusable entries, never a completed trip.
var shoppingSearch='', shoppingStore='all', shoppingPurchasedOpen=false;
var shoppingUndo=null, shoppingNotice='';
var shoppingQuickDraftName='',shoppingQuickDraftStore='supermarkt';
const SHOPPING_STORES={supermarkt:'Supermarkt',drogerie:'Drogerie',baumarkt:'Baumarkt',sonstiges:'Sonstiges'};
function shoppingKey(name){return String(name || '').trim().replace(/\s+/g,' ').toLocaleLowerCase('de');}
function shoppingStoreOf(item){return Object.hasOwn(SHOPPING_STORES,item.store)?item.store:'sonstiges';}
function shoppingMatches(item){return (shoppingStore==='all' || shoppingStoreOf(item)===shoppingStore) && shoppingKey(item.name+' '+(item.qty || '')).includes(shoppingKey(shoppingSearch));}
function shoppingMessageHtml(){
  if(!shoppingNotice)return '';
  return '<div class="shopping-notice" role="status">'+esc(shoppingNotice)+(shoppingUndo?' <button type="button" class="shopping-btn" data-shopping-action="undo">Rückgängig</button>':'')+'</div>';
}
function shoppingChange(label,change){
  const before=JSON.stringify(shopLists.items || []);
  change();
  const after=JSON.stringify(shopLists.items || []);
  if(before!==after){shoppingUndo={before,after};save('vh_shoplists',shopLists);}
  shoppingNotice=label;
  refreshEinkaufView();
}
function undoShoppingChange(){
  if(!shoppingUndo)return;
  if(JSON.stringify(shopLists.items || [])!==shoppingUndo.after){
    shoppingUndo=null;shoppingNotice='Die Liste wurde inzwischen geändert. Bitte den Artikel direkt bearbeiten.';refreshEinkaufView();return;
  }
  shopLists.items=JSON.parse(shoppingUndo.before);
  shoppingUndo=null;shoppingNotice='Letzte Änderung rückgängig gemacht.';
  save('vh_shoplists',shopLists);refreshEinkaufView();
}
function addContinuousShoppingItem(item){
  const items=shopLists.items || (shopLists.items=[]), key=shoppingKey(item.name),store=shoppingStoreOf(item);
  const matches=items.filter(x=>shoppingKey(x.name)===key && shoppingStoreOf(x)===store);
  const open=matches.find(x=>!x.checked);
  if(open)return {item:open,status:'open'};
  const previous=matches.find(x=>x.checked);
  if(previous){
    previous.checked=false;
    if(item.qty)previous.qty=item.qty;
    if(item.price!==undefined && item.price!=='')previous.price=item.price;
    if(item.note)previous.note=item.note;
    return {item:previous,status:'reused'};
  }
  const created={...item,id:item.id || uid(),name:String(item.name).trim(),store,checked:false};
  items.push(created);return {item:created,status:'new'};
}
function quickAddShopping(){
  const input=document.getElementById('shoppingQuickName');
  const name=(input?.value || '').trim();if(!name){input?.focus();return;}
  const store=document.getElementById('shoppingQuickStore').value;
  shoppingQuickDraftName='';shoppingQuickDraftStore=store;
  let result;
  shoppingChange('Artikel hinzugefügt.',()=>{result=addContinuousShoppingItem({name,store,qty:'',price:''});});
  shoppingNotice=result.status==='open'?'„'+name+'“ steht bereits auf der offenen Liste.':result.status==='reused'?'„'+name+'“ steht wieder auf der Liste.':'„'+name+'“ hinzugefügt.';
  // Ensure the newly added item is visible even after a search/store filter.
  shoppingSearch='';if(shoppingStore!=='all')shoppingStore=store;
  refreshEinkaufView();
  document.getElementById('shoppingQuickName')?.focus();
}
function shoppingItemHtml(item,idx){
  const done=!!item.checked;
  return '<div class="shopping-row">'+
    '<button type="button" class="shopping-btn shopping-check" data-chk="'+idx+'" aria-label="'+esc(done?item.name+' wieder auf die Liste setzen':item.name+' als gekauft markieren')+'">'+(done?'Wieder kaufen':'✓')+'</button>'+
    '<button type="button" class="shopping-name" data-edit-shop="'+idx+'"><strong>'+esc(item.name)+'</strong>'+(item.qty?'<span>'+esc(item.qty)+'</span>':'')+'</button>'+
    '<button type="button" class="shopping-btn shopping-pin" data-shopping-action="pin" data-shopping-index="'+idx+'" aria-pressed="'+!!item.pinned+'" aria-label="'+esc(item.name+(item.pinned?' nicht mehr merken':' zum schnellen Wiederkaufen merken'))+'">'+(item.pinned?'Gemerkt':'Merken')+'</button>'+
    '<button type="button" class="shopping-btn" data-rm="'+idx+'" aria-label="'+esc(item.name+' dauerhaft entfernen')+'">×</button></div>';
}
function shoppingRowsHtml(){
  const all=(shopLists.items || []).map((item,idx)=>({item,idx}));
  const open=all.filter(x=>!x.item.checked && shoppingMatches(x.item));
  const done=all.filter(x=>x.item.checked && shoppingMatches(x.item)).sort((a,b)=>Number(!!b.item.pinned)-Number(!!a.item.pinned)||String(b.item.lastPurchasedAt || '').localeCompare(String(a.item.lastPurchasedAt || ''))||a.item.name.localeCompare(b.item.name,'de'));
  let h=shoppingMessageHtml();
  const repeat=done.filter(x=>x.item.pinned).slice(0,8);
  if(repeat.length)h+='<div class="shopping-repeat"><strong>Schnell wieder auf die Liste</strong><div>'+repeat.map(x=>'<button type="button" class="shopping-btn" data-chk="'+x.idx+'">+ '+esc(x.item.name)+'</button>').join('')+'</div></div>';
  h+='<h3 style="font-size:15px;margin:16px 0 8px">Noch besorgen · '+open.length+'</h3>';
  for(const [store,label] of Object.entries(SHOPPING_STORES)){
    const rows=open.filter(x=>shoppingStoreOf(x.item)===store);if(!rows.length)continue;
    h+='<section><h4 class="shopping-store-title">'+label+' · '+rows.length+'</h4>'+rows.map(x=>shoppingItemHtml(x.item,x.idx)).join('')+'</section>';
  }
  if(!open.length)h+='<p class="shopping-hint">'+(shoppingSearch || shoppingStore!=='all'?'Keine offenen Artikel für diesen Filter.':'Aktuell nichts zu besorgen. Ergänze etwas oder setze einen gekauften Artikel wieder auf die Liste.')+'</p>';
  h+='<details id="shoppingPurchased" '+(shoppingPurchasedOpen || shoppingSearch?'open':'')+'><summary>Schon gekauft · '+done.length+' — wieder auf die Liste setzen</summary><p class="shopping-hint">Diese Artikel bleiben hier, bis du sie wieder brauchst. „Merken“ macht häufig benötigte Artikel schnell erreichbar.</p>'+
    (done.length?done.map(x=>shoppingItemHtml(x.item,x.idx)).join(''):'<p class="shopping-hint">'+(shoppingSearch?'Keine passenden gekauften Artikel.':'Hier erscheinen deine abgehakten Artikel.')+'</p>')+'</details>';
  return h;
}
function updateShoppingRows(){
  const el=document.getElementById('shoppingRows');if(!el)return;
  el.innerHTML=shoppingRowsHtml();
  const details=document.getElementById('shoppingPurchased');
  if(details)details.addEventListener('toggle',()=>{if(!shoppingSearch)shoppingPurchasedOpen=details.open;});
}
function renderContinuousShopping(){
  const total=(shopLists.items || []).filter(x=>!x.checked).length;
  document.getElementById('kasseContent').innerHTML='<div class="shopping-continuous">'+
    '<p class="shopping-hint">Deine dauerhafte Liste · '+total+' offen insgesamt</p>'+
    '<form id="shoppingQuickForm" class="shopping-quick"><label for="shoppingQuickName">Was brauchst du?</label><input id="shoppingQuickName" autocomplete="off" maxlength="160" placeholder="Artikel eingeben …">'+
    '<div><label class="shopping-sr" for="shoppingQuickStore">Laden für neuen Artikel</label><select id="shoppingQuickStore">'+Object.entries(SHOPPING_STORES).map(([k,v])=>'<option value="'+k+'" '+(k===(shoppingStore==='all'?'supermarkt':shoppingStore)?'selected':'')+'>'+v+'</option>').join('')+'</select><button type="submit" class="shopping-btn">Hinzufügen</button><button type="button" class="shopping-btn" data-shopping-action="details">Mit Menge …</button></div></form>'+
    '<div class="shopping-filters"><label for="shoppingSearch">Artikel suchen – auch bereits gekaufte</label><input id="shoppingSearch" type="search" value="'+esc(shoppingSearch)+'" placeholder="Name oder Menge"><label class="shopping-sr" for="shoppingFilter">Liste nach Laden filtern</label><select id="shoppingFilter"><option value="all">Alle Läden</option>'+Object.entries(SHOPPING_STORES).map(([k,v])=>'<option value="'+k+'" '+(k===shoppingStore?'selected':'')+'>'+v+'</option>').join('')+'</select><button type="button" class="shopping-btn" data-shopping-action="reset">Filter zurücksetzen</button></div><div id="shoppingRows"></div></div>';
  updateShoppingRows();
  document.getElementById('shoppingQuickName').value=shoppingQuickDraftName;
  document.getElementById('shoppingQuickStore').value=shoppingQuickDraftStore;
}
document.addEventListener('submit',e=>{if(e.target.id==='shoppingQuickForm'){e.preventDefault();quickAddShopping();}});
document.addEventListener('input',e=>{if(e.target.id==='shoppingQuickName')shoppingQuickDraftName=e.target.value;if(e.target.id==='shoppingSearch'){shoppingSearch=e.target.value;updateShoppingRows();}});
document.addEventListener('change',e=>{if(e.target.id==='shoppingQuickStore')shoppingQuickDraftStore=e.target.value;if(e.target.id==='shoppingFilter'){shoppingStore=e.target.value;const select=document.getElementById('shoppingQuickStore');if(select && shoppingStore!=='all'){select.value=shoppingStore;shoppingQuickDraftStore=shoppingStore;}updateShoppingRows();}});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-shopping-action]');if(!b)return;
  if(b.dataset.shoppingAction==='undo')undoShoppingChange();
  if(b.dataset.shoppingAction==='reset'){shoppingSearch='';shoppingStore='all';refreshEinkaufView();}
  if(b.dataset.shoppingAction==='details'){
    const name=document.getElementById('shoppingQuickName')?.value || '',store=document.getElementById('shoppingQuickStore')?.value || 'supermarkt';
    openAddShopItem();document.getElementById('si-name').value=name;document.getElementById('si-store').value=store;document.getElementById('si-qty').focus();
  }
  if(b.dataset.shoppingAction==='pin'){
    const item=shopLists.items[Number(b.dataset.shoppingIndex)];if(!item)return;
    shoppingChange(item.pinned?'Artikel nicht mehr gemerkt.':'Artikel zum Wiederkaufen gemerkt.',()=>{item.pinned=!item.pinned;});
  }
});
