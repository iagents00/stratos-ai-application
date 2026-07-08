/**
 * FichasTecnicas.jsx — Fichas técnicas de desarrollos para presentar a clientes
 * ─────────────────────────────────────────────────────────────────────────────
 * Sección del Marketing Studio (Create). Lee el catálogo real de `properties`
 * en Supabase (RLS org-scoped) — la misma tabla del módulo Propiedades y del
 * bot de Telegram. Los datos se mantienen sincronizados desde el Google Sheet
 * "DRIVES DUKE DEL CARIBE" (pestaña Top Desarrollos) vía n8n cada 6 h, así que
 * precios / entrega / disponibilidad reflejan lo último que capturó el equipo.
 *
 * · Tarjeta por desarrollo → "Ver ficha" abre el modo presentación (pantalla
 *   completa, pensado para compartir pantalla o enseñar en persona).
 * · Los datos internos (masterbroker, contacto) van OCULTOS por default y solo
 *   se muestran con el toggle "Datos internos" — el cliente nunca los ve.
 * · "Copiar resumen" genera el texto listo para WhatsApp con el link del Drive.
 */
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Building2, MapPin, Search, X, FolderOpen, Map, Copy, Check, Star,
  CalendarDays, CreditCard, KeyRound, BedDouble, Wrench, Tag, Eye, EyeOff,
  ChevronDown, RefreshCw, FileText, Wand2,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useClient } from "../../../hooks/useClient";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { G, Pill } from "../../SharedComponents";

const TIERS = [
  { id: "80-150K",  label: "$80–150K"  },
  { id: "200-350K", label: "$200–350K" },
  { id: "500-800K", label: "$500–800K" },
  { id: "LUXURY",   label: "Luxury"    },
];
const tierLabel = (id) => TIERS.find(t => t.id === id)?.label || id || "";

// Acento determinista por nombre — misma propiedad, mismo color siempre.
const ACCENTS = ["#6EE7C2", "#7EB8F0", "#A78BFA", "#F0B86E", "#5DC8D9", "#86EFAC", "#F0A3BB", "#93C5FD"];
export const accentFor = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
};

// Rango aproximado en USD por tier — para el filtro de presupuesto del generador.
export const TIER_BOUNDS = {
  "80-150K": [80000, 150000], "200-350K": [200000, 350000],
  "500-800K": [500000, 800000], "LUXURY": [800000, 2500000],
};

/**
 * Convierte una fila de `properties` (ficha del Sheet) al formato que consume
 * el generador de landing pages. Sin inventar datos: si no hay ROI/amenidades/
 * precio numérico, van vacíos y la landing los omite.
 */
export const fichaToLandingProp = (r) => {
  const accent = accentFor(r.name);
  const [pf, pt] = TIER_BOUNDS[r.price_tier] || [0, 0];
  const highlights = [
    ...(r.highlights ? r.highlights.split(/[;,]/).map(s => s.trim()).filter(Boolean) : []),
    r.entrega && `Entrega: ${r.entrega}`,
    r.financiamiento && `Financiamiento: ${r.financiamiento === "SI" ? "disponible" : r.financiamiento.toLowerCase()}`,
    r.como_se_entrega && `Se entrega: ${r.como_se_entrega}`,
    r.mantenimiento && `Mantenimiento: ${r.mantenimiento}`,
  ].filter(Boolean);
  return {
    id: `cat-${r.id}`,
    name: r.name,
    brand: r.clasificacion || "",
    location: r.plaza,
    zone: r.zona || r.plaza,
    type: "Desarrollo",
    sizes: [],
    bedrooms: r.tipologia || "",
    priceFrom: pf, priceTo: pt,
    ticket: r.ticket || "",
    roi: "", roiNum: 0,
    delivery: r.entrega || "",
    badge: r.is_top ? "TOP INVERSIÓN" : "CATÁLOGO",
    unitsAvailable: 0, totalUnits: 0,
    featured: !!r.is_top,
    amenities: [],
    highlights,
    description: [
      `${r.name} en ${r.plaza}${r.zona ? ` (${r.zona})` : ""}.`,
      r.tipologia && `Tipología: ${r.tipologia}.`,
      r.entrega && `Entrega ${r.entrega}.`,
      "Ficha del catálogo oficial del equipo, sincronizada con el inventario.",
    ].filter(Boolean).join(" "),
    img: `linear-gradient(135deg, ${accent}30 0%, ${accent}0A 45%, #020406 100%)`,
    accent,
    driveLink: r.drive_url || "",
    mapsUrl: r.maps_url || "",
    fromCatalog: true,
  };
};

