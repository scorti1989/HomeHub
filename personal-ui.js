'use strict';
var uxQuickDraft=null,uxQuickAccount='wir',uxExpenseFeedback='';
function captureQuickExpense(){
  const amt=document.getElementById('q-amt'),desc=document.getElementById('q-desc');
  if(!amt || !desc)return;
  uxQuickDraft=amt.value || desc.value ? {amount:amt.value,desc:desc.value,category:document.getElementById('q-cat')?.value,account:uxQuickAccount}:null;
}
function restoreQuickExpense(){
  if(!uxQuickDraft)return;
  document.getElementById('q-amt').value=uxQuickDraft.amount;
  document.getElementById('q-desc').value=uxQuickDraft.desc;
  document.getElementById('q-cat').value=uxQuickDraft.category;
}
function personalHomeActions(){
  const open=(shopLists.items || []).filter(i=>!i.checked).length;
  const p=typeof dragon==='object'?dragon:{};
  const care=p.krank?'krank':Math.min(p.hunger ?? 100,p.sauberkeit ?? 100,p.power ?? 100)<30?'braucht Pflege':(p.xp || 0)+' XP';
  return '<nav class="personal-actions" aria-label="Deine Schnellzugriffe">'+[
    ['expense','Ausgabe','Schnell erfassen'],['einkauf','Einkauf',open+' offen'],['budgets','Budgets','Gemeinsamer Haushalt'],
    ['tickets','Konzerte','Termine und Tickets'],['recipes','Rezepte','Sammlung und Import'],['egg','Mein Ei',care]
  ].map(([action,title,sub])=>'<button type="button" data-uxgo="'+action+'"><strong>'+title+'</strong><span>'+esc(sub)+'</span></button>').join('')+'</nav>';
}
function personalUpcomingCard(){
  const next=typeof upcomingConcerts==='function'?upcomingConcerts()[0]:null;
  if(!next)return '';
  return '<div class="card"><div class="hm-card-head"><span class="card-label">Nächstes Konzert</span><button class="hm-link-btn" data-uxgo="tickets">Alle Termine</button></div><button class="personal-concert" data-uxgo="tickets"><strong>'+esc(next.artist || 'Konzert')+'</strong><span>'+esc(fmtDate(next.date))+(next.city?' · '+esc(next.city):'')+'</span></button></div>';
}
function updatePersonalNavigation(){
  const shopping=activePage==='kasse' && activeKasseTab==='mehr' && mehrView==='einkauf';
  document.querySelectorAll('.nav-btn').forEach(b=>{
    const target=b.dataset.uxgo;
    const selected=target ? (target==='einkauf'?shopping:target==='household'?activePage==='kasse'&&!shopping:target==='more'?['contracts','meters','analysis'].includes(activePage):false):b.dataset.page===activePage;
    b.classList.toggle('active',selected);if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  const household=document.querySelector('#page-kasse > .hh-toggle');if(household)household.style.display=shopping?'none':'';
  const tabs=document.getElementById('kasseTabs');if(tabs)tabs.style.display=shopping?'none':'';
  const hint=document.getElementById('kasseModeHint');if(shopping&&hint)hint.style.display='none';
  const fab=document.getElementById('fabBtn');
  const label=shopping?'Artikel hinzufügen':({home:'Ausgabe erfassen',kasse:activeKasseTab==='budgets'?'Budget bearbeiten':'Ausgabe erfassen',contracts:'Vertrag hinzufügen',meters:'Zähler verwalten',recipes:'Rezept hinzufügen',tickets:'Konzert hinzufügen'}[activePage] || 'Hinzufügen');
  if(fab){fab.setAttribute('aria-label',label);fab.setAttribute('title',label);}
}
function openPersonalArea(target){
  closeModal('personalMoreModal');
  if(target==='more'){openModal('personalMoreModal');return;}
  if(target==='household'){goKasseTab('uebersicht');return;}
  if(['einkauf','budgets','ausgaben','ausgleich','recurring'].includes(target)){goKasseTab(target);return;}
  if(target==='expense'){showPage('home');document.getElementById('q-amt')?.focus();document.getElementById('q-amt')?.scrollIntoView({block:'center'});return;}
  if(target==='egg'){showPage('home');const card=document.getElementById('dragonCard');card?.scrollIntoView({block:'start'});return;}
  if(target==='settings'){document.getElementById('btnSettings').click();return;}
  if(target==='backup'){document.getElementById('btnExport').click();return;}
  if(target==='reading'){showPage('meters');openReadingModal();return;}
  if(['home','tickets','recipes','contracts','meters','analysis'].includes(target))showPage(target);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-uxgo]');if(b)openPersonalArea(b.dataset.uxgo);});
