/* SASSI DEL VALLE · Premium Experience V1 (isolated, progressive enhancement) */
(function(){
'use strict';
const EDITION='SASSI_PREMIUM_EXPERIENCE_V1';
const FAV_KEY='sassi-premium-favs-v1';
const COMPARE_MAX=3;
const $=id=>document.getElementById(id);
const validId=s=>/^SV-\d{3}$/.test(String(s||''));
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabel=s=>({DISPONIBLE:'Disponible',APARTADO:'Apartado',VENDIDO:'Vendido',SIN_DEFINIR:'Sin definir'}[s]||'Sin definir');
const money=n=>Number.isFinite(n)&&n>0?new Intl.NumberFormat('es-MX',{style:'currency',currency:'USD',currencyDisplay:'code',maximumFractionDigits:0}).format(n):'Consultar';
const store={favorites:new Set(),compare:[],mode:'all',shownId:''};
try{const arr=JSON.parse(localStorage.getItem(FAV_KEY)||'[]');if(Array.isArray(arr))arr.filter(validId).forEach(id=>store.favorites.add(id));}catch(e){}
function saveFavs(){try{localStorage.setItem(FAV_KEY,JSON.stringify([...store.favorites]));}catch(e){toast('El navegador no permite guardar favoritos.');}}
function catalog(){
 try{
  const f=typeof FEATURES!=='undefined'&&Array.isArray(FEATURES)?FEATURES:[];
  return f.filter(x=>validId(x?.properties?.lote_id)).map(x=>{
   const p=x.properties,id=p.lote_id;
   let state='SIN_DEFINIR';try{state=typeof getLotStatus==='function'?getLotStatus(id):state;}catch(e){}
   let price=null;try{if(typeof sassiValorApsById!=='undefined')price=sassiValorApsById.get(id);}catch(e){}
   return {id,status:state,area:Number(p.m2)||0,barrio:String(p.barrio||'Sin barrio'),price:Number.isFinite(Number(price))?Number(price):0,feature:x};
  });
 }catch(e){console.warn('[SASSI PREMIUM] Catalog unavailable',e);return []}
}
function byId(id){return catalog().find(x=>x.id===id)}
function navigate(id){
 if(!validId(id))return;
 const field=$('search'),go=$('go');
 if(field&&go){field.value=id;go.click();}
 else {const record=byId(id);if(record&&typeof selectLot==='function')selectLot(record.feature,true);}
 hideDiscovery();
}
function toast(text){
 const last=document.querySelector('.sp-toast');if(last)last.remove();
 const el=document.createElement('div');el.className='sp-toast';el.setAttribute('role','status');el.textContent=text;document.body.append(el);
 setTimeout(()=>{if(el.isConnected)el.remove();},3000);
}
function renderStats(){
 const all=catalog(),counts={};all.forEach(x=>counts[x.status]=(counts[x.status]||0)+1);
 const el=$('sp-stats');if(el)el.textContent=`${all.length} LOTES  ·  ${counts.DISPONIBLE||0} DISPONIBLES  ·  ${counts.APARTADO||0} APARTADOS`;
 const fav=$('sp-fav-count');if(fav)fav.textContent=store.favorites.size;
 const cmp=$('sp-compare-count');if(cmp)cmp.textContent=store.compare.length;
}
function renderDiscovery(){
 const all=catalog(),status=$('sp-status')?.value||'all',min=Number($('sp-min')?.value)||0,max=Number($('sp-max')?.value)||Infinity;
 const search=String($('sp-query')?.value||'').trim().toUpperCase(),sort=$('sp-sort')?.value||'id';
 let results=all.filter(x=>(status==='all'||(status==='favorites'?store.favorites.has(x.id):x.status===status))&&x.area>=min&&x.area<=max&&(!search||x.id.includes(search)||x.barrio.toUpperCase().includes(search)));
 const priceSort=(a,b)=>(a.price||Infinity)-(b.price||Infinity);
 if(sort==='area-asc')results.sort((a,b)=>a.area-b.area);else if(sort==='area-desc')results.sort((a,b)=>b.area-a.area);else if(sort==='price')results.sort(priceSort);else results.sort((a,b)=>a.id.localeCompare(b.id));
 const label=$('sp-result-count');if(label)label.textContent=`${results.length} opciones`;
 const el=$('sp-results');if(!el)return;
 if(!all.length){el.innerHTML='<div class="sp-empty">Preparando el inventario del masterplan…</div>';return;}
 if(!results.length){el.innerHTML='<div class="sp-empty">No se encontraron lotes con esos criterios.</div>';return;}
 el.innerHTML=results.slice(0,90).map(x=>`<button type="button" class="sp-result" data-lot="${x.id}" aria-label="Explorar ${x.id}"><span><b><i class="sp-swatch" data-status="${h(x.status)}"></i>${x.id} ${store.favorites.has(x.id)?'★':''}</b><small>${h(x.barrio)} · ${x.area.toLocaleString('es-MX',{maximumFractionDigits:0})} m² · ${statusLabel(x.status)}</small></span><span class="sp-result-price">${h(money(x.price))}</span></button>`).join('')+(results.length>90?'<div class="sp-empty">Refina los filtros para explorar más lotes.</div>':'');
}
function showDiscovery(mode){const dock=$('sp-discovery');if(!dock)return;dock.classList.add('sp-visible');$('sp-explore-btn')?.setAttribute('aria-expanded','true');if(mode==='favorites'&&$('sp-status'))$('sp-status').value='favorites';else if(mode==='all'&&$('sp-status'))$('sp-status').value='all';renderDiscovery();}
function hideDiscovery(){$('sp-discovery')?.classList.remove('sp-visible');$('sp-explore-btn')?.setAttribute('aria-expanded','false')}
function addCompare(id){if(!validId(id))return;const p=store.compare.indexOf(id);if(p>=0){store.compare.splice(p,1);toast(`${id} retirado de la comparación`);}else if(store.compare.length>=COMPARE_MAX)toast('Puedes comparar un máximo de 3 lotes.');else{store.compare.push(id);toast(`${id} añadido a la comparación`);}renderStats();renderCardExtras();if($('sp-compare')?.classList.contains('sp-visible'))renderCompare();}
function toggleFavorite(id){if(!validId(id))return;if(store.favorites.has(id)){store.favorites.delete(id);toast(`${id} retirado de favoritos`);}else{store.favorites.add(id);toast(`${id} guardado en favoritos`);}saveFavs();renderStats();renderCardExtras();if($('sp-discovery')?.classList.contains('sp-visible'))renderDiscovery();}
function getSelectedId(){let text=$('lot')?.textContent?.trim();return validId(text)?text:null}
function renderCardExtras(){const el=$('sp-card-extra'),id=getSelectedId();if(!el)return;el.hidden=!id;if(!id)return;
 el.innerHTML=`<div class="sp-kicker">TU SELECCIÓN · ${h(id)}</div><div class="sp-extra-row"><button type="button" data-action="favorite" title="Guardar lote">${store.favorites.has(id)?'★ Guardado':'☆ Favorito'}</button><button type="button" data-action="compare">${store.compare.includes(id)?'✓ Comparando':'+ Comparar'}</button><button type="button" data-action="share">↗ Compartir</button></div><button type="button" class="sp-gallery-action" data-action="gallery">▧ Explorar imágenes del proyecto ↗</button>`;
}
function renderCompare(){const box=$('sp-compare-grid');if(!box)return;box.innerHTML=store.compare.map(id=>{
 const x=byId(id);if(!x)return '';
 return `<article class="sp-compare-item"><div class="sp-kicker">${h(x.barrio)} · ${h(statusLabel(x.status))}</div><h3>${h(id)}</h3><dl><dt>Superficie</dt><dd>${x.area.toLocaleString('es-MX',{maximumFractionDigits:2})} m²</dd><dt>Precio de venta</dt><dd>${h(money(x.price))}</dd><dt>Disponibilidad</dt><dd>${h(statusLabel(x.status))}</dd></dl><button type="button" data-action="view-compare" data-lot="${h(id)}">Ver en el mapa ↗</button></article>`;
 }).join('')||'<div class="sp-empty">Selecciona hasta tres lotes usando el botón Comparar en la ficha de cada terreno.</div>';
}
function showCompare(){renderCompare();$('sp-compare')?.classList.add('sp-visible');$('sp-compare')?.setAttribute('aria-hidden','false')}
function hideCompare(){$('sp-compare')?.classList.remove('sp-visible');$('sp-compare')?.setAttribute('aria-hidden','true')}
async function shareLot(id){
 if(!validId(id))return;
 const url=new URL(location.href);url.searchParams.set('premium_lote',id);
 try{if(navigator.share&&matchMedia('(pointer:coarse)').matches){await navigator.share({title:'SASSI DEL VALLE · '+id,url:url.toString()});return}
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url.toString());toast(`Enlace de ${id} copiado`);return;}}
 catch(e){if(e?.name==='AbortError')return;}
 prompt('Copia este enlace para compartir:',url.toString());
}
function init(){if($('sp-launcher'))return;
 const launcher=document.createElement('nav');launcher.id='sp-launcher';launcher.setAttribute('aria-label','Exploración premium de lotes');
 launcher.innerHTML='<button class="sp-primary" id="sp-explore-btn" type="button" aria-expanded="false" aria-controls="sp-discovery">⌕ Explorar terrenos</button><button id="sp-favorites-btn" type="button">☆ Favoritos <span class="sp-count" id="sp-fav-count">0</span></button><button id="sp-compare-btn" type="button">▥ Comparar <span class="sp-count" id="sp-compare-count">0</span></button>';
 const stats=document.createElement('div');stats.id='sp-stats';stats.setAttribute('aria-live','polite');stats.textContent='PREPARANDO LOTES…';
 const watermark=document.createElement('div');watermark.id='sp-watermark';watermark.textContent='SASSI · EDICIÓN PREMIUM V1 · PRUEBA';
 const drawer=document.createElement('section');drawer.id='sp-discovery';drawer.setAttribute('aria-label','Explorar terrenos');
 drawer.innerHTML='<header class="sp-panel-head"><div><div class="sp-kicker">SASSI DEL VALLE / EXPLORAR</div><h2 class="sp-panel-title">Encuentra tu lugar.</h2><p class="sp-subline">200 lotes · selección privada · mapa interactivo</p></div><button class="sp-x" id="sp-drawer-close" type="button" aria-label="Cerrar filtros">×</button></header><div class="sp-filters"><label class="sp-wide">Lote o barrio<input id="sp-query" placeholder="Buscar SV-003, Centro…" autocomplete="off"></label><label>Estado<select id="sp-status"><option value="all">Todos</option><option value="DISPONIBLE">Disponible</option><option value="APARTADO">Apartado</option><option value="VENDIDO">Vendido</option><option value="favorites">Mis favoritos</option></select></label><label>Ordenar<select id="sp-sort"><option value="id">Por número</option><option value="area-asc">Menor superficie</option><option value="area-desc">Mayor superficie</option><option value="price">Menor precio</option></select></label><label>Superficie mín. (m²)<input id="sp-min" type="number" min="0" step="10" placeholder="Desde"></label><label>Superficie máx. (m²)<input id="sp-max" type="number" min="0" step="10" placeholder="Hasta"></label></div><div class="sp-results-head"><span id="sp-result-count">200 opciones</span><span>Haz clic para explorar ↗</span></div><div class="sp-results" id="sp-results"></div>';
 const comp=document.createElement('section');comp.id='sp-compare';comp.setAttribute('role','dialog');comp.setAttribute('aria-label','Comparador de terrenos');comp.setAttribute('aria-hidden','true');
 comp.innerHTML='<div class="sp-compare-sheet"><header class="sp-panel-head"><div><div class="sp-kicker">SASSI DEL VALLE / COMPARADOR</div><h2 class="sp-panel-title">Elegir con perspectiva.</h2><p class="sp-subline">Compara hasta tres terrenos, con información de la base maestra.</p></div><button class="sp-x" id="sp-compare-close" type="button" aria-label="Cerrar comparador">×</button></header><div id="sp-compare-grid" class="sp-compare-grid"></div></div>';
 document.body.append(launcher,stats,watermark,drawer,comp);
 const card=$('card');if(card){const extra=document.createElement('div');extra.id='sp-card-extra';extra.hidden=true;const acts=card.querySelector('.public-card-actions');if(acts)card.insertBefore(extra,acts);else card.append(extra);const lot=$('lot');if(lot)new MutationObserver(renderCardExtras).observe(lot,{childList:true,characterData:true,subtree:true});}
 const gate=$('entryGate');if(gate){const tag=document.createElement('div');tag.className='sp-gate-eyebrow';tag.textContent='UNA NUEVA FORMA DE EXPLORAR EL VALLE';gate.append(tag);}
 $('sp-explore-btn')?.addEventListener('click',()=>drawer.classList.contains('sp-visible')?hideDiscovery():showDiscovery('all'));
 $('sp-favorites-btn')?.addEventListener('click',()=>showDiscovery('favorites'));
 $('sp-compare-btn')?.addEventListener('click',showCompare);
 $('sp-drawer-close')?.addEventListener('click',hideDiscovery);
 $('sp-compare-close')?.addEventListener('click',hideCompare);
 [ 'sp-query','sp-status','sp-sort','sp-min','sp-max' ].forEach(id=>$(id)?.addEventListener(id==='sp-query'||id==='sp-min'||id==='sp-max'?'input':'change',renderDiscovery));
 $('sp-results')?.addEventListener('click',e=>{const button=e.target.closest('[data-lot]');if(button)navigate(button.dataset.lot)});
 $('sp-card-extra')?.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const id=getSelectedId();if(!id)return;if(b.dataset.action==='favorite')toggleFavorite(id);else if(b.dataset.action==='compare')addCompare(id);else if(b.dataset.action==='share')shareLot(id);else if(b.dataset.action==='gallery')$('projectGalleryBtn')?.click()});
 $('sp-compare-grid')?.addEventListener('click',e=>{const b=e.target.closest('[data-action="view-compare"]');if(b){hideCompare();navigate(b.dataset.lot)}});
 comp.addEventListener('click',e=>{if(e.target===comp)hideCompare()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){hideDiscovery();hideCompare()}});
 const sync=$('sheetsSyncInfo');if(sync)new MutationObserver(()=>{renderStats();if(drawer.classList.contains('sp-visible'))renderDiscovery()}).observe(sync,{childList:true,characterData:true,subtree:true});
 const pending=new URL(location.href).searchParams.get('premium_lote');if(validId(pending)){
  const start=$('startBuyer');if(start)start.addEventListener('click',()=>setTimeout(()=>navigate(pending),1600),{once:true});
 }
 renderStats();renderCardExtras();
 console.info('[SASSI PREMIUM] Experiencia independiente activa; datos y autenticación originales sin modificaciones.');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
