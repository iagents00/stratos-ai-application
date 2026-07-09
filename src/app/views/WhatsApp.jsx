/**
 * views/WhatsApp.jsx — Módulo "WhatsApp" (bandeja de conversaciones)
 * ─────────────────────────────────────────────────────────────────────────────
 * Todos los chats de WhatsApp de los clientes en un solo lugar (estilo
 * GoHighLevel): lista ordenada por último mensaje (los PINEADOS primero) con
 * contador de NO LEÍDOS, filtro por etapa del pipeline y toggle "No leídos" +
 * el hilo seleccionado a PANTALLA COMPLETA con composer fijo abajo (reutiliza
 * LeadWhatsAppChat en modo `fill`; el expediente lo usa en modo normal).
 *
 * Caso de uso central: que la asesora (Cecilia) SEPA al instante cuándo un
 * cliente le escribió y pueda responder sin salir del CRM.
 *
 * Permisos: la RLS decide sola — asesor ve SUS conversaciones; admin ve
 * todas las de la org. Módulo gateado por el flag `whatsappChat` en
 * canAccessModule (patrón Caja).
 *
 * Props: { T, isLight, inbox, openLead }
 *   inbox    ← instancia de useWhatsAppInbox creada en App.jsx (una sola
 *              suscripción realtime compartida con la campanita).
 *   openLead ← { id, ts } nonce para abrir una conversación directo desde
 *              la campanita de notificaciones.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Search, ArrowLeft, Phone, UserRound, FolderOpen, Pin } from "lucide-react";
import { P, font, fontDisp, STAGES, STAGE_COLORS } from "../../design-system/tokens";
import { useIsMobile } from "../../hooks/useViewport";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import LeadWhatsAppChat from "./CRM/LeadWhatsAppChat";

/* Etapas que el CRM protege con interceptores (Zoom/Visita exigen fecha vía
   modal; Zoom Concretado exige notas + próxima acción). Desde acá no hay
   modal → esas se cambian desde el expediente. */
const STAGES_CON_MODAL = new Set(["Zoom Agendado", "Visita Agendada", "Zoom Concretado"]);
const ROLES_MANDO = new Set(["super_admin", "admin", "director", "ceo"]);

const fmtWhen = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
};

const initials = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

