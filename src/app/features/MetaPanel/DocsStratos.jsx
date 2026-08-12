// DocsStratos.jsx — los documentos que GENERA el propio sistema.
//
// Pedido de Ángel (27-jul): «los documentos del manual no están en Word… quiero
// mostrarle a Iván todo lo que puede hacer NSG de Stratos IA, módulo por módulo,
// función por función y cómo nos cambia el trabajo» + «un botón de guardar en
// Stratos… y que se guarde en el AIOS y también en mis documentos».
//
// La diferencia con la lista de enlaces de abajo: eso son links a Google Docs,
// esto son documentos que viven ADENTRO. Se guardan como TEXTO (tabla
// `team_documents`), así el Copilot los puede leer y el Word se vuelve a armar en
// esta misma máquina cada vez que alguien lo pide — el archivo nunca viaja, que es
// lo que corrompía los .docx cuando los mandábamos por otro lado.

import { useState, useEffect, useCallback } from "react";
import { FileText, Download, RefreshCw, BookOpen, Eye, Cloud, Check } from "lucide-react";
import { font, fontDisp } from "../../../design-system/tokens";
import { supabase } from "../../../lib/supabase";
import { descargarDocx, buildDocx } from "../../../lib/docx";
import { MANUAL, manualEnBloques } from "../../../lib/manual-stratos-doc";

// Sube el documento al Drive de la cuenta OPERATIVA del negocio, no a la personal
// de quien lo genera. Es la lección del 24-jul: un archivo en la cuenta de uno,
// aunque esté compartido, no lo puede abrir el resto del equipo sin pedir permiso.
// El flujo de n8n sube el .docx TAL CUAL (con su formato) y le abre el permiso a
// «cualquiera con el enlace, como editor» — y verifica la respuesta antes de
// devolver el link. En Drive un .docx se abre y se edita en Google Docs, y desde
// ahí se baja en PDF: por eso no hace falta mantener tres archivos distintos.
const SUBIR_URL = "https://personal-n8n.suwsiw.easypanel.host/webhook/nsg-subir-doc";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
               "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaLarga = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
};

/** Texto plano → bloques de Word. Mismo criterio que el informe: TÍTULOS EN
 *  MAYÚSCULAS y viñetas que empiezan con •. */
export function textoABloques(texto, encabezado = "NSG", fechaISO) {
  const b = [
    { text: encabezado.toUpperCase(), bold: true, size: 12, align: "right", after: 0, color: "667085" },
    { text: fechaLarga(fechaISO || new Date().toISOString()), size: 10, align: "right", after: 18, color: "667085" },
  ];
  String(texto || "").split("\n").forEach((linea) => {
    const l = linea.trim();
    if (!l) { b.push({ text: "", after: 6 }); return; }
    const esTitulo = l === l.toUpperCase() && l.length < 60 && /[A-ZÁÉÍÓÚÑ]/.test(l);
    const esVineta = l.startsWith("•") || l.startsWith("·") || l.startsWith("-");
    if (esTitulo && b.length <= 2)      b.push({ text: l, bold: true, size: 18, align: "center", after: 4 });
    else if (esTitulo)                  b.push({ text: l, bold: true, size: 11.5, before: 12, after: 6, linea: true });
    else if (esVineta)                  b.push({ text: l.replace(/^[•·-]\s*/, "• "), size: 10.5, indent: 12, after: 5 });
    else                                b.push({ text: l, size: 11, after: 6 });
  });
  return b;
}

