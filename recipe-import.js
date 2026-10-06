'use strict';
// Extract only published recipe data. Page scripts are never executed.
const RECIPE_IMPORT_MAX_BYTES=4*1024*1024;
function recipeImportText(value){
 if(value==null)return '';
 const doc=new DOMParser().parseFromString(String(value),'text/html');
 doc.querySelectorAll('script,style,noscript,iframe').forEach(n=>n.remove());
 doc.querySelectorAll('br').forEach(n=>n.replaceWith('\n'));
 doc.querySelectorAll('p,li,div,h1,h2,h3,h4').forEach(n=>n.append('\n'));
 return (doc.body.textContent||'').replace(/\u00a0/g,' ').split(/\r?\n/).map(x=>x.replace(/[ \t]+/g,' ').trim()).filter(Boolean).join('\n');
}
function recipeImportUrl(value,base){
 try{const u=new URL(String(value||''),base);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch(_){return '';}
}
function recipePublicUrl(value){
 const text=String(value||'').trim();const url=recipeImportUrl(/^www\./i.test(text)?'https://'+text:text);
 if(!url)throw new Error('Bitte eine vollständige HTTP- oder HTTPS-Adresse eingeben.');
 const u=new URL(url),host=u.hostname.toLowerCase();
 if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.startsWith('[')||/^\d+(?:\.\d+){3}$/.test(host)||!host.includes('.'))throw new Error('Bitte die öffentliche Adresse einer Rezeptseite eingeben.');
 u.hash='';return u.href;
}
function recipeImportMinutes(value){
 if(typeof value==='number')return value>0?Math.round(value):null;
 const v=String(value||'').trim();
 const iso=v.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
 if(iso){const n=Number(iso[1]||0)*1440+Number(iso[2]||0)*60+Number(iso[3]||0)+Number(iso[4]||0)/60;return n>0?Math.ceil(n):null;}
 const h=v.match(/(\d+(?:[.,]\d+)?)\s*(?:stunden?|hours?|hrs?|h)\b/i),m=v.match(/(\d+(?:[.,]\d+)?)\s*(?:minuten?|minutes?|mins?|min)\b/i);
 if(h||m)return Math.round(Number((h?.[1]||'0').replace(',','.'))*60+Number((m?.[1]||'0').replace(',','.')));
 return /^\d+$/.test(v)&&Number(v)>0?Number(v):null;
}
function recipeImportServings(value){
 for(const x of [].concat(value||[])){
  const text=recipeImportText(typeof x==='object'?x.value||x.name||'':x);
  const m=text.match(/(\d+)\s*(?:portion|serving|person|stück|pieces|yield)/i)||text.match(/^\s*(\d+)(?:\s|$)/);
  if(m&&Number(m[1])>0)return Number(m[1]);
 }return null;
}
function recipeSchemaNodes(raw){
 const nodes=[],seen=new Set();let count=0;
 function walk(x,depth){if(!x||typeof x!=='object'||seen.has(x)||depth>40||count++>20000)return;seen.add(x);if(!Array.isArray(x))nodes.push(x);for(const v of Object.values(x))walk(v,depth+1);}
 walk(raw,0);return nodes;
}
function recipeSchemaLines(value,refs=new Map(),seen=new Set(),depth=0){
 if(depth>30||value==null)return [];
 if(Array.isArray(value))return value.flatMap(x=>recipeSchemaLines(x,refs,new Set(seen),depth+1));
 if(typeof value!=='object')return recipeImportText(value).split('\n').filter(Boolean);
 if(seen.has(value))return [];seen.add(value);
 if(value['@id']&&Object.keys(value).length===1){const ref=refs.get(value['@id']);return ref?recipeSchemaLines(ref,refs,seen,depth+1):[];}
 if(value.itemListElement||value.steps)return recipeSchemaLines(value.itemListElement||value.steps,refs,seen,depth+1);
 if(value.item)return recipeSchemaLines(value.item,refs,seen,depth+1);
 if('value' in value||'amount' in value){
  const units={KGM:'kg',GRM:'g',MLT:'ml',LTR:'l',C62:''};const unit=value.unitText||value.unit||units[value.unitCode]||'';
  return [recipeImportText([value.amount??value.value,unit,value.name].filter(x=>x!==undefined&&x!==null&&x!=='').join(' '))].filter(Boolean);
 }
 return recipeSchemaLines(value.text||value.name||'',refs,seen,depth+1);
}
function recipeFromSchema(schema,url,doc,refs=new Map()){
 const meta=key=>doc?.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.getAttribute('content')||'';
 let image=[].concat(schema.image||schema.imageUrl||[])[0];if(image&&typeof image==='object')image=image.url||image.contentUrl||image['@id'];
 const base=recipeImportUrl(doc?.querySelector('link[rel="canonical"]')?.getAttribute('href'),url)||url;
 const prep=recipeImportMinutes(schema.prepTime),cook=recipeImportMinutes(schema.cookTime);
 const ingredients=recipeSchemaLines(schema.recipeIngredient||schema.ingredients,refs).join('\n');
 const steps=recipeSchemaLines(schema.recipeInstructions||schema.steps,refs).join('\n');
 return {title:recipeImportText(schema.name||schema.title||meta('og:title')||recipeNodeValue(doc?.querySelector('h1,title'))),ingredients,steps,
  servings:recipeImportServings(schema.recipeYield||schema.servings),time:recipeImportMinutes(schema.totalTime||schema.time)||(prep||cook?(prep||0)+(cook||0):null),
  imageUrl:recipeImportUrl(image||meta('og:image'),base),note:recipeImportText(schema.description||schema.note||meta('og:description')),
  tags:autoTagsFromSchema(schema),sourceUrl:url,fromUrl:true,partial:!(ingredients&&steps),method:'Rezeptdaten',_recipeUrl:recipeImportUrl(schema.url||schema.mainEntityOfPage?.['@id']||schema['@id'],base)};
}
function recipeNodeValue(node){return node?.getAttribute('content')||node?.getAttribute('datetime')||node?.getAttribute('src')||recipeImportText(node?.innerHTML||'');}
function recipeDOMResult(root,url,doc,mode){
 const first=(selector)=>recipeNodeValue(root.querySelector(selector));
 const lines=selector=>[...root.querySelectorAll(selector)].filter(n=>!n.closest('nav,aside,footer')).map(recipeNodeValue).filter(Boolean).join('\n');
 const schema={name:first('[itemprop="name"],.wprm-recipe-name,.tasty-recipes-title,.recipe-title,h1,h2'),
  recipeIngredient:lines('[itemprop="recipeIngredient"],[itemprop="ingredients"],.wprm-recipe-ingredient,.tasty-recipes-ingredients li,.recipe-ingredients li,.ingredients li'),
  recipeInstructions:lines('[itemprop="recipeInstructions"],.wprm-recipe-instruction-text,.tasty-recipes-instructions li,.recipe-instructions li,.instructions li'),
  recipeYield:first('[itemprop="recipeYield"],.wprm-recipe-servings-container,.tasty-recipes-yield,.recipe-servings'),
  totalTime:first('[itemprop="totalTime"],.wprm-recipe-total-time-container,.tasty-recipes-total-time'),
  prepTime:first('[itemprop="prepTime"]'),cookTime:first('[itemprop="cookTime"]'),image:first('[itemprop="image"],.wprm-recipe-image img,.tasty-recipes-image img'),description:first('[itemprop="description"],.wprm-recipe-summary')};
 const result=recipeFromSchema(schema,url,doc);result.method=mode;return result;
}
function recipeHeadingSection(root,pattern){
 const heading=[...root.querySelectorAll('h2,h3,h4,strong')].find(n=>pattern.test(recipeImportText(n.textContent)));
 if(!heading)return {text:'',heading:''};
 const pieces=[];let n=heading.nextElementSibling,limit=0;
 if(!n&&heading.parentElement&&heading.parentElement!==root)n=heading.parentElement.nextElementSibling;
 while(n&&limit++<40){if(/^H[1-4]$/.test(n.tagName)||/^(zubereitung|anleitung|zutaten|ingredients|instructions|directions|nährwerte|nutrition|kommentare|comments)\b/i.test(recipeImportText(n.textContent).split('\n')[0]))break;
  const copy=n.cloneNode(true);copy.querySelectorAll('script,style,nav,aside,form,button').forEach(el=>el.remove());pieces.push(recipeImportText(copy.innerHTML));n=n.nextElementSibling;
 }
 return {text:pieces.filter(Boolean).join('\n'),heading:recipeImportText(heading.textContent)};
}
function extractRecipeFromHTML(html,url){
 if(typeof html!=='string'||!html.trim())throw new Error('Die Seite liefert keinen lesbaren Inhalt.');
 if(html.length>RECIPE_IMPORT_MAX_BYTES)throw new Error('Die Rezeptseite ist zu groß zum Einlesen.');
 const doc=new DOMParser().parseFromString(html,'text/html'),candidates=[],nodes=[];
 for(const script of doc.querySelectorAll('script')){
  if(!/^(application\/(ld\+json|json))\s*(;.*)?$/i.test(script.type)&&!['__NEXT_DATA__','__NUXT_DATA__'].includes(script.id))continue;
  let text=script.textContent.trim().replace(/^\uFEFF/,'').replace(/^<!--|-->$/g,'').replace(/;\s*$/,'');
  for(const source of [text,recipeImportText(text)]){try{nodes.push(...recipeSchemaNodes(JSON.parse(source)));break;}catch(_){}}
 }
 const refs=new Map(nodes.filter(n=>n['@id']).map(n=>[n['@id'],n]));
 for(const n of nodes){const types=[].concat(n['@type']||[]);if(types.some(t=>/(^|[/#:])Recipe$/i.test(String(t)))||(n.recipeIngredient&&n.recipeInstructions))candidates.push(recipeFromSchema(n,url,doc,refs));}
 for(const root of doc.querySelectorAll('[itemscope][itemtype*="Recipe"],.wprm-recipe-container,.tasty-recipes,.recipe-card')){
  const r=recipeDOMResult(root,url,doc,'Rezeptkarte');if(r.ingredients||r.steps)candidates.push(r);
 }
 // Semantic properties without an explicit Recipe root.
 if(!candidates.some(r=>r.ingredients&&r.steps)&&doc.querySelector('[itemprop="recipeIngredient"],[itemprop="recipeInstructions"]'))candidates.push(recipeDOMResult(doc.querySelector('main,article')||doc.body,url,doc,'Seitenangaben'));
 if(!candidates.some(r=>r.ingredients&&r.steps)){
  const root=doc.querySelector('article,main')||doc.body,ing=recipeHeadingSection(root,/^(zutaten|ingredients)(\s|:|$)/i),steps=recipeHeadingSection(root,/^(zubereitung|anleitung|zubereitungsschritte|instructions|directions|preparation)(\s|:|$)/i);
  if(ing.text||steps.text){const r=recipeFromSchema({name:recipeNodeValue(root.querySelector('h1')),recipeIngredient:ing.text,recipeInstructions:steps.text,recipeYield:ing.heading.replace(/^zutaten\s*(?:für)?\s*/i,'')},url,doc);r.method='Sichtbarer Rezepttext';candidates.push(r);}
 }
 const meaningful=candidates.filter(r=>r.title&&(r.ingredients||r.steps));
 const path=recipeImportUrl(url);const score=r=>(r.ingredients?40:0)+(r.steps?40:0)+(r.servings?3:0)+(r.time?2:0)+(r._recipeUrl&&r._recipeUrl.split('#')[0]===path?.split('#')[0]?100:0)+(r.method==='Rezeptdaten'?5:0);
 meaningful.sort((a,b)=>score(b)-score(a));
 if(meaningful.length){
  const unique=meaningful.filter((r,i,a)=>a.findIndex(x=>x.title===r.title&&x.ingredients===r.ingredients&&x.steps===r.steps)===i);
  const best=unique[0];return {...best,alternatives:unique.slice(0,12),missing:['ingredients','steps','servings'].filter(k=>!best[k])};
 }
 const title=recipeNodeValue(doc.querySelector('title'));
 if(doc.querySelector('#challenge-form,#cf-challenge-running,[id*="captcha"]')||/just a moment|access denied|zugriff verweigert|verify you are human|security check|checking your browser/i.test(title))throw new Error('Die Seite blockiert den automatischen Zugriff.');
 throw new Error('Auf dieser Seite wurden keine Zutaten oder Zubereitungsschritte gefunden.');
}
function cancelRecipeImport(){if(window.recipeImportController)window.recipeImportController.abort();window.recipeImportController=null;}
async function fetchRecipeFromUrl(input,options={}){
 const url=recipePublicUrl(input),signal=options.signal;let best=null;const failures=[];
 const endpoint=localStorage.getItem('vh_recipe_import_url')||'';
 const sources=[];
 if(endpoint)sources.push({url:endpoint+(endpoint.includes('?')?'&':'?')+'url='+encodeURIComponent(url),mode:'server',label:'Import-Server',ms:11000});
 sources.push({url,mode:'text',label:'Rezeptseite',ms:5000},
  {url:'https://api.allorigins.win/get?url='+encodeURIComponent(url),mode:'json',label:'Alternativer Abruf 1',ms:8500},
  {url:'https://api.allorigins.win/raw?url='+encodeURIComponent(url),mode:'text',label:'Alternativer HTML-Abruf',ms:8500});
 for(const source of sources){
  if(signal?.aborted)throw new DOMException('Import abgebrochen','AbortError');
  options.onProgress?.(source.label+' wird geprüft …');
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,source.ms);
  try{
   const resp=await fetch(source.url,{signal:controller.signal,credentials:'omit',redirect:'follow',cache:'no-store'});
   if(!resp.ok)throw new Error([401,403,429].includes(resp.status)?'Zugriff blockiert oder vorübergehend begrenzt':`Seite antwortet mit HTTP ${resp.status}`);
   let page,base=url;
   if(source.mode==='json'||source.mode==='server'){
    const data=await resp.json();page=data.html??data.contents;
    if(data.error)throw new Error(data.error);
    if(data.url)base=recipeImportUrl(data.url,url)||url;
    if(data.status?.http_code>=400)throw new Error('Die Rezeptseite ist nicht erreichbar oder blockiert den Zugriff.');
   }else{page=await resp.text();if(source.mode==='text'&&source.url===url)base=recipeImportUrl(resp.url,url)||url;}
   const result=extractRecipeFromHTML(page,base);
   if(!best||(result.ingredients?1:0)+(result.steps?1:0)>(best.ingredients?1:0)+(best.steps?1:0))best=result;
   if(!result.partial)return result;
  }catch(err){if(signal?.aborted)throw new DOMException('Import abgebrochen','AbortError');failures.push(err.name==='AbortError'?'Zeitüberschreitung':err.message||'Netzwerkfehler');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 if(best)return best;
 const blocked=failures.some(x=>/blockiert|begrenzt/i.test(x));
 throw new Error(blocked?'Die Seite blockiert den automatischen Zugriff. Öffne das Rezept und füge den kopierten Rezepttext unten ein.':'Das Rezept konnte nicht geladen werden. Prüfe die Adresse und Verbindung oder füge den Rezepttext unten ein.');
}
