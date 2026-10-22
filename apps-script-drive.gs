/**
 * Canton Fair — guarda en Drive las fotos y la ficha de cada proveedor, y una hoja por carpeta.
 *
 * Estructura que arma:
 *   <carpeta destino>/                      (Fase 1, Fase 2, Fase 3, o Categorias/<categoria>)
 *       Suppliers (Google Sheet con todos los datos de esa carpeta)
 *       003 - Zhongshan Bright - 11.2 C15/
 *           booth.jpg  product.jpg  card.jpg  license.jpg
 *           ficha.txt
 *
 * Instalar (1 sola vez, con colorlednaguanagua@gmail.com):
 *  1. script.google.com -> Nuevo proyecto -> pegar este codigo -> guardar.
 *  2. Implementar -> Nueva implementacion -> "Aplicacion web".
 *       Ejecutar como: Yo (colorlednaguanagua@gmail.com)
 *       Quien tiene acceso: Cualquier usuario
 *  3. Autorizar (aviso de app no verificada -> Configuracion avanzada -> Ir a...).
 *  4. Copiar la URL que termina en /exec y pegarla en la app (Export -> Google Drive).
 */

function doGet() {
  return json_({ ok: true, ping: 'canton-fair drive' });
}

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents);
    var dir = target_(p);
    if (p.action === 'sheet') return json_(sheet_(dir, p));
    if (p.action === 'ficha') return json_(put_(dir, p.supplier, 'ficha.txt', Utilities.newBlob(p.text || '', 'text/plain', 'ficha.txt')));
    if (!p.data || !p.name) return json_({ ok: false, error: 'missing data' });
    return json_(put_(dir, p.supplier, p.name, Utilities.newBlob(Utilities.base64Decode(p.data), p.type || 'image/jpeg', p.name)));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// carpeta destino: id que manda la app, y si viene "sub" (categoria) una subcarpeta dentro
function target_(p) {
  var root = DriveApp.getFolderById(p.dest);
  return p.sub ? child_(root, p.sub) : root;
}

function child_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function put_(dir, supplier, name, blob) {
  var f = supplier ? child_(dir, supplier) : dir;
  var old = f.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true); // re-subir reemplaza, no duplica
  return { ok: true, id: f.createFile(blob).getId() };
}

function sheet_(dir, p) {
  var name = p.name || 'Suppliers';
  var it = dir.getFilesByName(name), ss;
  if (it.hasNext()) {
    ss = SpreadsheetApp.open(it.next());
  } else {
    ss = SpreadsheetApp.create(name);
    DriveApp.getFileById(ss.getId()).moveTo(dir);
  }
  var rows = [p.header].concat(p.rows || []);
  var sh = ss.getSheets()[0];
  sh.clear();
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.setFrozenRows(1);
  return { ok: true, url: ss.getUrl(), rows: rows.length - 1 };
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
