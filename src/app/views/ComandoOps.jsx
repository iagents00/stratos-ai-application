/**
 * app/views/ComandoOps.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Comando Directivo para las empresas de OPERACIÓN (NSG y, después, el resto del
 * corporativo). Se activa con `features.comandoOps`.
 *
 * Por qué existe: el Comando original nació para una inmobiliaria — embudo de
 * leads, Zoom agendado, recorrido, apartó/cierre. En NSG eso no significa nada:
 * no vendemos propiedades, entregamos sistemas a clientes. Este tablero muestra
 * lo que sí importa acá:
 *   1) Cada CLIENTE con sus objetivos y cuánto se ha avanzado (barra real).
 *   2) El TRABAJO del equipo: vencido, hoy, en curso, cerrado en 7 días.
 *   3) Los PROYECTOS y su avance.
 *   4) La CAJA del mes y cuánto se le debe a cada quien.
 *
 * Todo sale de una sola RPC org-scoped (`fn_comando_nsg`), así que no hay riesgo
 * de cruzar datos entre empresas.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useMemo, useState } from "react";
import { Target, ListChecks, FolderKanban, Wallet, RefreshCw, AlertTriangle } from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { G } from "../SharedComponents";
import { supabase } from "../../lib/supabase";
import { useIsMobile } from "../../hooks/useViewport";

const money = (n) =>
  "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Barra de progreso: la misma lectura que da el Copilot por chat. */
const Barra = ({ pct, color, T }) => (
  <div style={{ height: 8, borderRadius: 999, background: T.bg2 || "rgba(255,255,255,0.06)", overflow: "hidden" }}>
    <div
      style={{
        width: `${Math.max(0, Math.min(100, pct || 0))}%`,
        height: "100%",
        borderRadius: 999,
        background: color,
        transition: "width .5s ease",
      }}
    />
  </div>
);

