/* SASSI Premium V1 — casona height envelopes from 00_LOTES!BH.
   The lot's entire cadastral footprint is extruded as a CONCEPTUAL mass,
   not as an as-built house footprint. Production main is unchanged. */
(function(){
  'use strict';
  const KEY='SASSI_PREMIUM_CASONA_MASSES_V1';
  const SOURCE='./data/sassi-casona-alturas-bh.json';
  const heights=new Map();
  const volumes=new Map();
  let map3d=null,lib3d=null,loaded=false,enabled=false,building=false;
  let loadedDate='',snapshotDate='',lastMode='',cachedCount=0;
  const $=id=>document.getElementById(id);
  const validId=id=>/^SV-\d{3}$/.test(String(id||''));
  function positiveHeight(id){const n=heights.get(id);return Number.isFinite(n)&&n>0?n:0;}
  function selectedId(){const id=$('lot')?.textContent?.trim();return validId(id)?id:null;}
  function is3D(){
    try{return window.getSassiExplorerState?.().viewMode==='satellite'&&typeof MAP_READY!=='undefined'&&MAP_READY&&
      !(typeof lotView360Active!=='undefined'&&lotView360Active);}catch(_){return false;}
  }
  function saveEnabled(){try{localStorage.setItem(KEY,enabled?'1':'0');}catch(_){}}
  function tint(selected){return selected?'#d2b789b5':'#c1b79c72';}
  function volumePath(coords,height){
    // Native Google extrusion requires relative-to-GROUND, never relative-to-MESH.
    if(typeof sassiLotMeshPath==='function')return sassiLotMeshPath(coords,height,8);
    return coords.map(c=>({lng:Number(c[0]),lat:Number(c[1]),altitude:height}));
  }
  function updateSelectedVisual(){
    const id=selectedId();
    for(const [lot,poly] of volumes){
      try{poly.fillColor=tint(lot===id);poly.strokeColor=lot===id?'#f9f0d4e6':'#eadbc09e';}catch(_){}
    }
    const row=$('sp-casona-height-row');
    if(row){const h=id?positiveHeight(id):0;row.hidden=!id;const val=$('sp-casona-height-value');if(val)val.textContent=h?h.toLocaleString('es-MX')+' m':'Sin altura asignada';}
  }
  async function prepareVolumes(){
    if(building||!loaded||!enabled||!is3D()||volumes.size)return;
    building=true;
    try{
      if(!map3d)map3d=$('map');
      if(!map3d||typeof google==='undefined')return;
      lib3d=lib3d||await google.maps.importLibrary('maps3d');
      const Poly=lib3d.Polygon3DInteractiveElement||lib3d.Polygon3DElement;
      if(!Poly)throw Error('Google 3D no ofrece poligonos.');
      // Same constructor compatibility shim as SASSI's existing drawLots().
      try{if(Poly&&!Poly.Op)Poly.Op=lib3d.Polygon3DElement?.Op||new Map();}catch(_){}
      const features=typeof FEATURES!=='undefined'&&Array.isArray(FEATURES)?FEATURES:[];
      const created=[];
      for(const feature of features){
        const id=feature?.properties?.lote_id,height=positiveHeight(id);
        if(!id||!height)continue;
        const shape=new Poly({
          altitudeMode:'RELATIVE_TO_GROUND',
          extruded:true,
          drawsOccludedSegments:false,
          fillColor:tint(id===selectedId()),
          strokeColor:'#eadbc09e',
          strokeWidth:1.2,
          zIndex:18
        });
        shape.path=volumePath(feature.geometry.coordinates[0],height);
        if(typeof shape.addEventListener==='function'){
          shape.addEventListener('gmp-click',()=>{if(typeof selectLot==='function')selectLot(feature,true);});
        }
        created.push([id,shape]);
      }
      for(const [id,shape] of created){volumes.set(id,shape);if(enabled&&is3D())map3d.append(shape);}
      cachedCount=volumes.size;
      updateSelectedVisual();updateButton();
      console.info('[SASSI CASONAS] '+cachedCount+' volumes (0 m = no extrusion); 3D conceptual.');
    }catch(error){
      console.warn('[SASSI CASONAS] 3D not available:',error);
      for(const p of volumes.values())try{p.remove();}catch(_){}
      volumes.clear();
      enabled=false;updateButton();
    }finally{building=false;}
  }
  function updateButton(){
    const btn=$('sp-casona-volumes-btn');
    if(!btn)return;
    const mode=is3D();
    btn.hidden=!mode;
    btn.disabled=!loaded;
    btn.setAttribute('aria-pressed',String(enabled));
    btn.textContent=enabled?'▥ Ocultar casonas':'▥ Casonas 3D';
    btn.title=loaded?(cachedCount||[...heights.values()].filter(h=>h>0).length)+' lotes con altura de casona en el Excel (columna BH)':'Cargando alturas...';
  }
  function syncVisibility(){
    const mode=is3D(),visible=enabled&&mode;
    if(lastMode!==String(visible)){
      lastMode=String(visible);
      for(const shape of volumes.values()){
        try{
          if(visible&&!shape.isConnected)map3d?.append(shape);
          if(!visible&&shape.isConnected)shape.remove();
        }catch(err){console.warn('[SASSI CASONAS] visibility:',err);}
      }
    }
    updateButton();
    if(visible&&!volumes.size)void prepareVolumes();
  }
  function syncHeight(id,height){
    if(!validId(id)||!Number.isFinite(height)||height<0||height>60)return false;
    if(heights.get(id)===height)return false;
    heights.set(id,height);
    const existing=volumes.get(id);
    if(existing){
      try{existing.remove();}catch(_){}
      volumes.delete(id);
    }
    // Rebuild all volumes on the next activation to avoid duplicate shapes.
    for(const p of volumes.values())try{p.remove();}catch(_){}
    volumes.clear();lastMode='';cachedCount=0;
    updateSelectedVisual();
    syncVisibility();
    return true;
  }
  function updateFromSheet(rows,date){
    if(!Array.isArray(rows)||!Number.isFinite(Date.parse(date))||Date.parse(date)<Date.parse(snapshotDate))return;
    for(const row of rows){
      if(!row||!Object.prototype.hasOwnProperty.call(row,'altura_casona_m'))continue;
      const id=row.lote_id??row.LOTE_ID;
      const raw=row.altura_casona_m;
      if(raw===null||raw===undefined||raw==='')continue;
      const n=Number(raw);
      if(Number.isFinite(n))syncHeight(String(id),n);
    }
    loadedDate=date;
  }
  window.sassiCasonaHeightsFromSheet=updateFromSheet;
  window.getSassiCasonaHeight=id=>positiveHeight(id);
  function mountUI(){
    const launcher=$('sp-launcher');
    if(launcher&&!$('sp-casona-volumes-btn')){
      const button=document.createElement('button');
      button.type='button';button.id='sp-casona-volumes-btn';button.hidden=true;
      button.title='Mostrar volúmenes conceptuales con alturas de la columna BH';
      button.addEventListener('click',()=>{
        if(!loaded)return;
        enabled=!enabled;saveEnabled();syncVisibility();
      });
      launcher.append(button);
    }
    const card=$('card');
    if(card&&!$('sp-casona-height-row')){
      const row=document.createElement('div');
      row.id='sp-casona-height-row';row.className='row';row.dataset.field='alturaCasona';
      row.innerHTML='<span>Altura de casona · Excel</span><strong id="sp-casona-height-value">—</strong>';
      const m2=card.querySelector('[data-field="m2"]');
      if(m2)m2.insertAdjacentElement('afterend',row);else card.append(row);
      row.hidden=true;
    }
    updateButton();updateSelectedVisual();
  }
  async function load(){
    try{
      const response=await fetch(SOURCE,{cache:'no-cache'});
      if(!response.ok)throw Error('No se encontró el archivo de alturas de SASSI ('+response.status+').');
      const payload=await response.json();
      if(payload.schema!=='sassi-casonas-alturas-v1'||payload.project!=='SASSI_DEL_VALLE'||
         payload.source!=='00_LOTES!BH'||!Array.isArray(payload.heights)||payload.heights.length!==200)
        throw Error('Formato de alturas incompatible');
      const seen=new Set();
      for(const row of payload.heights){
        const id=row.lote_id,n=row.altura_casona_m;
        if(!validId(id)||seen.has(id)||!Number.isFinite(n)||n<0||n>60)throw Error('Altura inválida en '+id);
        seen.add(id);heights.set(id,n);
      }
      if(seen.size!==200)throw Error('Faltan lotes de la hoja maestra.');
      snapshotDate=payload.generatedAt;loadedDate=payload.generatedAt;loaded=true;
      try{enabled=localStorage.getItem(KEY)==='1';}catch(_){}
      updateSelectedVisual();syncVisibility();
    }catch(error){loaded=false;enabled=false;console.warn('[SASSI CASONAS] No se cargó BH:',error);updateButton();}
  }
  function init(){
    mountUI();
    const priorSelected=window.onSassiLotSelected;
    window.onSassiLotSelected=function(feature){
      if(typeof priorSelected==='function')priorSelected.apply(this,arguments);
      queueMicrotask(updateSelectedVisual);
    };
    const priorReady=window.onSassiMapsReady;
    window.onSassiMapsReady=function(){
      if(typeof priorReady==='function')priorReady.apply(this,arguments);
      syncVisibility();
    };
    const lot=$('lot');
    if(lot)new MutationObserver(updateSelectedVisual).observe(lot,{childList:true,characterData:true,subtree:true});
    // Mode is managed by SASSI's closed-over setViewMode(); polling only checks
    // visibility, never rebuilds Google polygons per frame.
    setInterval(syncVisibility,1100);
    void load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();