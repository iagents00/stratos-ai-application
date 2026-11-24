import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";

export const states = {
  ready: "Por hacer", active: "En curso", blocked: "Bloqueado",
  review: "En revisión", approved: "Aprobada",
};

export const deliveryState = (item) => item.waiting && item.state === "ready" ? "blocked" : item.state;

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dayInZone(zone, date = new Date()) {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone:zone, year:"numeric", month:"2-digit", day:"2-digit" });
  const parts = Object.fromEntries(format.formatToParts(date).map(({type,value}) => [type,value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addCalendarDays(day, count) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate()+count);
  return date.toISOString().slice(0,10);
}

export function dayLabel(day, zone) {
  if (!day) return "Sin fecha";
  const today = zone ? dayInZone(zone) : localDay();
  if (day === today) return "Hoy";
  if (day === addCalendarDays(today,1)) return "Mañana";
  return new Intl.DateTimeFormat("es-MX", { day:"numeric", month:"short", timeZone:"UTC" }).format(new Date(`${day}T12:00:00Z`));
}

export function scheduleLabel(item) {
  if (!item.scheduled_at || !item.schedule_zone) return dayLabel(item.due_on);
  try {
    const clock = new Intl.DateTimeFormat("es-MX", {
      timeZone: item.schedule_zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(new Date(item.scheduled_at));
    const location = item.schedule_zone.split("/").at(-1).replaceAll("_", " ");
    return `${dayLabel(item.due_on,item.schedule_zone)} · ${clock} (${location})`;
  } catch {
    return dayLabel(item.due_on);
  }
}

export function bySchedule(a, b) {
  return (a.due_on || "z").localeCompare(b.due_on || "z") ||
    (a.scheduled_at || "z").localeCompare(b.scheduled_at || "z") || byPriority(a,b);
}

export function byPriority(a, b) {
  return a.priority - b.priority || (a.due_on || "z").localeCompare(b.due_on || "z") ||
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
}

export async function loadProjects(org, delivery = null, signal) {
  const response = supabase.rpc("work_project_snapshot", { p_org: org, p_delivery: delivery });
  return await (signal ? response.abortSignal(signal) : response);
}

export async function changeProject(org, action, payload) {
  return await supabase.rpc("work_project_action", { p_org: org, p_action: action, p_data: payload });
}

export async function askProjects(org, delivery, text, history = []) {
  return invoke({ organization: org, delivery: delivery || null, mode: "help", text, history });
}

export function draftProjectWeek(org, text, zone, project) {
  return invoke({ organization: org, delivery: null, mode: "plan", text, zone, project: project || null });
}

export async function applyProjectWeek(org, request, zone, plan) {
  return await supabase.rpc("work_project_apply_week", { p_org: org, p_request: request, p_zone: zone, p_plan: plan });
}

export async function runProjectAgent(org, item) {
  return invoke({ organization: org, delivery: item.id, mode: "report", version: item.version });
}

async function invoke(body) {
  try {
    const { data, error } = await supabase.functions.invoke("work-project-copilot", { body, timeout: body.mode === "plan" ? 105000 : 60000 });
    if (!error) return data;
    const detail = await error.context?.json?.().catch(() => null);
    return { error: detail?.error || "No pudimos confirmar la respuesta. Actualiza antes de volver a intentar." };
  } catch {
    return { error: "No pudimos confirmar la respuesta. Actualiza antes de volver a intentar." };
  }
}

export function useProjects(org, enabled = true) {
  const [state, setState] = useState({ org: null, data: null, error: "", loading: true });
  const loadRef = useRef(null);
  const reload = useCallback(async () => {
    if (!org || !enabled) return null;
    loadRef.current?.abort();
    const controller = new AbortController();
    loadRef.current = controller;
    setState((previous) => ({ org, data: previous.org === org ? previous.data : null, loading: true, error: "" }));
    let result;
    try {
      result = await loadProjects(org, null, controller.signal);
    } catch {
      result = { error: true };
    }
    if (controller.signal.aborted) return null;
    setState((previous) => ({
      org,
      loading: false,
      data: result.error ? previous.data : result.data,
      error: result.error ? "No se pudieron cargar los proyectos. Vuelve a intentar." : "",
    }));
    return result.data;
  }, [org, enabled]);
  useEffect(() => {
    reload();
    return () => loadRef.current?.abort();
  }, [reload]);
  return { ...(state.org === org ? state : { data: null, error: "", loading: true }), reload };
}
