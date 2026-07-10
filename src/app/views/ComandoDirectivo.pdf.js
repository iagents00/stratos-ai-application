/**
 * app/views/ComandoDirectivo.pdf.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generador del Reporte Ejecutivo de Pipeline en PDF.
 *
 * Dibuja el documento de forma VECTORIAL con la API de jsPDF (texto, rects,
 * líneas). NO usa html2canvas: por eso el texto es seleccionable, el peso del
 * archivo es mínimo y —sobre todo— los márgenes son correctos por construcción:
 * nada se dibuja fuera de [mL, W-mR] × [mT, H-mB], así que el contenido nunca
 * toca el borde ni se corta a la mitad entre páginas (el problema del enfoque
 * anterior, que rasterizaba todo el body y lo rebanaba a ciegas en hojas A4).
 *
 * Las tablas paginan solas: si una fila no cabe, abre página nueva y RE-DIBUJA
 * el encabezado. Nunca se parte una fila. Al final se numeran todas las páginas.
 *
 * Módulo PURO (sin React/DOM) → se puede smoke-testear en Node con el build
 * `jspdf/dist/jspdf.node`. El componente le pasa un `model` ya calculado desde
 * `leadsData` (el mismo array que consume el CRM), de modo que el PDF refleja
 * exactamente el estado del pipeline.
 *
 * Solo se usan caracteres dentro de cp1252 (Latin-1) porque las fuentes
 * estándar de jsPDF (Helvetica) codifican en WinAnsi. Acentos y ñ entran;
 * flechas tipográficas (→) NO — por eso los rangos usan guion "–".
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Geometría A4 (mm).
const A4 = { W: 210, H: 297, mL: 14, mR: 14, mT: 15, mB: 14 };

// Paleta — derivados de gris tinta + verde de marca. Coherente con la app.
const C = {
  ink:       [11, 18, 32],
  ink2:      [51, 65, 85],
  ink3:      [100, 116, 139],
  ink4:      [148, 163, 184],
  line:      [226, 232, 240],
  line2:     [241, 245, 249],
  line3:     [248, 250, 252],
  zebra:     [252, 253, 254],
  green:     [16, 185, 129],
  greenDeep: [4, 120, 87],
  greenSoft: [236, 253, 245],
  white:     [255, 255, 255],
};

function hexToRgb(hex, fallback = C.green) {
  if (Array.isArray(hex)) return hex;
  if (typeof hex !== "string") return fallback;
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (h.length !== 6) return fallback;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return fallback;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ── Contexto de dibujo — encapsula doc + cursor + helpers de página ──────────
function makeCtx(doc) {
  const ctx = {
    doc,
    W: A4.W, H: A4.H, mL: A4.mL, mR: A4.mR, mT: A4.mT, mB: A4.mB,
    contentW: A4.W - A4.mL - A4.mR,
    y: A4.mT,
  };
  ctx.bottom = () => ctx.H - ctx.mB;
  // Abre página nueva si lo que sigue (h mm) no cabe en la actual.
  ctx.need = (h) => {
    if (ctx.y + h > ctx.bottom()) {
      doc.addPage();
      ctx.y = ctx.mT;
      return true;
    }
    return false;
  };
  return ctx;
}

function text(doc, str, x, y, opts = {}) {
  const { size = 10, style = "normal", color = C.ink, align = "left", spacing } = opts;
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
  const o = { align };
  // Siempre fijamos charSpace (0 por defecto) Y lo aplicamos al estado GLOBAL
  // del doc: la opción por-llamada de jsPDF no siempre resetea el spacing de un
  // text() anterior, así que splitTextToSize (que asume 0) subestimaba el ancho
  // y el subtítulo se salía de la hoja.
  o.charSpace = spacing != null ? spacing : 0;
  if (typeof doc.setCharSpace === "function") doc.setCharSpace(o.charSpace);
  doc.text(str == null ? "" : String(str), x, y, o);
}

// Trunca con elipsis para que el string quepa en maxW (mm) con la fuente dada.
function fit(doc, str, maxW, size, style = "normal") {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  let s = String(str == null ? "" : str);
  if (doc.getTextWidth(s) <= maxW) return s;
  while (s.length > 1 && doc.getTextWidth(s + "…") > maxW) s = s.slice(0, -1);
  return s + "…";
}

// ── Encabezado de la primera página (banda de marca) ─────────────────────────
function drawMastheader(ctx, meta) {
  const { doc, mL, W, mR } = ctx;
  let y = ctx.y;

  // Nombre del cliente + badge "Comando Directivo".
  const clientName = meta.clientName || "Stratos";
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  const nameW = doc.getTextWidth(clientName);
  text(doc, clientName, mL, y + 3, { size: 16, style: "bold", color: C.ink });

  const badge = "COMANDO DIRECTIVO";
  const badgeCS = 0.3; // letter-spacing — hay que sumarlo al ancho medido.
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  const badgeTextW = doc.getTextWidth(badge) + badgeCS * (badge.length - 1);
  const badgeW = badgeTextW + 6, badgeH = 5.2;
  const badgeX = mL + nameW + 4, badgeY = y - 1.6;
  doc.setFillColor(...C.green);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.6, 2.6, "F");
  text(doc, badge, badgeX + 3, badgeY + 3.5, { size: 6.5, style: "bold", color: C.white, spacing: badgeCS });

  // Meta a la derecha (dos líneas). "·" está en cp1252 → seguro en Helvetica.
  text(doc, `Generado: ${meta.stamp} · ${meta.hhmm}`, W - mR, y, { size: 7.6, color: C.ink3, align: "right" });
  text(doc, `Granularidad: ${meta.granularityLabel} · ${meta.periodsCount} períodos`, W - mR, y + 4, { size: 7.6, color: C.ink3, align: "right" });

  y += 8.5;
  doc.setDrawColor(...C.ink); doc.setLineWidth(0.5);
  doc.line(mL, y, W - mR, y);
  y += 8;

  // Título + subtítulo.
  text(doc, "Reporte ejecutivo de pipeline", mL, y + 1, { size: 19, style: "bold", color: C.ink });
  y += 7;

  // Subtítulo en 2 líneas cortas EXPLÍCITAS: no dependemos de splitTextToSize
  // (con el char-spacing del badge calculaba mal el ancho y se salía de la hoja).
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  if (typeof doc.setCharSpace === "function") doc.setCharSpace(0);
  const sub1 = `Pipeline en vivo: ${meta.totalLeadsPipeline} leads  -  ${meta.asesoresCount} asesores activos en el rango`;
  const sub2 = `Rango analizado: ${meta.periodSpan}`;
  text(doc, sub1, mL, y + 3.2,       { size: 9, color: C.ink2 });
  text(doc, sub2, mL, y + 3.2 + 4.4, { size: 9, color: C.ink2 });
  y += 3.2 + 2 * 4.4 + 5;

  ctx.y = y;
}

// ── Título de sección — barra verde + label en versalitas + regla ────────────
function sectionTitle(ctx, label) {
  const { doc, mL, contentW } = ctx;
  ctx.need(13);
  const y = ctx.y;
  doc.setFillColor(...C.green);
  doc.roundedRect(mL, y - 0.5, 1.3, 5.2, 0.6, 0.6, "F");
  text(doc, label.toUpperCase(), mL + 4, y + 3.4, { size: 9, style: "bold", color: C.ink3, spacing: 0.4 });
  doc.setDrawColor(...C.line); doc.setLineWidth(0.3);
  doc.line(mL, y + 7, mL + contentW, y + 7);
  ctx.y = y + 11.5;
}

// Nota gris bajo un título de sección (aclaraciones para dirección).
function sectionNote(ctx, note) {
  if (!note) return;
  const { doc, mL, contentW } = ctx;
  doc.setFont("helvetica", "italic"); doc.setFontSize(7.8);
  const lines = doc.splitTextToSize(note, contentW);
  ctx.need(lines.length * 3.8 + 2);
  lines.forEach((ln, i) => text(doc, ln, mL, ctx.y + 2.6 + i * 3.8, { size: 7.8, style: "italic", color: C.ink3 }));
  ctx.y += lines.length * 3.8 + 3.5;
}

// ── Grid de KPI cards (4 por fila) ───────────────────────────────────────────
function drawCards(ctx, cards) {
  const { doc, mL, contentW } = ctx;
  const gap = 4, n = cards.length;
  const cardW = (contentW - gap * (n - 1)) / n;
  const cardH = 23;
  ctx.need(cardH + 2);
  const y0 = ctx.y;
  cards.forEach((c, i) => {
    const x = mL + i * (cardW + gap);
    const accent = hexToRgb(c.color, C.green);
    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.line); doc.setLineWidth(0.3);
    doc.roundedRect(x, y0, cardW, cardH, 2.5, 2.5, "FD");
    // Acento vertical a la izquierda (dentro de las esquinas redondeadas).
    doc.setFillColor(...accent);
    doc.roundedRect(x + 1.2, y0 + 2.4, 1.1, cardH - 4.8, 0.5, 0.5, "F");
    text(doc, fit(doc, c.label.toUpperCase(), cardW - 7, 6.8, "bold"), x + 4.5, y0 + 6, { size: 6.8, style: "bold", color: C.ink3, spacing: 0.2 });
    text(doc, c.value, x + 4.5, y0 + 15, { size: 17, style: "bold", color: C.ink });
    text(doc, fit(doc, c.sub || "", cardW - 7, 6.6), x + 4.5, y0 + 20, { size: 6.6, color: C.ink3 });
  });
  ctx.y = y0 + cardH + 5;
}

// ── Barras de indicadores (estado actual) ────────────────────────────────────
function drawIndicatorBars(ctx, indicators) {
  const { doc, mL, contentW } = ctx;
  const maxVal = Math.max(1, ...indicators.map(i => Number(i.value) || 0));
  const rowH = 8.4;
  const labelW = 60, valW = 16;
  const barX = mL + labelW;
  const barW = contentW - labelW - valW;
  indicators.forEach((ind) => {
    ctx.need(rowH);
    const cy = ctx.y;
    const midY = cy + rowH / 2;
    const accent = hexToRgb(ind.color, C.green);
    doc.setFillColor(...accent);
    doc.circle(mL + 1.6, midY - 0.6, 1.15, "F");
    text(doc, fit(doc, ind.label, labelW - 8, 8.6), mL + 5, midY + 0.8, { size: 8.6, color: C.ink });
    // pista
    doc.setFillColor(...C.line2);
    doc.roundedRect(barX, midY - 1.4, barW, 2.8, 1.4, 1.4, "F");
    // relleno
    const w = Math.max(2, ((Number(ind.value) || 0) / maxVal) * barW);
    doc.setFillColor(...accent);
    doc.roundedRect(barX, midY - 1.4, w, 2.8, 1.4, 1.4, "F");
    text(doc, String(ind.value), mL + contentW, midY + 1, { size: 9.6, style: "bold", color: C.ink, align: "right" });
    doc.setDrawColor(...C.line2); doc.setLineWidth(0.2);
    doc.line(mL, cy + rowH, mL + contentW, cy + rowH);
    ctx.y += rowH;
  });
  ctx.y += 2;
}

// ── Tabla paginada — encabezado repetido, fila de totales opcional ───────────
// cols: [{ w, align, key }], headers alineados a cols, rows: array de arrays.
function drawTable(ctx, { cols, headers, rows, totals, emptyMsg, fontSize = 7.6, headerFontSize }) {
  const { doc, mL, contentW } = ctx;
  const hSize = headerFontSize || fontSize;
  const headH = 8;
  const rowH = 6.6;
  const colX = [];
  let acc = mL;
  for (const col of cols) { colX.push(acc); acc += col.w; }

  const drawHeader = () => {
    const y = ctx.y;
    doc.setFillColor(...C.line3);
    doc.rect(mL, y, contentW, headH, "F");
    doc.setDrawColor(...C.line); doc.setLineWidth(0.3);
    doc.line(mL, y, mL + contentW, y);
    doc.line(mL, y + headH, mL + contentW, y + headH);
    headers.forEach((h, i) => {
      const col = cols[i];
      const tx = col.align === "right" ? colX[i] + col.w - 1.6 : colX[i] + 2.2;
      text(doc, fit(doc, h, col.w - 2.6, hSize, "bold"), tx, y + headH / 2 + 1.4, {
        size: hSize, style: "bold", color: C.ink2, align: col.align,
      });
    });
    ctx.y = y + headH;
  };

  ctx.need(headH + rowH + 4);
  drawHeader();

  if (!rows || rows.length === 0) {
    ctx.need(rowH + 4);
    text(doc, emptyMsg || "Sin datos en el rango analizado.", mL + 2.2, ctx.y + rowH, { size: fontSize, style: "italic", color: C.ink3 });
    ctx.y += rowH + 4;
    return;
  }

  rows.forEach((row, ri) => {
    if (ctx.y + rowH > ctx.bottom()) {
      doc.addPage();
      ctx.y = ctx.mT;
      drawHeader();
    }
    const y = ctx.y;
    if (ri % 2 === 1) {
      doc.setFillColor(...C.zebra);
      doc.rect(mL, y, contentW, rowH, "F");
    }
    row.forEach((cell, ci) => {
      const col = cols[ci];
      const isFirst = ci === 0;
      const tx = col.align === "right" ? colX[ci] + col.w - 2 : colX[ci] + 2.2;
      const s = isFirst ? fit(doc, cell, col.w - 3.5, fontSize) : String(cell);
      text(doc, s, tx, y + rowH / 2 + 1.2, {
        size: fontSize, color: isFirst ? C.ink : C.ink2, align: col.align,
      });
    });
    doc.setDrawColor(...C.line2); doc.setLineWidth(0.15);
    doc.line(mL, y + rowH, mL + contentW, y + rowH);
    ctx.y += rowH;
  });

  if (totals) {
    const th = rowH + 0.8;
    if (ctx.y + th > ctx.bottom()) {
      doc.addPage();
      ctx.y = ctx.mT;
      drawHeader();
    }
    const y = ctx.y;
    doc.setFillColor(...C.greenSoft);
    doc.rect(mL, y, contentW, th, "F");
    doc.setDrawColor(...C.green); doc.setLineWidth(0.5);
    doc.line(mL, y, mL + contentW, y);
    totals.forEach((cell, ci) => {
      const col = cols[ci];
      const tx = col.align === "right" ? colX[ci] + col.w - 2 : colX[ci] + 2.2;
      text(doc, fit(doc, cell, col.w - 3.5, fontSize, "bold"), tx, y + th / 2 + 1.2, {
        size: fontSize, style: "bold", color: C.greenDeep, align: col.align,
      });
    });
    ctx.y += th;
  }
  ctx.y += 2;
}

// ── Pie de página con numeración (post-proceso, todas las páginas) ───────────
function drawFooters(ctx, meta) {
  const { doc, mL, W, mR, H, mB } = ctx;
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const fy = H - mB + 5.5;
    doc.setDrawColor(...C.line); doc.setLineWidth(0.3);
    doc.line(mL, H - mB + 1.5, W - mR, H - mB + 1.5);
    text(doc, `Comando Directivo  -  ${meta.clientName}`, mL, fy, { size: 7, color: C.ink4 });
    text(doc, `${meta.stamp}  -  Página ${p} de ${total}`, W - mR, fy, { size: 7, color: C.ink4, align: "right" });
  }
}

/**
 * Construye y devuelve un documento jsPDF con el reporte ejecutivo.
 * @param {Function} JsPDF  - el constructor jsPDF (default export del módulo).
 * @param {object}   model  - datos ya calculados (ver ComandoDirectivo.jsx).
 * @returns {object} doc jsPDF listo para .save() / .output().
 */
