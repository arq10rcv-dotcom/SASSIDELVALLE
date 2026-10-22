'use strict';
// Only used on experiments/sassi-premium-experience-v1. Does not mutate main.
const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'..','index.html');
let html=fs.readFileSync(file,'utf8');
const marker='SASSI_PREMIUM_BRANCH_V1';
if(html.includes(marker)){console.log('[SASSI PREMIUM] Already injected');process.exit(0)}
if(!html.includes('id="card"')||!html.includes('id="toolbar"')||!html.includes('id="entryGate"')||!html.includes('id="startBuyer"')||!html.includes('id="openSeller"'))throw Error('[SASSI PREMIUM] Existing source changed, safe stop.');
if(html.split('</head>').length!==2||html.split('</body>').length!==2)throw Error('[SASSI PREMIUM] Unexpected document structure');
html=html.replace('</head>',`<!-- ${marker} -->\n<link rel="stylesheet" href="./scripts/premium-experience.css">\n</head>`);
html=html.replace('</body>',`<script defer src="./scripts/premium-experience.js"></script>\n</body>`);
fs.writeFileSync(file,html,'utf8');
console.log('[SASSI PREMIUM] Isolated experience injected; original functions and data preserved.');
