/**
 * hooks/useCopilotInbox.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bandeja/Notificaciones del módulo Copilot: monitorea la tabla tg_bot_activity
 * para detectar nuevas respuestas del asistente IA y notificar en la campanita
 * y en segundo plano (similar al patrón de useWhatsAppInbox).
 *
 * Cada asesor ve solo su propia actividad (RLS en RPCs / filtrado por usuario)
 * y el contador de no leídos se almacena por usuario en localStorage para no
 * requerir columna adicional ni migraciones en DB.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { getCopilotActivity } from "../lib/telegram";

const POLL_MS = 35000;
const DEBOUNCE_MS = 400;
const CACHE_PREFIX = "stratos_copilot_seen_";

export function useCopilotInbox({ enabled, activeView }) {
  const { user } = useAuth();
  const cacheKey = user?.id ? `${CACHE_PREFIX}${user.id}` : null;
  const [messages, setMessages] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const seqRef = useRef(0);

  const calculateUnread = useCallback((list, seenIso) => {
    if (!Array.isArray(list) || !seenIso) return 0;
    const seenTime = new Date(seenIso).getTime();
    return list.filter(m => m.role === "ai" && m.occurred_at && new Date(m.occurred_at).getTime() > seenTime).length;
  }, []);

  const load = useCallback(async () => {
    if (!enabled || !cacheKey) return;
    const seq = ++seqRef.current;
    const { messages: list, error } = await getCopilotActivity(25);
    if (seq !== seqRef.current) return;
    if (!error && Array.isArray(list)) {
      setMessages(list);
      let seenIso = localStorage.getItem(cacheKey);
      // Si el usuario nunca ha abierto el copilot o no hay marca, grabamos la más reciente para no saturar con el pasado
      if (!seenIso && list.length > 0) {
        const newestAi = list.find(m => m.role === "ai");
        seenIso = newestAi?.occurred_at || new Date().toISOString();
        localStorage.setItem(cacheKey, seenIso);
      }
      setTotalUnread(calculateUnread(list, seenIso));
    }
    setLoading(false);
  }, [enabled, cacheKey, calculateUnread]);

  useEffect(() => {
    if (!enabled || !cacheKey) {
      setMessages([]);
      setTotalUnread(0);
      setLoading(false);
      return;
    }
    let debounceTimer = null;
    load();

    const onCopilotActivity = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(load, DEBOUNCE_MS);
    };

    const ch = supabase
      .channel(`copilot-inbox-${user?.id || "global"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tg_bot_activity" },
        onCopilotActivity
      )
      .subscribe();

    const tick = () => {
      if (!document.hidden) load();
    };
    const pollTimer = setInterval(tick, POLL_MS);

    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch);
      clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, cacheKey, load, user?.id]);

  /** Marca como leídos los mensajes del Copilot actualizando el último timestamp visto */
  const markRead = useCallback(() => {
    if (!enabled || !cacheKey) return;
    const newestAi = messages.find(m => m.role === "ai");
    const nowIso = newestAi?.occurred_at || new Date().toISOString();
    localStorage.setItem(cacheKey, nowIso);
    setTotalUnread(0);
  }, [enabled, cacheKey, messages]);

  // Si la vista actual es copilot y el tab está activo, marcar como leído al vuelo
  useEffect(() => {
    if (activeView === "copilot" && !document.hidden && totalUnread > 0) {
      markRead();
    }
  }, [activeView, totalUnread, markRead]);

  const lastAiMessage = useMemo(() => messages.find(m => m.role === "ai"), [messages]);

  return useMemo(
    () => ({ messages, totalUnread, lastAiMessage, loading, refresh: load, markRead }),
    [messages, totalUnread, lastAiMessage, loading, load, markRead]
  );
}