export function buildExecutivePdf(JsPDF, model) {
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const ctx = makeCtx(doc);
  const meta = model.meta || {};

  drawMastheader(ctx, meta);

  // 1) Pipeline actual (snapshot — coincide con los KPIs del CRM).
  sectionTitle(ctx, "Pipeline actual");
  drawCards(ctx, model.pipelineCards || []);

  // 2) Resumen del rango.
  sectionTitle(ctx, `Resumen del rango  -  ${meta.granularityLabel || ""}`);
  drawCards(ctx, model.rangeCards || []);

  // 3) Indicadores clave (del rango seleccionado).
  sectionTitle(ctx, "Indicadores clave  -  del rango");
  drawIndicatorBars(ctx, model.indicators || []);

  // 4) Evolución temporal (por periodo — "lo registrado cada día/semana/mes").
  if (model.evolution) {
    sectionTitle(ctx, model.evolution.title || "Evolución temporal");
    sectionNote(ctx, model.evolution.note);
    drawTable(ctx, {
      cols: model.evolution.cols,
      headers: model.evolution.headers,
      rows: model.evolution.rows,
      totals: model.evolution.totals,
      emptyMsg: "No hay datos en el rango seleccionado.",
    });
  }

  // 5) Desglose por asesor.
  if (model.asesores) {
    sectionTitle(ctx, "Desglose por asesor");
    drawTable(ctx, {
      cols: model.asesores.cols,
      headers: model.asesores.headers,
      rows: model.asesores.rows,
      emptyMsg: "Sin asesores con leads en el rango analizado.",
      headerFontSize: 6.9, // 9 columnas → encabezados un poco más chicos para no truncar.
    });
  }

  drawFooters(ctx, meta);
  return doc;
}

