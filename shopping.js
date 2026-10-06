 'use strict';
let editShopIdx=null, editShopRef=null;
const shopKey=name=>String(name||'').normalize('NFC').trim().toLocaleLowerCase('de-DE').replace(/\s+/g,' ');
function shopSuggestions(){
 const map=new Map();
 Object.values(shopLists.history||{}).sort((a,b)=>String(b.lastBought||'').localeCompare(String(a.lastBought||''))).forEach(i=>map.set(shopKey(i.name),i));
 (shopLists.items||[]).filter(i=>i.checked).forEach(i=>{if(!map.has(shopKey(i.name)))map.set(shopKey(i.name),i)});
 Object.keys(priceMemory).forEach(name=>{if(!map.has(shopKey(name)))map.set(shopKey(name),{name,store:'supermarkt'})});
 return [...map.values()];
}
function updatePMHint(){
 const name=document.getElementById('si-name').value, pm=priceMemory[shopKey(name)];
 document.getElementById('pmHint').textContent=pm?`Früher notiert: ${fmtEurPlain(pm.last)} · Preis gilt für die angegebene Menge.`:'';
}
function shopPrefill(){
 updatePMHint();if(editShopRef)return;
 const match=shopSuggestions().find(i=>shopKey(i.name)===shopKey(document.getElementById('si-name').value));
 const values={'si-qty':match?.qty||'','si-price':match?(priceMemory[shopKey(match.name)]?.last||match.price||''):'','si-store':match?.store||'supermarkt'};
 for(const [id,value] of Object.entries(values)){
  const field=document.getElementById(id);
  if(!field.dataset.manual&&(!field.value||field.dataset.autofill||id==='si-store')){field.value=value;field.dataset.autofill='1';}
 }
}
for(const id of ['si-qty','si-price'])document.getElementById(id).addEventListener('input',e=>{e.target.dataset.manual='1';delete e.target.dataset.autofill;});
document.getElementById('si-name').addEventListener('input',shopPrefill);
document.getElementById('si-store').addEventListener('change',e=>e.target.dataset.manual='1');
function openAddShopItem(name=''){
 editShopIdx=null;editShopRef=null;
 document.getElementById('shopItemTitle').textContent='Artikel hinzufügen';
 for(const id of ['si-name','si-qty','si-price']){const field=document.getElementById(id);field.value='';delete field.dataset.manual;delete field.dataset.autofill;}
 document.getElementById('si-store').value='supermarkt';delete document.getElementById('si-store').dataset.manual;
 document.getElementById('shopNames').innerHTML=shopSuggestions().map(i=>`<option value="${esc(i.name)}"></option>`).join('');
 document.getElementById('si-name').value=typeof name==='string'?name:'';shopPrefill();openModal('shopItemModal');
}
function openEditShopItem(idx){
 const item=shopLists.items[idx];if(!item)return;editShopIdx=idx;editShopRef=item;
 document.getElementById('shopItemTitle').textContent='Artikel bearbeiten';
 for(const [id,key] of [['si-name','name'],['si-qty','qty'],['si-price','price'],['si-store','store']])document.getElementById(id).value=item[key]||'';
 updatePMHint();openModal('shopItemModal');
}
document.getElementById('saveShopBtn').addEventListener('click',()=>{
 const name=document.getElementById('si-name').value.trim(),price=parseDE(document.getElementById('si-price').value);
 if(!name){alert('Bitte Artikelname eingeben.');return;}
 if(!Number.isFinite(price)||price<0){alert('Bitte einen gültigen Preis eingeben.');return;}
 const items=shopLists.items||(shopLists.items=[]),store=document.getElementById('si-store').value;
 if(editShopRef && items[editShopIdx]!==editShopRef){alert('Die Liste wurde inzwischen geändert. Bitte den Artikel erneut öffnen.');return;}
 const duplicate=items.findIndex((i,idx)=>idx!==editShopIdx&&i.store===store&&shopKey(i.name)===shopKey(name));
 if(duplicate>=0){
  if(items[duplicate].checked&&!editShopRef){items[duplicate]={...items[duplicate],name,qty:document.getElementById('si-qty').value.trim(),store,price,checked:false};save('vh_shoplists',shopLists);closeModal('shopItemModal');refreshEinkaufView();return;}
  alert('Dieser Artikel steht bereits auf der Liste. Du kannst den vorhandenen Eintrag bearbeiten.');openEditShopItem(duplicate);return;
 }
 const item={...(editShopRef||{}),name,qty:document.getElementById('si-qty').value.trim(),store,price,checked:!!editShopRef?.checked};
 if(editShopRef)items[editShopIdx]=item;else items.push({...item,id:uid()});
 save('vh_shoplists',shopLists);closeModal('shopItemModal');refreshEinkaufView();
});
document.getElementById('cancelShopBtn').addEventListener('click',()=>closeModal('shopItemModal'));
function toggleShopItem(idx){if(!shopLists.items[idx])return;shopLists.items[idx].checked=!shopLists.items[idx].checked;save('vh_shoplists',shopLists);refreshEinkaufView();}
function removeShopItem(idx){shopLists.items.splice(idx,1);save('vh_shoplists',shopLists);refreshEinkaufView();}
function openBookShopping(){openStoreCheckout();}
document.getElementById('confirmBookBtn').addEventListener('click',()=>{closeModal('bookShoppingModal');openStoreCheckout();});
document.getElementById('cancelBookBtn').addEventListener('click',()=>closeModal('bookShoppingModal'));
document.addEventListener('click',e=>{
 const action=e.target.closest('[data-shop-action]');if(!action)return;
 if(action.dataset.shopAction==='checkout')openStoreCheckout();
 else if(action.dataset.shopAction==='add')openAddShopItem(document.getElementById('shopQuickName').value);
 else if(action.dataset.shopAction==='suggest')openAddShopItem(action.dataset.name);
});
document.addEventListener('keydown',e=>{if(e.target.id==='shopQuickName'&&e.key==='Enter'){e.preventDefault();openAddShopItem(e.target.value);}});

// BUDGETS MODAL

// ════════════════════════════════════════════
fillCatSelect('b-cat', 'lebensmittel');
function openBudgetModal(cat) {
  document.getElementById('b-cat').value = cat || 'lebensmittel';
  document.getElementById('b-amount').value = (budgets[activeHaushalt] || {})[cat] || '';
  openModal('budgetModal');
}
document.getElementById('saveBudgetBtn').addEventListener('click', () => {
  const cat = document.getElementById('b-cat').value;
  const amt = parseDE(document.getElementById('b-amount').value);
  if (!budgets[activeHaushalt]) budgets[activeHaushalt] = {};
  if (amt > 0) budgets[activeHaushalt][cat] = amt;
  else delete budgets[activeHaushalt][cat];
  save('vh_budgets', budgets);
  closeModal('budgetModal');
  renderKasseBudgets();
});
document.getElementById('cancelBudgetBtn').addEventListener('click', () => closeModal('budgetModal'));

// ════════════════════════════════════════════
