// docx.js — arma un archivo de Word (.docx) en el navegador, sin librerías.
//
// Por qué existe: Ángel necesita firmar las cuentas de cobro a mano, y un PDF
// no se puede editar. «la cuenta de cobro en pdf no debe quedar, debe quedar en
// word, para que yo ponga la firma» (27-jul-2026).
//
// Un .docx es un ZIP con unos XML adentro. Acá se arma el ZIP a mano usando el
// método STORE (sin comprimir) — Word lo acepta igual y así no hace falta ninguna
// dependencia. Lección de esta misma semana: NO mandes el archivo como base64
// pegado en un JSON, se pierden los «+» y llega corrupto. Acá el archivo se genera
// y se descarga en la misma máquina, así que no viaja por ningún lado.

/* ────────────────────────── ZIP (store + CRC32) ────────────────────────── */

let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c >>> 0;
  }
  return CRC_TABLE;
}

function crc32(bytes) {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// files: [{ name, data: Uint8Array }] → Blob del zip
function zipStore(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);

    const head = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(head.buffer);
    dv.setUint32(0, 0x04034b50, true);   // firma del encabezado local
    dv.setUint16(4, 20, true);           // versión necesaria (2.0)
    dv.setUint16(6, 0x0800, true);       // nombres en UTF-8
    dv.setUint16(8, 0, true);            // método 0 = sin comprimir
    dv.setUint16(10, 0, true);           // hora
    dv.setUint16(12, 0x0021, true);      // fecha (1980-01-01, fija: el zip es reproducible)
    dv.setUint32(14, crc, true);
    dv.setUint32(18, f.data.length, true);
    dv.setUint32(22, f.data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    head.set(nameBytes, 30);

    parts.push(head, f.data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x0021, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, f.data.length, true);
    cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += head.length + f.data.length;
  }

  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/* ────────────────────────── XML del documento ────────────────────────── */

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Un bloque = un párrafo.
//   { text, bold, italic, size (pt), align: left|center|right|justify,
//     before/after (pt de espacio), color: "1E7F72", linea: true (raya abajo) }
// text puede ser un array de trozos: [{ t, bold }] para negrita a mitad de línea.
function parrafo(b = {}) {
  const trozos = Array.isArray(b.text) ? b.text : [{ t: b.text ?? "", bold: b.bold, italic: b.italic }];

  // OJO: el orden de los hijos de <w:pPr> es obligatorio en OOXML
  // (pBdr → spacing → ind → jc). Si se altera, Word dice que el archivo
  // está dañado. Fue el bug del reporte de esta semana.
  let pPr = "";
  if (b.linea) pPr += '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="D0D5DD"/></w:pBdr>';
  const before = Math.round((b.before ?? 0) * 20);
  const after = Math.round((b.after ?? 6) * 20);
  pPr += `<w:spacing w:before="${before}" w:after="${after}" w:line="276" w:lineRule="auto"/>`;
  if (b.indent) pPr += `<w:ind w:left="${Math.round(b.indent * 20)}"/>`;
  if (b.align && b.align !== "left") pPr += `<w:jc w:val="${b.align}"/>`;

  const runs = trozos
    .map((r) => {
      const size = Math.round((r.size ?? b.size ?? 11) * 2); // half-points
      let rPr = `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
      if (r.bold ?? b.bold) rPr = "<w:b/>" + rPr;
      if (r.italic ?? b.italic) rPr = "<w:i/>" + rPr;
      const color = r.color ?? b.color;
      if (color) rPr += `<w:color w:val="${color.replace("#", "")}"/>`;
      const texto = esc(r.t ?? r);
      return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${texto}</w:t></w:r>`;
    })
    .join("");

  return `<w:p><w:pPr>${pPr}</w:pPr>${runs}</w:p>`;
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const CONTENT_TYPES = `${XML_HEAD}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const RELS = `${XML_HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `${XML_HEAD}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `${XML_HEAD}
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/>
<w:lang w:val="es-CO"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`;

/**
 * Arma el .docx. `bloques` es la lista de párrafos (ver parrafo()).
 * Devuelve un Blob listo para descargar.
 */
export function buildDocx(bloques = []) {
  const cuerpo = bloques.map(parrafo).join("");
  const document = `${XML_HEAD}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${cuerpo}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="708" w:footer="708" w:gutter="0"/>
</w:sectPr></w:body></w:document>`;

  const enc = new TextEncoder();
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES) },
    { name: "_rels/.rels", data: enc.encode(RELS) },
    { name: "word/_rels/document.xml.rels", data: enc.encode(DOC_RELS) },
    { name: "word/styles.xml", data: enc.encode(STYLES) },
    { name: "word/document.xml", data: enc.encode(document) },
  ]);
}

/** Genera el .docx y lo baja al equipo. */
export function descargarDocx(nombreArchivo, bloques) {
  const blob = buildDocx(bloques);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo.endsWith(".docx") ? nombreArchivo : `${nombreArchivo}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return blob;
}