const Tarjeta = ({ icon: Icon, label, valor, sub, color, T }) => (
  <div
    style={{
      flex: "1 1 150px",
      minWidth: 140,
      padding: 14,
      borderRadius: 14,
      background: T.bg2 || "rgba(255,255,255,0.03)",
      border: `1px solid ${T.border}`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ display: "inline-flex", padding: 6, borderRadius: 8, background: `${color}1A` }}>
        <Icon size={14} color={color} />
      </span>
      <span style={{ fontSize: 12, color: T.txt3, fontFamily: font }}>{label}</span>
    </div>
    <p style={{ margin: 0, fontSize: 24, fontWeight: 600, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
      {valor}
    </p>
    {sub ? <p style={{ margin: "3px 0 0", fontSize: 12, color: T.txt3, fontFamily: font }}>{sub}</p> : null}
  </div>
);

const ComandoOps = ({ T, accent = "#F472B6" }) => {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const isMobile = useIsMobile();

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const { data: perfil } = await supabase.auth.getUser();
      const uid = perfil?.user?.id;
      if (!uid) throw new Error("Sin sesión");
      const { data: res, error: e } = await supabase.rpc("fn_comando_nsg", { p_profile_id: uid });
      if (e) throw e;
      setData(res);
    } catch (e) {
      setError(e.message || "No se pudo cargar el tablero");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trabajo = data?.trabajo || {};
  const caja = data?.caja || {};
  const clientes = data?.clientes || [];
  const proyectos = data?.proyectos || [];
  const nomina = data?.nomina || [];
  const porPersona = data?.por_persona || [];

  const balance = useMemo(
    () => Number(caja.entro || 0) - Number(caja.nomina || 0) - Number(caja.servicios || 0),
    [caja]
  );

  const titulo = (t, s) => (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 14.5, fontWeight: 500, color: T.txt, fontFamily: fontDisp, margin: 0, letterSpacing: "-0.014em" }}>
        {t}
      </p>
      {s ? (
        <p style={{ fontSize: 12, color: T.txt3, fontFamily: font, margin: "3px 0 0", lineHeight: 1.5 }}>{s}</p>
      ) : null}
    </div>
  );

  if (cargando) {
    return (
      <G T={T}>
        <p style={{ color: T.txt3, fontFamily: font, fontSize: 13, margin: 0 }}>Cargando el tablero…</p>
      </G>
    );
  }

  if (error) {
    return (
      <G T={T}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={16} color="#F59E0B" />
          <p style={{ color: T.txt2, fontFamily: font, fontSize: 13, margin: 0 }}>{error}</p>
          <button
            onClick={cargar}
            style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${T.border}`, color: T.txt2,
                     borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontFamily: font, cursor: "pointer" }}
          >
            Reintentar
          </button>
        </div>
      </G>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── El pulso del trabajo ── */}
      <G T={T}>
        {titulo("El pulso de la semana", "Lo que el equipo tiene abierto ahora mismo")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Tarjeta icon={AlertTriangle} label="Vencido" valor={trabajo.vencidas ?? 0}
                   sub={trabajo.vencidas ? "necesita atención hoy" : "nada atrasado"} color="#EF4444" T={T} />
          <Tarjeta icon={ListChecks} label="Para hoy" valor={trabajo.hoy ?? 0} color="#3B82F6" T={T} />
          <Tarjeta icon={RefreshCw} label="En curso" valor={trabajo.en_curso ?? 0} color={accent} T={T} />
          <Tarjeta icon={ListChecks} label="Cerrado (7 días)" valor={trabajo.hechas_7d ?? 0}
                   sub="ritmo de la semana" color="#22C55E" T={T} />
        </div>

        {porPersona.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {porPersona.map((p) => (
              <div key={p.nombre}
                   style={{ flex: "1 1 200px", padding: "10px 12px", borderRadius: 12,
                            background: T.bg2 || "rgba(255,255,255,0.03)", border: `1px solid ${T.border}` }}>
                <p style={{ margin: 0, fontSize: 12.5, color: T.txt, fontFamily: font, fontWeight: 500 }}>{p.nombre}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: T.txt3, fontFamily: font }}>
                  {p.abiertas} abierta{p.abiertas === 1 ? "" : "s"}
                  {p.vencidas > 0 ? ` · ${p.vencidas} vencida${p.vencidas === 1 ? "" : "s"}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </G>

      {/* ── Clientes y objetivos ── */}
      <G T={T}>
        {titulo("Clientes y objetivos", "Qué nos comprometimos con cada uno y cuánto llevamos")}
        {clientes.length === 0 ? (
          <p style={{ color: T.txt3, fontFamily: font, fontSize: 12.5, margin: 0 }}>
            Todavía no hay clientes cargados. Dile al Copilot «agrega el cliente X» y aparece acá.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {clientes.map((c) => (
              <div key={c.nombre}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <Target size={14} color={accent} />
                  <span style={{ fontSize: 13.5, color: T.txt, fontFamily: font, fontWeight: 500 }}>{c.nombre}</span>
                  <span style={{ fontSize: 11.5, color: T.txt3, fontFamily: font, padding: "2px 8px",
                                 borderRadius: 999, border: `1px solid ${T.border}` }}>
                    {c.etapa}
                  </span>
                </div>
                {(c.objetivos || []).length === 0 ? (
                  <p style={{ margin: "0 0 0 22px", fontSize: 12, color: T.txt3, fontFamily: font }}>
                    Sin objetivos fijados — dile al Copilot «fija un objetivo con {c.nombre}: …»
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: 22 }}>
                    {c.objetivos.map((o) => (
                      <div key={o.titulo}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12.5, color: T.txt2, fontFamily: font }}>{o.titulo}</span>
                          <span style={{ fontSize: 12.5, color: T.txt, fontFamily: font, fontWeight: 500, whiteSpace: "nowrap" }}>
                            {o.actual} de {o.meta} {o.unidad} · {o.pct ?? 0}%
                          </span>
                        </div>
                        <Barra pct={o.pct} color={o.estado === "logrado" ? "#22C55E" : accent} T={T} />
                      </div>
                    ))}
                  </div>
                )}
                {c.ultimo_avance ? (
                  <p style={{ margin: "8px 0 0 22px", fontSize: 12, color: T.txt3, fontFamily: font, fontStyle: "italic" }}>
                    Último avance: {c.ultimo_avance}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </G>

      {/* ── Proyectos ── */}
      {proyectos.length > 0 && (
        <G T={T}>
          {titulo("Proyectos", "Cuánto va completado de cada uno")}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {proyectos.map((p) => {
              const pct = p.total > 0 ? Math.round((p.hechas / p.total) * 100) : 0;
              return (
                <div key={p.nombre}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.txt2, fontFamily: font }}>
                      <FolderKanban size={13} color={T.txt3} /> {p.nombre}
                    </span>
                    <span style={{ fontSize: 12.5, color: T.txt3, fontFamily: font }}>{p.hechas}/{p.total}</span>
                  </div>
                  <Barra pct={pct} color={accent} T={T} />
                </div>
              );
            })}
          </div>
        </G>
      )}

      {/* ── Caja y nómina ── */}
      <G T={T}>
        {titulo("Caja del mes", "Lo de NSG como empresa: lo que cobró, lo que pagó y cuánto le debe a cada quien")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Tarjeta icon={Wallet} label="Cobró a clientes" valor={money(caja.entro)} color="#22C55E" T={T} />
          <Tarjeta icon={Wallet} label="Pagó de nómina" valor={money(caja.nomina)} color="#3B82F6" T={T} />
          <Tarjeta icon={Wallet} label="Pagó de servicios" valor={money(caja.servicios)} color="#F59E0B" T={T} />
          <Tarjeta icon={Wallet} label="Le quedó" valor={money(balance)}
                   color={balance >= 0 ? "#22C55E" : "#EF4444"} T={T} />
        </div>

        {nomina.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <p style={{ fontSize: 12.5, color: T.txt2, fontFamily: font, margin: "0 0 10px", fontWeight: 500 }}>
              Saldos de nómina
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {nomina.map((n) => {
                const debe = Math.max(0, Number(n.devengado || 0) - Number(n.pagado || 0));
                const pct = n.devengado > 0 ? Math.round((Number(n.pagado || 0) / Number(n.devengado)) * 100) : 0;
                return (
                  // El nombre y el saldo van SOLOS en la primera línea, y el
                  // "$500 USD quincenal" baja a la segunda. Antes iban los tres
                  // juntos con space-between y en el iPhone el saldo de Iván se
                  // partía de línea mientras el de Ángel no — se veía roto
                  // (reporte de Ángel con captura, 27-jul).
                  <div key={n.persona}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, color: T.txt, fontFamily: font, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {n.persona}
                      </span>
                      <span style={{ fontSize: 13, color: debe > 0 ? "#F59E0B" : "#22C55E", fontFamily: font, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                        {debe > 0 ? money(debe) : "al día"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: T.txt3, fontFamily: font }}>
                        {money(n.monto)} {n.moneda} {n.periodicidad}
                      </span>
                      {debe > 0 && (
                        <span style={{ fontSize: 12, color: T.txt3, fontFamily: font, whiteSpace: "nowrap" }}>pendiente</span>
                      )}
                    </div>
                    <Barra pct={pct} color={debe > 0 ? "#F59E0B" : "#22C55E"} T={T} />
                    <p style={{ margin: "5px 0 0", fontSize: 11.5, color: T.txt3, fontFamily: font }}>
                      lleva ganado {money(n.devengado)} · ya cobró {money(n.pagado)}
                    </p>
                  </div>
                );
              })}
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 11.5, color: T.txt3, fontFamily: font }}>
              Los pagos se hacen el 15 y el 30 de cada mes. El acumulado sube día a día.
            </p>
          </div>
        )}
      </G>

      <div style={{ display: "flex", justifyContent: isMobile ? "stretch" : "flex-end" }}>
        <button
          onClick={cargar}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent",
                   border: `1px solid ${T.border}`, color: T.txt2, borderRadius: 10, padding: "8px 14px",
                   fontSize: 12.5, fontFamily: font, cursor: "pointer", width: isMobile ? "100%" : "auto",
                   justifyContent: "center" }}
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>
    </div>
  );
};

export default ComandoOps;
