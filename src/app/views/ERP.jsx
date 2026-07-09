import { useState, useMemo } from "react";
import { P, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Pill } from "../SharedComponents";
import {
  Building2, MapPin, FolderOpen, Search, Phone, HardDrive,
  Map as MapIcon, Layers, Briefcase, X, Tag,
} from "lucide-react";
import { CATALOGO_SECCIONES } from "../data/catalogoProyectos";

/* Color por rango de ticket */
const ticketColor = (t, T) => {
  const s = (t || "").toLowerCase();
  if (s.includes("450") || s.includes("500") || s.includes("800") || s.includes("luxury")) return T.violet;
  if (s.includes("250") || s.includes("350")) return T.amber;
  if (s.includes("150")) return T.emerald;
  return T.blue;
};

const summary = (it) => [
  it.desarrollo,
  it.ubicacion && `Ubicación: ${it.ubicacion}`,
  it.ticket && `Ticket: ${it.ticket}`,
  it.clasificacion && `Clasificación: ${it.clasificacion}`,
  it.tipologia && `Tipología: ${it.tipologia}`,
  it.masterbroker && `Masterbroker: ${it.masterbroker}`,
  it.contacto && `Contacto: ${it.contacto}`,
  it.drive && `Drive: ${it.drive}`,
].filter(Boolean).join(" · ");

