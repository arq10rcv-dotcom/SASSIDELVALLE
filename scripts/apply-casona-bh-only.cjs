'use strict';
// Cambio aislado: extruir lotes nativos de Satélite 3D con ALTURA DE CASONA m (BH).
// No modifica Satélite 2D, 360, fichas, Vendedor, estilos ni navegación.
const fs=require('node:fs');
const path=require('node:path');
const sourceFile=path.resolve(__dirname,'../index.html');
const heightsFile=path.resolve(__dirname,'../data/sassi-casona-alturas-bh.json');
const heights=JSON.parse(fs.readFileSync(heightsFile,'utf8'));
if(heights.schema!=='sassi-casonas-alturas-v1'||
 heights.source!=='00_LOTES!BH'||
 heights.column!=='ALTURA DE CASONA m'||
 heights.heights?.length!==200)throw Error('SASSI BH: tabla de alturas incompatible');
const seen=new Set();
for(const {lote_id,altura_casona_m} of heights.heights){
 if(!/^SV-\d{3}$/.test(lote_id)||seen.has(lote_id)||
    !Number.isFinite(altura_casona_m)||altura_casona_m<0||altura_casona_m>60)
  throw Error('SASSI BH: dato no válido '+lote_id);
 seen.add(lote_id);
}
for(let i=1;i<=200;i++)if(!seen.has('SV-'+String(i).padStart(3,'0')))throw Error('SASSI BH: falta ID '+i);
let html=fs.readFileSync(sourceFile,'utf8');
const marker='SASSI_PRODUCTION_CASONA_BH_ONLY_V1';
if(html.includes(marker)){console.log('[SASSI BH] ya aplicado');process.exit(0)}
function once(a,b,label){
 const i=html.indexOf(a);
 if(i<0||html.indexOf(a,i+a.length)>=0)throw Error('[SASSI BH] Estructura inesperada '+label);
 html=html.slice(0,i)+b+html.slice(i+a.length);
}
const pairs=heights.heights.map(r=>[r.lote_id,r.altura_casona_m]);
const helper=[
 '// '+marker,
 'const sassiBHHeights=new Map('+JSON.stringify(pairs)+');',
 'function sassiApplyCasonaBHHeight(poly,f){',
 '  const m=sassiBHHeights.get(f.properties.lote_id)||0;',
 "  poly.altitudeMode='RELATIVE_TO_GROUND';",
 '  poly.extruded=m>0;',
 '  poly.path=f.geometry.coordinates[0].map(c=>({lat:Number(c[1]),lng:Number(c[0]),altitude:m>0?m:LOT_SURFACE_OFFSET_M}));',
 '}',
 ''
].join('\n');
once('function updateLotGeometry(id){',helper+'function updateLotGeometry(id){','helper');
once(
 "  poly.extruded=false;\n  // Huella sin extrusión: sigue el relieve pero flota 1.20 m sobre la superficie\n  // para evitar que la textura del terreno atraviese o parpadee sobre el color.\n  poly.path=f.geometry.coordinates[0].map(c=>({lat:c[1],lng:c[0],altitude:LOT_SURFACE_OFFSET_M}));",
 "  sassiApplyCasonaBHHeight(poly,f);",
 'refresh'
);
once(
 "    // Sin extrusión. Cada vértice queda 1.20 m sobre su terreno local para mantener\n    // la lectura completa del lote sin crear un volumen vertical.\n    poly.path=f.geometry.coordinates[0].map(c=>({lat:c[1],lng:c[0],altitude:LOT_SURFACE_OFFSET_M}));",
 "    sassiApplyCasonaBHHeight(poly,f);",
 'drawLots'
);
fs.writeFileSync(sourceFile,html,'utf8');
console.log('[SASSI BH] PASS: '+heights.heights.filter(r=>r.altura_casona_m>0).length+' lotes extruidos, sin otras modificaciones.');
