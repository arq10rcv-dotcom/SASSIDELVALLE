// SASSI · HITO 02: 00_LOTES verificado y lector tolerante a filas auxiliares.
// Aplica al build de Netlify; no modifica geometria, imagenes ni autenticacion.
const fs=require('node:fs'),path=require('node:path');
const target=path.resolve(__dirname,'../index.html');
const snapshot=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../data/sassi-statuses-verified.json'),'utf8'));
const marker='SASSI_SHEETS_SYNC_H02';
const ids=new Set();
if(snapshot.project!=='SASSI_DEL_VALLE'||snapshot.schema!=='sassi-status-v1'||snapshot.source!=='00_LOTES'||snapshot.lots?.length!==200||!Number.isFinite(Date.parse(snapshot.generatedAt)))throw Error('SASSI: copia invalida');
for(const item of snapshot.lots){
  if(!/^SV-\d{3}$/.test(item.lote_id)||ids.has(item.lote_id)||!['DISPONIBLE','APARTADO','VENDIDO','SIN_DEFINIR'].includes(item.estatus))throw Error('SASSI: lote duplicado o estado invalido');
  ids.add(item.lote_id);
}
for(let n=1;n<=200;n++)if(!ids.has('SV-'+String(n).padStart(3,'0')))throw Error('SASSI: falta lote '+n);
let html=fs.readFileSync(target,'utf8');
if(html.includes(marker)){console.log('[SASSI] HITO 02 ya aplicado');process.exit(0)}
function replaceOnce(oldValue,newValue,title){
  const pos=html.indexOf(oldValue);
  if(pos<0||html.indexOf(oldValue,pos+oldValue.length)>=0)throw Error('SASSI: no se encuentra cambio unico '+title);
  html=html.slice(0,pos)+newValue+html.slice(pos+oldValue.length);
}
const start='const SASSI_STATUS_SNAPSHOT=';
const begin=html.indexOf(start),end=html.indexOf(';\nconst statusById=',begin);
if(begin<0||end<0||html.indexOf(start,begin+1)>=0)throw Error('SASSI: snapshot original no identificado');
html=html.slice(0,begin)+start+JSON.stringify(snapshot)+'; // '+marker+html.slice(end+1);
replaceOnce(
  "try{if(!sheetsEndpoint)sheetsEndpoint=normalizeSheetsEndpoint(localStorage.getItem(SASSI_SYNC_ENDPOINT_KEY)||'');}catch(e){}",
  "try{const saved=normalizeSheetsEndpoint(localStorage.getItem(SASSI_SYNC_ENDPOINT_KEY)||'');if(saved)sheetsEndpoint=saved;}catch(e){console.warn('SASSI: URL guardada no valida',e);}",
  'lector guardado'
);
replaceOnce(
  "if(!Array.isArray(payload.lots)||payload.lots.length!==FEATURES.length||!Number.isFinite(Date.parse(payload.generatedAt)))",
  "if(!Array.isArray(payload.lots)||!Number.isFinite(Date.parse(payload.generatedAt)))",
  'filas auxiliares'
);
replaceOnce(
  'const lots=payload.lots.map(row=>{',
  'const lots=payload.lots.filter(row=>featureById.has(normalizeId(row?.lote_id??row?.LOTE_ID))).map(row=>{',
  'filtrar IDs'
);
replaceOnce(
  'const id=normalizeId(row?.lote_id);',
  'const id=normalizeId(row?.lote_id??row?.LOTE_ID);',
  'IDs alternativos'
);
replaceOnce(
  'estatus:normalizeSheetStatus(row.estatus)',
  'estatus:normalizeSheetStatus(row.estatus??row.ESTATUS)',
  'columna ESTATUS'
);
replaceOnce(
  '    return clean;\n  });\n  return {schema:',
  "    return clean;\n  });\n  if(lots.length!==FEATURES.length)throw new Error('Google entrego '+lots.length+' de '+FEATURES.length+' lotes. Se conserva la copia verificada.');\n  if(Date.parse(payload.generatedAt)<Date.parse(SASSI_STATUS_SNAPSHOT.generatedAt)){\n    const baseline=new Map(SASSI_STATUS_SNAPSHOT.lots.map(x=>[x.lote_id,x.estatus]));\n    if(lots.some(row=>baseline.get(row.lote_id)!==row.estatus))throw new Error('Lector de Google obsoleto. Revisa la version publicada de Apps Script.');\n  }\n  return {schema:",
  'validacion 200 y version'
);
replaceOnce(
  'const result=applySassiStatuses(payload);sheetsLastRead=result.clean.generatedAt;',
  'const result=applySassiStatuses(payload);sheetsLastRead=new Date().toISOString();result.clean.generatedAt=sheetsLastRead;',
  'hora de consulta'
);
fs.writeFileSync(target,html,'utf8');
console.log('[SASSI] HITO 02 aplicado: 200 estatus verificados; lector robusto ante filas adicionales.');
