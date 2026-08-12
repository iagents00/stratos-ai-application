/**
 * views/PlanSemanal.jsx — el PLAN SEMANAL, adentro de Stratos.
 * ─────────────────────────────────────────────────────────────────────────────
 * Es la hoja «PLAN SEMANAL» que dirección repartió por Drive el 30-jul-2026,
 * pero viva: misma grilla (Lunes→Domingo × 09:00–18:00 cada media hora), mismas
 * dos cajas de abajo (NOTAS y TAREAS DE PRIORIDAD). Cada quien lo mantiene
 * durante la semana y los líderes lo revisan el viernes.
 *
 * ── DÓNDE SE GUARDA (y por qué así) ──────────────────────────────────────────
 * UNA fila de `mkt_tasks` por persona y por semana, con el plan entero en
 * `descripcion` como JSON. NO una fila por franja. Dos razones:
 *
 *   1. `fn_mkt_persecucion_tick` persigue TODA tarea con `due_at` que no esté
 *      'hecha': aviso 1h antes, 10 min antes, "es la hora" y el resumen de la
 *      mañana. Con 95 franjas por semana, cada persona recibiría decenas de
 *      avisos diarios por su propio plan. Duke tiene la persecución en `on`.
 *   2. El plan se lee y se escribe SIEMPRE completo (es una hoja), nunca franja
 *      por franja. Una fila es más simple y más rápido que 95.
 *
 * La fila va con `due_at = null` y `estado = 'en_curso'`, que es justo la
 * combinación que ningún bloque del perseguidor mira (A y B exigen `due_at` en
 * ventana, C exige `por_hacer`, E exige `due_at not null`). El plan NO notifica:
 * para eso está el botón «A mi agenda» de cada franja, que crea la tarea REAL
 * con su hora y ahí sí entran los recordatorios. Esa es la conexión entre el
 * plan y la agenda, y es opt-in — como debe ser.
 *
 * Sin migración: usa tablas y columnas que ya existen.
 *
 * ── ZONA HORARIA ─────────────────────────────────────────────────────────────
 * El plan es una grilla de día y hora local, no de instantes: se guarda como
 * texto ("lun|09:30"), así que no lo corre ningún cambio de huso. Solo al mandar
 * una franja a la agenda se arma un timestamp real, con la hora local del
 * navegador (el equipo entero está en Cancún).
 *
 * Aesthetic: paleta `T` del theme de App.jsx, isLight por luminancia (patrón
 * Caja.jsx/Marketing.jsx).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CalendarRange, ChevronLeft, ChevronRight, Check, Plus, X,
  CalendarPlus, Users, AlertCircle,
} from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useViewport";
import {
  DIAS, FRANJAS, lunesDe, isoDe, fechaCorta, planVacio, parsePlan,
  franjasLlenas, tituloFilaDe,
} from "./plan-semanal";

export default function PlanSemanal({ T, onOpenCopilot }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const orgId = user?.organizationId;

  const isLight = parseInt(String(T?.bg || "#000000").replace("#", "").slice(0, 2), 16) > 128;
  const txt    = T?.txt    || (isLight ? "#0B1220" : "#E2E8F0");
  const txt2   = T?.txt2   || (isLight ? "#3B4A61" : "#8B99AE");
  const txt3   = T?.txt3   || (isLight ? "#7A8699" : "#4A5568");
  const accent = T?.accent || (isLight ? "#0D9A76" : "#6EE7C2");
  const glass  = T?.glass  || (isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.032)");
  const bd     = T?.border || (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)");
  const AMBER  = isLight ? "#D97706" : "#FBBF24";

  // Quien revisa (líder) puede abrir el plan de otra persona; el resto ve el suyo.
  const esLider = ["super_admin", "admin", "director", "ceo"].includes(user?.role) || user?.isMarketingAdmin === true;

  const [lunes, setLunes]   = useState(() => lunesDe(new Date()));
  const [quien, setQuien]   = useState(user?.id || null);
  const [gente, setGente]   = useState([]);
  const [plan, setPlan]     = useState(planVacio);
  const [rowId, setRowId]   = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardadoAt, setGuardadoAt] = useState(null);
  const [error, setError]   = useState(null);
  const [diaMovil, setDiaMovil] = useState(() => DIAS[Math.min((new Date().getDay() + 6) % 7, 6)].k);
  const [nuevaPrio, setNuevaPrio] = useState("");

  useEffect(() => { if (user?.id && !quien) setQuien(user.id); }, [user?.id, quien]);

  const semanaIso = useMemo(() => isoDe(lunes), [lunes]);
  const tituloFila = useMemo(() => tituloFilaDe(lunes), [lunes]);
  const domingo = useMemo(() => { const d = new Date(lunes); d.setDate(d.getDate() + 6); return d; }, [lunes]);
  const fechaDe = useCallback((idx) => { const d = new Date(lunes); d.setDate(d.getDate() + idx); return d; }, [lunes]);

  const esMio = quien === user?.id;

  /* ── Gente (solo para el selector del líder) ── */
  useEffect(() => {
    if (!esLider || !orgId) return;
    let vivo = true;
    supabase.from("profiles").select("id, name, role").eq("organization_id", orgId).eq("active", true)
      .then(({ data }) => { if (vivo) setGente(data || []); });
    return () => { vivo = false; };
  }, [esLider, orgId]);

  /* ── Cargar el plan de la semana ── */
  useEffect(() => {
    if (!orgId || !quien) return;
    let vivo = true;
    setCargando(true); setError(null);
    supabase.from("mkt_tasks")
      .select("id, descripcion, updated_at")
      .eq("organization_id", orgId).eq("assignee_id", quien)
      .eq("origen", "plan_semanal").eq("titulo", tituloFila)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }).limit(1)
      .then(({ data, error: e }) => {
        if (!vivo) return;
        if (e) { setError("No pude cargar el plan. Actualiza la página."); setCargando(false); return; }
        const fila = data?.[0];
        setRowId(fila?.id || null);
        setPlan(parsePlan(fila?.descripcion));
        setGuardadoAt(fila?.updated_at || null);
        setCargando(false);
      });
    return () => { vivo = false; };
  }, [orgId, quien, tituloFila]);

  /* ── Guardado ──────────────────────────────────────────────────────────────
     Debounce de 900ms: se escribe una hoja completa, no hace falta una ida por
     tecla. El id de la fila se conserva en un ref para que dos guardados
     seguidos no creen dos filas de la misma semana. */
  const rowIdRef  = useRef(null);
  const timerRef  = useRef(null);
  const pendiente = useRef(null);
  useEffect(() => { rowIdRef.current = rowId; }, [rowId]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const persistir = useCallback(async (siguiente) => {
    if (!orgId || !quien) return;
    setGuardando(true); setError(null);
    const descripcion = JSON.stringify(siguiente);
    try {
      if (rowIdRef.current) {
        const { error: e } = await supabase.from("mkt_tasks")
          .update({ descripcion, updated_at: new Date().toISOString() })
          .eq("id", rowIdRef.current);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase.from("mkt_tasks").insert({
          organization_id: orgId,
          assignee_id: quien,
          created_by: user?.id || quien,
          titulo: tituloFila,
          descripcion,
          // due_at null + en_curso = invisible para el perseguidor (ver cabecera).
          due_at: null,
          estado: "en_curso",
          origen: "plan_semanal",
        }).select("id").single();
        if (e) throw e;
        rowIdRef.current = data.id;
        setRowId(data.id);
      }
      setGuardadoAt(new Date().toISOString());
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
    } finally {
      setGuardando(false);
    }
  }, [orgId, quien, tituloFila, user?.id]);

  const cambiar = useCallback((mutador) => {
    setPlan(prev => {
      const siguiente = mutador(prev);
      pendiente.current = siguiente;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { persistir(pendiente.current); }, 900);
      return siguiente;
    });
  }, [persistir]);

  const setSlot = useCallback((dia, hora, valor) => {
    cambiar(p => {
      const slots = { ...p.slots };
      const k = `${dia}|${hora}`;
      if (valor && valor.trim()) slots[k] = valor; else delete slots[k];
      return { ...p, slots };
    });
  }, [cambiar]);

  /* ── Mandar una franja a la agenda (ahí sí hay recordatorios) ──────────────
     Los dos estados van ANTES de la función que los usa: un useCallback que
     referencia consts declaradas más abajo es la trampa de TDZ que ya nos costó
     un hotfix (v334) — el build de Vite no la detecta. */
  const [agendando, setAgendando] = useState(null);
  // Franjas ya mandadas a la agenda en esta sesión (para no duplicarlas de a dos toques).
  const [agendados, setAgendados] = useState(() => new Set());
  useEffect(() => { setAgendados(new Set()); }, [semanaIso, quien]);

  const aLaAgenda = useCallback(async (diaIdx, hora, texto) => {
    const k = `${DIAS[diaIdx].k}|${hora}`;
    setAgendando(k);
    try {
      const d = fechaDe(diaIdx);
      const [hh, mm] = hora.split(":").map(Number);
      const cuando = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0);
      const { error: e } = await supabase.from("mkt_tasks").insert({
        organization_id: orgId,
        assignee_id: quien,
        created_by: user?.id || quien,
        titulo: texto.slice(0, 200),
        due_at: cuando.toISOString(),
        estado: "por_hacer",
        origen: "plan_semanal_agenda",
      });
      if (e) throw e;
      setAgendados(prev => new Set(prev).add(k));
    } catch (e) {
      setError(`No se pudo agendar: ${e.message}`);
    } finally {
      setAgendando(null);
    }
  }, [orgId, quien, user?.id, fechaDe]);

  /* ── Estilos ── */
  const card = { background: glass, border: `1px solid ${bd}`, borderRadius: 14, padding: isMobile ? 13 : 17 };
  const celda = {
    width: "100%", boxSizing: "border-box", border: "none", outline: "none",
    background: "transparent", color: txt, fontFamily: font, fontSize: 12.6,
    padding: "7px 8px", borderRadius: 7,
  };
  const btn = (activo) => ({
    cursor: "pointer", padding: "7px 11px", borderRadius: 9, fontFamily: font, fontSize: 12.5,
    background: activo ? `${accent}1F` : "transparent",
    border: `1px solid ${activo ? `${accent}55` : bd}`, color: activo ? accent : txt2,
  });

  const llenas = useMemo(() => franjasLlenas(plan), [plan]);

  /* ── Una franja (celda) ── */
  const Franja = ({ diaIdx, hora }) => {
    const dia = DIAS[diaIdx].k;
    const k = `${dia}|${hora}`;
    const valor = plan.slots[k] || "";
    const yaAgendada = agendados.has(k);
    return (
      <div style={{ position: "relative", display: "flex", alignItems: "center", borderLeft: `1px solid ${bd}`, minWidth: 0 }}>
        <input
          value={valor}
          onChange={e => setSlot(dia, hora, e.target.value)}
          disabled={!esMio}
          placeholder=""
          title={valor}
          style={{ ...celda, cursor: esMio ? "text" : "default", opacity: esMio ? 1 : 0.85 }}
        />
        {esMio && valor.trim() && (
          <button
            onClick={() => aLaAgenda(diaIdx, hora, valor)}
            disabled={agendando === k || yaAgendada}
            title={yaAgendada ? "Ya está en tu agenda" : "Mandar a mi agenda (con recordatorios)"}
            style={{
              position: "absolute", right: 3, cursor: yaAgendada ? "default" : "pointer",
              background: "transparent", border: "none", padding: 3, lineHeight: 0,
              color: yaAgendada ? accent : txt3, opacity: yaAgendada ? 1 : 0.75,
            }}
          >
            {yaAgendada ? <Check size={12} /> : <CalendarPlus size={12} />}
          </button>
        )}
      </div>
    );
  };

  const diasVisibles = isMobile ? [DIAS.findIndex(d => d.k === diaMovil)] : DIAS.map((_, i) => i);

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Encabezado ── */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${accent}18`, border: `1px solid ${bd}`,
        }}>
          <CalendarRange size={19} color={accent} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: fontDisp, fontSize: isMobile ? 15 : 16.5, color: txt, fontWeight: 600 }}>
            Plan Semanal
          </div>
          <div style={{ fontSize: 12.5, color: txt3, marginTop: 2 }}>
            Semana del {fechaCorta(lunes)} al {fechaCorta(domingo)}
            {llenas > 0 && ` · ${llenas} ${llenas === 1 ? "franja" : "franjas"}`}
            {guardando ? " · guardando…" : guardadoAt ? " · guardado" : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <button onClick={() => setLunes(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}
                  title="Semana anterior" style={{ ...btn(false), padding: "7px 9px" }}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setLunes(lunesDe(new Date()))} style={btn(isoDe(lunes) === isoDe(lunesDe(new Date())))}>
            Esta semana
          </button>
          <button onClick={() => setLunes(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}
                  title="Semana siguiente" style={{ ...btn(false), padding: "7px 9px" }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Selector de persona (líderes: la revisión del viernes) ── */}
      {esLider && gente.length > 0 && (
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: isMobile ? 11 : 13 }}>
          <Users size={14} color={txt3} />
          <span style={{ fontSize: 12.5, color: txt2 }}>Revisar el plan de:</span>
          <select
            value={quien || ""}
            onChange={e => setQuien(e.target.value)}
            style={{
              padding: "7px 10px", borderRadius: 9, fontFamily: font, fontSize: 12.5,
              backgroundColor: isLight ? "#FFFFFF" : "rgba(255,255,255,0.045)",
              color: txt, border: `1px solid ${bd}`, colorScheme: isLight ? "light" : "dark",
            }}
          >
            {gente.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.id === user?.id ? " (yo)" : ""}</option>
            ))}
          </select>
          {!esMio && (
            <span style={{ fontSize: 11.5, color: AMBER, display: "flex", alignItems: "center", gap: 5 }}>
              <AlertCircle size={12} /> Solo lectura: este plan lo edita su dueño
            </span>
          )}
        </div>
      )}

      {error && (
        <div style={{ ...card, borderColor: `${AMBER}66`, color: AMBER, fontSize: 12.5, padding: 12 }}>{error}</div>
      )}

      {/* ── Días en el celular (la grilla de 7 no entra) ── */}
      {isMobile && (
        <div style={{ display: "flex", gap: 5, overflowX: "auto" }}>
          {DIAS.map((d, i) => (
            <button key={d.k} onClick={() => setDiaMovil(d.k)} style={{ ...btn(diaMovil === d.k), flexShrink: 0 }}>
              {d.c} {fechaDe(i).getDate()}
            </button>
          ))}
        </div>
      )}

      {/* ── La grilla ── */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {cargando ? (
          <div style={{ padding: 22, fontSize: 13, color: txt3 }}>Cargando el plan…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: isMobile ? undefined : 760 }}>
              {/* Encabezado de días */}
              <div style={{
                display: "grid",
                gridTemplateColumns: `64px repeat(${diasVisibles.length}, minmax(0, 1fr))`,
                borderBottom: `1px solid ${bd}`,
                background: isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.028)",
              }}>
                <div style={{ padding: "9px 8px", fontSize: 11, color: txt3, fontWeight: 600 }}>Hora</div>
                {diasVisibles.map(i => {
                  const hoy = isoDe(fechaDe(i)) === isoDe(new Date());
                  return (
                    <div key={DIAS[i].k} style={{
                      padding: "9px 8px", borderLeft: `1px solid ${bd}`, textAlign: "center",
                      fontSize: 11.5, fontWeight: 650, color: hoy ? accent : txt2,
                      fontFamily: fontDisp, letterSpacing: "-0.01em",
                    }}>
                      {isMobile ? DIAS[i].l : DIAS[i].c}
                      <span style={{ fontWeight: 400, color: txt3 }}> {fechaDe(i).getDate()}</span>
                    </div>
                  );
                })}
              </div>

              {/* Franjas */}
              {FRANJAS.map((hora, fi) => (
                <div key={hora} style={{
                  display: "grid",
                  gridTemplateColumns: `64px repeat(${diasVisibles.length}, minmax(0, 1fr))`,
                  borderBottom: fi === FRANJAS.length - 1 ? "none" : `1px solid ${bd}`,
                  background: hora.endsWith(":00") ? "transparent" : (isLight ? "rgba(15,23,42,0.012)" : "rgba(255,255,255,0.012)"),
                }}>
                  <div style={{
                    padding: "7px 8px", fontSize: 11, color: hora.endsWith(":00") ? txt2 : txt3,
                    fontWeight: hora.endsWith(":00") ? 600 : 400, fontVariantNumeric: "tabular-nums",
                  }}>{hora}</div>
                  {diasVisibles.map(i => <Franja key={`${DIAS[i].k}-${hora}`} diaIdx={i} hora={hora} />)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Notas + Tareas de prioridad (las dos cajas de la hoja) ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>

        <div style={card}>
          <div style={{ fontSize: 11.5, fontWeight: 650, color: txt2, letterSpacing: "0.04em", marginBottom: 8 }}>NOTAS</div>
          <textarea
            value={plan.notas}
            onChange={e => cambiar(p => ({ ...p, notas: e.target.value }))}
            disabled={!esMio}
            rows={5}
            placeholder={esMio ? "Lo que haga falta recordar de esta semana…" : ""}
            style={{
              width: "100%", boxSizing: "border-box", resize: "vertical",
              padding: "9px 11px", borderRadius: 10, fontFamily: font, fontSize: 13, lineHeight: 1.5,
              backgroundColor: isLight ? "#FFFFFF" : "rgba(255,255,255,0.045)",
              color: txt, border: `1px solid ${bd}`, outline: "none",
            }}
          />
        </div>

        <div style={card}>
          <div style={{ fontSize: 11.5, fontWeight: 650, color: txt2, letterSpacing: "0.04em", marginBottom: 8 }}>
            TAREAS DE PRIORIDAD
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {plan.prioridades.length === 0 && (
              <div style={{ fontSize: 12.5, color: txt3 }}>Sin tareas de prioridad esta semana.</div>
            )}
            {plan.prioridades.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => esMio && cambiar(p => ({
                    ...p, prioridades: p.prioridades.map((x, j) => j === i ? { ...x, hecha: !x.hecha } : x),
                  }))}
                  disabled={!esMio}
                  title={t.hecha ? "Marcar como pendiente" : "Marcar como hecha"}
                  style={{
                    width: 17, height: 17, flexShrink: 0, borderRadius: 5, cursor: esMio ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: t.hecha ? `${accent}22` : "transparent",
                    border: `1px solid ${t.hecha ? `${accent}66` : bd}`, color: accent, padding: 0,
                  }}
                >
                  {t.hecha && <Check size={11} />}
                </button>
                <span style={{
                  fontSize: 13, color: t.hecha ? txt3 : txt, flex: 1, minWidth: 0,
                  textDecoration: t.hecha ? "line-through" : "none",
                }}>{t.texto}</span>
                {esMio && (
                  <button
                    onClick={() => cambiar(p => ({ ...p, prioridades: p.prioridades.filter((_, j) => j !== i) }))}
                    title="Quitar" style={{ background: "transparent", border: "none", cursor: "pointer", color: txt3, padding: 2, lineHeight: 0 }}
                  ><X size={13} /></button>
                )}
              </div>
            ))}
          </div>

          {esMio && (
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input
                value={nuevaPrio}
                onChange={e => setNuevaPrio(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && nuevaPrio.trim()) {
                    cambiar(p => ({ ...p, prioridades: [...p.prioridades, { texto: nuevaPrio.trim(), hecha: false }] }));
                    setNuevaPrio("");
                  }
                }}
                placeholder="Agregar tarea de prioridad…"
                style={{
                  flex: 1, minWidth: 0, padding: "8px 11px", borderRadius: 9, fontFamily: font, fontSize: 12.8,
                  backgroundColor: isLight ? "#FFFFFF" : "rgba(255,255,255,0.045)",
                  color: txt, border: `1px solid ${bd}`, outline: "none",
                }}
              />
              <button
                onClick={() => {
                  if (!nuevaPrio.trim()) return;
                  cambiar(p => ({ ...p, prioridades: [...p.prioridades, { texto: nuevaPrio.trim(), hecha: false }] }));
                  setNuevaPrio("");
                }}
                disabled={!nuevaPrio.trim()}
                style={{ ...btn(!!nuevaPrio.trim()), cursor: nuevaPrio.trim() ? "pointer" : "default" }}
              ><Plus size={13} /></button>
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: txt3, lineHeight: 1.55 }}>
        Se guarda solo mientras escribes. El plan no te manda recordatorios: si quieres que una franja
        te avise, usa <CalendarPlus size={11} style={{ verticalAlign: "-1px" }} /> y pasa a tu agenda.
        {onOpenCopilot && " También puedes dictarle a tu Copilot lo que vas cerrando."}
        {" "}Los líderes lo revisan el viernes.
      </div>
    </div>
  );
}
