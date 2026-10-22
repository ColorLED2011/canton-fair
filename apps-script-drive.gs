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
    if (p.action === 'card') return json_(card_(p));   // OCR de la tarjeta, no escribe en Drive
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

// Lee la tarjeta con el OCR de Google Drive y devuelve los datos sueltos.
// Requiere el servicio avanzado "Drive API" activado en el proyecto (Servicios -> Drive API, v2).
function card_(p) {
  var blob = Utilities.newBlob(Utilities.base64Decode(p.data), p.type || 'image/jpeg', 'card.jpg');
  var doc = Drive.Files.insert({ title: 'ocr-tmp-' + Date.now(), mimeType: 'application/vnd.google-apps.document' },
                               blob, { ocr: true, ocrLanguage: p.lang || 'en' });
  var text = '';
  try { text = DocumentApp.openById(doc.id).getBody().getText(); } finally { DriveApp.getFileById(doc.id).setTrashed(true); }
  return { ok: true, text: text, fields: parseCard_(text) };
}

function parseCard_(t) {
  var lines = (t || '').split('\n').map(function (l) { return l.trim(); }).filter(String);
  var find = function (re) { for (var i = 0; i < lines.length; i++) if (re.test(lines[i])) return lines[i]; return ''; };
  var tail = function (line) { if (!line) return ''; var m = line.match(/[:：]?\s*([+\d][\d\s().\-]{5,}\d|[A-Za-z0-9_.\-]{4,})\s*$/); return m ? m[1].trim() : ''; };
  var email = (t.match(/[\w.\-+]+@[\w\-]+\.[\w.\-]+/) || [''])[0];
  var phones = (t.match(/[+]?\d[\d\s().\-]{7,}\d/g) || []).map(function (s) { return s.trim(); });
  var whatsLine = find(/whats\s?app/i), wechatLine = find(/wechat|weixin|微信/i), phoneLine = find(/tel|phone|mobile|手机|电话/i);
  var companyRe = /co\.,?\s*ltd|company|limited|factory|industr|有限公司|集团|公司|厂/i;
  var company = find(companyRe);
  var name = '';
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    if (l === company || companyRe.test(l) || /@|www\.|http/i.test(l) || /\d{5,}/.test(l)) continue;
    if (l.length > 2 && l.length < 40) { name = l; break; }
  }
  var whats = tail(whatsLine), wechat = tail(wechatLine), phone = tail(phoneLine) || phones[0] || '';
  // el telefono de la tarjeta suele servir tambien de whatsapp, pero no lo inventamos
  return { company: company, contact: name, phone: phone, whats: whats, wechat: wechat, email: email };
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