export default function DocsStratos({ T, isLight, userId, empresa = "NSG" }) {
  const txt    = T?.txt    || (isLight ? "#0B1220" : "#E2E8F0");
  const txt2   = T?.txt2   || (isLight ? "#3B4A61" : "#8B99AE");
  const txt3   = T?.txt3   || (isLight ? "#7A8699" : "#4A5568");
  const accent = T?.accent || (isLight ? "#0D9A76" : "#6EE7C2");
  const bd     = T?.border || (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)");

  const [docs, setDocs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(null);   // documento que se está leyendo
  const [subiendo, setSubiendo] = useState(null); // id del que se está subiendo
  const [subido, setSubido] = useState({});       // id -> link de Drive
  const [aviso, setAviso] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setCargando(true);
    const { data } = await supabase.rpc("fn_docs_listar", { p_profile_id: userId });
    setDocs(Array.isArray(data) ? data : []);
    setCargando(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const bajarManual = () => {
    descargarDocx(`Manual de ${MANUAL.titulo}`, manualEnBloques(new Date().toISOString()));
  };
  const bajarDoc = (d) => {
    descargarDocx(d.titulo, textoABloques(d.contenido, empresa, d.fecha));
  };

  // A Drive, en un toque. Sube el Word con su formato; en Drive se abre, se edita
  // y se baja en PDF — «la mayoría en Word, y en PDF mejor». El enlace se guarda
  // además en Documentos del Equipo.
  const aDrive = async (clave, titulo, bloques) => {
    if (subiendo) return;
    setSubiendo(clave); setAviso("");
    try {
      // Se sube el .docx CON su formato, no el texto pelado. La primera versión
      // mandaba texto y en Drive salía un bloque plano sin títulos ni tamaños:
      // «no se ve bien», con razón. El Word se arma acá con la misma plantilla de
      // la cuenta de cobro y viaja como base64.
      const blob = buildDocx(bloques);
      const base64 = await new Promise((ok, err) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result).split(",")[1] || "");
        fr.onerror = () => err(new Error("No pude preparar el archivo."));
        fr.readAsDataURL(blob);
      });

      const r = await fetch(SUBIR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: `${titulo}.docx`, base64 }),
      });
      const j = await r.json();
      // Se exige la confirmación del permiso. Si el archivo queda restringido, el
      // link no le sirve a nadie más del equipo — es peor que no haberlo subido,
      // porque parece que está y al abrirlo pide acceso. (Le pasó a Ángel el 24-jul.)
      if (!j?.ok || !j?.link || j?.permiso?.type !== "anyone") {
        throw new Error("Se subió pero quedó restringido. Avisa para revisarlo.");
      }
      const link = j.link;
      setSubido((s) => ({ ...s, [clave]: link }));
      if (userId) {
        await supabase.rpc("fn_doc_link_agregar", { p_profile_id: userId, p_titulo: titulo, p_url: link });
      }
    } catch (e) {
      setAviso(e?.message || "No pude subirlo a Drive. Intenta de nuevo en un minuto.");
    } finally {
      setSubiendo(null);
    }
  };

  const fila = {
    display: "flex", alignItems: "center", gap: 13, padding: "14px 16px",
    borderRadius: 14, border: `1px solid ${bd}`, marginBottom: 10,
    background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.025)",
  };
  const btn = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "9px 13px", borderRadius: 10, border: `1px solid ${bd}`,
    background: "transparent", color: txt2, fontSize: 12.5, fontFamily: font,
    cursor: "pointer", flexShrink: 0,
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 500, fontFamily: fontDisp, color: txt }}>
          Documentos de Stratos
        </h4>
        <p style={{ margin: "5px 0 0", fontSize: 12.5, color: txt3, fontFamily: font, textWrap: "pretty" }}>
          Los genera el propio sistema · se bajan en Word para leerlos o editarlos
        </p>
      </div>

      {/* El manual — siempre disponible y siempre al día, porque se arma al
          momento desde el sistema en vez de ser un archivo viejo guardado. */}
      <div style={{ ...fila, borderColor: `${accent}44`, background: `${accent}0D` }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}1c`, border: `1px solid ${accent}33` }}>
          <BookOpen size={18} color={accent} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: txt, fontFamily: fontDisp, textWrap: "pretty" }}>
            Manual de {MANUAL.titulo} — módulo por módulo
          </div>
          <div style={{ fontSize: 12, color: txt3, marginTop: 3 }}>
            {MANUAL.secciones.length} secciones · {MANUAL.secciones.reduce((a, s) => a + s.items.length, 0)} funciones · qué hace cada una y qué cambia
          </div>
        </div>
        <button onClick={bajarManual} title="Descargar el manual en Word"
          style={{ ...btn, borderColor: `${accent}55`, color: accent, background: `${accent}14`, fontWeight: 600 }}>
          <Download size={14} /> Word
        </button>
        {subido.manual ? (
          <a href={subido.manual} target="_blank" rel="noreferrer" title="Abrirlo en Drive"
            style={{ ...btn, borderColor: `${accent}55`, color: accent, textDecoration: "none" }}>
            <Check size={14} /> En Drive
          </a>
        ) : (
          <button onClick={() => aDrive("manual", `Manual de ${MANUAL.titulo}`, manualEnBloques(new Date().toISOString()))}
            disabled={!!subiendo} title="Subirlo a Drive: queda editable y se baja en Word o PDF" style={btn}>
            {subiendo === "manual"
              ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
              : <Cloud size={14} />} Drive
          </button>
        )}
      </div>

      {aviso && (
        <div style={{ ...fila, borderColor: "#F8717155", color: txt2, fontSize: 12.5 }}>{aviso}</div>
      )}

      {/* Lo que se fue guardando desde el sistema (informes, reportes, notas) */}
      {cargando && (
        <div style={{ ...fila, justifyContent: "center", color: txt3, fontSize: 12.5 }}>
          <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Buscando…
        </div>
      )}

      {!cargando && docs.map((d) => (
        <div key={d.id} style={fila}>
          <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)" }}>
            <FileText size={17} color={txt2} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: txt, fontFamily: fontDisp, textWrap: "pretty" }}>{d.titulo}</div>
            <div style={{ fontSize: 12, color: txt3, marginTop: 3 }}>
              {d.tipo} · {fechaLarga(d.fecha)}{d.autor ? ` · ${d.autor.split(" ")[0]}` : ""}
            </div>
          </div>
          <button onClick={() => setAbierto(d)} title="Leerlo aquí" style={btn}>
            <Eye size={14} />
          </button>
          <button onClick={() => bajarDoc(d)} title="Descargar en Word" style={btn}>
            <Download size={14} /> Word
          </button>
          {subido[d.id] ? (
            <a href={subido[d.id]} target="_blank" rel="noreferrer" title="Abrirlo en Drive"
              style={{ ...btn, borderColor: `${accent}55`, color: accent, textDecoration: "none" }}>
              <Check size={14} />
            </a>
          ) : (
            <button onClick={() => aDrive(d.id, d.titulo, textoABloques(d.contenido, empresa, d.fecha))} disabled={!!subiendo}
              title="Subirlo a Drive: queda editable y se baja en Word o PDF" style={btn}>
              {subiendo === d.id
                ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                : <Cloud size={14} />}
            </button>
          )}
        </div>
      ))}

      {!cargando && !docs.length && (
        <div style={{ ...fila, color: txt3, fontSize: 12.5, textWrap: "pretty" }}>
          Todavía no guardaste ninguno. Los informes que generes en Caja → Informe se guardan aquí con un botón.
        </div>
      )}

      {/* Lector — para no tener que bajar el Word solo para mirarlo */}
      {abierto && (
        <div onClick={() => setAbierto(null)}
          style={{ position: "fixed", inset: 0, zIndex: 99990, background: isLight ? "rgba(15,23,42,0.5)" : "rgba(1,3,9,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: "min(760px, 96vw)", maxHeight: "86dvh", overflowY: "auto",
            background: isLight ? "#FFFFFF" : "#0A0F1C", border: `1px solid ${bd}`,
            borderRadius: 18, padding: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${bd}` }}>
              <div style={{ fontSize: 15, color: txt, fontFamily: fontDisp, textWrap: "pretty" }}>{abierto.titulo}</div>
              <button onClick={() => bajarDoc(abierto)} style={{ ...btn, borderColor: `${accent}55`, color: accent }}>
                <Download size={14} /> Word
              </button>
            </div>
            <pre style={{ margin: 0, fontFamily: font, fontSize: 13, lineHeight: 1.75, color: txt, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {abierto.contenido}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
