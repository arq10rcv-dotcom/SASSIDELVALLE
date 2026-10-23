'use strict';
// Only used on experiments/sassi-premium-experience-v1. Does not mutate main.
const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'..','index.html');
let html=fs.readFileSync(file,'utf8');
const marker='SASSI_PREMIUM_BRANCH_V1';
if(html.includes(marker)){console.log('[SASSI PREMIUM] Already injected');process.exit(0)}
if(!html.includes('id="card"')||!html.includes('id="toolbar"')||!html.includes('id="entryGate"')||!html.includes('id="startBuyer"')||!html.includes('id="openSeller"'))throw Error('[SASSI PREMIUM] Existing source changed, safe stop.');
if(html.split('</head>').length!==2||html.split('</body>').length!==2)throw Error('[SASSI PREMIUM] Unexpected document structure');
html=html.replace('</head>',`<!-- ${marker} -->\n<link rel="stylesheet" href="./scripts/premium-experience.css">\n<link rel="stylesheet" href="./scripts/premium-casonas-3d.css">\n</head>`);
html=html.replace('</body>',`<script defer src="./scripts/premium-experience.js"></script>\n<script defer src="./scripts/premium-casonas-3d.js"></script>\n</body>`);

// Height sync is optional: older Apps Script readers will keep the verified BH snapshot.
function replaceOptionalOnce(from,to,label){
  const pos=html.indexOf(from);
  if(pos<0||html.indexOf(from,pos+from.length)>=0)throw Error('[SASSI CASONAS] Unrecognized '+label);
  html=html.slice(0,pos)+to+html.slice(pos+from.length);
}
replaceOptionalOnce(
  'const clean={lote_id:id,estatus:normalizeSheetStatus(row.estatus??row.ESTATUS)};',
  "const clean={lote_id:id,estatus:normalizeSheetStatus(row.estatus??row.ESTATUS)};\n"+
  "    const rawHeight=Object.prototype.hasOwnProperty.call(row,'altura_casona_m')?row.altura_casona_m:\n"+
  "      Object.prototype.hasOwnProperty.call(row,'ALTURA DE CASONA m')?row['ALTURA DE CASONA m']:undefined;\n"+
  "    if(rawHeight!==undefined){\n"+
  "      const height=typeof rawHeight==='number'?rawHeight:Number(String(rawHeight).trim().replace(',','.'));\n"+
  "      if(!Number.isFinite(height)||height<0||height>60)throw new Error('ALTURA DE CASONA m inválida en '+id);\n"+
  "      clean.altura_casona_m=height;\n"+
  "    }",
  'optional Apps Script height field'
);
replaceOptionalOnce(
  'return {clean,changed,doterChanged,priceChanged};',
  "window.sassiCasonaHeightsFromSheet?.(clean.lots,clean.generatedAt);\n  return {clean,changed,doterChanged,priceChanged};",
  'SASSI heights sync after successful status update'
);

fs.writeFileSync(file,html,'utf8');
console.log('[SASSI PREMIUM] Isolated experience injected; original functions and data preserved.');