const entregaColor = (entrega, T) => {
  const e = (entrega || "").toUpperCase();
  if (!e) return T.txt3;
  if (e.includes("INMEDIATA") || e.includes("INMEDITA")) return T.emerald;
  if (e.includes("REVENTA")) return T.amber;
  return T.blue;
};

const fmtDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return ""; }
};

const buildResumen = (r) => [
  `🏗 *${r.name}*${r.plaza ? ` — ${r.plaza}` : ""}`,
  r.zona && `📍 ${r.zona}`,
  (r.ticket || r.price_tier) && `💰 ${r.ticket || tierLabel(r.price_tier)}`,
  r.tipologia && `🛏 ${r.tipologia}`,
  r.entrega && `📅 Entrega: ${r.entrega}`,
  r.financiamiento && `💳 Financiamiento: ${r.financiamiento}`,
  r.como_se_entrega && `🔑 Se entrega: ${r.como_se_entrega}`,
  r.highlights && `✨ ${r.highlights}`,
  r.drive_url && `📂 Fotos y brochure: ${r.drive_url}`,
  r.maps_url && `🗺 Ubicación: ${r.maps_url}`,
].filter(Boolean).join("\n");

/* ─── Modo presentación: la ficha que ve el cliente ─── */
const FichaModal = ({ r, onClose, T = P, onCreateLanding }) => {
  const isLight = T?.bg !== P.bg;
  const accent = accentFor(r.name);
  const [showInternal, setShowInternal] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyResumen = () => {
    navigator.clipboard?.writeText(buildResumen(r)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const datos = [
    { icon: CreditCard,  label: "Precio / Ticket",  value: r.ticket || tierLabel(r.price_tier) },
    { icon: BedDouble,   label: "Tipología",         value: r.tipologia },
    { icon: CalendarDays,label: "Entrega",           value: r.entrega, color: entregaColor(r.entrega, T) },
    { icon: CreditCard,  label: "Financiamiento",    value: r.financiamiento },
    { icon: KeyRound,    label: "Cómo se entrega",   value: r.como_se_entrega },
    { icon: Wrench,      label: "Mantenimiento",     value: r.mantenimiento },
  ].filter(d => d.value);

  const hasInternal = r.masterbroker || r.contacto || r.recommended_by;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,5,10,0.82)", backdropFilter: "blur(12px)", zIndex: 200000 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 200001,
        width: "min(760px, 94vw)", maxHeight: "92vh", overflowY: "auto",
        background: isLight ? "#FFFFFF" : "#0A0F16", border: `1px solid ${accent}30`, borderRadius: 24,
        boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 60px ${accent}12`,
      }}>
        {/* Hero */}
        <div style={{
          position: "relative", padding: "34px 36px 26px", overflow: "hidden",
          background: r.cover_url
            ? `linear-gradient(180deg, rgba(4,8,14,0.25) 0%, rgba(4,8,14,0.85) 100%), url(${r.cover_url}) center/cover`
            : `linear-gradient(135deg, ${accent}2E 0%, ${accent}0A 45%, ${isLight ? "#F2F6FA" : "#04080E"} 100%)`,
          borderBottom: `1px solid ${T.border}`,
        }}>
          <button onClick={onClose} style={{
            position: "absolute", top: 18, right: 18, width: 34, height: 34, borderRadius: 10,
            border: `1px solid ${T.border}`, background: "rgba(10,15,22,0.55)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><X size={15} color="#E2E8F0" /></button>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            {r.is_top && <Pill color={T.amber} s isLight={isLight}><Star size={10} /> Top inversión</Pill>}
            {r.price_tier && <Pill color={accent} s isLight={isLight}>{tierLabel(r.price_tier)}</Pill>}
            {r.entrega && <Pill color={entregaColor(r.entrega, T)} s isLight={isLight}>Entrega: {r.entrega}</Pill>}
            {r.clasificacion && <Pill color={T.violet} s isLight={isLight}>{r.clasificacion}</Pill>}
          </div>
          <p style={{
            fontSize: 32, fontWeight: 800, fontFamily: fontDisp, letterSpacing: "-0.02em", lineHeight: 1.1,
            color: r.cover_url ? "#FFFFFF" : T.txt, marginBottom: 8,
          }}>{r.name}</p>
          <p style={{ fontSize: 14, color: r.cover_url ? "rgba(255,255,255,0.75)" : T.txt2, fontFamily: font, display: "flex", alignItems: "center", gap: 6 }}>
            <MapPin size={14} color={accent} /> {r.plaza}{r.zona ? ` · ${r.zona}` : ""}
          </p>
        </div>

        <div style={{ padding: "26px 36px 30px", display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Datos de la ficha */}
          {datos.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {datos.map(d => (
                <div key={d.label} style={{
                  padding: "14px 16px", borderRadius: 14,
                  background: isLight ? "rgba(15,23,42,0.035)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.border}`,
                }}>
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: font, display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                    <d.icon size={11} color={accent} /> {d.label}
                  </p>
                  <p style={{ fontSize: 14.5, fontWeight: 700, color: d.color || T.txt, fontFamily: fontDisp, lineHeight: 1.3 }}>{d.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Highlights */}
          {r.highlights && (
            <div style={{ padding: "16px 18px", borderRadius: 14, background: `${accent}0C`, border: `1px solid ${accent}22` }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7, fontFamily: font }}>Por qué recomendarla</p>
              <p style={{ fontSize: 13.5, color: T.txt, fontFamily: font, lineHeight: 1.65 }}>{r.highlights}</p>
            </div>
          )}

          {(r.tags || []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {r.tags.map(t => <Pill key={t} color={T.txt3} s isLight={isLight}><Tag size={9} /> {t}</Pill>)}
            </div>
          )}

          {/* CTAs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {r.drive_url && (
              <a href={r.drive_url} target="_blank" rel="noopener noreferrer" style={{
                flex: "2 1 240px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "14px 18px", borderRadius: 13, textDecoration: "none",
                background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 60%, ${T.blue} 40%) 100%)`,
                color: "#06110D", fontSize: 13.5, fontWeight: 800, fontFamily: fontDisp,
                boxShadow: `0 6px 22px ${accent}40`,
              }}><FolderOpen size={16} strokeWidth={2.4} /> Fotos, brochure y disponibilidad</a>
            )}
            {r.maps_url && (
              <a href={r.maps_url} target="_blank" rel="noopener noreferrer" style={{
                flex: "1 1 150px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "14px 16px", borderRadius: 13, textDecoration: "none",
                background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${T.border}`, color: T.txt, fontSize: 12.5, fontWeight: 700, fontFamily: fontDisp,
              }}><Map size={15} /> Ver en Maps</a>
            )}
            <button onClick={copyResumen} style={{
              flex: "1 1 170px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "14px 16px", borderRadius: 13, cursor: "pointer",
              background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${copied ? T.emerald : T.border}`, color: copied ? T.emerald : T.txt,
              fontSize: 12.5, fontWeight: 700, fontFamily: fontDisp,
            }}>{copied ? <Check size={15} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar resumen"}</button>
            {onCreateLanding && (
              <button onClick={() => { onClose(); onCreateLanding(r); }} style={{
                flex: "1 1 180px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "14px 16px", borderRadius: 13, cursor: "pointer",
                background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${T.border}`, color: T.txt,
                fontSize: 12.5, fontWeight: 700, fontFamily: fontDisp,
              }}><Wand2 size={14} /> Crear landing page</button>
            )}
          </div>

          {/* Datos internos — nunca se presentan al cliente */}
          {hasInternal && (
            <div style={{ borderTop: `1px dashed ${T.border}`, paddingTop: 14 }}>
              <button onClick={() => setShowInternal(v => !v)} style={{
                display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
                cursor: "pointer", color: T.txt3, fontSize: 11, fontWeight: 700, fontFamily: font, padding: 0,
              }}>
                {showInternal ? <EyeOff size={12} /> : <Eye size={12} />}
                Datos internos (solo equipo) {showInternal ? "— ocultar" : ""}
              </button>
              {showInternal && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
                  {r.masterbroker && <p style={{ fontSize: 12, color: T.txt2, fontFamily: font }}>Masterbroker: <b style={{ color: T.txt }}>{r.masterbroker}</b></p>}
                  {r.contacto && <p style={{ fontSize: 12, color: T.txt2, fontFamily: font }}>Contacto: <b style={{ color: T.txt }}>{r.contacto}</b></p>}
                  {r.recommended_by && <p style={{ fontSize: 12, color: T.txt2, fontFamily: font }}>Recomienda: <b style={{ color: T.txt }}>{r.recommended_by}</b></p>}
                </div>
              )}
            </div>
          )}

          {r.updated_at && (
            <p style={{ fontSize: 10.5, color: T.txt3, fontFamily: font, display: "flex", alignItems: "center", gap: 5 }}>
              <RefreshCw size={10} /> Datos actualizados al {fmtDate(r.updated_at)} · Catálogo oficial del equipo
            </p>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

/* ─── Sección: catálogo de fichas en el Marketing Studio ─── */
const FichasTecnicas = ({ T = P, onCreateLanding }) => {
  const isLight = T?.bg !== P.bg;
  const { isFeatureEnabled } = useClient();
  const enabled = isFeatureEnabled("propiedades");

  const [rows, setRows] = useState(null);          // null = cargando
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState("");
  const [plaza, setPlaza] = useState("all");
  const [tier, setTier] = useState("all");
  const [ficha, setFicha] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    supabase.from("properties").select("*").is("deleted_at", null)
      .order("plaza", { ascending: true }).order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.warn("[Stratos] fichas load:", error.message); setRows([]); return; }
        setRows((data || []).filter(r => r.active !== false));
      });
  }, [enabled]);

  const plazas = useMemo(() => {
    const set = new Set((rows || []).map(r => (r.plaza || "").trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return (rows || [])
      .filter(r => plaza === "all" || r.plaza === plaza)
      .filter(r => tier === "all" || r.price_tier === tier)
      .filter(r => !nq || [r.name, r.plaza, r.zona, r.highlights, r.tipologia, r.masterbroker]
        .filter(Boolean).join(" ").toLowerCase().includes(nq))
      .sort((a, b) => (b.is_top - a.is_top) || a.plaza.localeCompare(b.plaza, "es") || a.name.localeCompare(b.name, "es"));
  }, [rows, q, plaza, tier]);

  if (!enabled) return null;

  const chip = (active) => ({
    padding: "5px 12px", borderRadius: 99, cursor: "pointer", userSelect: "none",
    fontSize: 10.5, fontWeight: 700, fontFamily: font, whiteSpace: "nowrap",
    color: active ? (isLight ? "#065F46" : "#06110D") : T.txt2,
    background: active ? T.accent : (isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)"),
    border: `1px solid ${active ? T.accent : T.border}`,
    transition: "all 0.2s",
  });

  return (
    <G np T={T}>
      {/* Header de la sección */}
      <div onClick={() => setOpen(v => !v)} style={{
        padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: open ? `1px solid ${T.border}` : "none", cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
            background: `${T.accent}14`, border: `1px solid ${T.accent}30`,
          }}><FileText size={14} color={T.accent} /></div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Fichas Técnicas de Desarrollos</p>
            <p style={{ fontSize: 11, color: T.txt3, marginTop: 1, fontFamily: font }}>
              {rows === null ? "Cargando catálogo…" : `${rows.length} desarrollos · sincronizado con el Sheet del equipo`}
            </p>
          </div>
        </div>
        <div style={{ color: T.txt3, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>
          <ChevronDown size={16} />
        </div>
      </div>

      {open && (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filtros */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span onClick={() => setPlaza("all")} style={chip(plaza === "all")}>Todas las plazas</span>
            {plazas.map(pz => (
              <span key={pz} onClick={() => setPlaza(pz)} style={chip(plaza === pz)}>{pz}</span>
            ))}
            <div style={{ width: 1, height: 20, background: T.border }} />
            <span onClick={() => setTier("all")} style={chip(tier === "all")}>Todo rango</span>
            {TIERS.map(t => (
              <span key={t.id} onClick={() => setTier(t.id)} style={chip(tier === t.id)}>{t.label}</span>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ position: "relative", minWidth: 190 }}>
              <Search size={12} color={T.txt3} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar desarrollo…" style={{
                width: "100%", padding: "8px 12px 8px 29px", borderRadius: 9, outline: "none",
                background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${T.border}`, color: T.txt, fontSize: 12, fontFamily: font, boxSizing: "border-box",
              }} />
            </div>
          </div>

          {/* Grid de fichas */}
          {rows === null ? (
            <p style={{ fontSize: 12, color: T.txt3, fontFamily: font, padding: "10px 0" }}>Cargando catálogo…</p>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "26px 0 14px" }}>
              <Building2 size={26} color={T.txt3} style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, marginBottom: 4 }}>
                {rows.length === 0 ? "El catálogo aún no está cargado" : "Sin resultados con estos filtros"}
              </p>
              <p style={{ fontSize: 11, color: T.txt3, fontFamily: font }}>
                {rows.length === 0
                  ? "Las fichas se cargan del Sheet DRIVES del equipo. Si no aparecen, avisa al administrador."
                  : "Prueba con otra plaza, rango o búsqueda."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {filtered.map(r => {
                const accent = accentFor(r.name);
                return (
                  <div key={r.id} style={{
                    borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column",
                    background: isLight ? "#FFFFFF" : `linear-gradient(160deg, ${accent}0E 0%, rgba(255,255,255,0.02) 55%)`,
                    border: `1px solid ${isLight ? "rgba(15,23,42,0.08)" : accent + "24"}`,
                  }}>
                    <div style={{ padding: "14px 16px 12px", flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 800, color: T.txt, fontFamily: fontDisp, lineHeight: 1.25 }}>
                          {r.is_top && <Star size={12} color={T.amber} fill={T.amber} style={{ marginRight: 5, verticalAlign: "-1.5px" }} />}
                          {r.name}
                        </p>
                        {(r.ticket || r.price_tier) && (
                          <p style={{ fontSize: 12, fontWeight: 800, color: accent, fontFamily: fontDisp, whiteSpace: "nowrap", flexShrink: 0 }}>
                            {r.ticket || tierLabel(r.price_tier)}
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: r.tipologia || r.entrega ? 8 : 0 }}>
                        <Pill color={T.blue} s isLight={isLight}><MapPin size={9} /> {r.plaza}</Pill>
                        {r.entrega && <Pill color={entregaColor(r.entrega, T)} s isLight={isLight}>{r.entrega}</Pill>}
                      </div>
                      {r.tipologia && <p style={{ fontSize: 11, color: T.txt2, fontFamily: font }}>🛏 {r.tipologia}</p>}
                    </div>
                    <div style={{ display: "flex", gap: 7, padding: "0 16px 14px" }}>
                      <button onClick={() => setFicha(r)} style={{
                        flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "9px 12px", borderRadius: 10, cursor: "pointer", border: "none",
                        background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 65%, ${T.blue} 35%) 100%)`,
                        color: "#06110D", fontSize: 11.5, fontWeight: 800, fontFamily: fontDisp,
                        boxShadow: `0 3px 12px ${accent}30`,
                      }}><FileText size={12} strokeWidth={2.5} /> Ver ficha</button>
                      {onCreateLanding && (
                        <button onClick={() => onCreateLanding(r)} title="Crear landing page con esta ficha" style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36,
                          borderRadius: 10, cursor: "pointer",
                          background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)",
                          border: `1px solid ${T.border}`,
                        }}><Wand2 size={13} color={T.txt2} /></button>
                      )}
                      {r.drive_url && (
                        <a href={r.drive_url} target="_blank" rel="noopener noreferrer" title="Abrir Drive" style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36,
                          borderRadius: 10, textDecoration: "none",
                          background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)",
                          border: `1px solid ${T.border}`,
                        }}><FolderOpen size={13} color={T.txt2} /></a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {ficha && <FichaModal r={ficha} onClose={() => setFicha(null)} T={T} onCreateLanding={onCreateLanding} />}
    </G>
  );
};

export default FichasTecnicas;
