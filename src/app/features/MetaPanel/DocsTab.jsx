/**
 * app/features/MetaPanel/DocsTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pestaña "Documentos" del MetaPanel.
 * Manual de operación comercial NSG (procesos / SOP) con una UI tipo Notion,
 * pero más limpia: barra lateral con buscador + categorías, y panel de lectura
 * con tipografía cuidada. Incluye un mini-renderizador de Markdown (sin libs).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useMemo } from "react";
import { Search, FileText, BookOpen } from "lucide-react";
import { font, fontDisp, mono } from "../../../design-system/tokens";
import { COMERCIAL_DOCS, DOC_CATEGORIES } from "../../data/comercialDocs";

/* ── Inline markdown: **negrita**, *cursiva*, `código` ─────────────────────── */
function inline(text, T) {
  const nodes = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0, m, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] != null) nodes.push(<strong key={k++} style={{ fontWeight: 700, color: T.txt }}>{m[2]}</strong>);
    else if (m[3] != null) nodes.push(<em key={k++}>{m[3]}</em>);
    else if (m[4] != null) nodes.push(<code key={k++} style={{ fontFamily: mono, fontSize: "0.86em", background: "rgba(127,127,127,0.14)", padding: "1px 5px", borderRadius: 5 }}>{m[4]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/* ── Bloque de tabla ───────────────────────────────────────────────────────── */
function Table({ rows, T, isLight }) {
  const cells = rows.map(r => r.replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
  const head = cells[0];
  const body = cells.slice(2); // [1] es el separador |---|
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}`, margin: "14px 0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
        <thead>
          <tr style={{ background: isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.045)" }}>
            {head.map((h, i) => (
              <th key={i} style={{ textAlign: "left", padding: "9px 13px", fontSize: 10, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "0.04em", textTransform: "uppercase", color: T.txt2, borderBottom: `1px solid ${T.border}` }}>{inline(h, T)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} style={{ background: ri % 2 ? (isLight ? "rgba(0,0,0,0.018)" : "rgba(255,255,255,0.018)") : "transparent" }}>
              {r.map((c, ci) => (
                <td key={ci} style={{ padding: "9px 13px", fontSize: 12.5, color: ci === 0 ? T.txt : T.txt2, lineHeight: 1.45, borderBottom: ri < body.length - 1 ? `1px solid ${T.border}` : "none", verticalAlign: "top" }}>{inline(c, T)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Renderizador de Markdown ──────────────────────────────────────────────── */
function Markdown({ md, T, isLight }) {
  const lines = md.split("\n");
  const out = [];
  let i = 0, key = 0;
  const push = el => out.push(<div key={key++}>{el}</div>);

  while (i < lines.length) {
    let line = lines[i];

    // Bloque de código / plantilla
    if (line.trim().startsWith("```")) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
      i++; // cierre
      push(
        <pre style={{ fontFamily: mono, fontSize: 12, lineHeight: 1.6, color: T.txt, background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.035)", border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", margin: "14px 0", whiteSpace: "pre-wrap", overflowX: "auto" }}>{buf.join("\n")}</pre>
      );
      continue;
    }

    // Tabla
    if (line.trim().startsWith("|")) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { buf.push(lines[i]); i++; }
      if (buf.length >= 2) { push(<Table rows={buf} T={T} isLight={isLight} />); continue; }
    }

    // Cita / callout
    if (line.trim().startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      const txt = buf.join(" ");
      const isStop = /⛔|NUNCA|NO NEGOCIABLE/i.test(txt);
      push(
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: isStop ? "rgba(239,68,68,0.07)" : T.accentS, border: `1px solid ${isStop ? "rgba(239,68,68,0.22)" : T.accentB}`, borderLeft: `3px solid ${isStop ? "#F87171" : T.accent}`, borderRadius: 10, padding: "11px 14px", margin: "13px 0" }}>
          <span style={{ fontSize: 13, color: T.txt, fontFamily: font, lineHeight: 1.55 }}>{inline(txt, T)}</span>
        </div>
      );
      continue;
    }

    // Encabezados
    if (line.startsWith("### ")) { push(<h4 style={{ margin: "20px 0 8px", fontSize: 13.5, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "-0.01em", color: T.txt }}>{inline(line.slice(4), T)}</h4>); i++; continue; }
    if (line.startsWith("## ")) { push(<h3 style={{ margin: "26px 0 10px", fontSize: 16, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "-0.02em", color: T.txt, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 3, height: 16, borderRadius: 2, background: T.accent, display: "inline-block" }} />{inline(line.slice(3), T)}</h3>); i++; continue; }
    if (line.startsWith("# ")) { i++; continue; } // el H1 lo dibuja el header del panel

    // Separador
    if (line.trim() === "---") { push(<hr style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "20px 0" }} />); i++; continue; }

    // Lista con viñetas
    if (/^\s*-\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*-\s+/, "")); i++; }
      push(
        <ul style={{ margin: "8px 0", paddingLeft: 4, listStyle: "none" }}>
          {buf.map((b, bi) => (
            <li key={bi} style={{ display: "flex", gap: 9, marginBottom: 5, fontSize: 13.5, color: T.txt2, fontFamily: font, lineHeight: 1.55 }}>
              <span style={{ color: T.accent, marginTop: 1, flexShrink: 0 }}>•</span>
              <span>{inline(b, T)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Lista numerada
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      push(
        <ol style={{ margin: "8px 0", paddingLeft: 4, listStyle: "none", counterReset: "li" }}>
          {buf.map((b, bi) => (
            <li key={bi} style={{ display: "flex", gap: 10, marginBottom: 6, fontSize: 13.5, color: T.txt2, fontFamily: font, lineHeight: 1.55 }}>
              <span style={{ flexShrink: 0, minWidth: 20, height: 20, borderRadius: 6, background: T.accentS, border: `1px solid ${T.accentB}`, color: T.accent, fontSize: 11, fontWeight: 700, fontFamily: fontDisp, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{bi + 1}</span>
              <span style={{ paddingTop: 1 }}>{inline(b, T)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Línea en blanco
    if (line.trim() === "") { i++; continue; }

    // Párrafo
    const buf = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^\s*[-#>|]/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
    if (!buf.length) { i++; continue; } // guardia: garantiza avance del índice
    push(<p style={{ margin: "0 0 11px", fontSize: 13.5, color: T.txt2, fontFamily: font, lineHeight: 1.6 }}>{inline(buf.join(" "), T)}</p>);
  }
  return <div>{out}</div>;
}

/* ── Pestaña Documentos ────────────────────────────────────────────────────── */
export default function DocsTab({ T, isLight }) {
  const [activeId, setActiveId] = useState(COMERCIAL_DOCS[0].id);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMERCIAL_DOCS;
    return COMERCIAL_DOCS.filter(d => (d.title + " " + d.subtitle + " " + d.category).toLowerCase().includes(q));
  }, [query]);

  const active = COMERCIAL_DOCS.find(d => d.id === activeId) || COMERCIAL_DOCS[0];

  const grouped = DOC_CATEGORIES
    .map(cat => ({ cat, docs: filtered.filter(d => d.category === cat) }))
    .filter(g => g.docs.length);

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

      {/* ── Barra lateral ── */}
      <aside style={{ width: 244, flexShrink: 0, position: "sticky", top: 0, alignSelf: "flex-start" }}>
        {/* Buscador */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <Search size={14} color={T.txt3} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar documento…"
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 32px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.glass, color: T.txt, fontSize: 12.5, fontFamily: font, outline: "none" }}
          />
        </div>

        {grouped.map(({ cat, docs }) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 7px 4px", fontSize: 9.5, fontWeight: 800, fontFamily: fontDisp, letterSpacing: "0.1em", textTransform: "uppercase", color: T.txt3 }}>{cat}</p>
            {docs.map(d => {
              const on = d.id === active.id;
              return (
                <button key={d.id} onClick={() => setActiveId(d.id)} style={{
                  width: "100%", textAlign: "left", display: "flex", gap: 9, alignItems: "center",
                  padding: "8px 10px", marginBottom: 2, borderRadius: 9, cursor: "pointer",
                  border: `1px solid ${on ? T.accentB : "transparent"}`,
                  background: on ? T.accentS : "transparent",
                  transition: "all 0.13s",
                }}
                  onMouseEnter={e => { if (!on) e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{d.emoji}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: on ? 700 : 500, color: on ? T.txt : T.txt2, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</span>
                    <span style={{ display: "block", fontSize: 10.5, color: T.txt3, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        {!grouped.length && (
          <p style={{ fontSize: 12, color: T.txt3, fontFamily: font, padding: "8px 4px" }}>Sin resultados para “{query}”.</p>
        )}
      </aside>

      {/* ── Panel de lectura ── */}
      <article style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
        {/* Encabezado del documento */}
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 6 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: T.accentS, border: `1px solid ${T.accentB}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23, flexShrink: 0 }}>{active.emoji}</div>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999, background: T.glass, border: `1px solid ${T.border}`, marginBottom: 5 }}>
              <BookOpen size={11} color={T.accent} />
              <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "0.06em", textTransform: "uppercase", color: T.txt2 }}>{active.category}</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "-0.03em", color: T.txt }}>{active.title}</h2>
          </div>
        </div>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: T.txt3, fontFamily: font }}>{active.subtitle}</p>
        <hr style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "16px 0 20px" }} />

        <Markdown md={active.md} T={T} isLight={isLight} />

        {/* Pie */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 28, paddingTop: 16, borderTop: `1px solid ${T.border}`, color: T.txt3 }}>
          <FileText size={13} />
          <span style={{ fontSize: 11, fontFamily: font }}>Manual de operación NSG · documento interno · v1 · 2026</span>
        </div>
      </article>
    </div>
  );
}
