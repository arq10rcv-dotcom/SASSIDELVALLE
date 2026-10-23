'use strict';
// SASSI H06 — only the existing native Google 3D lot polygons are extruded.
// The 2D map, lot features, tile fills, seller, panorama and pricing stay intact.
const fs=require('node:fs'),path=require('node:path');
const htmlPath=path.resolve(__dirname,'../index.html');
const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../data/sassi-casona-alturas-bh.json'),'utf8'));
if(data.schema!=='sassi-casonas-alturas-v1'||data.project!=='SASSI_DEL_VALLE'||data.source!=='00_LOTES!BH'||data.column!=='ALTURA DE CASONA m'||data.heights?.length!==200)
  throw Error('SASSI H06: hoja de alturas BH incompatible');
const seen=new Set();
for(const row of data.heights){
 if(!/^SV-\d{3}$/.test(row.lote_id)||seen.has(row.lote_id)||!Number.isFinite(row.altura_casona_m)||row.altura_casona_m<0||row.altura_casona_m>60)
   throw Error('SASSI H06: fila inválida o duplicada '+row.lote_id);
 seen.add(row.lote_id);
}
for(let i=1;i<=200;i++)if(!seen.has('SV-'+String(i).padStart(3,'0')))throw Error('SASSI H06: falta lote '+i);
let html=fs.readFileSync(htmlPath,'utf8');
const marker='SASSI_CASONA_BH_EXTRUSIONS_H06';
if(html.includes(marker)){console.log('[SASSI H06] Ya aplicado');process.exit(0)}
function once(a,b,label){
 const pos=html.indexOf(a);
 if(pos<0||html.indexOf(a,pos+a.length)>=0)throw Error('SASSI H06: no se identificó de forma única '+label);
 html=html.slice(0,pos)+b+html.slice(pos+a.length);
}
const helper=[
 '// '+marker,
 'const sassiCasonaHeightsByLot=new Map('+JSON.stringify(data.heights)+'.map(row=>[row.lote_id,row.altura_casona_m]));',
 'function sassiCasonaHeight(id){return sassiCasonaHeightsByLot.get(id)||0;}',
 'function sassiApplyCasonaHeight(poly,feature){',
 '  const height=sassiCasonaHeight(feature?.properties?.lote_id);',
 '  // Google 3D: extruded polygons require RELATIVE_TO_GROUND, not RELATIVE_TO_MESH.',
 "  poly.altitudeMode=height>0?'RELATIVE_TO_GROUND':'RELATIVE_TO_MESH';",
 '  poly.extruded=height>0;',
 '  poly.drawsOccludedSegments=false;',
 '  poly.path=sassiLotMeshPath(feature.geometry.coordinates[0],height>0?height:0.95);',
 '}',
 ''
].join('\n');
once('const sassiLotTilesById=new Map();','const sassiLotTilesById=new Map();\n'+helper,'H04 maps');
once(
 "  poly.extruded=false;\n  poly.altitudeMode='RELATIVE_TO_MESH';\n  poly.drawsOccludedSegments=false;\n  poly.path=sassiLotMeshPath(f.geometry.coordinates[0],0.95);",
 '  sassiApplyCasonaHeight(poly,f);','refresh geometry');
once(
 '    poly.path=sassiLotMeshPath(f.geometry.coordinates[0],0.95);\n    poly.addEventListener',
 '    sassiApplyCasonaHeight(poly,f);\n    if(sassiCasonaHeight(p.lote_id)>0)poly.fillColor=lotStyle.fill;\n    poly.addEventListener',
 'original lot geometry');
once(
 "    poly.fillColor='#00000000';\n    for(const tile of sassiLotTilesById.get(id)||[])tile.fillColor=selectedColor;",
 "    poly.fillColor=sassiCasonaHeight(id)>0?selectedColor:'#00000000';\n    for(const tile of sassiLotTilesById.get(id)||[])tile.fillColor=selectedColor;",
 'selected volumetric fill');
once(
 "  poly.fillColor='#00000000';\n  for(const tile of sassiLotTilesById.get(id)||[])tile.fillColor=st.fill;",
 "  poly.fillColor=sassiCasonaHeight(id)>0?st.fill:'#00000000';\n  for(const tile of sassiLotTilesById.get(id)||[])tile.fillColor=st.fill;",
 'normal volumetric fill');
fs.writeFileSync(htmlPath,html,'utf8');
console.log('[SASSI H06] Extrusiones BH: '+data.heights.filter(row=>row.altura_casona_m>0).length+' lotes, sin cambios de interfaz.');
