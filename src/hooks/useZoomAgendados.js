/**
 * hooks/useZoomAgendados.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de datos del panel "Control de Zooms". Lee y muta la tabla
 * public.zoom_agendados (migraciones 027 + 083) para la organización del
 * usuario activo. RLS aísla por organización, así que todas las queries van
 * con el anon key del usuario logueado — no se filtra org a mano (igual que
 * useScheduledCalls).
 *
 * Devuelve:
 *   · rows       — array de Zooms (orden cronológico por fecha_zoom).
 *   · loading    — true durante el primer fetch.
 *   · error      — null | "missing_table" | string. "missing_table" = la
 *                  migración 027/083 aún no se aplicó en este proyecto.
 *   · hasExtCols — true si la tabla ya tiene las columnas v2 (discovery,
 *                  calentito — migración 083). Si es false, el panel oculta
 *                  esas features y las mutaciones no envían esos campos.
 *   · refetch()  — recarga manual (se llama tras cada mutación).
 *   · createRow / updateRow / removeRow — CRUD; resuelven con { error } y
 *                  refrescan la lista al terminar.
 *
 * Refresca solo en mount + al volver a la pestaña (visibilitychange). NO hace
 * polling por intervalo: es un panel editable y un refetch a destiempo no debe
 * competir con el modal de edición (que vive en estado local del panel).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { readAllRows } from "../lib/read-all-rows.js";

const TABLE = "zoom_agendados";

const BASE_COLS =
  "id, organization_id, lead_id, fecha_agendado, fecha_zoom, hora, liner, " +
  "presentador_principal, presentador_apoyo, cliente, proyecto, estatus, " +
  "comentarios, created_at, updated_at";
// Columnas v2 (migración 083). Se intentan primero; si el proyecto aún no las
// tiene, caemos a BASE_COLS y el panel esconde discovery/calentito.
const EXT_COLS = BASE_COLS + ", discovery, calentito";

// Postgres "undefined_table" (42P01) o el código de PostgREST cuando la tabla
// no existe todavía → la migración 027/083 no se ha aplicado en este proyecto.
function isMissingTable(error) {
  if (!error) return false;
  const code = error.code || "";
  const msg = (error.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (msg.includes(TABLE) && msg.includes("does not exist")) ||
    msg.includes("could not find the table")
  );
}

// Postgres "undefined_column" (42703) o PostgREST "column not in schema cache"
// (PGRST204) → la tabla existe pero sin las columnas v2 (falta migración 083).
function isMissingColumn(error) {
  if (!error) return false;
  const code = error.code || "";
  const msg = (error.message || "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    (msg.includes("column") && (msg.includes("does not exist") || msg.includes("schema cache")))
  );
}

export function useZoomAgendados({ enabled = true } = {}) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasExtCols, setHasExtCols] = useState(true);
  // Ref espejo para que refetch no cambie de identidad al degradar columnas
  // (si dependiera del state, el useEffect re-dispararía el fetch en loop).
  const extColsRef = useRef(true);
  const requestId = useRef(0);

  const orgId = user?.organizationId || null;
  const isDemo = !!user?.isDemo;

  const refetch = useCallback(async () => {
    const request = ++requestId.current;
    if (!enabled || !orgId || isDemo) {
      setRows([]);
      setError(null);
      setLoading(false);
      return { error: null };
    }
    setLoading(true);
    const runSelect = cols => readAllRows(() => supabase
      .from(TABLE).select(cols).eq("organization_id", orgId)
      .order("fecha_zoom", { ascending: true, nullsFirst: false })
      .order("hora", { ascending: true, nullsFirst: true }).order("id"));
    let result = await runSelect(extColsRef.current ? EXT_COLS : BASE_COLS);
    if (request !== requestId.current) return { error: null };
    if (result.error && extColsRef.current && isMissingColumn(result.error)) {
      extColsRef.current = false;
      setHasExtCols(false);
      result = await runSelect(BASE_COLS);
    }
    if (request !== requestId.current) return { error: null };
    const message = result.error ? (isMissingTable(result.error) ? "missing_table" : result.error.message || "No se pudo cargar la agenda.") : null;
    setError(message);
    if (!message) setRows(result.data);
    setLoading(false);
    return { error: message };
  }, [orgId, isDemo, enabled]);

  useEffect(() => {
    extColsRef.current = true;
    // Reset the previous organization before the next external data subscription.
    setHasExtCols(true);
    setRows([]);
    refetch();
    const onVis = () => { if (!document.hidden) refetch(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      // This is a request generation token, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++requestId.current;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refetch]);

  // Realtime: los triggers del CRM (migración 087) escriben en zoom_agendados;
  // esta suscripción refresca el panel solo, sin que el usuario recargue.
  // RLS filtra los eventos por organización. removeChannel SIEMPRE en cleanup.
  //
  // ⚠️ El nombre del canal debe ser ÚNICO POR MONTAJE: supabase.channel(nombre)
  // devuelve la MISMA instancia si el nombre ya existe, y agregarle callbacks
  // a un canal ya suscrito lanza "cannot add postgres_changes callbacks ...
  // after subscribe()" — con nombre fijo, salir y volver a entrar a la
  // pestaña de Zooms tumbaba el panel entero ("Algo salió mal", bug de Ivan).
  // Además: el realtime es un extra, nunca debe poder romper el panel →
  // try/catch alrededor de todo.
  useEffect(() => {
    if (!enabled || !orgId || isDemo) return;
    let ch = null;
    try {
      ch = supabase
        .channel(`zoom-agendados-live-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: `organization_id=eq.${orgId}` }, () => refetch())
        .subscribe();
    } catch (e) {
      console.warn("[Control de Zooms] realtime no disponible:", e?.message || e);
      return;
    }
    return () => {
      try { if (ch) supabase.removeChannel(ch); } catch { /* noop */ }
    };
  }, [orgId, isDemo, enabled, refetch]);

  // ── Mutaciones ──────────────────────────────────────────────────────────
  // org se fija explícito en el INSERT (la policy WITH CHECK exige que coincida
  // con current_organization_id(); fijarlo evita depender del default).
  const mutate = useCallback(async (operation) => {
    if (!enabled || !orgId || isDemo) return { error: "No hay una organización activa para guardar." };
    try {
      const { error: err } = await operation();
      if (err) return { error: err.message || "No se pudo guardar el cambio." };
      const refresh = await refetch();
      return { error: null, refreshError: refresh.error };
    } catch (err) {
      return { error: err?.message || "No se pudo conectar. El cambio no se confirmó." };
    }
  }, [enabled, orgId, isDemo, refetch]);

  const createRow = useCallback(payload => mutate(() => supabase.from(TABLE)
    .insert([{ ...sanitize(payload, extColsRef.current), organization_id: orgId }])
    .select("id").single()), [mutate, orgId]);
  const updateRow = useCallback((id, patch) => mutate(() => supabase.from(TABLE)
    .update(sanitize(patch, extColsRef.current)).eq("id", id).eq("organization_id", orgId)
    .select("id").single()), [mutate, orgId]);
  const removeRow = useCallback(id => mutate(() => supabase.from(TABLE).delete()
    .eq("id", id).eq("organization_id", orgId).select("id").single()), [mutate, orgId]);

  return { rows, loading, error, hasExtCols, refetch, createRow, updateRow, removeRow };
}

// Normaliza el payload del form a columnas de la tabla. Strings vacíos → null
// (para que las fechas/horas vacías no rompan el tipo DATE en Postgres) y
// recorta solo a las columnas conocidas (ignora cualquier campo extra del form).
const COLUMNS = [
  "lead_id", "fecha_agendado", "fecha_zoom", "hora", "liner",
  "presentador_principal", "presentador_apoyo", "cliente", "proyecto",
  "estatus", "comentarios",
];
const EXT_COLUMNS = ["discovery", "calentito"];

function sanitize(obj, includeExt) {
  const cols = includeExt ? [...COLUMNS, ...EXT_COLUMNS] : COLUMNS;
  const out = {};
  for (const k of cols) {
    if (!(k in obj)) continue;
    const v = obj[k];
    out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out;
}
