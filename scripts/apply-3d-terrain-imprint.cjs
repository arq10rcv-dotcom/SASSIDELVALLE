// SASSI H03 — native Google Maps 3D mesh imprint, no Three.js and no extra imagery.
// Build-time patch preserves the 19MB source and the 200 GeoJSON sales features.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../index.html');
const marker='SASSI_TERRAIN_IMPRINT_H03';
let html=fs.readFileSync(file,'utf8');
if(html.includes(marker)){console.log('[SASSI] H03 already applied');process.exit(0);}
function one(a,b,label){
  const p=html.indexOf(a);
  if(p<0||html.indexOf(a,p+a.length)>=0)throw Error('[SASSI] H03 missing/ambiguous '+label);
  html=html.slice(0,p)+b+html.slice(p+a.length);
}
one('const LOT_SURFACE_OFFSET_M=1.20;',
    'const LOT_SURFACE_OFFSET_M=0.22; // '+marker,'lot clearance');
const meshFn=[
  'function sassiLotMeshPath(ring, clearance=LOT_SURFACE_OFFSET_M, maxSegmentMeters=6){',
  '  if(!Array.isArray(ring)||!ring.length)return [];',
  '  const result=[];',
  '  const toPoint=c=>({lat:Number(c[1]),lng:Number(c[0]),altitude:clearance});',
  '  for(let i=0;i<ring.length;i++){',
  '    const a=ring[i],b=ring[i+1];',
  '    if(!a||!Number.isFinite(Number(a[0]))||!Number.isFinite(Number(a[1])))continue;',
  '    if(!b){result.push(toPoint(a));continue;}',
  '    const latMean=(Number(a[1])+Number(b[1]))*0.5*Math.PI/180;',
  '    const dx=(Number(b[0])-Number(a[0]))*111320*Math.cos(latMean);',
  '    const dy=(Number(b[1])-Number(a[1]))*110540;',
  '    const steps=Math.max(1,Math.min(32,Math.ceil(Math.hypot(dx,dy)/maxSegmentMeters)));',
  '    for(let j=0;j<steps;j++){',
  '      const t=j/steps;',
  '      result.push({lng:Number(a[0])+(Number(b[0])-Number(a[0]))*t,',
  '        lat:Number(a[1])+(Number(b[1])-Number(a[1]))*t,altitude:clearance});',
  '    }',
  '  }',
  '  return result;',
  '}',
  ''
].join('\n');
one('function updateLotGeometry(id){',meshFn+'function updateLotGeometry(id){','mesh interpolation helper');
one(
  '  poly.extruded=false;\n  // Huella sin extrusión: sigue el relieve pero flota 1.20 m sobre la superficie\n  // para evitar que la textura del terreno atraviese o parpadee sobre el color.\n  poly.path=f.geometry.coordinates[0].map(c=>({lat:c[1],lng:c[0],altitude:LOT_SURFACE_OFFSET_M}));',
  "  poly.extruded=false;\n  poly.altitudeMode='RELATIVE_TO_MESH';\n  poly.drawsOccludedSegments=false;\n  poly.path=sassiLotMeshPath(f.geometry.coordinates[0]);",
  'refresh 3D shape');
one(
  "      altitudeMode:'RELATIVE_TO_GROUND',\n      extruded:false,\n      drawsOccludedSegments:false",
  "      altitudeMode:'RELATIVE_TO_MESH',\n      extruded:false,\n      drawsOccludedSegments:false",
  'lot altitude mode');
one(
  '    // Sin extrusión. Cada vértice queda 1.20 m sobre su terreno local para mantener\n    // la lectura completa del lote sin crear un volumen vertical.\n    poly.path=f.geometry.coordinates[0].map(c=>({lat:c[1],lng:c[0],altitude:LOT_SURFACE_OFFSET_M}));',
  '    // Poligono interactivo sobre la malla 3D real, sin extrusión ni UV forzadas.\n    poly.path=sassiLotMeshPath(f.geometry.coordinates[0]);',
  'create 3D shape');
one(
  "const fills={donation:'#a0ac80cc',streets:'#bbaf96c8',parking:'#8b9188'};",
  "const fills={donation:'#a0ac805c',streets:'#bbaf9654',parking:'#8b91886b'};",
  'context transparency');
one(
  "const material={donation:['#667b5238','#b3b98a30'],streets:['#716b6230','#e3dcc038']};",
  "const material={donation:['#667b521a','#b3b98a14'],streets:['#716b6214','#e3dcc01a']};",
  'context materials');
one('const contextClearance={donation:3,parking:3,streets:0.72};',
    'const contextClearance={donation:0.22,parking:0.28,streets:0.16};','context elevation');
one("const height=contextClearance[data.group]+(kind==='texture'?0.26:0);",
    "const height=contextClearance[data.group]+(kind==='texture'?0.12:0);",'layers separation');
one("const node=new Poly({altitudeMode,extruded:false,drawsOccludedSegments:isTerrainSurface,",
    "const node=new Poly({altitudeMode,extruded:false,drawsOccludedSegments:false,",
    'context occlusion');
one('function sassiContextTerrainPath(points,height,maxSegmentMeters=12){',
    'function sassiContextTerrainPath(points,height,maxSegmentMeters=8){','context edge steps');
one("const node=new Line({altitudeMode:'RELATIVE_TO_GROUND',extruded:false,drawsOccludedSegments:false,",
    "const node=new Line({altitudeMode:'RELATIVE_TO_MESH',extruded:false,drawsOccludedSegments:false,",
    'district mode');
one("node.path=sassiContextPath(points,1.45);rememberContextNode(node,'districts','outline',district.name);",
    "node.path=sassiContextTerrainPath(points,0.32);rememberContextNode(node,'districts','outline',district.name);",
    'district elevation');
one("if(item.kind==='surface'){item.node.fillColor=custom.fill;item.node.strokeColor=custom.stroke;}",
    "if(item.kind==='surface'){const maxOpacity=item.group==='parking'?.72:.58;const finalOpacity=Math.min(custom.opacity,maxOpacity);item.node.fillColor=custom.color+Math.round(255*finalOpacity).toString(16).padStart(2,'0');item.node.strokeColor=custom.stroke;}",
    'photo transparency in 3D only');
fs.writeFileSync(file,html,'utf8');
console.log('[SASSI] H03: Google 3D mesh drape active; buyer/seller logic untouched.');
