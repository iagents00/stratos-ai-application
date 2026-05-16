/**
 * lib/markdown.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mini renderer Markdown → React. Pensado para las notas privadas que la IA
 * (Chatwoot/Retell vía n8n) inserta en `expediente_items` con formato:
 *
 *   ## PERFIL ESTRATÉGICO DEL LEAD (IA)
 *
 *   **Zona:** Cancún
 *   **Presupuesto:** 300K USD
 *
 *   - Cita confirmada para mañana 3:30 PM
 *   - Quiere unidad de 3 recámaras
 *
 * NO usa una librería externa porque la superficie de Markdown que aceptamos
 * es chica (h2, h3, bold, listas, líneas). Si en el futuro necesitamos
 * tablas/links/imágenes, migramos a `react-markdown`.
 *
 * Devuelve un array de elementos React listos para usar con `{children}`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Fragment } from "react";

const BOLD_RE = /\*\*([^*]+)\*\*/g;

// Convierte una línea de texto plano → array de React nodes, parseando
// **bold** inline. Cualquier otro asterisco se deja literal.
function inline(line, keyPrefix) {
  if (!line.includes("**")) return [line];
  const out = [];
  let last = 0;
  let m;
  let i = 0;
  BOLD_RE.lastIndex = 0;
  while ((m = BOLD_RE.exec(line)) !== null) {
    if (m.index > last) out.push(line.slice(last, m.index));
    out.push(<strong key={`${keyPrefix}-b-${i++}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/**
 * Renderiza un string Markdown como un array de elementos React.
 * @param {string} md
 * @param {{ T?: object }} [opts]
 * @returns {Array<JSX.Element>}
 */
export function renderMarkdown(md, _opts = {}) {
  if (!md || typeof md !== "string") return [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");

  const blocks = [];
  let listBuffer = [];
  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} style={{ margin: "6px 0 6px 18px", padding: 0, lineHeight: 1.55 }}>
        {listBuffer.map((item, i) => (
          <li key={`li-${blocks.length}-${i}`} style={{ marginBottom: 2 }}>
            {inline(item, `li-${blocks.length}-${i}`)}
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const line = raw.trim();

    // Línea vacía → cierra lista actual + spacer
    if (line === "") {
      flushList();
      continue;
    }

    // Headers (### / ## / #)
    const hMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (hMatch) {
      flushList();
      const level = hMatch[1].length;
      const text  = hMatch[2];
      const fontSize = level === 1 ? 16 : level === 2 ? 14 : 13;
      blocks.push(
        <p
          key={`h-${idx}`}
          style={{
            margin: "10px 0 4px",
            fontSize, fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          {inline(text, `h-${idx}`)}
        </p>
      );
      continue;
    }

    // List item (- ó *)
    const liMatch = line.match(/^[-*]\s+(.*)$/);
    if (liMatch) {
      listBuffer.push(liMatch[1]);
      continue;
    }

    // Párrafo normal
    flushList();
    blocks.push(
      <p key={`p-${idx}`} style={{ margin: "4px 0", lineHeight: 1.55 }}>
        {inline(line, `p-${idx}`)}
      </p>
    );
  }
  flushList();
  return blocks;
}

/**
 * Wrapper conveniente: devuelve un <div> con el Markdown ya renderizado.
 * Útil cuando solo querés colgar el contenido.
 */
export function MarkdownBlock({ children, style }) {
  if (!children) return null;
  return <div style={style}>{renderMarkdown(children).map((node, i) => <Fragment key={i}>{node}</Fragment>)}</div>;
}
