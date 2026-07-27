// InformeAvances.jsx — «qué se hizo» en los últimos días, contado para que lo
// entienda cualquiera.
//
// Pedido de Ángel (27-jul-2026):
//   «si lanzo el resumen, ese resumen también debe estar conectado con el AIOS…
//    cuando se dé generar, debe quedarse como cargando, buscar la información de
//    lo que se ha hecho de los últimos quince días… y así se genere un buen
//    documento con todo lo que se ha hecho, de forma no técnica, que se vea bien
//    para cualquier persona de recursos humanos y también para cualquier CEO»
//
// Cómo funciona, en dos pasos:
//   1. La BASE junta la EVIDENCIA (`fn_informe_avances`): tareas cerradas, avance
//      real de cada proyecto, objetivos del cliente, bitácora, reuniones y el
//      changelog del cerebro. Nada de esto se inventa: sale de lo que quedó escrito.
//   2. Un redactor (Claude, por n8n) reescribe ESA evidencia en lenguaje de
//      negocio. Tiene prohibido agregar hechos; solo traduce.
//
// Si el redactor no contesta, NO se cae: la misma función devuelve un borrador ya
// armado y el informe sale igual. Un informe que depende de que un servicio esté
// vivo no es un informe, es una promesa.

import { useState, useCallback, useRef, useEffect } from "react";
import { FileBarChart, Download, RefreshCw, Sparkles, AlertTriangle } from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useViewport";
import { descargarDocx } from "../../lib/docx";

const REDACTOR_URL = "https://personal-n8n.suwsiw.easypanel.host/webhook/nsg-informe-avances";
const REDACTOR_TIMEOUT_MS = 90000;   // el redactor tarda ~10s; 90 es margen de sobra

const RANGOS = [
  { dias: 7,  label: "7 días" },
  { dias: 15, label: "15 días" },
  { dias: 30, label: "30 días" },
];

// Lo que se le muestra mientras trabaja. No es decoración: sin esto el botón
// parece colgado durante 10-15 segundos y la gente vuelve a apretarlo.
const PASOS = [
  "Buscando en el cerebro lo que se hizo…",
  "Ordenando entregas, proyectos y reuniones…",
  "Redactando el informe en lenguaje claro…",
];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
               "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaLarga = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
};

