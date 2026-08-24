// ChatEquipo.jsx — el chat del equipo, dentro de Stratos.
//
// Pedido de Ángel (27-jul-2026):
//   «y si hagamos un chat de equipo y demás. recuerda pensarlo a futuro si hay
//    otros desarrolladores»
// El problema real que resuelve: hoy Iván manda todo por WhatsApp — el plan del
// día, los documentos, las capturas — y nada de eso queda en el sistema. Con el
// chat adentro, la conversación del equipo vive donde el Copilot y el cerebro la
// pueden ver, y no hay que ir a buscar nada a otra app.
//
// Por qué CANALES y no un solo cuarto: con 2 socios da lo mismo, pero cuando
// entren más desarrolladores un hilo único se vuelve inservible. Nace escalado.
//
// Las @menciones le avisan a la persona en la campanita (el mismo canal que usan
// las alertas del Copilot), así un "@Iván mirá esto" no se pierde en el scroll.

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  MessagesSquare, Send, Plus, X, Hash, Paperclip, ArrowLeft, CornerUpLeft, ExternalLink,
} from "lucide-react";
import { font, fontDisp, chatType } from "../../design-system/tokens";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useViewport";

const cuando = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  const hora = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  if (mismoDia) return hora;
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return `ayer ${hora}`;
  const mos = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d.getDate()} ${mos[d.getMonth()]} ${hora}`;
};

const diaDe = (iso) => (iso ? new Date(iso).toDateString() : "");
const etiquetaDia = (iso) => {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long" });
};

const iniciales = (nombre = "") =>
  nombre.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "?";

// Color estable por persona, para reconocer de un vistazo quién habla.
const COLORES = ["#6EE7C2", "#F472B6", "#60A5FA", "#FBBF24", "#A78BFA", "#FB923C", "#34D399"];
const colorDe = (id = "") => COLORES[Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORES.length];

export default function ChatEquipo({ T, onInmersivo }) {
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

  const [canales, setCanales] = useState([]);
  const [activo, setActivo] = useState(null);       // canal seleccionado
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [equipo, setEquipo] = useState([]);         // para el autocompletado de @
  const [sugerencias, setSugerencias] = useState(null);
  const [respondiendo, setRespondiendo] = useState(null);
  const [nuevoCanal, setNuevoCanal] = useState(null); // { nombre, descripcion }
  const [adjuntando, setAdjuntando] = useState(false);
  const [viewer, setViewer] = useState(null);

  const finRef = useRef(null);
  const inputRef = useRef(null);
  const activoRef = useRef(null);
  activoRef.current = activo;

  const orgId = user?.organizationId;

  const cargarCanales = useCallback(async () => {
    if (!user?.id) return;
    const { data, error: e } = await supabase.rpc("fn_chat_channels", { p_profile_id: user.id });
    if (e) { setError("No pude traer los canales."); return; }
    const lista = Array.isArray(data) ? data : [];
    setCanales(lista);
    setActivo(prev => prev || (isMobile ? null : lista[0] || null));
  }, [user?.id, isMobile]);

  const cargarMensajes = useCallback(async (canalId) => {
    if (!user?.id || !canalId) return;
    const { data } = await supabase.rpc("fn_chat_messages", { p_profile_id: user.id, p_channel_id: canalId });
    setMensajes(Array.isArray(data) ? data : []);
    await supabase.rpc("fn_chat_read", { p_profile_id: user.id, p_channel_id: canalId });
    setCanales(prev => prev.map(c => (c.id === canalId ? { ...c, sin_leer: 0 } : c)));
  }, [user?.id]);

  useEffect(() => { cargarCanales(); }, [cargarCanales]);

  useEffect(() => {
    if (!orgId) return;
    supabase.from("profiles").select("id, name").eq("organization_id", orgId)
      .then(({ data }) => setEquipo((data || []).filter(p => p.name)));
  }, [orgId]);

  useEffect(() => { if (activo?.id) cargarMensajes(activo.id); }, [activo?.id, cargarMensajes]);

  // Realtime: el mensaje del otro aparece solo, sin recargar.
  // Handler nombrado + removeChannel en el cleanup (regla de performance del CRM:
  // una suscripción huérfana por render mata la fluidez).
  useEffect(() => {
    if (!orgId || !user?.id) return;
    const onInsert = (payload) => {
      const m = payload?.new;
      if (!m) return;
      if (m.channel_id === activoRef.current?.id) {
        cargarMensajes(m.channel_id);
      } else {
        setCanales(prev => prev.map(c =>
          c.id === m.channel_id && m.author_id !== user.id
            ? { ...c, sin_leer: Number(c.sin_leer || 0) + 1 }
            : c));
      }
    };
    const ch = supabase
      .channel(`team-chat-${orgId}`)
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "team_chat_messages", filter: `organization_id=eq.${orgId}` },
          onInsert)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, user?.id, cargarMensajes]);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);

  const enviar = async (ev) => {
    ev?.preventDefault?.();
    const cuerpo = texto.trim();
    if (!cuerpo || !activo?.id || enviando) return;
    setEnviando(true); setError("");
    const { data, error: e } = await supabase.rpc("fn_chat_send", {
      p_profile_id: user.id, p_channel_id: activo.id, p_body: cuerpo,
      p_reply_to: respondiendo?.id || null,
    });
    setEnviando(false);
    if (e || data?.ok === false) { setError(e?.message || data?.error || "No se pudo enviar."); return; }
    setTexto(""); setRespondiendo(null); setSugerencias(null);
    cargarMensajes(activo.id);
  };

  const adjuntar = async (file) => {
    if (!file || !activo?.id || !orgId) return;
    setAdjuntando(true); setError("");
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `chat/${orgId}/${activo.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("evidencia").upload(path, file, { upsert: true });
      if (up.error) throw up.error;
      const { data, error: e } = await supabase.rpc("fn_chat_send", {
        p_profile_id: user.id, p_channel_id: activo.id,
        p_body: texto.trim() || file.name,
        p_attachment_path: path,
        p_attachment_type: file.type?.startsWith("image/") ? "image" : "file",
        p_reply_to: respondiendo?.id || null,
      });
      if (e || data?.ok === false) throw new Error(e?.message || data?.error);
      setTexto(""); setRespondiendo(null);
      cargarMensajes(activo.id);
    } catch {
      setError("No pude subir el archivo. Prueba con otro.");
    } finally {
      setAdjuntando(false);
    }
  };

  const abrirAdjunto = async (path) => {
    if (!path) return;
    setViewer({ loading: true });
    const { data, error: e } = await supabase.storage.from("evidencia").createSignedUrl(path, 3600);
    if (e) { setViewer(null); setError("No pude abrir el archivo."); return; }
    setViewer({ url: data.signedUrl });
  };

  const crearCanal = async (ev) => {
    ev.preventDefault();
    const { data, error: e } = await supabase.rpc("fn_chat_create_channel", {
      p_profile_id: user.id, p_nombre: nuevoCanal.nombre, p_descripcion: nuevoCanal.descripcion || null,
    });
    if (e || data?.ok === false) { setError(e?.message || data?.error || "No se pudo crear."); return; }
    setNuevoCanal(null);
    cargarCanales();
  };

  // Autocompletado de @menciones mientras se escribe.
  const alEscribir = (v) => {
    setTexto(v);
    const m = /@([\wÁÉÍÓÚÑáéíóúñ]*)$/.exec(v);
    if (!m) { setSugerencias(null); return; }
    const q = m[1].toLowerCase();
    const hits = equipo.filter(p => p.id !== user.id && p.name.toLowerCase().includes(q)).slice(0, 5);
    setSugerencias(hits.length ? hits : null);
  };

  const ponerMencion = (nombre) => {
    setTexto(t => t.replace(/@[\wÁÉÍÓÚÑáéíóúñ]*$/, `@${nombre.split(" ")[0]} `));
    setSugerencias(null);
    inputRef.current?.focus();
  };

  // Un mensaje "sigue" al anterior si es la misma persona en los últimos 5 min:
  // así el hilo se lee como una conversación y no como una lista de tarjetas.
  const conAgrupado = useMemo(() => mensajes.map((m, i) => {
    const prev = mensajes[i - 1];
    const seguido = prev && prev.author_id === m.author_id && !m.reply_to &&
      (new Date(m.created_at) - new Date(prev.created_at)) < 5 * 60 * 1000;
    const nuevoDia = !prev || diaDe(prev.created_at) !== diaDe(m.created_at);
    return { ...m, seguido: seguido && !nuevoDia, nuevoDia };
  }), [mensajes]);

  const totalSinLeer = canales.reduce((a, c) => a + Number(c.sin_leer || 0), 0);
  const verLista = !isMobile || !activo;
  const verHilo  = !isMobile || !!activo;

  // MODO INMERSIVO — pedido de Ángel (27-jul, con captura): «el chat aún no se
  // expande, necesitamos que se expanda totalmente, así como el Copilot».
  // Cuando en el celular hay un canal abierto, la app esconde su header y la
  // barra de abajo (el mismo mecanismo del Copilot y WhatsApp) y el hilo ocupa
  // la pantalla completa. La flecha ‹ del hilo es la única salida — por eso el
  // aviso solo se enciende con un canal abierto, nunca en la lista de canales:
  // si no, quedarías sin barra y sin forma de volver.
  const inmersivo = isMobile && !!activo;
  useEffect(() => {
    onInmersivo?.(inmersivo);
    return () => onInmersivo?.(false);   // al salir del módulo, la app vuelve a la normalidad
  }, [inmersivo, onInmersivo]);

  const btnIcono = {
    background: "transparent", border: `1px solid ${bd}`, borderRadius: 11,
    padding: 11, cursor: "pointer", color: txt2,
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: inmersivo ? 0 : 16,
      color: txt, fontFamily: font, width: "100%", margin: "0 auto",
      maxWidth: inmersivo ? "none" : 1180,
      // En inmersivo el hilo manda: ocupa el alto real de la pantalla (dvh, que en
      // el celular descuenta la barra del navegador) menos las zonas seguras.
      height: inmersivo ? "100dvh" : undefined,
      paddingTop: inmersivo ? "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))" : undefined,
      paddingBottom: inmersivo ? "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))" : undefined,
      overflow: inmersivo ? "hidden" : undefined,
    }}>
      {/* Header del módulo — centrado en el celular, como el resto de la app.
          En inmersivo NO se dibuja: el hilo tiene su propio encabezado con la
          flecha de volver, igual que el Copilot. */}
      {!inmersivo && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexDirection: isMobile ? "column" : "row", textAlign: isMobile ? "center" : "left" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}18`, border: `1px solid ${accent}33` }}>
            <MessagesSquare size={20} color={accent} strokeWidth={1.9} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontFamily: fontDisp, fontWeight: 500, letterSpacing: "-0.01em", color: txt }}>
              Chat del equipo
            </h1>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: txt2 }}>
              {totalSinLeer > 0
                ? `${totalSinLeer} mensaje${totalSinLeer === 1 ? "" : "s"} sin leer`
                : "Todo lo del equipo aquí adentro · menciona con @ y le llega el aviso"}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div style={{ ...card, padding: "12px 15px", fontSize: 12.5, color: isLight ? "#B42318" : "#F87171" }}>{error}</div>
      )}

      <div style={{
        display: "flex", gap: inmersivo ? 0 : 14, alignItems: "stretch",
        // minHeight:0 es lo que deja que el hijo con overflow:auto se encoja de
        // verdad dentro de un flex; sin eso el hilo desborda la pantalla.
        flex: inmersivo ? 1 : undefined,
        minHeight: inmersivo ? 0 : (isMobile ? "auto" : 560),
      }}>
        {/* Canales */}
        {verLista && (
          <div style={{ ...card, width: isMobile ? "100%" : 264, flexShrink: 0, padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 8px" }}>
              <span style={{ fontSize: 12, color: txt3, letterSpacing: "0.04em", textTransform: "uppercase" }}>Canales</span>
              <button onClick={() => setNuevoCanal({ nombre: "", descripcion: "" })} title="Nuevo canal"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: txt3, display: "flex", padding: 2 }}>
                <Plus size={15} />
              </button>
            </div>

            {canales.map(c => {
              const sel = activo?.id === c.id;
              const sinLeer = Number(c.sin_leer || 0);
              return (
                <button key={c.id} onClick={() => setActivo(c)} style={{
                  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                  padding: "10px 11px", borderRadius: 11, cursor: "pointer", border: "1px solid transparent",
                  background: sel ? `${accent}16` : "transparent", fontFamily: font,
                }}>
                  <Hash size={15} color={sel ? accent : txt3} strokeWidth={2} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, color: sel ? accent : txt, fontWeight: sinLeer ? 600 : 400 }}>
                      {c.nombre}
                    </span>
                    {c.ultimo && (
                      <span style={{ display: "block", fontSize: 12, color: txt3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                        {c.ultimo.autor?.split(" ")[0]}: {c.ultimo.body}
                      </span>
                    )}
                  </span>
                  {sinLeer > 0 && (
                    <span style={{ flexShrink: 0, minWidth: 19, height: 19, borderRadius: 999, background: accent, color: isLight ? "#fff" : "#04140F", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                      {sinLeer}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Hilo */}
        {verHilo && (
          <div style={{
            ...card, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden",
            // A pantalla completa el hilo no es una tarjeta flotante: es LA pantalla.
            ...(inmersivo ? { borderRadius: 0, border: "none", minHeight: 0 } : null),
          }}>
            {!activo ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: txt3, fontSize: 13, padding: 40 }}>
                Elige un canal para empezar
              </div>
            ) : (
              <>
                <div style={{ padding: "13px 16px", borderBottom: `1px solid ${bd}`, display: "flex", alignItems: "center", gap: 10 }}>
                  {isMobile && (
                    <button onClick={() => setActivo(null)} style={{ ...btnIcono, border: "none", padding: 4 }}>
                      <ArrowLeft size={17} />
                    </button>
                  )}
                  <Hash size={16} color={accent} strokeWidth={2} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: txt, fontFamily: fontDisp }}>{activo.nombre}</div>
                    {activo.descripcion && <div style={{ fontSize: 12, color: txt3, marginTop: 1 }}>{activo.descripcion}</div>}
                  </div>
                </div>

                {/* La lista de mensajes: en inmersivo crece hasta llenar la pantalla
                    (flex:1 + minHeight:0). El 52dvh de antes era lo que dejaba ese
                    hueco muerto abajo que reportó Ángel. */}
                <div style={{
                  flex: 1, overflowY: "auto", padding: "14px 16px",
                  display: "flex", flexDirection: "column", gap: 2,
                  minHeight: inmersivo ? 0 : (isMobile ? "52dvh" : 0),
                  maxHeight: inmersivo ? "none" : (isMobile ? "52dvh" : 460),
                }}>
                  {!conAgrupado.length && (
                    <div style={{ margin: "auto", textAlign: "center", color: txt3, fontSize: 13, padding: 20 }}>
                      Todavía no hay mensajes acá.<br />
                      <span style={{ fontSize: 12.5 }}>Escribe el primero — esto reemplaza el WhatsApp del equipo.</span>
                    </div>
                  )}

                  {conAgrupado.map(m => {
                    const mio = m.author_id === user?.id;
                    const col = colorDe(m.author_id || "");
                    return (
                      <div key={m.id}>
                        {m.nuevoDia && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 12px" }}>
                            <div style={{ flex: 1, height: 1, background: bd }} />
                            <span style={{ fontSize: 12, color: txt3 }}>{etiquetaDia(m.created_at)}</span>
                            <div style={{ flex: 1, height: 1, background: bd }} />
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex", gap: 10, padding: "4px 8px", borderRadius: 10,
                            marginTop: m.seguido ? 0 : 8,
                            background: m.me_mencionaron ? `${accent}12` : "transparent",
                            borderLeft: m.me_mencionaron ? `2px solid ${accent}` : "2px solid transparent",
                          }}
                          onDoubleClick={() => setRespondiendo(m)}
                        >
                          <div style={{ width: 32, flexShrink: 0 }}>
                            {!m.seguido && (
                              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${col}22`, border: `1px solid ${col}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: col }}>
                                {iniciales(m.autor)}
                              </div>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {!m.seguido && (
                              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                                <span style={{ fontSize: chatType.chip + 0.5, fontWeight: 600, color: mio ? accent : txt }}>
                                  {mio ? "Tú" : m.autor}
                                </span>
                                <span style={{ fontSize: chatType.time, color: txt3 }}>{cuando(m.created_at)}</span>
                              </div>
                            )}
                            {m.reply_to && (
                              <div style={{ fontSize: 12, color: txt3, borderLeft: `2px solid ${bd}`, paddingLeft: 8, marginBottom: 4 }}>
                                <span style={{ color: txt2 }}>{m.reply_autor || "alguien"}</span>: {m.reply_body}
                              </div>
                            )}
                            <div style={{ fontSize: chatType.body, color: txt, lineHeight: chatType.bodyLh, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {m.body}
                            </div>
                            {m.attachment_path && (
                              <button onClick={() => abrirAdjunto(m.attachment_path)} style={{
                                marginTop: 6, background: "transparent", border: `1px solid ${bd}`, borderRadius: 9,
                                padding: "6px 11px", cursor: "pointer", color: txt2, fontSize: 12.5, fontFamily: font,
                                display: "inline-flex", alignItems: "center", gap: 6,
                              }}>
                                <Paperclip size={13} /> {m.attachment_type === "image" ? "Ver la imagen" : "Abrir el archivo"}
                              </button>
                            )}
                          </div>
                          <button onClick={() => setRespondiendo(m)} title="Responder"
                            style={{ background: "transparent", border: "none", cursor: "pointer", color: txt3, opacity: 0.5, padding: 3, alignSelf: "flex-start", display: "flex" }}>
                            <CornerUpLeft size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={finRef} />
                </div>

                {/* Escribir */}
                <div style={{ borderTop: `1px solid ${bd}`, padding: 12, position: "relative" }}>
                  {respondiendo && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: txt3 }}>
                      <CornerUpLeft size={12} />
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        Respondiendo a {respondiendo.autor}: {respondiendo.body?.slice(0, 60)}
                      </span>
                      <button onClick={() => setRespondiendo(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: txt3, display: "flex" }}>
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  {sugerencias && (
                    <div style={{ position: "absolute", bottom: "100%", left: 12, marginBottom: 6, ...card, padding: 5, minWidth: 190, zIndex: 20 }}>
                      {sugerencias.map(p => (
                        <button key={p.id} onClick={() => ponerMencion(p.name)} style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                          padding: "8px 10px", borderRadius: 9, cursor: "pointer", border: "none",
                          background: "transparent", color: txt, fontSize: chatType.input, fontFamily: font,
                        }}>
                          <span style={{ width: 22, height: 22, borderRadius: 7, background: `${colorDe(p.id)}22`, color: colorDe(p.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                            {iniciales(p.name)}
                          </span>
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <form onSubmit={enviar} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <label title="Adjuntar" style={{ ...btnIcono, cursor: adjuntando ? "wait" : "pointer" }}>
                      <Paperclip size={16} />
                      <input type="file" style={{ display: "none" }} disabled={adjuntando}
                        onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ""; if (f) adjuntar(f); }} />
                    </label>
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={texto}
                      onChange={e => alEscribir(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(e); } }}
                      placeholder={`Escribile al equipo en #${activo.nombre}…`}
                      style={{
                        flex: 1, resize: "none", maxHeight: 130, minHeight: 40,
                        background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.045)", color: txt,
                        border: `1px solid ${bd}`, borderRadius: 12, padding: "11px 13px",
                        fontSize: 13.5, fontFamily: font, outline: "none", lineHeight: 1.45,
                      }}
                    />
                    <button type="submit" disabled={enviando || !texto.trim()} style={{
                      background: texto.trim() ? accent : "transparent",
                      border: `1px solid ${texto.trim() ? accent : bd}`, borderRadius: 11,
                      padding: "11px 13px", cursor: texto.trim() ? "pointer" : "default",
                      color: texto.trim() ? (isLight ? "#fff" : "#04140F") : txt3, display: "flex", alignItems: "center",
                    }}>
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Nuevo canal */}
      {nuevoCanal && (
        <div onClick={() => setNuevoCanal(null)} style={{
          position: "fixed", inset: 0, zIndex: 100000, background: "rgba(3,8,16,0.72)",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <form onClick={e => e.stopPropagation()} onSubmit={crearCanal}
            style={{ ...card, padding: 20, width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 15, fontFamily: fontDisp, fontWeight: 500 }}>Nuevo canal</div>
            <input autoFocus placeholder="Nombre (ej: Duke)" value={nuevoCanal.nombre}
              onChange={e => setNuevoCanal(n => ({ ...n, nombre: e.target.value }))}
              style={{ background: isLight ? "#FFF" : "rgba(255,255,255,0.045)", color: txt, border: `1px solid ${bd}`, borderRadius: 10, padding: "11px 13px", fontSize: 13.5, fontFamily: font, outline: "none" }} />
            <input placeholder="¿De qué se habla acá? (opcional)" value={nuevoCanal.descripcion}
              onChange={e => setNuevoCanal(n => ({ ...n, descripcion: e.target.value }))}
              style={{ background: isLight ? "#FFF" : "rgba(255,255,255,0.045)", color: txt, border: `1px solid ${bd}`, borderRadius: 10, padding: "11px 13px", fontSize: 13.5, fontFamily: font, outline: "none" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setNuevoCanal(null)} style={{ background: "transparent", border: `1px solid ${bd}`, borderRadius: 10, padding: "10px 16px", cursor: "pointer", color: txt2, fontSize: 13, fontFamily: font }}>
                Cancelar
              </button>
              <button type="submit" style={{ background: accent, border: "none", borderRadius: 10, padding: "10px 18px", cursor: "pointer", color: isLight ? "#fff" : "#04140F", fontSize: 13, fontWeight: 600, fontFamily: font }}>
                Crear
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Visor de adjunto */}
      {viewer && (
        <div onClick={() => setViewer(null)} style={{
          position: "fixed", inset: 0, zIndex: 100000, background: "rgba(3,8,16,0.82)",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <button onClick={() => setViewer(null)} style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 10, padding: 8, cursor: "pointer", color: "#fff", display: "flex" }}>
            <X size={18} />
          </button>
          {viewer.loading ? (
            <div style={{ color: "#fff", fontSize: 14 }}>Abriendo…</div>
          ) : (
            <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: "94vw" }}>
              <img src={viewer.url} alt="Adjunto" style={{ maxWidth: "94vw", maxHeight: "80vh", borderRadius: 12, objectFit: "contain" }} />
              <a href={viewer.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#fff", fontSize: 12.5, textDecoration: "none", opacity: 0.85 }}>
                <ExternalLink size={13} /> Abrir original (o descargar si no es imagen)
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
