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
import { FileBarChart, Download, RefreshCw, Sparkles, AlertTriangle, Save, Check, CalendarDays,
         Cloud, Link2, MessageSquarePlus, X } from "lucide-react";
import { bloquesDelReporte } from "../../lib/informe-doc";
import { font, fontDisp } from "../../design-system/tokens";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useViewport";
import { descargarDocx, buildDocx } from "../../lib/docx";

const REDACTOR_URL = "https://personal-n8n.suwsiw.easypanel.host/webhook/nsg-informe-avances";
// El redactor tarda entre 30 y 60 segundos con una quincena entera. Estaba en 90
// y aun así se cortó: el 29-jul salió el BORRADOR crudo —con emojis, números de
// PR y nombres de flujos— porque el redactor no llegó a tiempo. 150 da aire.
const REDACTOR_TIMEOUT_MS = 150000;

// Lo que se le manda al redactor va PODADO. Con la quincena completa eran ~120
// entradas de 420 caracteres: el modelo tardaba más que el tope y se caía al
// borrador. Con esto el prompt baja a la mitad y el informe sale redactado.
const HECHOS_POR_DIA = 5;
const LARGO_HECHO    = 300;

// Emojis y símbolos fuera. El prompt ya los prohíbe, pero si el modelo copia uno
// del changelog termina en el Word que lee la persona de recursos humanos — y
// ahí ya es tarde. Se limpia en los dos sentidos: lo que entra y lo que sale.
const sinEmojis = (t) =>
  String(t || "").replace(/[^\n\r -~áéíóúüñÁÉÍÓÚÜÑ¿¡«»°ºª—–…·]/g, "").replace(/[ \t]{2,}/g, " ");

// Al redactor se le manda SOLO lo que va a usar, y en la forma más simple que
// existe: el encabezado, el periodo y el día a día con sus hechos como frases
// sueltas. Nada más.
//
// Antes viajaba la evidencia entera —con `entregas`, `reuniones`, `proyectos` y
// `objetivos` además de los `dias`—, y eso era pagar dos veces por lo mismo: las
// entregas y las reuniones YA vienen dentro de cada día como hechos. Los
// porcentajes de proyectos y los objetivos ya no se usan (Ángel los sacó del
// molde del documento), así que solo hacían el prompt más largo y más lento.
//
// Esta es exactamente la forma con la que se probó el redactor de punta a punta
// el 30-jul. Si cambia acá, hay que volver a probarlo: el prompt está escrito
// contra esta forma.
const podarEvidencia = (data) => ({
  empresa:    data.empresa,
  cliente:    data.cliente,
  periodo:    data.periodo,
  encabezado: data.encabezado,
  dias: (data.dias || []).map((d) => ({
    dia:    d.dia,
    numero: d.numero,
    semana: d.semana,
    hechos: (d.hechos || [])
      .slice(0, HECHOS_POR_DIA)
      // Un hecho es una frase, no un objeto: el título si lo tiene (las tareas y
      // las reuniones lo traen limpio) y si no, el detalle del changelog.
      // El `trim` no es cosmético: al sacar un emoji del arranque queda un
      // espacio suelto, y esa frase entra al prompt empezando en blanco.
      .map((h) => sinEmojis(h.titulo || h.detalle || "").trim().slice(0, LARGO_HECHO))
      .filter((t) => t.length > 0),
  })),
});

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

// Fecha de HOY en la zona de quien está mirando. `toISOString()` a secas devuelve
// UTC: en Bogotá (-5) eso da el día de AYER hasta las 7 de la tarde, y el informe
// arrancaría corrido un día sin que nadie lo note.
const isoLocal = (d) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const hoyISO = () => isoLocal(new Date());
const menosDias = (iso, n) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return isoLocal(new Date(y, m - 1, d - n));
};

