'use strict';
// H04: split large Google Maps 3D polygons into small terrain-relative cells.
// No alterations to source GeoJSON, authentication, Sheets or 360 panoramas.
const fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../index.html');
let html=fs.readFileSync(file,'utf8');
const marker='SASSI_H04_MESH_TILES';
if(html.includes(marker)){console.log('[SASSI] H04 already applied');process.exit(0);}
function once(a,b,label){
  const p=html.indexOf(a);
  if(p<0||html.indexOf(a,p+a.length)!==-1)throw Error('[SASSI] H04 missing/ambiguous '+label);
  html=html.slice(0,p)+b+html.slice(p+a.length);
}
function sassiClipCellRing(ring,x0,y0,x1,y1){
  let out=ring;
  for(const [axis,val,greater] of [[0,x0,true],[0,x1,false],[1,y0,true],[1,y1,false]]){
    if(out.length<3)return [];
    const result=[];let a=out[out.length-1];
    for(const b of out){
      const aIn=greater?a[axis]>=val-1e-8:a[axis]<=val+1e-8;
      const bIn=greater?b[axis]>=val-1e-8:b[axis]<=val+1e-8;
      if(aIn!==bIn){
        const t=(val-a[axis])/(b[axis]-a[axis]);
        result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
      }
      if(bIn)result.push(b);
      a=b;
    }
    out=result;
  }
  return out;
}
function sassiMeshCellPaths(coords,sizeMeters=15,height=.8){
  if(!Array.isArray(coords)||coords.length<3)return [];
  const anchor=coords[0],lat0=Number(anchor[1]),lng0=Number(anchor[0]);
  const sx=111320*Math.cos(lat0*Math.PI/180),sy=110540;
  const ring=[];
  for(const raw of coords){
    const p=[(Number(raw[0])-lng0)*sx,(Number(raw[1])-lat0)*sy];
    if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))return [];
    if(!ring.length||Math.hypot(p[0]-ring[ring.length-1][0],p[1]-ring[ring.length-1][1])>.015)ring.push(p);
  }
  if(ring.length>1&&Math.hypot(ring[0][0]-ring[ring.length-1][0],ring[0][1]-ring[ring.length-1][1])<.015)ring.pop();
  if(ring.length<3)return [];
  const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
  const minX=Math.floor(Math.min(...xs)/sizeMeters),maxX=Math.ceil(Math.max(...xs)/sizeMeters);
  const minY=Math.floor(Math.min(...ys)/sizeMeters),maxY=Math.ceil(Math.max(...ys)/sizeMeters);
  const pieces=[];
  for(let x=minX;x<maxX;x++)for(let y=minY;y<maxY;y++){
    const cut=sassiClipCellRing(ring,x*sizeMeters,y*sizeMeters,(x+1)*sizeMeters,(y+1)*sizeMeters);
    if(cut.length<3)continue;
    let area=0;
    for(let i=0;i<cut.length;i++){const a=cut[i],b=cut[(i+1)%cut.length];area+=a[0]*b[1]-b[0]*a[1];}
    if(Math.abs(area)<1)continue;
    pieces.push(cut.map(p=>({lng:lng0+p[0]/sx,lat:lat0+p[1]/sy,altitude:height})));
  }
  return pieces;
}
const helpers='// '+marker+'\nconst sassiLotTilesById=new Map();\n'
  +sassiClipCellRing.toString()+'\n'+sassiMeshCellPaths.toString()+'\n';
once('function sassiLotMeshPath(ring, clearance=LOT_SURFACE_OFFSET_M, maxSegmentMeters=6){',
  helpers+'function sassiLotMeshPath(ring, clearance=LOT_SURFACE_OFFSET_M, maxSegmentMeters=6){',
  'helper insertion');
once('  poly.path=sassiLotMeshPath(f.geometry.coordinates[0]);\n  const pt=statusPointById.get(id);',
  '  poly.path=sassiLotMeshPath(f.geometry.coordinates[0],0.95);\n  const pt=statusPointById.get(id);','outline update');
once("    poly.fillColor=alphaColor(STATUS_COLORS[getLotStatus(id)],Math.round(selectedLotFillOpacity(getLotStatus(id))*255).toString(16).padStart(2,'0'));",
  "    const selectedColor=alphaColor(STATUS_COLORS[getLotStatus(id)],Math.round(selectedLotFillOpacity(getLotStatus(id))*255).toString(16).padStart(2,'0'));\n    poly.fillColor='#00000000';\n    for(const tile of sassiLotTilesById.get(id)||[])tile.fillColor=selectedColor;",
  'selected tile coloring');
once("  poly.fillColor=st.fill;\n  poly.strokeColor=",
  "  poly.fillColor='#00000000';\n  for(const tile of sassiLotTilesById.get(id)||[])tile.fillColor=st.fill;\n  poly.strokeColor=",
  'status tile coloring');