export default function WhatsAppInbox({ T = P, isLight = false, inbox, openLead, openExpediente }) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");   // "" = todas las etapas
  const [unreadOnly, setUnreadOnly] = useState(false);  // solo chats con no-leídos
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [teamNames, setTeamNames] = useState([]);   // equipo (profiles) para reasignar
  const [savingLead, setSavingLead] = useState(false);
  const [actionMsg, setActionMsg] = useState(null); // feedback corto de etapa/asesor
  const msgTimerRef = useRef(null);

  const conversations = inbox?.conversations || [];
  const loading = inbox?.loading ?? true;
  const isMando = ROLES_MANDO.has(user?.role);

  // Equipo para el selector de reasignación (solo mando lo ve). Misma fuente
  // que Caja: profiles org-scoped (la RLS filtra sola).
  useEffect(() => {
    if (!isMando || !user?.organizationId) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("name")
      .eq("organization_id", user.organizationId)
      .then(({ data }) => {
        if (!alive || !Array.isArray(data)) return;
        const names = [...new Set(data.map((p) => p.name).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, "es"));
        setTeamNames(names);
      });
    return () => { alive = false; };
  }, [isMando, user?.organizationId]);

  // Mensajito de feedback que se borra solo (timer limpiado en cleanup).
  const flashMsg = (msg) => {
    setActionMsg(msg);
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(() => setActionMsg(null), 3500);
  };
  useEffect(() => () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current); }, []);

  // Cambiar la ETAPA del lead directo desde la bandeja. Escritura directa a
  // leads.stage (la RLS valida permisos: asesor su lead, admin todos).
  const changeStage = async (leadId, stage) => {
    if (!leadId || !stage || savingLead) return;
    setSavingLead(true);
    const { error } = await supabase.from("leads").update({ stage }).eq("id", leadId);
    setSavingLead(false);
    if (error) { flashMsg("⚠ No se pudo cambiar la etapa"); return; }
    flashMsg(`Etapa → ${stage}`);
    inbox?.refresh?.();
  };

  // Reasignar el lead a otro miembro del equipo. MISMA RPC que usa el CRM
  // (fn_bulk_reassign_leads: resuelve asesor_id server-side y audita).
  const reassignLead = async (leadId, name) => {
    if (!leadId || !name || savingLead) return;
    setSavingLead(true);
    const { error } = await supabase.rpc("fn_bulk_reassign_leads", {
      p_ids: [leadId], p_asesor_name: name, p_to_contactame: false,
    });
    setSavingLead(false);
    if (error) { flashMsg("⚠ No se pudo reasignar"); return; }
    flashMsg(`Asignado a ${name}`);
    inbox?.refresh?.();
  };

  // Apertura directa desde la campanita (nonce {id, ts})
  useEffect(() => {
    if (openLead?.id) {
      setSelectedId(openLead.id);
      setMobileShowChat(true);
      inbox?.markRead?.(openLead.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLead?.ts]);

  // Etapas para el filtro: solo las que EXISTEN en la bandeja, en el orden del
  // pipeline (las legacy que ya no están en STAGES van al final).
  const stageOptions = useMemo(() => {
    const present = new Set(conversations.map((c) => c.stage).filter(Boolean));
    const inOrder = STAGES.filter((s) => present.has(s));
    const legacy = [...present].filter((s) => !STAGES.includes(s)).sort((a, b) => a.localeCompare(b, "es"));
    return [...inOrder, ...legacy];
  }, [conversations]);

  // El server ya manda el orden final (pineados primero, luego más reciente);
  // acá solo se FILTRA sin reordenar.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (unreadOnly && !(Number(c.unread_count || 0) > 0)) return false;
      if (stageFilter && c.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        (c.lead_name || "").toLowerCase().includes(q) ||
        (c.lead_phone || "").toLowerCase().includes(q) ||
        (c.asesor_name || "").toLowerCase().includes(q)
      );
    });
  }, [conversations, query, stageFilter, unreadOnly]);

  const selected = useMemo(
    () => conversations.find((c) => c.lead_id === selectedId) || null,
    [conversations, selectedId]
  );

  // Si llegan mensajes nuevos a la conversación ABIERTA, marcarla leída.
  useEffect(() => {
    if (selected && Number(selected.unread_count || 0) > 0) {
      inbox?.markRead?.(selected.lead_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.unread_count, selected?.lead_id]);

  const handleSelect = (c) => {
    setSelectedId(c.lead_id);
    setMobileShowChat(true);
    if (Number(c.unread_count || 0) > 0) inbox?.markRead?.(c.lead_id);
    // Pedir permiso de notificaciones DESDE UN GESTO del usuario (Safari
    // ignora requests fuera de gesto; Chrome los degrada a prompt silencioso).
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch { /* sin soporte */ }
  };

  const subC = isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.45)";
  const cardBg = isLight ? "#FFFFFF" : T.glass;
  const accentStrong = isLight ? T.accentDark || T.accent : T.accent;

  const showList = !isMobile || !mobileShowChat;
  const showChat = !isMobile || mobileShowChat;

  /* ── Lista de conversaciones ─────────────────────────────────────────── */
  const listPane = (
    <div
      style={{
        width: isMobile ? "100%" : 340, flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 10, minHeight: 0,
      }}
    >
      <div style={{ position: "relative" }}>
        <Search size={13} color={T.txt3} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente o teléfono…"
          style={{
            width: "100%", height: 34, padding: "0 11px 0 32px",
            borderRadius: 9, background: isLight ? "rgba(255,255,255,0.85)" : T.glass,
            border: `1px solid ${T.border}`, color: T.txt,
            fontSize: 12.5, outline: "none", fontFamily: font, boxSizing: "border-box",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = T.accentB || T.accent; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = T.border; }}
        />
      </div>

      {/* Filtros rápidos: etapa del pipeline + solo no-leídos */}
      <div style={{ display: "flex", gap: 6 }}>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          title="Filtrar conversaciones por etapa del lead"
          style={{
            flex: 1, minWidth: 0, height: 30, padding: "0 8px", borderRadius: 8,
            cursor: "pointer", outline: "none",
            background: isLight ? "rgba(255,255,255,0.85)" : T.glass,
            border: `1px solid ${stageFilter ? (STAGE_COLORS?.[stageFilter] || T.border) : T.border}`,
            color: stageFilter ? (STAGE_COLORS?.[stageFilter] || T.txt) : T.txt2,
            fontSize: 11, fontWeight: 600, fontFamily: font,
          }}
        >
          <option value="" style={{ color: "#0B1220" }}>Todas las etapas</option>
          {stageOptions.map((s) => (
            <option key={s} value={s} style={{ color: "#0B1220" }}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => setUnreadOnly((v) => !v)}
          title="Mostrar solo conversaciones con mensajes sin leer"
          style={{
            height: 30, padding: "0 10px", borderRadius: 8, cursor: "pointer",
            flexShrink: 0, fontSize: 11, fontWeight: 700, fontFamily: font,
            background: unreadOnly
              ? (isLight ? "rgba(13,154,118,0.10)" : "rgba(110,231,194,0.10)")
              : (isLight ? "rgba(255,255,255,0.85)" : T.glass),
            border: `1px solid ${unreadOnly ? (isLight ? "rgba(13,154,118,0.35)" : "rgba(110,231,194,0.3)") : T.border}`,
            color: unreadOnly ? accentStrong : T.txt2,
          }}
        >
          No leídos{inbox?.totalUnread > 0 ? ` · ${inbox.totalUnread}` : ""}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: 14, fontSize: 12, color: T.txt3, fontFamily: font }}>Cargando conversaciones…</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: "26px 16px", borderRadius: 12, textAlign: "center",
              border: `1px dashed ${T.border}`, fontSize: 12.5, color: T.txt3,
              fontFamily: font, lineHeight: 1.55,
            }}
          >
            {(query || stageFilter || unreadOnly) ? "Sin conversaciones con esos filtros." : (
              <>Sin conversaciones todavía.<br />Cuando un cliente escriba por WhatsApp, aparecerá acá.</>
            )}
          </div>
        ) : (
          filtered.map((c) => {
            const unread = Number(c.unread_count || 0);
            const active = c.lead_id === selectedId;
            const pinned = c.pinned === true;
            const stageC = STAGE_COLORS?.[c.stage];
            return (
              /* div role=button (no <button>): adentro vive el botón del pin y
                 anidar botones es HTML inválido (Safari dispara los dos). */
              <div
                key={c.lead_id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(c)}
                onKeyDown={(e) => {
                  // Solo cuando el foco está EN LA FILA: si está en el botón del
                  // pin (hijo focusable), Enter/Espacio deben activar EL PIN —
                  // sin este guard el preventDefault mataba el click nativo del
                  // botón y seleccionaba el chat en su lugar.
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(c); }
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                  background: active
                    ? (isLight ? "rgba(13,154,118,0.08)" : "rgba(110,231,194,0.08)")
                    : cardBg,
                  border: `1px solid ${active ? (isLight ? "rgba(13,154,118,0.3)" : "rgba(110,231,194,0.25)") : T.border}`,
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <div
                  style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isLight ? "rgba(13,154,118,0.10)" : "rgba(110,231,194,0.09)",
                    color: accentStrong, fontSize: 12, fontWeight: 800, fontFamily: fontDisp,
                  }}
                >
                  {initials(c.lead_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        flex: 1, minWidth: 0,
                        fontSize: 12.5, fontWeight: unread > 0 ? 800 : 600, color: T.txt,
                        fontFamily: fontDisp, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}
                    >
                      {c.lead_name || c.lead_phone || "Cliente"}
                    </span>
                    {/* Pin: fijar/soltar el chat arriba de la lista (por usuario) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); inbox?.togglePin?.(c.lead_id); }}
                      title={pinned ? "Desfijar este chat" : "Fijar este chat arriba"}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: "transparent", border: "none", cursor: "pointer",
                        color: pinned ? accentStrong : T.txt3,
                        opacity: pinned ? 1 : 0.45,
                      }}
                    >
                      <Pin size={12} fill={pinned ? "currentColor" : "none"} style={{ transform: pinned ? "none" : "rotate(45deg)" }} />
                    </button>
                    <span style={{ fontSize: 9.5, color: unread > 0 ? accentStrong : subC, fontFamily: font, flexShrink: 0, fontWeight: unread > 0 ? 700 : 400 }}>
                      {fmtWhen(c.last_at)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 2 }}>
                    <span
                      style={{
                        fontSize: 11.5, color: unread > 0 ? T.txt : subC, fontFamily: font,
                        fontWeight: unread > 0 ? 600 : 400,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}
                    >
                      {c.last_direction === "out" ? "Tú: " : ""}{c.last_content || ""}
                    </span>
                    {unread > 0 && (
                      <span
                        style={{
                          minWidth: 17, height: 17, padding: "0 5px", borderRadius: 99, flexShrink: 0,
                          background: T.accent, color: "#041016",
                          fontSize: 9.5, fontWeight: 800, fontFamily: fontDisp,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </div>
                  {/* Etapa del pipeline de un vistazo (+ asesor, para mando) */}
                  {(c.stage || (isMando && c.asesor_name)) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, minWidth: 0 }}>
                      {c.stage && (
                        <span
                          style={{
                            fontSize: 8.5, fontWeight: 700, fontFamily: fontDisp,
                            padding: "1.5px 7px", borderRadius: 99, flexShrink: 0,
                            color: stageC || subC,
                            background: stageC ? `${stageC}14` : "transparent",
                            border: `1px solid ${stageC ? `${stageC}55` : T.border}`,
                            whiteSpace: "nowrap", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis",
                          }}
                        >
                          {c.stage}
                        </span>
                      )}
                      {isMando && c.asesor_name && (
                        <span style={{ fontSize: 9, color: subC, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.asesor_name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  /* ── Panel del chat ──────────────────────────────────────────────────── */
  const chatPane = (
    <div
      style={{
        flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column",
        borderRadius: 14, border: `1px solid ${T.border}`,
        background: isLight ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.02)",
        padding: isMobile ? "10px 10px 12px" : 16,
      }}
    >
      {selected ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 12, borderBottom: `1px solid ${T.border}`, marginBottom: 12, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isMobile && (
                <button
                  onClick={() => setMobileShowChat(false)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
                >
                  <ArrowLeft size={16} color={T.txt2} />
                </button>
              )}
              <div
                style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isLight ? "rgba(13,154,118,0.10)" : "rgba(110,231,194,0.09)",
                  color: accentStrong, fontSize: 12, fontWeight: 800, fontFamily: fontDisp,
                }}
              >
                {initials(selected.lead_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Click en el nombre → expediente completo en el CRM */}
                <button
                  onClick={() => openExpediente?.(selected.lead_id)}
                  title="Abrir el expediente completo del cliente"
                  style={{
                    display: "block", maxWidth: "100%", padding: 0, textAlign: "left",
                    background: "transparent", border: "none", cursor: "pointer",
                    fontSize: 13.5, fontWeight: 700, color: T.txt, fontFamily: fontDisp,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = accentStrong; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = T.txt; }}
                >
                  {selected.lead_name || "Cliente"}
                </button>
                <p style={{ fontSize: 10.5, color: subC, fontFamily: font, display: "flex", alignItems: "center", gap: 4 }}>
                  <Phone size={9} />
                  {selected.lead_phone || "—"}
                </p>
              </div>
              <button
                onClick={() => openExpediente?.(selected.lead_id)}
                title="Abrir el expediente completo"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                  padding: "5px 10px", borderRadius: 8, cursor: "pointer",
                  background: isLight ? "rgba(13,154,118,0.07)" : "rgba(110,231,194,0.07)",
                  border: `1px solid ${isLight ? "rgba(13,154,118,0.25)" : "rgba(110,231,194,0.2)"}`,
                  color: accentStrong, fontSize: 10.5, fontWeight: 700, fontFamily: font,
                }}
              >
                <FolderOpen size={11} />
                {isMobile ? "" : "Expediente"}
              </button>
              {actionMsg && (
                <span style={{ fontSize: 10.5, color: actionMsg.startsWith("⚠") ? "#EF4444" : accentStrong, fontFamily: font, fontWeight: 600, flexShrink: 0 }}>
                  {actionMsg}
                </span>
              )}
              {savingLead && !actionMsg && (
                <span style={{ fontSize: 10.5, color: T.txt3, fontFamily: font, flexShrink: 0 }}>Guardando…</span>
              )}
            </div>

            {/* Gestión del lead sin salir del chat: etapa + asesor */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <select
                value={selected.stage || ""}
                onChange={(e) => changeStage(selected.lead_id, e.target.value)}
                disabled={savingLead}
                title="Cambiar la etapa del lead"
                style={{
                  height: 30, padding: "0 8px", borderRadius: 8, cursor: "pointer",
                  background: isLight ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${STAGE_COLORS?.[selected.stage] || T.border}`,
                  color: STAGE_COLORS?.[selected.stage] || T.txt,
                  fontSize: 11, fontWeight: 700, fontFamily: font, outline: "none",
                  maxWidth: isMobile ? 150 : 190,
                }}
              >
                {!selected.stage && <option value="">Etapa…</option>}
                {/* etapa legacy fuera de la lista actual: mostrarla igual */}
                {selected.stage && !STAGES.includes(selected.stage) && (
                  <option value={selected.stage} style={{ color: "#0B1220" }}>{selected.stage}</option>
                )}
                {STAGES.map((s) => (
                  <option
                    key={s}
                    value={s}
                    /* Zoom/Visita exigen fecha (modal del expediente) — acá no */
                    disabled={STAGES_CON_MODAL.has(s) && s !== selected.stage}
                    style={{ color: "#0B1220" }}
                  >
                    {s}{STAGES_CON_MODAL.has(s) && s !== selected.stage ? " (desde el expediente)" : ""}
                  </option>
                ))}
              </select>

              {isMando ? (
                <label style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <UserRound size={12} color={T.txt3} />
                  <select
                    value={selected.asesor_name || ""}
                    onChange={(e) => reassignLead(selected.lead_id, e.target.value)}
                    disabled={savingLead}
                    title="Reasignar el lead a otro asesor"
                    style={{
                      height: 30, padding: "0 8px", borderRadius: 8, cursor: "pointer",
                      background: isLight ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${T.border}`, color: T.txt,
                      fontSize: 11, fontWeight: 600, fontFamily: font, outline: "none",
                      maxWidth: isMobile ? 140 : 180,
                    }}
                  >
                    {!selected.asesor_name && <option value="">Sin asesor…</option>}
                    {/* el asesor actual siempre aparece aunque no esté en profiles */}
                    {[...new Set([selected.asesor_name, ...teamNames].filter(Boolean))].map((n) => (
                      <option key={n} value={n} style={{ color: "#0B1220" }}>{n}</option>
                    ))}
                  </select>
                </label>
              ) : (
                selected.asesor_name && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: subC, fontFamily: font }}>
                    <UserRound size={11} /> {selected.asesor_name}
                  </span>
                )
              )}
            </div>
          </div>
          {/* Columna flex SIN overflow propio: el chat en modo `fill` reparte
              el alto (hilo scrollea adentro; composer SIEMPRE fijo abajo). */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {/* key por conversación: al cambiar de chat se MONTA una instancia
                nueva → el borrador/adjunto y los mensajes NO se arrastran al
                siguiente cliente (evita responder a B con lo que ibas a mandar
                a A, y el envío con conversationId viejo mientras carga). */}
            <LeadWhatsAppChat
              key={selected.lead_id}
              lead={{ id: selected.lead_id, n: selected.lead_name, name: selected.lead_name }}
              T={T}
              isLight={isLight}
              fill
            />
          </div>
        </>
      ) : (
        <div
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <MessageCircle size={30} color={T.txt3} />
          <p style={{ fontSize: 13, color: T.txt3, fontFamily: font }}>
            Selecciona una conversación para verla y responder.
          </p>
        </div>
      )}
    </div>
  );

  return (
    /* flex:1 + minHeight:0 → el módulo ocupa EXACTO el alto del área de
       contenido (nunca la desborda): la página no scrollea y el composer
       queda fijo abajo, en PC y en celular. El padding móvil es mínimo
       porque .stratos-content-area ya trae el suyo (14px + 72px del nav). */
    <div
      style={{
        display: "flex", flexDirection: "column", gap: isMobile ? 10 : 14,
        flex: "1 1 0%", minHeight: 0, padding: isMobile ? "4px 0 0" : "22px 26px",
        boxSizing: "border-box",
      }}
    >
      {/* En móvil, con un chat abierto, el header del módulo se oculta:
          cada pixel de alto es hilo de conversación. */}
      {!(isMobile && mobileShowChat) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div
            style={{
              width: 34, height: 34, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: isLight ? "rgba(13,154,118,0.10)" : "rgba(110,231,194,0.08)",
              border: `1px solid ${isLight ? "rgba(13,154,118,0.25)" : "rgba(110,231,194,0.18)"}`,
            }}
          >
            <MessageCircle size={16} color={accentStrong} />
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>
              WhatsApp
            </h1>
            <p style={{ fontSize: 11, color: subC, fontFamily: font }}>
              Conversaciones de tus clientes
              {inbox?.totalUnread > 0 ? ` · ${inbox.totalUnread} sin leer` : ""}
            </p>
          </div>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 14 }}>
        {showList && listPane}
        {showChat && !isMobile && chatPane}
        {showChat && isMobile && mobileShowChat && chatPane}
      </div>
    </div>
  );
}
