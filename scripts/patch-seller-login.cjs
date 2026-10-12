// SASSI DEL VALLE: parche de despliegue, sin reescribir el HTML de 19 MB en GitHub.
// Se ejecuta al publicar desde Netlify o GitHub Pages.
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

function replaceOne(search, replacement) {
  const first = html.indexOf(search);
  if (first < 0 || html.indexOf(search, first + search.length) >= 0) {
    throw new Error(`SASSI seller login patch: unexpected HTML structure (${search.slice(0, 75)})`);
  }
  html = html.replace(search, replacement);
}

// No duplicar el parche en ejecuciones posteriores.
if (!html.includes('id="sassi-seller-login-click-fix"')) {
  replaceOne('<button id="openSeller">Vendedor</button>',
    '<button id="openSeller" type="button">Vendedor</button>');

  replaceOne(
    `    <div id="sellerLoginError" role="alert"></div>\n  </div>\n</div>\n\n\n<style id="sassi-seller-sheet-layout">`,
    `    <div id="sellerLoginError" role="alert"></div>\n  </div>\n</div>\n\n<!-- Respaldo independiente: el acceso Vendedor siempre muestra el diálogo. -->\n<style id="sassi-seller-login-visibility-fix">\n  #sellerLogin.open { display:flex!important; visibility:visible!important; opacity:1!important; pointer-events:auto!important; z-index:2147483000!important; }\n</style>\n<script id="sassi-seller-login-click-fix">\n(function(){\n  const trigger=document.getElementById('openSeller');\n  const dialog=document.getElementById('sellerLogin');\n  if(!trigger||!dialog)return;\n  trigger.addEventListener('click',function(event){\n    event.preventDefault();\n    // No detener propagación: la validación original continúa en Netlify.\n    dialog.classList.add('open');\n    const error=document.getElementById('sellerLoginError');\n    const password=document.getElementById('sellerPassword');\n    if(error)error.textContent='';\n    if(password){password.value='';setTimeout(()=>password.focus(),0);}\n  },true);\n})();\n</script>\n\n<style id="sassi-seller-sheet-layout">`);

  replaceOne(
    "if(err)err.textContent=result?.offline?'No se pudo verificar. Revisa tu conexión.':result?.limited?'Demasiados intentos. Espera un minuto.':'Contraseña incorrecta.';",
    "if(err)err.textContent=result?.offline?'No se pudo verificar. Revisa tu conexión.':result?.error==='not_configured'?'Acceso no configurado en Netlify.':result?.limited?'Demasiados intentos. Espera un minuto.':'Contraseña incorrecta.';"
  );
}

fs.writeFileSync(file, html, 'utf8');
console.log('[SASSI] Login Vendedor: ventana reforzada, validación en Netlify conservada.');

// Hito local: conservar puntos 360, imagenes y colores tras volver a abrir la pagina.
require('./apply-local-persistence.cjs');
