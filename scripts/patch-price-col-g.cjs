'use strict';
// H05: VALOR APs from column G = lot sale price in USD, not PRECIO FINAL (L).
// Runs at build after H02 and before map geometry patches.
const fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../index.html');
const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../data/sassi-prices-col-g.json'),'utf8'));
if(data.schema!=='sassi-prices-g-v1'||data.project!=='SASSI_DEL_VALLE'||data.source!=='00_LOTES!G'||data.currency!=='USD'||data.lots?.length!==200)throw Error('[SASSI H05] Invalid column G snapshot');
const seen=new Set();
for(const row of data.lots){if(!/^SV-\d{3}$/.test(row.lote_id)||seen.has(row.lote_id)||typeof row.valor_aps!=='number'||!Number.isFinite(row.valor_aps)||row.valor_aps<0)throw Error('[SASSI H05] Invalid/duplicated lot');seen.add(row.lote_id);}
for(let n=1;n<=200;n++)if(!seen.has('SV-'+String(n).padStart(3,'0')))throw Error('[SASSI H05] Missing lot '+n);
let html=fs.readFileSync(file,'utf8');
if(html.includes('SASSI_VALOR_APS_G_H05')){console.log('[SASSI] H05 already applied');process.exit(0)}
function once(a,b,label){const pos=html.indexOf(a);if(pos<0||html.indexOf(a,pos+a.length)>=0)throw Error('[SASSI H05] Invalid anchor '+label);html=html.slice(0,pos)+b+html.slice(pos+a.length)}
const marker='SASSI_VALOR_APS_G_H05';
const base='const statusById=new Map(SASSI_STATUS_SNAPSHOT.lots.map(row=>[row.lote_id,row.estatus]));';
const helpers='\n// '+marker+': snapshot of column G keyed by LOTE_ID.\n'+
 'const SASSI_PRICES_G_SNAPSHOT='+JSON.stringify(data)+';\n'+
 [
 'const sassiValorApsById=new Map(SASSI_PRICES_G_SNAPSHOT.lots.map(row=>[row.lote_id,row.valor_aps]));',
 "let sassiPriceReadSource='snapshot';",
 'function sassiParseValorAps(value){',
 "  if(value===null||value===undefined||value==='')return null;",
 '  let number;',
 "  if(typeof value==='number')number=value;",
 '  else{',
 "    const normalized=String(value).trim().replace(/^USD\\s*/i,'').replace(/\\s/g,'').replace(/,/g,'');",
 "    if(!/^\\d+(?:\\.\\d{1,2})?$/.test(normalized))return null;",
 '    number=Number(normalized);',
 '  }',
 '  return Number.isFinite(number)&&number>=0&&number<=1e12?number:null;',
 '}',
 'function getSassiPrecioVentaUSD(id){',
 '  const num=sassiValorApsById.get(id);',
 "  return typeof num==='number'&&Number.isFinite(num)&&num>0?",
 "    new Intl.NumberFormat('es-MX',{style:'currency',currency:'USD',currencyDisplay:'code',minimumFractionDigits:2,maximumFractionDigits:2}).format(num):'—';",
 '}',
 'window.getSassiPrecioVentaUSD=getSassiPrecioVentaUSD;'
 ].join('\n')+'\n';
once(base,base+helpers,'price data after status data');
// Main map card, no price/m2 inferred from the total.
once("const pv=document.getElementById('precioVenta'); if(pv)pv.textContent='—';",
     "const pv=document.getElementById('precioVenta'); if(pv)pv.textContent=getSassiPrecioVentaUSD(p.lote_id);",'map selected card');
once("precioVenta:'—',precioM2Venta:'—',propiedad:",
     "precioVenta:getSassiPrecioVentaUSD(row.lote_id),precioM2Venta:'—',propiedad:",'seller preview');
once("precioVenta:money(r.precio_venta??r.precioVenta),precioM2Venta:",
     "precioVenta:getSassiPrecioVentaUSD(id),precioM2Venta:",'APOL card');
// JSONP reader can include G under an explicit header; older readers still update status,
// but cannot override the verified price snapshot with missing fields.
once("const clean={lote_id:id,estatus:normalizeSheetStatus(row.estatus??row.ESTATUS)};",
"const clean={lote_id:id,estatus:normalizeSheetStatus(row.estatus??row.ESTATUS)};\n    const rawG=Object.prototype.hasOwnProperty.call(row,'valor_aps')?row.valor_aps:\n      Object.prototype.hasOwnProperty.call(row,'VALOR APs')?row['VALOR APs']:\n      Object.prototype.hasOwnProperty.call(row,'VALOR_APS')?row.VALOR_APS:\n      Object.prototype.hasOwnProperty.call(row,'valorAps')?row.valorAps:undefined;\n    if(rawG!==undefined){\n      const parsed=sassiParseValorAps(rawG);\n      if(parsed===null)throw new Error('Precio G inválido en '+id+'; se conservan los últimos precios confirmados.');\n      clean.valor_aps=parsed;\n    }",'optional field G from reader');
once('const clean=validateSassiStatuses(payload),changed=[],doterChanged=[];',
     'const clean=validateSassiStatuses(payload),changed=[],doterChanged=[],priceChanged=[];','track price changes');
once('  for(const row of clean.lots){\n    if(statusById.get(row.lote_id)!==row.estatus){',
"  for(const row of clean.lots){\n    if(Object.prototype.hasOwnProperty.call(row,'valor_aps')&&Date.parse(clean.generatedAt)>=Date.parse(SASSI_PRICES_G_SNAPSHOT.generatedAt)){\n      if(sassiValorApsById.get(row.lote_id)!==row.valor_aps){\n        sassiValorApsById.set(row.lote_id,row.valor_aps);priceChanged.push(row.lote_id);\n      }\n      sassiPriceReadSource='reader';\n    }\n    if(statusById.get(row.lote_id)!==row.estatus){", 'apply G prices on valid fresh response');
once("const field=document.getElementById('doter');if(field)field.textContent=getSassiDoterText(id);",
     "const field=document.getElementById('doter');if(field)field.textContent=getSassiDoterText(id);\n    const price=document.getElementById('precioVenta');if(price)price.textContent=getSassiPrecioVentaUSD(id);",'refresh selected price');
once('window.refreshSassiApol?.([...new Set([...changed,...doterChanged])]);',
     'window.refreshSassiApol?.([...new Set([...changed,...doterChanged,...priceChanged])]);','refresh APOL if price changes');
once('return {clean,changed,doterChanged};','return {clean,changed,doterChanged,priceChanged};','return price changes');
// Distinguish statuses synchronized from pricing snapshot if old reader does not include G.
once("if(detail)detail.textContent=sheetsSyncMessage||(!sheetsEndpoint?'Conexión pendiente. Pega la URL /exec del lector.':message+' · consulta automática cada 1 min.'+(sheetsDotersConfigured===false?' · DOTER pendiente: agrega USOS_DOTER y actualiza el lector.':''));",
"if(detail)detail.textContent=sheetsSyncMessage||(!sheetsEndpoint?'Conexión pendiente. Pega la URL /exec del lector.':message+' · consulta automática cada 1 min.'+(sheetsDotersConfigured===false?' · DOTER pendiente: agrega USOS_DOTER y actualiza el lector.':'')+(sassiPriceReadSource==='snapshot'?' · Precio USD: copia de columna G (la actualización en vivo necesita valor_aps en el lector).':' · Precios USD sincronizados.'));",
'price freshness label');
fs.writeFileSync(file,html,'utf8');
console.log('[SASSI] H05 200 lot prices linked to G (USD). Existing states and 3D unchanged.');
