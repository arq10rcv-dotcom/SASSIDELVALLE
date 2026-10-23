'use strict';
// H07 is exclusive to the Premium deploy preview. Never merge into production main.
const fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../index.html');
let html=fs.readFileSync(file,'utf8');
const marker='SASSI_PREMIUM_MODEL3D_H07';
if(html.includes(marker)){console.log('[SASSI H07] Already installed');process.exit(0)}
if(!html.includes('const FEATURES=')||!html.includes('function selectLot(f,fly)')||
   !html.includes('function getLotStatus(id)')||!html.includes('id="toolbar"')||
   !html.includes('SASSI_PREMIUM_BRANCH_V1')){
 throw Error('[SASSI H07] Existing sources absent or Premium patch not applied; abort');
}
if(html.split('</head>').length!==2||html.split('</body>').length!==2)throw Error('[SASSI H07] Unexpected HTML');
const header=[
 '<!-- '+marker+' -->',
 '<script type="importmap">',
 '{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}',
 '</script>',
 '<link rel="stylesheet" href="./scripts/premium-modelo3d.css">'
].join('\n');
const bridge=[
 '<script id="sassi-technical-data-bridge">',
 '(function(){',
 '  window.sassiTechnicalBridge={',
 '    get features(){return FEATURES},',
 '    status:function(id){return getLotStatus(id)},',
 '    select:function(feature){selectLot(feature,false)}',
 '  };',
 '})();',
 '</script>',
 '<script defer src="./scripts/premium-modelo3d.js"></script>'
].join('\n');
html=html.replace('</head>',header+'\n</head>');
html=html.replace('</body>',bridge+'\n</body>');
fs.writeFileSync(file,html,'utf8');
console.log('[SASSI H07] 3D technical view added to Premium preview only.');