once("      fillColor:lotStyle.fill,\n      strokeColor:lotStyle.stroke,",
  "      fillColor:'#00000000',\n      strokeColor:lotStyle.stroke,",
  'outline transparent fill');
once("    poly.path=sassiLotMeshPath(f.geometry.coordinates[0]);\n    poly.addEventListener",
  "    poly.path=sassiLotMeshPath(f.geometry.coordinates[0],0.95);\n    poly.addEventListener",
  'outline geometry');
const lotCells=[
"    polygonById.set(p.lote_id,poly);",
"    const tiles=[];",
"    const VisibleTile=lib.Polygon3DInteractiveElement||lib.Polygon3DElement;",
"    const paths=sassiMeshCellPaths(f.geometry.coordinates[0],15,0.78);",
"    for(const path of paths){",
"      const node=new VisibleTile({altitudeMode:'RELATIVE_TO_MESH',extruded:false,",
"        drawsOccludedSegments:false,fillColor:lotStyle.fill,strokeColor:'#00000000',strokeWidth:0,zIndex:4});",
"      node.path=path;",
"      node.addEventListener('gmp-click',()=>selectLot(f,true));",
"      tiles.push(node);map.append(node);",
"    }",
"    sassiLotTilesById.set(p.lote_id,tiles);",
"    // createStatusPoint(f);"
].join('\n');
once("    polygonById.set(p.lote_id,poly);\n    // createStatusPoint(f);",lotCells,'lot tiling');
once("    for(const poly of polygonById.values()){try{if(!poly.isConnected)map.append(poly);}catch(e){}}",
  "    for(const poly of polygonById.values()){try{if(!poly.isConnected)map.append(poly);}catch(e){}}\n    for(const tiles of sassiLotTilesById.values())for(const tile of tiles){try{if(!tile.isConnected)map.append(tile);}catch(e){}}",
  'show tiles in 360 reset');
once("  for(const poly of polygonById.values()){try{poly.remove();}catch(e){}}",
  "  for(const poly of polygonById.values()){try{poly.remove();}catch(e){}}\n  for(const tiles of sassiLotTilesById.values())for(const tile of tiles){try{tile.remove();}catch(e){}}",
  'hide tiles in 360 mode');
const context=[
"    const isParking=data.group==='parking';",
"    if(kind==='texture'){",
"      const options=material[data.group];if(!options)return;",
"      const textureColor=options[data.tone]||'#00000000';",
"      for(const path of sassiMeshCellPaths(data.outer,25,.88)){",
"        const segment=new Poly({altitudeMode:'RELATIVE_TO_MESH',extruded:false,drawsOccludedSegments:false,",
"          fillColor:textureColor,strokeColor:'#00000000',strokeWidth:0,zIndex:5});",
"        segment.path=path;segment.sassiDetailStyle={fillColor:textureColor,strokeColor:'#00000000',strokeWidth:0};",
"        rememberContextNode(segment,data.group,'texture');",
"      }return;",
"    }",
"    // Huge CAD road polygons have many interior holes: show their true",
"    // boundaries in 3D instead of one plane cutting through the Google mesh.",
"    if(data.group==='streets'){",
"      const outline=new Line({altitudeMode:'RELATIVE_TO_MESH',extruded:false,drawsOccludedSegments:false,",
"        strokeColor:strokes.streets,strokeWidth:sassiAdaptiveStroke3D(2,.4,2),zIndex:12});",
"      outline.path=sassiContextTerrainPath(data.outer,.92,6);",
"      rememberContextNode(outline,'streets','outline');",
"      outline.sassiDetailStyle={strokeColor:outline.strokeColor,strokeWidth:2};",
"      return;",
"    }",
"    if(data.group==='donation'||data.group==='parking'){",
"      const color=fills[data.group];",
"      for(const path of sassiMeshCellPaths(data.outer,25,.68)){",
"        const segment=new Poly({altitudeMode:'RELATIVE_TO_MESH',extruded:false,drawsOccludedSegments:false,",
"          fillColor:color,strokeColor:'#00000000',strokeWidth:0,zIndex:3});",
"        segment.path=path;segment.sassiDetailStyle={fillColor:color,strokeColor:'#00000000',strokeWidth:0};",
"        rememberContextNode(segment,data.group,'surface');",
"      }return;",
"    }",
"    // Relleno y textura comparten"
].join('\n');
once("    const isParking=data.group==='parking';\n    // Relleno y textura comparten",context,'context terrain');
fs.writeFileSync(file,html,'utf8');
console.log('[SASSI] H04: subdivided 3D surfaces, all 200 interactive lot IDs retained.');