// Helpers de layout reutilizables por el componente para armar el `model`.
// Reparten el ancho de contenido entre la 1ª columna (texto) y N numéricas.
export function evolutionCols(nIndicators) {
  const contentW = A4.W - A4.mL - A4.mR; // 182
  const firstW = 30;
  const numW = (contentW - firstW) / nIndicators;
  return [
    { w: firstW, align: "left" },
    ...Array.from({ length: nIndicators }, () => ({ w: numW, align: "right" })),
  ];
}

export function asesorCols(nIndicators) {
  const contentW = A4.W - A4.mL - A4.mR; // 182
  const firstW = 33, leadsW = 12;
  const numW = (contentW - firstW - leadsW) / nIndicators;
  return [
    { w: firstW, align: "left" },
    { w: leadsW, align: "right" },
    ...Array.from({ length: nIndicators }, () => ({ w: numW, align: "right" })),
  ];
}

// ═════════════════════════════════════════════════════════════════════════
// PDF "Resumen automático de Zooms" — lo que el director comercial manda a
// los socios (ver ZoomControl/Resumen.jsx, que arma el `model`). Reutiliza
// los mismos helpers del reporte ejecutivo para que la marca sea idéntica.
// ═════════════════════════════════════════════════════════════════════════
export function buildZoomResumenPdf(JsPDF, model) {
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const ctx = makeCtx(doc);
  const meta = model.meta || {};

  // Masthead compacto — badge propio "CONTROL DE ZOOMS".
  {
    const { mL, W, mR } = ctx;
    let y = ctx.y;
    const clientName = meta.clientName || "Stratos";
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    const nameW = doc.getTextWidth(clientName);
    text(doc, clientName, mL, y + 3, { size: 16, style: "bold", color: C.ink });

    const badge = "CONTROL DE ZOOMS";
    const badgeCS = 0.3;
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
    const badgeTextW = doc.getTextWidth(badge) + badgeCS * (badge.length - 1);
    doc.setFillColor(...hexToRgb("#2563EB"));
    doc.roundedRect(mL + nameW + 4, y - 1.6, badgeTextW + 6, 5.2, 2.6, 2.6, "F");
    text(doc, badge, mL + nameW + 7, y + 1.9, { size: 6.5, style: "bold", color: C.white, spacing: badgeCS });

    text(doc, `Generado: ${meta.stamp} - ${meta.hhmm}`, W - mR, y, { size: 7.6, color: C.ink3, align: "right" });

    y += 8.5;
    doc.setDrawColor(...C.ink); doc.setLineWidth(0.5);
    doc.line(mL, y, W - mR, y);
    y += 8;

    text(doc, "Resumen automático de Zooms", mL, y + 1, { size: 19, style: "bold", color: C.ink });
    y += 7;
    if (typeof doc.setCharSpace === "function") doc.setCharSpace(0);
    text(doc, meta.subtitle1 || "", mL, y + 3.2,       { size: 9, color: C.ink2 });
    text(doc, meta.subtitle2 || "", mL, y + 3.2 + 4.4, { size: 9, color: C.ink2 });
    ctx.y = y + 3.2 + 2 * 4.4 + 5;
  }

  const contentW = A4.W - A4.mL - A4.mR; // 182
  const statusCols = [
    { w: 62, align: "left" },
    ...Array.from({ length: 6 }, () => ({ w: (contentW - 62) / 6, align: "right" })),
  ];

  // 1) KPIs de hoy.
  sectionTitle(ctx, "Zooms de hoy");
  drawCards(ctx, model.cardsHoy || []);

  // 2) Semana actual L-D.
  if (model.semana) {
    sectionTitle(ctx, model.semana.title);
    drawTable(ctx, { cols: statusCols, headers: model.semana.headers, rows: model.semana.rows, totals: model.semana.totals, emptyMsg: "Sin Zooms esta semana." });
  }

  // 3+4) Por Liner (hoy y semana).
  if (model.linerHoy) {
    sectionTitle(ctx, model.linerHoy.title);
    drawTable(ctx, { cols: statusCols, headers: model.linerHoy.headers, rows: model.linerHoy.rows, emptyMsg: "Sin Zooms hoy." });
  }
  if (model.linerSemana) {
    sectionTitle(ctx, model.linerSemana.title);
    drawTable(ctx, { cols: statusCols, headers: model.linerSemana.headers, rows: model.linerSemana.rows, emptyMsg: "Sin Zooms esta semana." });
  }
  if (model.linerMes) {
    sectionTitle(ctx, model.linerMes.title);
    drawTable(ctx, { cols: statusCols, headers: model.linerMes.headers, rows: model.linerMes.rows, emptyMsg: "Sin Zooms este mes." });
  }

  // 5) Por Presentador — columnas numéricas repartidas según los headers.
  if (model.presentadores) {
    sectionTitle(ctx, model.presentadores.title);
    const nNum = Math.max(1, model.presentadores.headers.length - 1);
    drawTable(ctx, {
      cols: [
        { w: 50, align: "left" },
        ...Array.from({ length: nNum }, () => ({ w: (contentW - 50) / nNum, align: "right" })),
      ],
      headers: model.presentadores.headers,
      rows: model.presentadores.rows,
      emptyMsg: "Sin presentadores con Zooms.",
    });
  }

  // 6) Próximos 7 días.
  if (model.proximos7) {
    sectionTitle(ctx, model.proximos7.title);
    drawTable(ctx, {
      cols: [{ w: 82, align: "left" }, { w: 50, align: "right" }, { w: 50, align: "right" }],
      headers: model.proximos7.headers,
      rows: model.proximos7.rows,
      emptyMsg: "Sin Zooms agendados en los próximos 7 días.",
    });
  }

  drawFooters(ctx, meta);
  return doc;
}

export { hexToRgb };
