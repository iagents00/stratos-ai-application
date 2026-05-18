/**
 * hooks/useScheduledCalls.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Devuelve un Map<phoneDigits, { id, phone_e164, scheduled_at }> con las
 * llamadas pendientes de la tabla scheduled_calls para la org del usuario
 * activo. Refresca cada 60s automáticamente (suficiente para que el contador
 * "en X minutos" no se desfase demasiado).
 *
 * Las claves del Map son los teléfonos NORMALIZADOS a solo dígitos, para
 * que el lookup tolere formatos distintos entre scheduled_calls.phone_e164
 * y leads.phone / leads.whatsapp_phone_e164.
 *
 * Hace UNA sola query para toda la org y comparte el resultado vía useMemo
 * en el caller. No querés que cada card haga su propio fetch.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

const REFRESH_MS = 60_000;
const onlyDigits = (s) => String(s || "").replace(/[^0-9]/g, "");

export function useScheduledCalls() {
  const { user } = useAuth();
  const [map, setMap] = useState(new Map());

  const refetch = useCallback(async () => {
    if (!user?.organizationId) return;
    // Modo demo no tiene BD real.
    if (user?.isDemo) return;
    const { data, error } = await supabase
      .from("scheduled_calls")
      .select("id, phone_e164, scheduled_at")
      .eq("status", "pending")
      .eq("organization_id", user.organizationId)
      .order("scheduled_at", { ascending: true });
    if (error) return;
    const m = new Map();
    for (const row of data || []) {
      const key = onlyDigits(row.phone_e164);
      if (!key) continue;
      // Si hay duplicados (no debería, pero por las dudas), nos quedamos con
      // el más cercano en el tiempo (orderBy ascending → primero es el más próximo).
      if (!m.has(key)) m.set(key, row);
    }
    setMap(m);
  }, [user?.organizationId, user?.isDemo]);

  useEffect(() => {
    refetch();
    const t = setInterval(refetch, REFRESH_MS);
    const onVis = () => { if (!document.hidden) refetch(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refetch]);

  /** Lookup helper: devuelve el row de scheduled_call para un lead (o null). */
  const get = useCallback((leadOrPhone) => {
    if (!leadOrPhone) return null;
    const phone = typeof leadOrPhone === "string"
      ? leadOrPhone
      : (leadOrPhone.whatsapp_phone_e164 || leadOrPhone.phone || "");
    const key = onlyDigits(phone);
    return key ? (map.get(key) || null) : null;
  }, [map]);

  return { map, get, refetch };
}
