/* SASSI PREMIUM — MODELO 3D TÉCNICO (EXPERIMENTAL ONLY) */
(function(){
'use strict';
const el=id=>document.getElementById(id), bridge=()=>window.sassiTechnicalBridge;
let THREE,Controls,scene,camera,renderer,orbit,ray,mouse,ground,material,grid,view,frame=0,modelReady=false,busy=false,enabled=false;
let dataset=[],heights=new Map(),solids=[],footprints=[],pickables=[],selected='',backMode='masterplan',dim=200,spanX=0,spanZ=0;
let textureUrl=null,resizeObserver=null;
const colorByStatus={DISPONIBLE:'#33ae8e',APARTADO:'#d3ae51',VENDIDO:'#778079',SIN_DEFINIR:'#a3aa9d'};
const isId=s=>/^SV-\d{3}$/.test(s||'');
const status=id=>{try{return bridge()?.status(id)||'SIN_DEFINIR'}catch(_){return 'SIN_DEFINIR'}};
function lotColor(id){const palette=window.getSassiStatusColors?.()||{};const c=palette[status(id)]||colorByStatus[status(id)]||'#a3aa9d';return /^#[0-9a-f]{6}$/i.test(c)?c:'#a3aa9d';}
function message(s,error=false){const node=el('stmMessage');if(node){node.textContent=s;node.classList.toggle('error',error)}}
function bindSwitcher(){
 const parent=el('viewSwitcher')||el('sp-launcher')||el('toolbar');if(!parent||el('viewTechnicalModelBtn'))return;
 const b=document.createElement('button');b.id='viewTechnicalModelBtn';b.type='button';b.textContent='Modelo 3D';
 b.title='Modelo técnico de casonas con altura del Excel';b.setAttribute('aria-pressed','false');
 b.addEventListener('click',()=>{void openModel()});parent.append(b);
 parent.addEventListener('click',event=>{if(event.target.closest('button')?.id!=='viewTechnicalModelBtn')closeModel(false)},true);
}
function setupUI(){
 if(el('stmView'))return;
 const root=document.createElement('section');root.id='stmView';root.hidden=true;root.setAttribute('aria-label','Modelo técnico 3D de SASSI DEL VALLE');
 root.innerHTML=[
 '<div id="stmCanvas" aria-label="Visor tridimensional interactivo"></div>',
 '<div class="stmHeading"><small>SASSI DEL VALLE · ESTUDIO DE MASAS</small><strong>Modelo 3D</strong></div>',
 '<div class="stmNav">N ↑</div>',
 '<div class="stmControls"><div class="stmCamera">',
 '<button type="button" data-cam="center">Centrar</button>',
 '<button type="button" data-cam="top">Planta</button>',
 '<button type="button" data-cam="iso">Isométrico</button></div>',
 '<label><input type="checkbox" id="stmMasses" checked> Masas de casonas</label>',
 '<label><input type="checkbox" id="stmGrid"> Retícula</label>',
 '<label class="stmUpload">Cargar ortofoto<input id="stmPhoto" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>',
 '<button id="stmClearPhoto" type="button" hidden>Quitar ortofoto</button>',
 '<button id="stmExit" type="button">Volver al mapa</button></div>',
 '<div class="stmFooter"><strong id="stmCounter">200 lotes</strong>',
 '<span id="stmMessage" role="status">Preparando geometría…</span>',
 '<small>Terreno horizontal y georreferenciado. Para fotografía real, carga una ortofoto propia que cubra la extensión de los lotes. No es un DEM.</small></div>',
 '<div class="stmBusy" id="stmBusy" hidden>Construyendo modelo 3D…</div>'
 ].join('');
 document.body.append(root);view=root;
 root.querySelectorAll('[data-cam]').forEach(b=>b.addEventListener('click',()=>cameraPose(b.dataset.cam)));
 el('stmMasses').addEventListener('change',()=>setMasses());
 el('stmGrid').addEventListener('change',()=>{if(grid)grid.visible=el('stmGrid').checked});
 el('stmExit').addEventListener('click',()=>closeModel(true));
 el('stmPhoto').addEventListener('change',e=>{if(e.target.files[0])void importPhoto(e.target.files[0]);e.target.value=''});
 el('stmClearPhoto').addEventListener('click',()=>{void removePhoto()});
}
function pointsLocal(){
 const features=bridge()?.features;
 if(!Array.isArray(features)||features.length!==200)throw Error('No encuentro los 200 lotes originales.');
 const all=[];for(const f of features)for(const ring of f.geometry?.coordinates||[])for(const p of ring)all.push(p);
 const refLng=all.reduce((n,p)=>n+p[0],0)/all.length,refLat=all.reduce((n,p)=>n+p[1],0)/all.length;
 const east=111320*Math.cos(refLat*Math.PI/180),north=110540;
 const raw=p=>[(p[0]-refLng)*east,(p[1]-refLat)*north];
 const coords=all.map(raw),xs=coords.map(p=>p[0]),zs=coords.map(p=>p[1]);
 const ox=(Math.min(...xs)+Math.max(...xs))/2,oz=(Math.min(...zs)+Math.max(...zs))/2;
 spanX=Math.max(...xs)-Math.min(...xs);spanZ=Math.max(...zs)-Math.min(...zs);
 dim=Math.max(spanX,spanZ,80);
 const toLocal=p=>{const c=raw(p);return [c[0]-ox,c[1]-oz]};
 return features.map(f=>({id:f.properties.lote_id,feature:f,height:heights.get(f.properties.lote_id)||0,
  rings:f.geometry.coordinates.map(r=>r.map(toLocal))}));
}
async function fetchHeights(){
 const r=await fetch('./data/sassi-casona-alturas-bh.json',{cache:'no-cache'});
 if(!r.ok)throw Error('Falta el archivo de alturas BH.');
 const doc=await r.json();
 if(doc.schema!=='sassi-casonas-alturas-v1'||doc.source!=='00_LOTES!BH'||doc.heights?.length!==200)throw Error('La tabla BH es incompatible.');
 const seen=new Set();heights=new Map();
 for(const item of doc.heights){
  const h=item.altura_casona_m;if(!isId(item.lote_id)||!Number.isFinite(h)||h<0||h>60||seen.has(item.lote_id))throw Error('Altura repetida o inválida.');
  heights.set(item.lote_id,h);seen.add(item.lote_id);
 }
 if(seen.size!==200)throw Error('La tabla de alturas está incompleta.');
}
function clean(ring){
 const out=[];for(const p of ring){const q=out[out.length-1];if(!q||Math.hypot(q[0]-p[0],q[1]-p[1])>.12)out.push(p);}
 if(out.length>2&&Math.hypot(out[0][0]-out[out.length-1][0],out[0][1]-out[out.length-1][1])<.12)out.pop();
 return out;
}
function makeShape(rings){
 const pts=clean(rings[0]);if(pts.length<3)return null;
 const s=new THREE.Shape();s.moveTo(...pts[0]);pts.slice(1).forEach(p=>s.lineTo(...p));s.closePath();
 for(const holeCoords of rings.slice(1)){
  const hole=clean(holeCoords);if(hole.length<3)continue;
  const path=new THREE.Path();path.moveTo(...hole[0]);hole.slice(1).forEach(p=>path.lineTo(...p));path.closePath();s.holes.push(path);
 }
 return s;
}
function mat(color,opacity){
 return new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,transparent:opacity<1,opacity,roughness:.95,metalness:0,depthWrite:opacity>=1});
}
function drawSurface(){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
 const context=canvas.getContext('2d');context.fillStyle='#bec7ac';context.fillRect(0,0,1024,1024);
 let seed=273;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<1600;i++){
  context.fillStyle=rnd()<.55?'rgba(49,82,53,.07)':'rgba(204,177,123,.065)';
  context.beginPath();context.ellipse(rnd()*1024,rnd()*1024,3+rnd()*14,3+rnd()*14,rnd()*3,0,6.2832);context.fill();
 }
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 material=mat('#ffffff',1);material.map=tex;
 const padding=Math.max(dim*.1,20);
 const plane=new THREE.PlaneGeometry(spanX+2*padding,spanZ+2*padding);
 plane.rotateX(-Math.PI/2);
 ground=new THREE.Mesh(plane,material);ground.position.y=-.15;ground.receiveShadow=true;scene.add(ground);
 grid=new THREE.GridHelper(Math.ceil(dim*1.3/20)*20,Math.max(8,Math.min(48,Math.ceil(dim/20))),0x607e6f,0x98ad92);
 grid.visible=false;grid.position.y=.025;scene.add(grid);
}
function drawLots(){
 let count=0;
 for(const row of dataset){
  const shape=makeShape(row.rings);if(!shape)continue;
  const hex=lotColor(row.id);
  const footprint=new THREE.Mesh(new THREE.ShapeGeometry(shape,6),mat(hex,.48));
  footprint.rotation.x=-Math.PI/2;footprint.position.y=.055;footprint.userData={id:row.id,feature:row.feature,type:'lot'};
  scene.add(footprint);footprints.push(footprint);pickables.push(footprint);
  const ring=clean(row.rings[0]);
  if(ring.length>=3){
   const pts=ring.map(p=>new THREE.Vector3(p[0],.125,-p[1]));
   const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xe5eddb,transparent:true,opacity:.92}));
   scene.add(line);
  }
  if(row.height>0){
   count++;
   const solid=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:row.height,bevelEnabled:false,steps:1,curveSegments:6}),[mat(hex,.79),mat(hex,.65)]);
   solid.rotation.x=-Math.PI/2;solid.userData={id:row.id,feature:row.feature,type:'mass'};
   solid.visible=el('stmMasses').checked;scene.add(solid);solids.push(solid);pickables.push(solid);
  }
 }
 el('stmCounter').textContent='200 lotes · '+count+' casonas · '+(200-count)+' sin altura';
}
function resize(){
 if(!renderer)return;
 const root=el('stmCanvas'),w=Math.max(1,root.clientWidth),h=Math.max(1,root.clientHeight);
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
function cameraPose(mode){
 if(!camera||!orbit)return;
 camera.up.set(0,1,0);
 if(mode==='top'){camera.up.set(0,0,-1);camera.position.set(0,dim*1.6,.001)}
 else if(mode==='center'){camera.position.set(0,dim*.88,dim*1.35)}
 else{camera.position.set(dim*.92,dim*.92,dim*1.08)}
 orbit.target.set(0,0,0);camera.lookAt(0,0,0);orbit.update();
}
function choose(mesh){
 const id=mesh?.userData?.id;if(!isId(id))return;
 selected=id;highlight();
 try{bridge()?.select(mesh.userData.feature)}catch(e){console.warn('Selección técnica:',e)}
 message(id+' · Casona: '+(heights.get(id)||0)+' m');
}
function highlight(){
 for(const obj of pickables){
  const selectedObj=obj.userData.id===selected;
  const materials=Array.isArray(obj.material)?obj.material:[obj.material];
  materials.forEach(m=>{if(m?.emissive){m.emissive.set(selectedObj?'#5e5236':'#000000');m.emissiveIntensity=selectedObj?.42:0}});
 }
}
function refreshColors(){
 for(const obj of pickables){
  const materials=Array.isArray(obj.material)?obj.material:[obj.material];
  materials.forEach(m=>m?.color?.set(lotColor(obj.userData.id)));
 }
 highlight();
}
let pressed=null;
function tapStart(e){pressed=[e.clientX,e.clientY]}
function tapEnd(e){
 if(!pressed||Math.hypot(pressed[0]-e.clientX,pressed[1]-e.clientY)>6)return;
 const r=renderer.domElement.getBoundingClientRect();
 mouse.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
 ray.setFromCamera(mouse,camera);
 const hit=ray.intersectObjects(pickables,false)[0];
 if(hit)choose(hit.object);
}
function setMasses(){
 const visible=el('stmMasses').checked;solids.forEach(x=>x.visible=visible);
 message(visible?'Masas 3D activas.':'Mostrando solamente los terrenos.');
}
function setupThree(){
 scene=new THREE.Scene();scene.background=new THREE.Color('#b3d3df');
 camera=new THREE.PerspectiveCamera(48,1,.1,Math.max(5000,dim*25));
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
 el('stmCanvas').append(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xffffff,0x687e70,2.5));
 const sun=new THREE.DirectionalLight(0xfff6e1,2.5);sun.position.set(-dim,dim*1.7,-dim);scene.add(sun);
 orbit=new Controls(camera,renderer.domElement);orbit.enableDamping=true;orbit.maxPolarAngle=Math.PI/2-.035;
 orbit.minDistance=Math.max(7,dim*.025);orbit.maxDistance=dim*4;
 ray=new THREE.Raycaster();mouse=new THREE.Vector2();
 renderer.domElement.addEventListener('pointerdown',tapStart);renderer.domElement.addEventListener('pointerup',tapEnd);
 drawSurface();drawLots();cameraPose('iso');resize();
 new ResizeObserver(resize).observe(el('stmCanvas'));
}
function loop(){
 frame=0;if(!enabled||!modelReady)return;
 orbit.update();renderer.render(scene,camera);frame=requestAnimationFrame(loop);
}
function startFrame(){if(frame)cancelAnimationFrame(frame);frame=0;if(enabled&&modelReady)loop()}
function toggleView(yes){
 enabled=yes;el('stmView').hidden=!yes;
 document.body.classList.toggle('sassi-technical-mode',yes);
 el('viewTechnicalModelBtn')?.setAttribute('aria-pressed',String(yes));
 if(!yes){if(frame)cancelAnimationFrame(frame);frame=0}
}
async function openModel(){
 if(enabled)return;
 setupUI();bindSwitcher();
 backMode=B()?.viewMode?.()||'masterplan';
 if(typeof B()?.setViewMode==='function')B().setViewMode('masterplan');
 toggleView(true);
 if(modelReady){resize();startFrame();return}
 if(busy)return;busy=true;el('stmBusy').hidden=false;
 try{
  await fetchHeights();
  const mods=await Promise.all([import('three'),import('three/addons/controls/OrbitControls.js')]);
  THREE=mods[0];Controls=mods[1].OrbitControls;
  dataset=pointsLocal();setupThree();modelReady=true;
  await restorePhoto();resize();startFrame();
  message('Modelo listo. Arrastra para orbitar; rueda para zoom; clic para seleccionar.');
 }catch(e){console.error('[SASSI modelo3D]',e);message('No se pudo iniciar Modelo 3D: '+e.message,true)}
 finally{busy=false;el('stmBusy').hidden=true}
}
function closeModel(returnToMap){
 if(!enabled)return;
 toggleView(false);
 if(returnToMap&&typeof B()?.setViewMode==='function')B().setViewMode(backMode);
}
function dbOpen(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('SASSI_MODELO3D_ASSETS_V1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('images');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
}
async function dbAction(action,blob){
 const db=await dbOpen();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('images',action==='get'?'readonly':'readwrite');
  const s=tx.objectStore('images');
  const q=action==='get'?s.get('ortofoto'):action==='put'?s.put(blob,'ortofoto'):s.delete('ortofoto');
  q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
 })}finally{db.close()}
}
function showPhoto(blob){
 if(textureUrl)URL.revokeObjectURL(textureUrl);
 textureUrl=URL.createObjectURL(blob);
 new THREE.TextureLoader().load(textureUrl,tex=>{
  tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  material.map?.dispose();material.map=tex;material.color.set('#ffffff');material.needsUpdate=true;
  el('stmClearPhoto').hidden=false;message('Ortofoto cargada. Debe corresponder al área completa del modelo.');
 },undefined,()=>message('No fue posible leer esta imagen.',true));
}
async function importPhoto(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>18*1024*1024)return message('Usa una imagen PNG, JPG o WEBP menor de 18 MB.',true);
 showPhoto(file);try{await dbAction('put',file)}catch(e){message('Imagen visible, pero el navegador no pudo guardarla.',true)}
}
async function restorePhoto(){try{const blob=await dbAction('get');if(blob)showPhoto(blob)}catch(_){/* optional browser storage */}}
async function removePhoto(){
 try{await dbAction('delete')}catch(_){}
 if(textureUrl)URL.revokeObjectURL(textureUrl);textureUrl=null;
 material.map?.dispose();material.map=null;material.color.set('#c0c9b2');material.needsUpdate=true;
 el('stmClearPhoto').hidden=true;message('Base técnica visible sin ortofoto.');
}
function ready(){
 setupUI();bindSwitcher();
 const tb=el('toolbar');if(tb)new MutationObserver(bindSwitcher).observe(tb,{childList:true});
 const prior=window.onSassiLotSelected;
 window.onSassiLotSelected=function(f){
  if(typeof prior==='function')prior.apply(this,arguments);
  if(!enabled||!f?.properties)return;
  selected=f.properties.lote_id;highlight();
 };
 let last='';
 setInterval(()=>{
  if(!modelReady)return;
  const now=JSON.stringify(window.getSassiStatusColors?.()||{})+'|'+Array.from(dataset).map(l=>status(l.id)).join(',');
  if(now!==last){last=now;refreshColors()}
 },5500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();