'use strict';
// MODO TEMPORAL: el boton Vendedor abre el panel sin contrasena.
// Esto NO desactiva la API de autenticacion ni modifica permisos de Google Sheets.
// El panel sera accesible a cualquier persona que abra la pagina publica.
// Para restaurar la contrasena: retirar este comando de build en netlify.toml.
const fs = require('node:fs');
const path = require('node:path');
const htmlPath = path.join(__dirname, '..', 'index.html');
const original = fs.readFileSync(htmlPath, 'utf8');
const before = "document.getElementById('openSeller')?.addEventListener('click',()=>{sellerAuthenticated=false;askSellerPassword();});";
const after = "document.getElementById('openSeller')?.addEventListener('click',()=>{openSeller();});";
const occurrences = original.split(before).length - 1;
if (occurrences !== 1) {
  throw new Error(`SASSI: el acceso no se modifico. Patron esperado una vez, encontrado ${occurrences}.`);
}
fs.writeFileSync(htmlPath, original.replace(before, after), 'utf8');
console.log('SASSI: acceso temporal al panel Vendedor sin formulario activado.');
