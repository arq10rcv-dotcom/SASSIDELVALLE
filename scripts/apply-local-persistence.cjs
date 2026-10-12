// SASSI · Hito guardado local. Se aplica durante el build de Netlify.
// Mantiene intacto el index.html fuente y modifica solo el controlador de panoramas.
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(target, 'utf8');
const version = 'SASSI_LOCAL_PERSISTENCE_H01';
if (html.includes(version)) {
  console.log('[SASSI] Hito guardado local ya aplicado.');
  process.exit(0);
}
function replaceOnce(before, after, title) {
  const start = html.indexOf(before);
  if (start < 0 || html.indexOf(before, start + before.length) >= 0) {
    throw new Error('[SASSI] No se pudo aplicar cambio ' + title + ': origen no encontrado o ambiguo.');
  }
  html = html.slice(0, start) + after + html.slice(start + before.length);
}
replaceOnce(
  "const DB_NAME='SASSI_PANORAMAS_V1',STORE='points',SCHEMA='sassi-panoramas-v1',DEFAULT_COLOR='#c58f43';",
  "const DB_NAME='SASSI_PANORAMAS_V1',STORE='points',SCHEMA='sassi-panoramas-v1',DEFAULT_COLOR='#c58f43';\n  const TOMBSTONE_PREFIX='SASSI_DELETED_'; // SASSI_LOCAL_PERSISTENCE_H01",
  'identificadores de guardado'
);
replaceOnce(
  "  const clock=()=>performance.now();",
  "  const clock=()=>performance.now();\n  async function requestDurableStorage(){\n    try{if(navigator.storage&&typeof navigator.storage.persist==='function')await navigator.storage.persist();}\n    catch(e){console.warn('SASSI: almacenamiento persistente no disponible',e);}\n  }",
  'permanencia del almacenamiento'
);
replaceOnce(
  "      for(const record of records)store.put(record);if(removeId)store.delete(removeId);",
  "      for(const record of records){store.put(record);store.delete(TOMBSTONE_PREFIX+record.id);}\n      if(removeId){store.put({id:TOMBSTONE_PREFIX+removeId,deletedAt:new Date().toISOString()});store.delete(removeId);}",
  'guardado y eliminación en IndexedDB'
);
replaceOnce(
  "    try{await writePoints([record]);points.set(record.id,record);",
  "    try{await requestDurableStorage();await writePoints([record]);points.set(record.id,record);",
  'solicitud de almacenamiento persistente al guardar'
);
replaceOnce(
  "      const existingIds = new Set(list.map(p => p.id));\n      const missing = DEFAULT_PANORAMA_RECORDS.filter(p => !existingIds.has(p.id));",
  "      const existingIds = new Set(list.map(p => p.id));\n      const removedIds = new Set(list.filter(p=>typeof p?.id==='string'&&p.id.startsWith(TOMBSTONE_PREFIX)).map(p=>p.id.slice(TOMBSTONE_PREFIX.length)));\n      const missing = DEFAULT_PANORAMA_RECORDS.filter(p => !existingIds.has(p.id)&&!removedIds.has(p.id));",
  'no restaurar panoramas eliminados'
);
replaceOnce(
  "      for(const row of list){\n        try{\n          const record=validateRecord(row);",
  "      for(const row of list){\n        if(typeof row?.id==='string'&&row.id.startsWith(TOMBSTONE_PREFIX))continue;\n        try{\n          const record=validateRecord(row);",
  'no mostrar marcas de eliminación'
);
replaceOnce(
  "      message(points.size+' panoramas 360° recuperados.',false);",
  "      message('No se pudo leer el almacenamiento local. Los panoramas incluidos se muestran temporalmente; no se garantiza conservar cambios hasta resolver el problema.',true);",
  'aviso de error de almacenamiento'
);
replaceOnce(
  "<small class=\"pano-storage-note\">Se guardan en este navegador. Exporta una copia para respaldarlos o llevarlos a otro equipo.</small>",
  "<small class=\"pano-storage-note\">Se guardan automáticamente en este navegador al pulsar Guardar punto, incluidas imágenes, ubicaciones y colores. Se recuperan al volver a abrir el mismo sitio. Para protegerlos de un borrado de datos del navegador, utiliza Exportar puntos e imágenes.</small>",
  'aviso visible de guardado local'
);
fs.writeFileSync(target, html, 'utf8');
console.log('[SASSI] Guardado local reforzado y eliminación persistente aplicada.');