// Por qué no se pudo redactar. No es para dar detalle técnico: es para que la
// persona sepa si tiene sentido volver a intentar o si hay que avisarle a
// alguien. Son cosas muy distintas y hasta hoy se contaban igual.
const motivoDelRedactor = (respuesta, cuerpo) => {
  const crudo = JSON.stringify(cuerpo || {}) + " " + (respuesta?.statusText || "");
  // El caso que nos mordió: la cuenta de la IA sin saldo. Reintentar no arregla
  // nada, hay que recargarla — y eso lo hace Iván, que tiene los accesos.
  if (/credit balance|too low|insufficient|quota|billing/i.test(crudo)) return "sin-saldo";
  if (/rate.?limit|429/i.test(crudo)) return "saturado";
  return "otro";
};

const AVISOS_REDACTOR = {
  "sin-saldo": "El asistente que redacta se quedó sin saldo, así que el informe salió en su versión resumida. Volver a intentar no lo va a resolver: hay que recargar la cuenta (eso lo ve Iván). Abajo queda todo lo que hay registrado.",
  "saturado":  "El asistente que redacta está saturado en este momento. Esperá un par de minutos y volvé a darle a «Generar informe».",
  "tardo":     "El asistente que redacta tardó más de lo normal. Volvé a darle a «Generar informe» y suele salir completo.",
  "sin-conexion": "No pude comunicarme con el asistente que redacta. Revisá la conexión y volvé a intentar.",
  "otro":      "El asistente que redacta no pudo responder, así que el informe salió en su versión resumida. Volvé a intentar en un momento.",
};

// Deja el informe en Mi Espacio → Documentos (y le avisa al equipo por el
// Copilot). Vive fuera del componente y recibe TODO por parámetro: así la
// pueden llamar tanto el guardado automático —que corre cuando el estado de
// React todavía no se actualizó— como el botón, sin riesgo de archivar el
// informe anterior.
async function guardarEnDocumentos(profileId, texto, periodo) {
  const nombre = `Informe de avances · ${periodo?.desde || ""} al ${periodo?.hasta || ""}`.trim();
  const { data, error } = await supabase.rpc("fn_doc_guardar", {
    p_profile_id: profileId, p_titulo: nombre, p_contenido: texto,
    p_tipo: "informe", p_desde: periodo?.desde || null, p_hasta: periodo?.hasta || null,
  });
  return !error && data?.ok !== false;
}

// Sube el Word a Google Drive y devuelve un link que abre de verdad.
//
// El flujo del otro lado (`nsg-subir-doc`) sube con la cuenta OPERATIVA del
// negocio y después abre el permiso a «cualquiera con el enlace, como editor».
// Las dos cosas importan: un archivo subido con otra cuenta le pide permiso a
// quien lo abra, y un link que pide permiso no sirve para mandarle nada a nadie.
const DRIVE_URL = "https://personal-n8n.suwsiw.easypanel.host/webhook/nsg-subir-doc";

// El Word viaja en base64. `btoa` no acepta bytes sueltos de más de 255 ni
// strings largos de un saque, así que se arma por trozos.
function bytesABase64(bytes) {
  let bin = "";
  const PASO = 0x8000;
  for (let i = 0; i < bytes.length; i += PASO) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + PASO));
  }
  return btoa(bin);
}