export default function InformeAvances({ T }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const isLight = parseInt(String(T?.bg || "#000000").replace("#", "").slice(0, 2), 16) > 128;
  const txt    = T?.txt    || (isLight ? "#0B1220" : "#E2E8F0");
  const txt2   = T?.txt2   || (isLight ? "#3B4A61" : "#8B99AE");
  const txt3   = T?.txt3   || (isLight ? "#7A8699" : "#4A5568");
  const accent = T?.accent || (isLight ? "#0D9A76" : "#6EE7C2");
  const glass  = T?.glass  || (isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.032)");
  const bd     = T?.border || (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)");

  const card = {
    background: glass, border: `1px solid ${bd}`, borderRadius: 16,
    backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)",
  };

  const [dias, setDias] = useState(15);
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState(0);
  const [texto, setTexto] = useState("");
  const [meta, setMeta] = useState(null);      // { empresa, cliente, periodo, redactado }
  const [error, setError] = useState("");
  const pasoTimer = useRef(null);

  // El intervalo de los pasos se limpia siempre — si no, sigue corriendo después
  // de desmontar la vista y React avisa (y se acumulan timers).
  useEffect(() => () => clearInterval(pasoTimer.current), []);

  const generar = useCallback(async () => {
    if (!user?.id || cargando) return;
    setCargando(true); setError(""); setTexto(""); setMeta(null); setPaso(0);

    clearInterval(pasoTimer.current);
    pasoTimer.current = setInterval(() => setPaso((p) => Math.min(p + 1, PASOS.length - 1)), 3500);

    try {
      // 1) La evidencia. Esto es lo único que no puede fallar.
      const { data, error: e } = await supabase.rpc("fn_informe_avances", {
        p_profile_id: user.id, p_dias: dias,
      });
      if (e) throw new Error(e.message);
      if (!data || data.ok === false) throw new Error(data?.error || "No pude reunir la información.");

      const info = {
        empresa: data.empresa, cliente: data.cliente, periodo: data.periodo,
        entregas: (data.entregas || []).length,
        reuniones: (data.reuniones || []).length,
        redactado: false,
      };

      // 2) El redactor. Si no contesta, se usa el borrador y el informe sale igual.
      let salida = data.borrador || "";
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), REDACTOR_TIMEOUT_MS);
        const r = await fetch(REDACTOR_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evidencia: data }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        const j = await r.json();
        if (j?.texto && String(j.texto).trim().length > 80) {
          salida = String(j.texto).trim();
          info.redactado = true;
        }
      } catch {
        // Silencio a propósito: el borrador ya cubre el caso y decirle a la
        // persona «falló el redactor» no le sirve de nada — el informe está.
      }

      setTexto(salida);
      setMeta(info);
    } catch (err) {
      setError(err?.message || "No pude generar el informe.");
    } finally {
      clearInterval(pasoTimer.current);
      setCargando(false);
    }
  }, [user?.id, dias, cargando]);

  // El Word. Se arma en esta misma máquina, así que el archivo no viaja por
  // ningún lado y no se puede corromper en el camino (lección de la primera
  // cuenta de cobro, que llegaba dañada).
  const bajarWord = () => {
    if (!texto) return;
    const bloques = [
      { text: (meta?.empresa || "Informe").toUpperCase(), bold: true, size: 12, align: "right", after: 0, color: "667085" },
      { text: fechaLarga(new Date().toISOString().slice(0, 10)), size: 10, align: "right", after: 18, color: "667085" },
    ];

    // El texto viene en párrafos separados por línea en blanco. Los títulos de
    // sección vienen EN MAYÚSCULAS y las viñetas empiezan con •.
    String(texto).split("\n").forEach((linea) => {
      const l = linea.trim();
      if (!l) { bloques.push({ text: "", after: 6 }); return; }

      const esTitulo = l === l.toUpperCase() && l.length < 60 && /[A-ZÁÉÍÓÚÑ]/.test(l);
      const esVineta = l.startsWith("•") || l.startsWith("·") || l.startsWith("-");

      if (esTitulo && bloques.length <= 2) {
        bloques.push({ text: l, bold: true, size: 18, align: "center", after: 4 });
      } else if (esTitulo) {
        bloques.push({ text: l, bold: true, size: 11.5, before: 12, after: 6, linea: true });
      } else if (esVineta) {
        bloques.push({ text: l.replace(/^[•·-]\s*/, "• "), size: 10.5, indent: 12, after: 5 });
      } else {
        bloques.push({ text: l, size: 11, after: 6 });
      }
    });

    const desde = meta?.periodo?.desde || "";
    descargarDocx(`Informe de avances ${desde ? `— ${desde}` : ""}`.trim(), bloques);
  };

  const botonPrimario = {
    background: cargando ? "transparent" : `${accent}1A`,
    border: `1px solid ${accent}55`, borderRadius: 12,
    padding: "12px 18px", cursor: cargando ? "default" : "pointer", color: accent,
    fontSize: 13.5, fontWeight: 600, fontFamily: font,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    flex: isMobile ? 1 : "none", opacity: cargando ? 0.75 : 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Encabezado — en celular todo se apila y queda centrado (pedido de Ángel:
          «los botones centrados, el texto también»). */}
      <div style={{
        display: "flex", alignItems: isMobile ? "stretch" : "center",
        justifyContent: "space-between", gap: 12,
        flexDirection: isMobile ? "column" : "row",
      }}>
        <div style={{ textAlign: isMobile ? "center" : "left" }}>
          <div style={{ fontSize: 14.5, fontFamily: fontDisp, fontWeight: 500, color: txt }}>
            Informe de avances
          </div>
          <div style={{ fontSize: 12, color: txt2, marginTop: 3, textWrap: "pretty" }}>
            Junta lo que de verdad se hizo y lo cuenta sin tecnicismos · listo para enviar al cliente
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 11, border: `1px solid ${bd}` }}>
            {RANGOS.map((r) => (
              <button key={r.dias} type="button" onClick={() => setDias(r.dias)} disabled={cargando}
                style={{
                  padding: "9px 12px", borderRadius: 8, cursor: cargando ? "default" : "pointer",
                  fontSize: 12.5, fontFamily: font, border: "1px solid transparent", textAlign: "center",
                  background: dias === r.dias ? `${accent}1A` : "transparent",
                  color: dias === r.dias ? accent : txt2,
                  fontWeight: dias === r.dias ? 600 : 400,
                }}>{r.label}</button>
            ))}
          </div>
          <button onClick={generar} disabled={cargando} style={botonPrimario}>
            {cargando
              ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} />
              : <Sparkles size={15} />}
            {cargando ? "Generando…" : "Generar informe"}
          </button>
        </div>
      </div>

      {/* Mientras trabaja: se ve QUÉ está haciendo, no una ruedita muda. */}
      {cargando && (
        <div style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {PASOS.map((p, i) => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                background: i <= paso ? accent : bd,
                opacity: i === paso ? 1 : (i < paso ? 0.5 : 0.4),
                animation: i === paso ? "pulse 1.4s ease-in-out infinite" : undefined,
              }} />
              <span style={{
                fontSize: 13, fontFamily: font,
                color: i === paso ? txt : (i < paso ? txt2 : txt3),
              }}>{p}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 10, borderColor: "#F8717155" }}>
          <AlertTriangle size={16} color="#F87171" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: txt2, fontFamily: font }}>{error}</span>
        </div>
      )}

      {/* El informe */}
      {!cargando && texto && (
        <div style={{ ...card, padding: isMobile ? 18 : 26 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, flexWrap: "wrap", marginBottom: 16, paddingBottom: 14,
            borderBottom: `1px solid ${bd}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FileBarChart size={17} color={accent} />
              <div>
                <div style={{ fontSize: 13.5, fontFamily: fontDisp, color: txt }}>
                  {meta?.periodo ? `${fechaLarga(meta.periodo.desde)} al ${fechaLarga(meta.periodo.hasta)}` : "Informe"}
                </div>
                <div style={{ fontSize: 11.5, color: txt3, marginTop: 2 }}>
                  {meta?.entregas || 0} entregas · {meta?.reuniones || 0} reuniones
                  {meta && !meta.redactado ? " · versión resumida" : ""}
                </div>
              </div>
            </div>
            <button onClick={bajarWord} title="Descargar en Word" style={{
              background: "transparent", border: `1px solid ${bd}`, borderRadius: 10,
              padding: "10px 14px", cursor: "pointer", color: txt2, fontSize: 12.5,
              fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}>
              <Download size={14} /> Word
            </button>
          </div>

          <pre style={{
            margin: 0, fontFamily: font, fontSize: isMobile ? 13 : 13.5,
            lineHeight: 1.75, color: txt, whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>{texto}</pre>
        </div>
      )}

      {/* Estado vacío — explica de dónde saldrá el informe antes de apretarlo. */}
      {!cargando && !texto && !error && (
        <div style={{ ...card, padding: 28, textAlign: "center" }}>
          <FileBarChart size={26} color={txt3} strokeWidth={1.6} />
          <div style={{ fontSize: 13.5, color: txt2, marginTop: 12, fontFamily: font, textWrap: "pretty" }}>
            Elegí el periodo y dale a «Generar informe».
          </div>
          <div style={{ fontSize: 12, color: txt3, marginTop: 6, maxWidth: 460, marginLeft: "auto", marginRight: "auto", textWrap: "pretty" }}>
            Sale de lo que quedó registrado: tareas cerradas, avance de los proyectos,
            objetivos del cliente y las reuniones del periodo.
          </div>
        </div>
      )}
    </div>
  );
}
