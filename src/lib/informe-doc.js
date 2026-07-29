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
// El azul (#1155CC) es el del documento de referencia, el que RH de Duke ya
// conoce. Los tamaños salen de ese mismo molde, +17% (pedido de Ángel: la
// letra se veía chica al lado del original).

// Azul, como el documento con el que se le manda el reporte a RH de Duke.
// Era verde (el de la marca) pero el molde que se aprobó es azul, y el
// reporte tiene que verse IGUAL al que ya recibieron — si cambia de color,
// del otro lado parece otro documento.
const AZUL       = "1155CC";
const AZUL_HONDO = "1A56A8";
const TINTA       = "1F2937";
const GRIS        = "667085";

// Hasta acá se busca el «:» que separa el titular del texto. Más allá ya no es
// un titular sino una frase con dos puntos en el medio, y ponerla media en
// negrita se ve como un error de formato.
const LARGO_MAX_TITULAR = 95;


// «Martes 14 — Nacimiento del asistente:» es el titular de un día, y va en
// negrita SIEMPRE — venga o no con viñeta. El redactor a veces lo escribe como
// párrafo suelto, y así salía en redonda mientras sus vecinos iban en negrita:
// en el papel se lee como un error de formato. El patrón es inequívoco.
const DIA_TITULAR = /^(Lunes|Martes|Mi[eé]rcoles|Jueves|Viernes|S[áa]bado|Domingo)\s+\d{1,2}\s*[—–-]/i;

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
    bloques.push({ text: String(meta.empresa).toUpperCase(), bold: true, size: 11,
                   align: "right", after: 0, color: GRIS });
  }
  if (meta.generado) {
    bloques.push({ text: meta.generado, size: 10.5, align: "right", after: 20, color: GRIS });
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
      bloques.push({ text: l, bold: true, size: 27, align: "center",
                     after: 16, color: AZUL });
      return;
    }

    // 2) Ficha del encabezado: Periodo / Responsables / Proyecto.
    const ficha = l.match(/^(Periodo|Responsables|Proyecto|Cliente|Empresa)\s*:\s*(.*)$/i);
    if (ficha) {
      bloques.push({ text: [{ t: `${ficha[1]}: `, bold: true }, { t: ficha[2] }],
                     size: 13, after: 4, color: TINTA });
      return;
    }

    // 3) Sub-viñeta — se mira ANTES que la viñeta normal, porque el «·» de una
    //    sub-viñeta indentada también podría colarse como viñeta suelta.
    if (indentado && /^[·•-]\s+/.test(l)) {
      bloques.push({ text: partirTitular(l.replace(/^[·•-]\s+/, "")),
                     size: 12.5, indent: 34, before: 2, after: 5, color: TINTA });
      return;
    }

    // 4) Viñeta.
    if (/^[•·]\s+/.test(l)) {
      const cuerpo = partirTitular(l.replace(/^[•·]\s+/, ""));
      bloques.push({ text: [{ t: "•   " }, ...cuerpo],
                     size: 13, indent: 14, before: 3, after: 7, color: TINTA });
      return;
    }

    // 5) Sección (PARTE 1 — TRABAJO REALIZADO, RESUMEN GENERAL…).
    if (esMayusculas(l)) {
      bloques.push({ text: l, bold: true, size: 17.5, before: 20, after: 9,
                     color: AZUL, linea: true });
      return;
    }

    // 6) Subtítulo de semana.
    if (/^Semana\s+\d+/i.test(l)) {
      bloques.push({ text: l, bold: true, size: 14.5, before: 16, after: 7,
                     color: AZUL_HONDO });
      return;
    }

    // 7) Cierre de la Parte 1.
    if (/^Resultado\s*:/i.test(l)) {
      bloques.push({ text: partirTitular(l), size: 13, before: 10, after: 9, color: TINTA });
      return;
    }

    // 8) Titular de día sin viñeta — se rescata acá para que no pierda la negrita.
    if (DIA_TITULAR.test(l)) {
      bloques.push({ text: [{ t: "•   " }, ...partirTitular(l)],
                     size: 13, indent: 14, before: 3, after: 7, color: TINTA });
      return;
    }

    // 9) Párrafo normal.
    bloques.push({ text: l, size: 13, after: 8, color: TINTA });
  });

  return bloques;
}
