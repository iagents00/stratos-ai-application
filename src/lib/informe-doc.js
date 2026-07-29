// informe-doc.js — convierte el texto del reporte en bloques de Word con la
// forma del documento que ya se le manda a RH de Duke del Caribe.
//
// Pedido de Ángel (29-jul): «básate en el documento de Word, así es como hemos
// estado enviando los reportes… necesitamos que se genere automáticamente».
//
// El reporte viaja como TEXTO PLANO (el redactor no escribe markdown: si
// escribiera, cualquier canal que no lo renderice —Telegram, un correo, la
// pantalla— mostraría los asteriscos crudos). Para no perder la jerarquía, el
// texto sigue una convención fija y acá se vuelve a levantar:
//
//   Primera línea            → título del documento
//   Periodo: / Responsables: / Proyecto:  → ficha, con la etiqueta en negrita
//   LÍNEA EN MAYÚSCULAS      → sección (PARTE 1 — TRABAJO REALIZADO)
//   Semana N — <tema>        → subtítulo de semana
//   • Titular: texto         → viñeta, con el titular en negrita
//     · Titular: texto       → sub-viñeta indentada
//   Resultado: …             → párrafo de cierre con la etiqueta en negrita
//
// El verde es el mismo de la marca (#0D9A76), el que quedó como estándar de
// documentos cuando se rehízo el manual.

const VERDE       = "0D9A76";
const VERDE_HONDO = "0A7057";
const TINTA       = "1F2937";
const GRIS        = "667085";

// Hasta acá se busca el «:» que separa el titular del texto. Más allá ya no es
// un titular sino una frase con dos puntos en el medio, y ponerla media en
// negrita se ve como un error de formato.
const LARGO_MAX_TITULAR = 95;

const esMayusculas = (l) =>
  !/[a-záéíóúñü]/.test(l) && /[A-ZÁÉÍÓÚÑÜ]/.test(l) && l.length <= 70;

// Parte «Titular: resto» en dos trozos, uno en negrita. Si no hay un «:» a
// tiempo, devuelve la línea entera sin negrita.
const partirTitular = (texto) => {
  const i = texto.indexOf(":");
  if (i < 0 || i > LARGO_MAX_TITULAR) return [{ t: texto }];
  return [
    { t: texto.slice(0, i + 1), bold: true },
    { t: texto.slice(i + 1) },
  ];
};

/**
 * @param {string} texto  El reporte, tal como lo devolvió el redactor (o el
 *                        borrador de la base, que usa la misma convención).
 * @param {{empresa?: string, generado?: string}} meta
 * @returns {Array} bloques para `buildDocx` / `descargarDocx`
 */
export function bloquesDelReporte(texto, meta = {}) {
  const bloques = [];

  // Membrete: de quién es el papel y de cuándo.
  if (meta.empresa) {
    bloques.push({ text: String(meta.empresa).toUpperCase(), bold: true, size: 9.5,
                   align: "right", after: 0, color: GRIS });
  }
  if (meta.generado) {
    bloques.push({ text: meta.generado, size: 9, align: "right", after: 20, color: GRIS });
  }

  const lineas = String(texto || "").split("\n");
  let tituloPuesto = false;

  lineas.forEach((cruda) => {
    // El indentado importa (marca las sub-viñetas), así que se mira antes de
    // recortar los espacios.
    const indentado = /^\s{2,}/.test(cruda);
    const l = cruda.trim();

    if (!l) { bloques.push({ text: "", after: 4 }); return; }

    // 1) Título del documento — la primera línea con contenido.
    if (!tituloPuesto) {
      tituloPuesto = true;
      bloques.push({ text: l, bold: true, size: 19, align: "center",
                     after: 14, color: VERDE });
      return;
    }

    // 2) Ficha del encabezado: Periodo / Responsables / Proyecto.
    const ficha = l.match(/^(Periodo|Responsables|Proyecto|Cliente|Empresa)\s*:\s*(.*)$/i);
    if (ficha) {
      bloques.push({ text: [{ t: `${ficha[1]}: `, bold: true }, { t: ficha[2] }],
                     size: 10.5, after: 3, color: TINTA });
      return;
    }

    // 3) Sub-viñeta — se mira ANTES que la viñeta normal, porque el «·» de una
    //    sub-viñeta indentada también podría colarse como viñeta suelta.
    if (indentado && /^[·•-]\s+/.test(l)) {
      bloques.push({ text: partirTitular(l.replace(/^[·•-]\s+/, "")),
                     size: 10, indent: 34, before: 1, after: 4, color: TINTA });
      return;
    }

    // 4) Viñeta.
    if (/^[•·]\s+/.test(l)) {
      const cuerpo = partirTitular(l.replace(/^[•·]\s+/, ""));
      bloques.push({ text: [{ t: "•   " }, ...cuerpo],
                     size: 10.5, indent: 14, before: 2, after: 6, color: TINTA });
      return;
    }

    // 5) Sección (PARTE 1 — TRABAJO REALIZADO, RESUMEN GENERAL…).
    if (esMayusculas(l)) {
      bloques.push({ text: l, bold: true, size: 13, before: 16, after: 8,
                     color: VERDE, linea: true });
      return;
    }

    // 6) Subtítulo de semana.
    if (/^Semana\s+\d+/i.test(l)) {
      bloques.push({ text: l, bold: true, size: 11.5, before: 12, after: 6,
                     color: VERDE_HONDO });
      return;
    }

    // 7) Cierre de la Parte 1.
    if (/^Resultado\s*:/i.test(l)) {
      bloques.push({ text: partirTitular(l), size: 10.5, before: 8, after: 8, color: TINTA });
      return;
    }

    // 8) Párrafo normal.
    bloques.push({ text: l, size: 10.5, after: 7, color: TINTA });
  });

  return bloques;
}