const ERP = ({ oc, T: _T }) => {
  const isLight = !!_T && _T?.bg !== P.bg;
  const T = _T || P;

  const [secId, setSecId] = useState(CATALOGO_SECCIONES[0].id);
  const [q, setQ] = useState("");
  const [ticket, setTicket] = useState("");
  const [limit, setLimit] = useState(60);

  const sec = useMemo(
    () => CATALOGO_SECCIONES.find((s) => s.id === secId) || CATALOGO_SECCIONES[0],
    [secId]
  );

  const kpis = useMemo(() => {
    const all = CATALOGO_SECCIONES.flatMap((s) => s.items);
    const conDrive = all.filter((i) => i.drive).length;
    const ubic = new Set(all.map((i) => (i.ubicacion || "").trim()).filter(Boolean));
    const secciones = CATALOGO_SECCIONES.filter((s) => s.items.length).length;
    return { total: all.length, conDrive, ubic: ubic.size, secciones };
  }, []);

  const tickets = useMemo(
    () => Array.from(new Set(sec.items.map((i) => i.ticket).filter(Boolean))),
    [sec]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sec.items.filter((i) => {
      if (ticket && i.ticket !== ticket) return false;
      if (!needle) return true;
      return [
        i.desarrollo, i.ubicacion, i.zona, i.masterbroker, i.contacto,
        i.clasificacion, i.tipologia, i.highlights, i.asesor,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [sec, q, ticket]);

  const shown = filtered.slice(0, limit);

  const pickSection = (id) => { setSecId(id); setQ(""); setTicket(""); setLimit(60); };

  const btnStyle = (color) => ({
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "6px 11px", borderRadius: 9, textDecoration: "none",
    fontSize: 11, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "-0.01em",
    color, background: `${color}14`, border: `1px solid ${color}2E`,
    whiteSpace: "nowrap", transition: "background 0.15s, border-color 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KPI label="Desarrollos" value={kpis.total} sub="Catálogo total" icon={Building2} color={T.blue} T={T} />
        <KPI label="Con carpeta Drive" value={kpis.conDrive} sub="Material listo" icon={HardDrive} color={T.emerald} T={T} />
        <KPI label="Ubicaciones" value={kpis.ubic} sub="Zonas cubiertas" icon={MapPin} color={T.amber} T={T} />
        <KPI label="Secciones" value={kpis.secciones} sub="Del Google Sheet" icon={Layers} color={T.violet} T={T} />
      </div>

      {/* Catálogo */}
      <G np T={T}>
        {/* Header + secciones */}
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp, margin: 0 }}>Catálogo de Proyectos</p>
              <p style={{ fontSize: 10.5, color: T.txt3, fontFamily: font, margin: "3px 0 0" }}>
                Duke del Caribe · fuente: Google Sheet «DRIVES DUKE DEL CARIBE»
              </p>
            </div>
            <Pill color={T.blue} s isLight={isLight}>{filtered.length} de {sec.items.length}</Pill>
          </div>

          {/* Section tabs */}
          <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4 }}>
            {CATALOGO_SECCIONES.map((s) => {
              const active = s.id === secId;
              return (
                <button
                  key={s.id}
                  onClick={() => pickSection(s.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
                    padding: "8px 13px", borderRadius: 10, cursor: "pointer",
                    border: `1px solid ${active ? `${T.accent}55` : T.border}`,
                    background: active ? `${T.accent}18` : (isLight ? "rgba(15,23,42,0.02)" : "rgba(255,255,255,0.02)"),
                    color: active ? T.accent : T.txt2,
                    fontSize: 12, fontWeight: active ? 700 : 500, fontFamily: fontDisp, letterSpacing: "-0.01em",
                    transition: "all 0.15s",
                  }}
                >
                  {s.nombre}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
                    background: active ? `${T.accent}26` : (isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)"),
                    color: active ? T.accent : T.txt3,
                  }}>{s.items.length}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar: search + ticket filter */}
        {sec.items.length > 0 && (
          <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 240px", padding: "9px 13px", borderRadius: 11, background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.04)", border: `1px solid ${q ? T.accent : T.border}` }}>
              <Search size={14} color={T.txt3} />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setLimit(60); }}
                placeholder="Buscar desarrollo, zona, masterbroker, contacto…"
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", color: T.txt, fontSize: 13, fontFamily: font, minWidth: 0 }}
              />
              {q && <X size={13} color={T.txt3} style={{ cursor: "pointer" }} onClick={() => setQ("")} />}
            </div>
            {tickets.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tickets.map((tk) => {
                  const active = ticket === tk;
                  const c = ticketColor(tk, T);
                  return (
                    <button
                      key={tk}
                      onClick={() => { setTicket(active ? "" : tk); setLimit(60); }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 99,
                        cursor: "pointer", fontSize: 10.5, fontWeight: 700, fontFamily: fontDisp,
                        border: `1px solid ${active ? c : T.border}`,
                        background: active ? `${c}22` : "transparent",
                        color: active ? c : T.txt3, transition: "all 0.15s",
                      }}
                    >
                      <Tag size={10} /> {tk}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ padding: 18 }}>
          {sec.items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px 40px" }}>
              <div style={{ width: 58, height: 58, borderRadius: 17, background: `${T.accent}0D`, border: `1px solid ${T.accent}1F`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <FolderOpen size={25} color={T.accent} strokeWidth={1.6} style={{ opacity: 0.75 }} />
              </div>
              <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, fontFamily: fontDisp, color: T.txt }}>Sección sin registros todavía</p>
              <p style={{ margin: 0, fontSize: 12, color: T.txt3, fontFamily: font }}>Esta pestaña existe en el Sheet pero aún no tiene desarrollos cargados.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", fontSize: 13, color: T.txt3, fontFamily: font }}>
              Sin coincidencias para «{q}»{ticket && ` · ${ticket}`}.
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(288px, 1fr))", gap: 12 }}>
                {shown.map((it, idx) => {
                  const c = ticketColor(it.ticket, T);
                  return (
                    <div
                      key={idx}
                      onClick={() => oc(summary(it))}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${c}50`)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}
                      style={{
                        display: "flex", flexDirection: "column", gap: 9, padding: "14px 15px",
                        borderRadius: 14, background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${T.border}`, cursor: "pointer", transition: "border-color 0.15s",
                      }}
                    >
                      {/* Title row */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em", lineHeight: 1.25 }}>{it.desarrollo}</p>
                        {it.ticket && <Pill color={c} s isLight={isLight}>{it.ticket}</Pill>}
                      </div>

                      {/* Meta */}
                      {(it.ubicacion || it.clasificacion) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {it.ubicacion && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: T.txt2, fontFamily: font }}>
                              <MapPin size={11} color={T.txt3} /> {it.ubicacion}
                            </span>
                          )}
                          {it.clasificacion && (
                            <span style={{ fontSize: 10, color: T.txt3, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.04em" }}>· {it.clasificacion}</span>
                          )}
                        </div>
                      )}

                      {/* Detail lines */}
                      {(it.tipologia || it.highlights || it.entrega) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {it.tipologia && <span style={{ fontSize: 11, color: T.txt2, fontFamily: font }}>{it.tipologia}</span>}
                          {it.highlights && <span style={{ fontSize: 11, color: T.txt3, fontFamily: font, fontStyle: "italic" }}>“{it.highlights}”</span>}
                          {it.entrega && <span style={{ fontSize: 10.5, color: T.txt3, fontFamily: font }}>Entrega: {it.entrega}</span>}
                        </div>
                      )}

                      {/* Broker / asesor / contacto */}
                      {(it.masterbroker || it.asesor || it.contacto) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 2 }}>
                          {it.masterbroker && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: T.txt3, fontFamily: font }}>
                              <Briefcase size={10} /> {it.masterbroker}
                            </span>
                          )}
                          {it.asesor && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: T.txt3, fontFamily: font }}>
                              <Building2 size={10} /> Asesor: {it.asesor}
                            </span>
                          )}
                          {it.contacto && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: T.txt3, fontFamily: font }}>
                              <Phone size={10} /> {it.contacto}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      {(it.drive || it.maps) && (
                        <div style={{ display: "flex", gap: 7, marginTop: "auto", paddingTop: 4 }}>
                          {it.drive && (
                            <a href={it.drive} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={btnStyle(T.emerald)}>
                              <HardDrive size={12} /> Drive
                            </a>
                          )}
                          {it.maps && (
                            <a href={it.maps} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={btnStyle(T.blue)}>
                              <MapIcon size={12} /> Maps
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {filtered.length > limit && (
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button
                    onClick={() => setLimit((l) => l + 60)}
                    style={{
                      padding: "10px 20px", borderRadius: 11, cursor: "pointer",
                      background: `${T.accent}14`, border: `1px solid ${T.accent}33`,
                      color: T.accent, fontSize: 12.5, fontWeight: 700, fontFamily: fontDisp,
                    }}
                  >
                    Ver más ({filtered.length - limit} restantes)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </G>
    </div>
  );
};

export default ERP;
