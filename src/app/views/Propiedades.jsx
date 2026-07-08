/**
 * app/views/Propiedades.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Catálogo de propiedades (inventario de proyectos con links de Drive).
 * Reemplaza el Google Sheet "DRIVES DUKE DEL CARIBE" como fuente de verdad:
 * tabla `properties` en Supabase (migración 055), org-scoped vía RLS.
 *
 * · Todo el equipo (asesores incluidos) consulta, filtra y copia links.
 * · Cualquiera agrega propiedades; edita/archiva el creador o un rol de mando.
 * · El bot de Telegram lee esta misma tabla (bot_propiedades):
 *   "top inversiones de Cancún", "/propiedades tulum de 200 a 350".
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useMemo } from "react";
import {
  FolderOpen, MapPin, Star, Search, Plus, X, Pencil, Archive,
  Copy, Check, Building2, Link2,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { P, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Pill } from "../SharedComponents";

// Rangos canónicos (mismos códigos que usa el bot en bot_propiedades).
const TIERS = [
  { id: "80-150K",  label: "$80–150K"  },
  { id: "200-350K", label: "$200–350K" },
  { id: "500-800K", label: "$500–800K" },
  { id: "LUXURY",   label: "Luxury"    },
];
const tierLabel = (id) => TIERS.find(t => t.id === id)?.label || id || "—";
const tierRank  = (id) => { const i = TIERS.findIndex(t => t.id === id); return i === -1 ? TIERS.length : i; };

const MANAGE_ROLES = ["super_admin", "admin", "director", "ceo"];

const emptyForm = {
  name: "", plaza: "", price_tier: "", highlights: "",
  drive_url: "", recommended_by: "", tags: "", is_top: false,
};

const Propiedades = ({ T: _T }) => {
  const T = _T || P;
  const isLight = !!_T && _T?.bg !== P.bg;
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role);

  const [rows, setRows]     = useState(null);   // null = cargando
  const [plaza, setPlaza]   = useState("all");
  const [tier, setTier]     = useState("all");
  const [q, setQ]           = useState("");
  const [topOnly, setTopOnly] = useState(false);
  const [modal, setModal]   = useState(null);   // null | {row?} (row => edición)
  const [form, setForm]     = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const load = () => {
    supabase.from("properties").select("*").is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.warn("[Stratos] propiedades load:", error.message); setRows([]); return; }
        setRows(data || []);
      });
  };
  useEffect(load, []);

  const plazas = useMemo(() => {
    const set = new Set((rows || []).filter(r => r.active !== false).map(r => (r.plaza || "").trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return (rows || [])
      .filter(r => r.active !== false)
      .filter(r => plaza === "all" || r.plaza === plaza)
      .filter(r => tier === "all" || r.price_tier === tier)
      .filter(r => !topOnly || r.is_top)
      .filter(r => !nq || [r.name, r.highlights, r.plaza, r.recommended_by, ...(r.tags || [])]
        .filter(Boolean).join(" ").toLowerCase().includes(nq))
      .sort((a, b) => (b.is_top - a.is_top)
        || a.plaza.localeCompare(b.plaza, "es")
        || (tierRank(a.price_tier) - tierRank(b.price_tier))
        || a.name.localeCompare(b.name, "es"));
  }, [rows, plaza, tier, q, topOnly]);

  const withLink = (rows || []).filter(r => r.active !== false && r.drive_url).length;
  const topCount = (rows || []).filter(r => r.active !== false && r.is_top).length;

  const openNew  = () => { setForm(emptyForm); setErr(""); setModal({}); };
  const openEdit = (r) => {
    setForm({
      name: r.name || "", plaza: r.plaza || "", price_tier: r.price_tier || "",
      highlights: r.highlights || "", drive_url: r.drive_url || "",
      recommended_by: r.recommended_by || "", tags: (r.tags || []).join(", "),
      is_top: !!r.is_top,
    });
    setErr(""); setModal({ row: r });
  };
  const canEditRow = (r) => canManage || r.created_by === user?.id;

  const save = async () => {
    if (!form.name.trim() || !form.plaza.trim()) { setErr("Nombre y plaza son obligatorios."); return; }
    if (form.drive_url && !/^https?:\/\//i.test(form.drive_url.trim())) {
      setErr("El link debe empezar con https://"); return;
    }
    setSaving(true); setErr("");
    const payload = {
      name: form.name.trim(),
      plaza: form.plaza.trim(),
      price_tier: form.price_tier || null,
      highlights: form.highlights.trim() || null,
      drive_url: form.drive_url.trim() || null,
      recommended_by: form.recommended_by.trim() || null,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      is_top: form.is_top,
      updated_at: new Date().toISOString(),
    };
    const query = modal?.row
      ? supabase.from("properties").update(payload).eq("id", modal.row.id)
      : supabase.from("properties").insert({
          ...payload,
          organization_id: user.organizationId,
          created_by: user.id,
        });
    const { error } = await query;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setModal(null); load();
  };

  const archive = async (r) => {
    if (!window.confirm(`¿Archivar "${r.name}"? Deja de verse en el catálogo y en el bot.`)) return;
    const { error } = await supabase.from("properties")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) { console.warn("[Stratos] propiedades archive:", error.message); return; }
    load();
  };

  const toggleTop = async (r) => {
    const { error } = await supabase.from("properties")
      .update({ is_top: !r.is_top, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (!error) load();
  };

  const copyLink = (r) => {
    if (!r.drive_url) return;
    navigator.clipboard?.writeText(r.drive_url).then(() => {
      setCopiedId(r.id);
      setTimeout(() => setCopiedId(cur => (cur === r.id ? null : cur)), 1600);
    });
  };

  const chip = (active) => ({
    padding: "6px 13px", borderRadius: 99, cursor: "pointer", userSelect: "none",
    fontSize: 11, fontWeight: 700, fontFamily: font, whiteSpace: "nowrap",
    color: active ? (isLight ? "#065F46" : "#06110D") : T.txt2,
    background: active ? T.accent : (isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.05)"),
    border: `1px solid ${active ? T.accent : T.border}`,
    transition: "all 0.2s",
  });

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10, outline: "none",
    background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.05)",
    border: `1px solid ${T.border}`, color: T.txt, fontSize: 13, fontFamily: font,
  };
  const labelStyle = {
    fontSize: 10, fontWeight: 700, color: T.txt3, textTransform: "uppercase",
    letterSpacing: "0.07em", fontFamily: font, marginBottom: 6, display: "block",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KPI label="Propiedades" value={rows ? rows.filter(r => r.active !== false).length : "…"} sub="En catálogo" icon={Building2} color={T.blue} T={T} />
        <KPI label="Plazas" value={plazas.length} sub="Destinos" icon={MapPin} color={T.violet} T={T} />
        <KPI label="Con link de Drive" value={withLink} sub="Listas para compartir" icon={Link2} color={T.emerald} T={T} />
        <KPI label="Top inversiones" value={topCount} sub="Destacadas ⭐" icon={Star} color={T.amber} T={T} />
      </div>

      {/* Filtros */}
      <G T={T}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span onClick={() => setPlaza("all")} style={chip(plaza === "all")}>Todas las plazas</span>
            {plazas.map(pz => (
              <span key={pz} onClick={() => setPlaza(pz)} style={chip(plaza === pz)}>{pz}</span>
            ))}
          </div>
          <div style={{ width: 1, height: 22, background: T.border }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span onClick={() => setTier("all")} style={chip(tier === "all")}>Todo rango</span>
            {TIERS.map(t => (
              <span key={t.id} onClick={() => setTier(t.id)} style={chip(tier === t.id)}>{t.label}</span>
            ))}
            <span onClick={() => setTopOnly(v => !v)} style={chip(topOnly)}>⭐ Top</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative", minWidth: 200 }}>
            <Search size={13} color={T.txt3} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar proyecto, highlight…"
              style={{ ...inputStyle, paddingLeft: 32 }} />
          </div>
          <button onClick={openNew} style={{
            display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
            padding: "9px 16px", borderRadius: 10, border: "none",
            background: T.accent, color: isLight ? "#065F46" : "#06110D",
            fontSize: 12, fontWeight: 800, fontFamily: fontDisp,
          }}>
            <Plus size={14} strokeWidth={3} /> Agregar
          </button>
        </div>
      </G>

      {/* Grid de propiedades */}
      {rows === null ? (
        <G T={T}><p style={{ fontSize: 12, color: T.txt3, fontFamily: font }}>Cargando catálogo…</p></G>
      ) : filtered.length === 0 ? (
        <G T={T} style={{ textAlign: "center", padding: 40 }}>
          <FolderOpen size={28} color={T.txt3} style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, marginBottom: 4 }}>
            {rows.length === 0 ? "El catálogo está vacío" : "Sin resultados con estos filtros"}
          </p>
          <p style={{ fontSize: 11, color: T.txt3, fontFamily: font }}>
            {rows.length === 0 ? "Agrega la primera propiedad con el botón Agregar." : "Prueba con otra plaza, rango o búsqueda."}
          </p>
        </G>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 14 }}>
          {filtered.map(r => (
            <G key={r.id} T={T} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: T.txt, fontFamily: fontDisp, marginBottom: 6, lineHeight: 1.25 }}>
                    {r.is_top && <Star size={13} color={T.amber} fill={T.amber} style={{ marginRight: 5, verticalAlign: "-2px" }} />}
                    {r.name}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <Pill color={T.blue} s isLight={isLight}><MapPin size={10} /> {r.plaza}</Pill>
                    {r.price_tier && <Pill color={T.violet} s isLight={isLight}>{tierLabel(r.price_tier)}</Pill>}
                    {(r.tags || []).slice(0, 3).map(t => <Pill key={t} color={T.txt3} s isLight={isLight}>{t}</Pill>)}
                  </div>
                </div>
                {canEditRow(r) && (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => toggleTop(r)} title={r.is_top ? "Quitar de top" : "Marcar como top"}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Star size={14} color={r.is_top ? T.amber : T.txt3} fill={r.is_top ? T.amber : "none"} />
                    </button>
                    <button onClick={() => openEdit(r)} title="Editar"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Pencil size={13} color={T.txt3} />
                    </button>
                    <button onClick={() => archive(r)} title="Archivar"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Archive size={13} color={T.txt3} />
                    </button>
                  </div>
                )}
              </div>

              {r.highlights && (
                <p style={{ fontSize: 12, color: T.txt2, fontFamily: font, lineHeight: 1.5 }}>{r.highlights}</p>
              )}
              {r.recommended_by && (
                <p style={{ fontSize: 10, color: T.txt3, fontFamily: font }}>Recomienda: <b style={{ color: T.txt2 }}>{r.recommended_by}</b></p>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                {r.drive_url ? (
                  <>
                    <a href={r.drive_url} target="_blank" rel="noopener noreferrer" style={{
                      flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                      padding: "10px 14px", borderRadius: 11, textDecoration: "none",
                      background: `linear-gradient(135deg, ${T.accent} 0%, color-mix(in srgb, ${T.accent} 65%, ${T.blue} 35%) 100%)`,
                      color: isLight ? "#053B2E" : "#06110D",
                      fontSize: 12, fontWeight: 800, fontFamily: fontDisp, letterSpacing: "0.01em",
                      boxShadow: `0 4px 14px ${T.accent}33, inset 0 1px 0 rgba(255,255,255,0.35)`,
                    }}>
                      <FolderOpen size={14} strokeWidth={2.4} /> Abrir Drive
                    </a>
                    <button onClick={() => copyLink(r)} title="Copiar link" style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 40, borderRadius: 11, cursor: "pointer",
                      background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${copiedId === r.id ? T.emerald : T.border}`,
                    }}>
                      {copiedId === r.id
                        ? <Check size={14} color={T.emerald} />
                        : <Copy size={13} color={T.txt2} />}
                    </button>
                  </>
                ) : (
                  <span style={{
                    flex: 1, textAlign: "center", padding: "10px 14px", borderRadius: 11,
                    background: isLight ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.04)",
                    border: `1px dashed ${T.border}`, color: T.txt3,
                    fontSize: 11, fontWeight: 600, fontFamily: font,
                  }}>Sin link de Drive aún</span>
                )}
              </div>
            </G>
          ))}
        </div>
      )}

      {/* Modal alta / edición */}
      {modal && (
        <div onClick={() => !saving && setModal(null)} style={{
          position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(2,6,12,0.62)", backdropFilter: "blur(6px)", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "min(560px, 100%)", maxHeight: "88vh", overflowY: "auto",
            background: isLight ? "#FFFFFF" : "#0B1220",
            border: `1px solid ${T.border}`, borderRadius: 20, padding: 24,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: T.txt, fontFamily: fontDisp }}>
                {modal.row ? "Editar propiedad" : "Nueva propiedad"}
              </p>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={16} color={T.txt3} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Proyecto *</label>
                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej. NAJ ORIGEN" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Plaza *</label>
                  <input style={inputStyle} list="plazas-list" value={form.plaza}
                    onChange={e => setForm(f => ({ ...f, plaza: e.target.value }))} placeholder="Ej. Tulum" />
                  <datalist id="plazas-list">{plazas.map(pz => <option key={pz} value={pz} />)}</datalist>
                </div>
                <div>
                  <label style={labelStyle}>Rango de precio</label>
                  <select style={inputStyle} value={form.price_tier}
                    onChange={e => setForm(f => ({ ...f, price_tier: e.target.value }))}>
                    <option value="">— Sin rango —</option>
                    {TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Highlights (por qué recomendarla)</label>
                <input style={inputStyle} value={form.highlights}
                  onChange={e => setForm(f => ({ ...f, highlights: e.target.value }))}
                  placeholder="Ej. Acabados premium, mejor precio por m²" />
              </div>
              <div>
                <label style={labelStyle}>Link del Drive</label>
                <input style={inputStyle} value={form.drive_url}
                  onChange={e => setForm(f => ({ ...f, drive_url: e.target.value }))}
                  placeholder="https://drive.google.com/drive/folders/…" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Recomienda</label>
                  <input style={inputStyle} value={form.recommended_by}
                    onChange={e => setForm(f => ({ ...f, recommended_by: e.target.value }))} placeholder="Ej. Ken" />
                </div>
                <div>
                  <label style={labelStyle}>Tags (separados por coma)</label>
                  <input style={inputStyle} value={form.tags}
                    onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="beach front, ROI, cenote" />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: T.txt2, fontFamily: font }}>
                <input type="checkbox" checked={form.is_top}
                  onChange={e => setForm(f => ({ ...f, is_top: e.target.checked }))} />
                ⭐ Marcar como top inversión
              </label>

              {err && <p style={{ fontSize: 11, color: T.rose || "#FB7185", fontFamily: font }}>{err}</p>}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setModal(null)} disabled={saving} style={{
                  padding: "10px 18px", borderRadius: 10, cursor: "pointer",
                  background: "transparent", border: `1px solid ${T.border}`,
                  color: T.txt2, fontSize: 12, fontWeight: 700, fontFamily: font,
                }}>Cancelar</button>
                <button onClick={save} disabled={saving} style={{
                  padding: "10px 22px", borderRadius: 10, cursor: "pointer", border: "none",
                  background: T.accent, color: isLight ? "#065F46" : "#06110D",
                  fontSize: 12, fontWeight: 800, fontFamily: fontDisp, opacity: saving ? 0.6 : 1,
                }}>{saving ? "Guardando…" : modal.row ? "Guardar cambios" : "Agregar propiedad"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Propiedades;