async function subirADrive(nombreArchivo, blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const r = await fetch(DRIVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: nombreArchivo,
      base64: bytesABase64(bytes),
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  });
  const j = await r.json();
  if (!j?.link) throw new Error("Drive no devolvió el enlace del archivo.");
  // Se compara el peso de ida y vuelta: ya pasó que el archivo llegara a medias
  // y el link existiera igual, apuntando a un Word que no abre.
  return { link: j.link, id: j.id, bytes: bytes.length };
}

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

  // El periodo se guarda SIEMPRE como dos fechas. Los botones de 7/15/30 no son
  // otro modo: solo rellenan estas dos cajas. Con una sola fuente de verdad no
  // puede pasar que la pantalla diga un rango y el informe salga con otro.
  const [hasta, setHasta] = useState(hoyISO);
  const [desde, setDesde] = useState(() => menosDias(hoyISO(), 15));
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState(0);
  const [texto, setTexto] = useState("");
  const [meta, setMeta] = useState(null);      // { empresa, cliente, periodo, redactado }
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  // Drive y notas del equipo.
  const [subiendo, setSubiendo] = useState(false);
  const [linkDrive, setLinkDrive] = useState("");
  const [notas, setNotas] = useState([]);
  const [notaNueva, setNotaNueva] = useState("");
  const [anotando, setAnotando] = useState(false);
  const pasoTimer = useRef(null);

  // El intervalo de los pasos se limpia siempre — si no, sigue corriendo después
  // de desmontar la vista y React avisa (y se acumulan timers).
  useEffect(() => () => clearInterval(pasoTimer.current), []);

  // Las notas del periodo que se esté mirando. Se refrescan al cambiar las
  // fechas para que lo que se ve en pantalla sea lo que va a entrar al informe.
  const cargarNotas = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.rpc("fn_informe_notas_listar", {
      p_profile_id: user.id, p_desde: desde, p_hasta: hasta,
    });
    setNotas(Array.isArray(data) ? data : []);
  }, [user?.id, desde, hasta]);

  useEffect(() => { cargarNotas(); }, [cargarNotas]);

  const generar = useCallback(async () => {
    if (!user?.id || cargando) return;
    setCargando(true); setError(""); setTexto(""); setMeta(null); setPaso(0);
    setLinkDrive("");   // el link de Drive es de ESE Word; con otro informe ya no aplica

    clearInterval(pasoTimer.current);
    pasoTimer.current = setInterval(() => setPaso((p) => Math.min(p + 1, PASOS.length - 1)), 3500);

    try {
      // 1) La evidencia. Esto es lo único que no puede fallar.
      const { data, error: e } = await supabase.rpc("fn_informe_avances", {
        p_profile_id: user.id, p_dias: 15, p_desde: desde, p_hasta: hasta,
      });
      if (e) throw new Error(e.message);
      if (!data || data.ok === false) throw new Error(data?.error || "No pude reunir la información.");

      const info = {
        empresa: data.empresa, cliente: data.cliente, periodo: data.periodo,
        encabezado: data.encabezado || null,
        entregas: (data.entregas || []).length,
        reuniones: (data.reuniones || []).length,
        jornadas: (data.dias || []).length,
        redactado: false,
      };

      // 2) El borrador presentable. Es el que sale si el redactor no contesta, así
      //    que TIENE que poder mandarse tal cual: abre con el encabezado del
      //    documento y va día por día, ya sin emojis ni jerga técnica.
      let salida = "";
      try {
        const { data: b } = await supabase.rpc("fn_informe_borrador", { p_j: data });
        if (b && String(b).trim().length > 40) salida = String(b).trim();
      } catch { /* si falla, queda el de la propia función */ }
      if (!salida) salida = sinEmojis(data.borrador || "");

      // 3) El redactor. Si no contesta, se usa el borrador y el informe sale igual.
      //    Las notas del equipo se leen ACÁ y no del estado de React: si alguien
      //    acaba de escribir una y aprieta «regenerar», el estado todavía no se
      //    actualizó y la nota se perdería justo en la corrida que la pidió.
      let notasAhora = [];
      try {
        const { data: n } = await supabase.rpc("fn_informe_notas_listar", {
          p_profile_id: user.id, p_desde: desde, p_hasta: hasta,
        });
        notasAhora = Array.isArray(n) ? n : [];
        setNotas(notasAhora);
      } catch { /* sin notas se genera igual */ }

      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), REDACTOR_TIMEOUT_MS);
        const r = await fetch(REDACTOR_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidencia: {
              ...podarEvidencia(data),
              notas_del_equipo: notasAhora.map((n) => n.texto),
            },
          }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        const j = await r.json().catch(() => null);
        if (j?.texto && String(j.texto).trim().length > 80) {
          salida = sinEmojis(String(j.texto).trim());
          info.redactado = true;
        } else {
          info.porQueNo = motivoDelRedactor(r, j);
        }
      } catch (e) {
        // Antes esto era silencio a propósito, con el argumento de que el
        // borrador ya cubría el caso. Estaba mal: el 31-jul el redactor se cayó
        // porque la cuenta de la IA se quedó SIN SALDO, y la pantalla dijo «no
        // alcanzó a responder, volvé a intentar en un momento». Reintentar no
        // servía de nada — iba a fallar igual — y nadie tenía cómo saberlo.
        // Un aviso que manda a repetir algo que no puede funcionar es peor que
        // no decir nada.
        info.porQueNo = e?.name === "AbortError"
          ? "tardo"
          : "sin-conexion";
      }

      setTexto(salida);
      setMeta(info);

      // Queda archivado SOLO, sin que nadie apriete nada. Si falla, el informe
      // sigue en pantalla y descargable — solo se avisa que no se archivó.
      const ok = await guardarEnDocumentos(user.id, salida, info.periodo);
      setGuardado(ok);
      if (!ok) setError("El informe está listo, pero no pude dejarlo en Documentos. Probá con «Guardar en Stratos».");
    } catch (err) {
      setError(err?.message || "No pude generar el informe.");
    } finally {
      clearInterval(pasoTimer.current);
      setCargando(false);
    }
  }, [user?.id, desde, hasta, cargando]);

  // Guardar en Documentos. Ya NO depende de que alguien apriete el botón:
  // pedido de Ángel (29-jul) — «todo reporte que hagamos debe quedar en
  // documentos de NSG… el reporte del día del lunes no se puso en ningún lado».
  // Un documento que solo existe si alguien se acuerda de guardarlo, tarde o
  // temprano no existe. Se guarda solo apenas está listo; el botón queda como
  // testigo (y como reintento si el guardado falló).
  //
  // Recibe el texto y la ficha por parámetro a propósito: cuando se llama desde
  // `generar`, el estado de React todavía no se actualizó y leerlo de ahí
  // guardaría el informe ANTERIOR.
  const guardar = async () => {
    if (!texto || !user?.id || guardando) return;
    setGuardando(true); setError("");
    const ok = await guardarEnDocumentos(user.id, texto, meta?.periodo);
    setGuardando(false);
    if (!ok) { setError("No pude dejarlo en Documentos. Intentá de nuevo en un momento."); return; }
    setGuardado(true);
  };

  // El Word. Se arma en esta misma máquina, así que el archivo no viaja por
  // ningún lado y no se puede corromper en el camino (lección de la primera
  // cuenta de cobro, que llegaba dañada).
  const bajarWord = () => {
    if (!texto) return;
    const bloques = bloquesDelReporte(texto, {
      empresa: meta?.empresa,
      generado: fechaLarga(hoyISO()),
    });
    const d = meta?.periodo?.desde || "";
    const h = meta?.periodo?.hasta || "";
    descargarDocx(`Reporte de avances ${d && h ? `${d} al ${h}` : ""}`.trim(), bloques);
  };

  // El mismo Word, pero a Drive: queda un enlace que se puede mandar por
  // WhatsApp o pegar en un correo y lo abre cualquiera, sin cuenta y sin pedir
  // permiso. Pedido de Ángel (30-jul): «ponle una función en generar reporte
  // para ponerlo en Google Drive, para que de un link se mande al Drive».
  const mandarADrive = async () => {
    if (!texto || subiendo) return;
    setSubiendo(true); setError("");
    try {
      const bloques = bloquesDelReporte(texto, {
        empresa: meta?.empresa,
        generado: fechaLarga(hoyISO()),
      });
      const d = meta?.periodo?.desde || "";
      const h = meta?.periodo?.hasta || "";
      const nombre = `Reporte de avances ${d && h ? `${d} al ${h}` : hoyISO()}.docx`;
      const blob = buildDocx(bloques);
      const { link } = await subirADrive(nombre, blob);
      setLinkDrive(link);
      // El enlace también se guarda en Documentos del equipo: si solo vive en
      // esta pantalla, mañana nadie lo encuentra.
      try {
        await supabase.rpc("fn_doc_link_agregar", {
          p_profile_id: user.id,
          p_titulo: `Informe de avances ${d} al ${h} (Word)`,
          p_url: link,
        });
      } catch { /* el link ya está en pantalla; que falle el índice no lo pierde */ }
    } catch (err) {
      setError(err?.message || "No pude subirlo a Drive. Probá de nuevo en un momento.");
    } finally {
      setSubiendo(false);
    }
  };

  // Guardar una nota del equipo y volver a redactar con ella puesta.
  //
  // Pedido de Ángel (30-jul): «algo que no está en el AIOS y que se quiera que
  // se agregue… "también agrega que se le dedicaron 10 horas a trabajar en la
  // meta de Cecilia"… o mandarle retroalimentación después del reporte, para que
  // no nos quedemos solo con la primera versión que da».
  //
  // La nota se GUARDA antes de regenerar, no se manda de paso: así el dato queda
  // para la próxima quincena aunque esta corrida falle.
  const agregarNota = async (regenerar) => {
    const t = notaNueva.trim();
    if (!t || !user?.id || anotando) return;
    setAnotando(true); setError("");
    try {
      const { data, error: e } = await supabase.rpc("fn_informe_nota_agregar", {
        p_profile_id: user.id, p_texto: t, p_desde: desde, p_hasta: hasta,
      });
      if (e || data?.ok === false) throw new Error(data?.error || e?.message || "No pude guardar la nota.");
      setNotaNueva("");
      await cargarNotas();
      if (regenerar) await generar();
    } catch (err) {
      setError(err?.message || "No pude guardar la nota.");
    } finally {
      setAnotando(false);
    }
  };

  const quitarNota = async (id) => {
    if (!user?.id) return;
    await supabase.rpc("fn_informe_nota_borrar", { p_profile_id: user.id, p_nota_id: id });
    cargarNotas();
  };

  // `colorScheme` no es cosmético: sin él, en modo oscuro el navegador dibuja el
  // calendario nativo con fondo blanco y el iconito del día queda invisible.
  const campoFecha = {
    background: "transparent", border: "none", outline: "none",
    color: txt, fontSize: 12.5, fontFamily: font, padding: 0,
    colorScheme: isLight ? "light" : "dark",
    cursor: cargando ? "default" : "pointer",
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
          <div style={{ fontSize: 12.5, color: txt2, marginTop: 3, textWrap: "pretty" }}>
            Junta lo que de verdad se hizo y lo cuenta sin tecnicismos · listo para enviar al cliente
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
          {/* Atajos. No son «otro modo»: solo mueven la fecha de inicio. */}
          <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 11, border: `1px solid ${bd}` }}>
            {RANGOS.map((r) => {
              const activo = desde === menosDias(hasta, r.dias);
              return (
                <button key={r.dias} type="button" disabled={cargando}
                  onClick={() => setDesde(menosDias(hasta, r.dias))}
                  style={{
                    padding: "9px 12px", borderRadius: 8, cursor: cargando ? "default" : "pointer",
                    fontSize: 12.5, fontFamily: font, border: "1px solid transparent", textAlign: "center",
                    background: activo ? `${accent}1A` : "transparent",
                    color: activo ? accent : txt2,
                    fontWeight: activo ? 600 : 400,
                  }}>{r.label}</button>
              );
            })}
          </div>

          {/* El periodo exacto. Los reportes se facturan por quincena («del 30 de
              junio al 14 de julio»), no por «los últimos N días». */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
            borderRadius: 11, border: `1px solid ${bd}`,
          }}>
            <CalendarDays size={14} color={txt3} style={{ flexShrink: 0 }} />
            <input type="date" value={desde} max={hasta} disabled={cargando}
              onChange={(e) => e.target.value && setDesde(e.target.value)}
              aria-label="Desde" style={campoFecha} />
            <span style={{ color: txt3, fontSize: 12.5, fontFamily: font }}>al</span>
            <input type="date" value={hasta} min={desde} max={hoyISO()} disabled={cargando}
              onChange={(e) => e.target.value && setHasta(e.target.value)}
              aria-label="Hasta" style={campoFecha} />
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
                <div style={{ fontSize: 12, color: txt3, marginTop: 2 }}>
                  {meta?.jornadas || 0} jornadas · {meta?.reuniones || 0} reuniones
                  {meta?.entregas ? ` · ${meta.entregas} entregas` : ""}
                  {meta && !meta.redactado ? " · versión resumida" : ""}
                </div>
                {/* Por qué quedó resumido. Va acá arriba, pegado al informe, y
                    no como un error rojo: el informe SÍ salió, solo que sin
                    redactar. Lo que cambia es qué hacer al respecto. */}
                {meta && !meta.redactado && (
                  <div style={{
                    fontSize: 12, color: txt2, marginTop: 7, maxWidth: 620,
                    lineHeight: 1.55, textWrap: "pretty",
                  }}>
                    {AVISOS_REDACTOR[meta.porQueNo] || AVISOS_REDACTOR.otro}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={guardar} disabled={guardando || guardado}
                title={guardado
                  ? "Quedó solo en Mi Espacio → Documentos, y al equipo le llegó el aviso"
                  : "Guardarlo en Stratos y avisarle al equipo"}
                style={{
                  background: guardado ? `${accent}14` : "transparent",
                  border: `1px solid ${guardado ? `${accent}55` : bd}`, borderRadius: 10,
                  padding: "10px 14px", cursor: (guardando || guardado) ? "default" : "pointer",
                  color: guardado ? accent : txt2, fontSize: 12.5, fontFamily: font,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}>
                {guardando ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                  : guardado ? <Check size={14} /> : <Save size={14} />}
                {guardando ? "Guardando…" : guardado ? "En Documentos" : "Guardar en Stratos"}
              </button>
              <button onClick={bajarWord} title="Descargar en Word" style={{
                background: "transparent", border: `1px solid ${bd}`, borderRadius: 10,
                padding: "10px 14px", cursor: "pointer", color: txt2, fontSize: 12.5,
                fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}>
                <Download size={14} /> Word
              </button>
              <button onClick={mandarADrive} disabled={subiendo}
                title="Subirlo a Google Drive y quedarse con el enlace para compartir"
                style={{
                  background: linkDrive ? `${accent}14` : "transparent",
                  border: `1px solid ${linkDrive ? `${accent}55` : bd}`, borderRadius: 10,
                  padding: "10px 14px", cursor: subiendo ? "default" : "pointer",
                  color: linkDrive ? accent : txt2, fontSize: 12.5, fontFamily: font,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}>
                {subiendo ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                  : linkDrive ? <Check size={14} /> : <Cloud size={14} />}
                {subiendo ? "Subiendo…" : linkDrive ? "En Drive" : "Subir a Drive"}
              </button>
            </div>
          </div>

          {/* El enlace de Drive. Se muestra entero y se puede copiar de un toque:
              el caso real es mandarlo por WhatsApp, no abrirlo acá. */}
          {linkDrive && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              padding: "10px 12px", marginBottom: 14, borderRadius: 10,
              background: `${accent}0D`, border: `1px solid ${accent}33`,
            }}>
              <Link2 size={14} color={accent} style={{ flexShrink: 0 }} />
              <a href={linkDrive} target="_blank" rel="noreferrer" style={{
                color: accent, fontSize: 12.5, fontFamily: font, wordBreak: "break-all", flex: 1,
              }}>{linkDrive}</a>
              <button onClick={() => navigator.clipboard?.writeText(linkDrive)} style={{
                background: "transparent", border: `1px solid ${accent}44`, borderRadius: 8,
                padding: "6px 12px", cursor: "pointer", color: accent, fontSize: 12, fontFamily: font,
              }}>Copiar</button>
            </div>
          )}

          <pre style={{
            margin: 0, fontFamily: font, fontSize: isMobile ? 13 : 13.5,
            lineHeight: 1.75, color: txt, whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>{texto}</pre>
        </div>
      )}

      {/* Notas del equipo — lo que el informe no puede saber solo.
          Va DESPUÉS del informe a propósito: se escribe leyendo lo que salió. */}
      {!cargando && (
        <div style={{ ...card, padding: isMobile ? 18 : 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
            <MessageSquarePlus size={16} color={accent} />
            <div style={{ fontSize: 13.5, fontFamily: fontDisp, color: txt }}>
              {texto ? "¿Le falta algo o lo cambiarías?" : "Contexto para el próximo informe"}
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: txt3, marginBottom: 12, textWrap: "pretty" }}>
            Escribí acá lo que el sistema no puede saber solo — «dedicamos diez horas a la meta
            de Cecilia» — o cómo querés que cambie el texto — «el resumen no debería abrir con
            la app». Queda guardado para este periodo: si mañana lo volvés a generar, sigue puesto.
          </div>

          <textarea
            value={notaNueva}
            onChange={(e) => setNotaNueva(e.target.value)}
            placeholder="Ej.: También dedicamos diez horas a la meta de Cecilia."
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box", resize: "vertical",
              background: isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${bd}`, borderRadius: 10, padding: "11px 13px",
              color: txt, fontSize: 12.5, fontFamily: font, lineHeight: 1.6, outline: "none",
            }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => agregarNota(true)} disabled={!notaNueva.trim() || anotando}
              title="Guarda la nota y vuelve a redactar el informe con ella puesta"
              style={{
                background: notaNueva.trim() ? `${accent}1A` : "transparent",
                border: `1px solid ${notaNueva.trim() ? `${accent}55` : bd}`, borderRadius: 10,
                padding: "10px 15px", cursor: notaNueva.trim() && !anotando ? "pointer" : "default",
                color: notaNueva.trim() ? accent : txt3, fontSize: 12.5, fontWeight: 600,
                fontFamily: font, display: "flex", alignItems: "center", gap: 7,
                opacity: anotando ? 0.7 : 1,
              }}>
              {anotando ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
                        : <Sparkles size={14} />}
              {anotando ? "Aplicando…" : texto ? "Guardar y rehacer el informe" : "Guardar"}
            </button>
            {texto && (
              <button onClick={() => agregarNota(false)} disabled={!notaNueva.trim() || anotando}
                title="Solo la guarda; se usará la próxima vez que generes"
                style={{
                  background: "transparent", border: `1px solid ${bd}`, borderRadius: 10,
                  padding: "10px 15px", cursor: notaNueva.trim() && !anotando ? "pointer" : "default",
                  color: txt2, fontSize: 12.5, fontFamily: font,
                }}>
                Solo guardar
              </button>
            )}
          </div>

          {notas.length > 0 && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ fontSize: 11.5, color: txt3, fontFamily: font, letterSpacing: "0.03em" }}>
                {notas.length === 1 ? "1 nota en este periodo" : `${notas.length} notas en este periodo`}
              </div>
              {notas.map((n) => (
                <div key={n.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px",
                  borderRadius: 9, background: isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${bd}`,
                }}>
                  <div style={{ flex: 1, fontSize: 12.5, color: txt2, fontFamily: font, lineHeight: 1.55 }}>
                    {n.texto}
                    {n.quien && <span style={{ color: txt3 }}>{`  — ${n.quien}`}</span>}
                  </div>
                  <button onClick={() => quitarNota(n.id)} title="Quitar del informe"
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      color: txt3, padding: 2, display: "flex", flexShrink: 0,
                    }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Estado vacío — explica de dónde saldrá el informe antes de apretarlo. */}
      {!cargando && !texto && !error && (
        <div style={{ ...card, padding: 28, textAlign: "center" }}>
          <FileBarChart size={26} color={txt3} strokeWidth={1.6} />
          <div style={{ fontSize: 13.5, color: txt2, marginTop: 12, fontFamily: font, textWrap: "pretty" }}>
            Elegí el periodo y dale a «Generar informe».
          </div>
          <div style={{ fontSize: 12.5, color: txt3, marginTop: 6, maxWidth: 470, marginLeft: "auto", marginRight: "auto", textWrap: "pretty" }}>
            Sale día a día, agrupado por semana, de lo que quedó registrado: el trabajo
            del periodo, las reuniones, las tareas cerradas y el avance de los proyectos.
            Lo del domingo se reporta en el sábado.
          </div>
        </div>
      )}
    </div>
  );
}
