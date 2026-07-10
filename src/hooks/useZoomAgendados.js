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

export function useZoomAgendados() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasExtCols, setHasExtCols] = useState(true);
  // Ref espejo para que refetch no cambie de identidad al degradar columnas
  // (si dependiera del state, el useEffect re-dispararía el fetch en loop).
  const extColsRef = useRef(true);

  const orgId = user?.organizationId || null;
  const isDemo = !!user?.isDemo;

  const refetch = useCallback(async () => {
    // Sin org real (o modo demo) no hay BD que consultar.
    if (!orgId || isDemo) {
      setRows([]);
      setLoading(false);
      return;
    }
    const runSelect = (cols) =>
      supabase
        .from(TABLE)
        .select(cols)
        .order("fecha_zoom", { ascending: true, nullsFirst: false })
        .order("hora", { ascending: true, nullsFirst: true });

    let { data, error: err } = await runSelect(extColsRef.current ? EXT_COLS : BASE_COLS);
    if (err && extColsRef.current && isMissingColumn(err)) {
      // Tabla vieja (sin migración 083): degradar a columnas base y seguir.
      extColsRef.current = false;
      setHasExtCols(false);
      ({ data, error: err } = await runSelect(BASE_COLS));
    }
    if (err) {
      setError(isMissingTable(err) ? "missing_table" : (err.message || "error"));
      setRows([]);
      setLoading(false);
      return;
    }
    setError(null);
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [orgId, isDemo]);

  useEffect(() => {
    setLoading(true);
    refetch();
    const onVis = () => { if (!document.hidden) refetch(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refetch]);

  // ── Mutaciones ──────────────────────────────────────────────────────────
  // org se fija explícito en el INSERT (la policy WITH CHECK exige que coincida
  // con current_organization_id(); fijarlo evita depender del default).
  const createRow = useCallback(async (payload) => {
    if (!orgId || isDemo) return { error: "sin-organización" };
    const { error: err } = await supabase
      .from(TABLE)
      .insert([{ ...sanitize(payload, extColsRef.current), organization_id: orgId }]);
    if (err) return { error: err.message || "error" };
    await refetch();
    return { error: null };
  }, [orgId, isDemo, refetch]);

  const updateRow = useCallback(async (id, patch) => {
    if (!orgId || isDemo) return { error: "sin-organización" };
    const { error: err } = await supabase
      .from(TABLE)
      .update(sanitize(patch, extColsRef.current))
      .eq("id", id);
    if (err) return { error: err.message || "error" };
    await refetch();
    return { error: null };
  }, [orgId, isDemo, refetch]);

  const removeRow = useCallback(async (id) => {
    if (!orgId || isDemo) return { error: "sin-organización" };
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) return { error: err.message || "error" };
    await refetch();
    return { error: null };
  }, [orgId, isDemo, refetch]);

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
