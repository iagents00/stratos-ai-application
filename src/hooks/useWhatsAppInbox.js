/**
 * hooks/useWhatsAppInbox.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bandeja de WhatsApp: lista de conversaciones (última msg + no-leídos por
 * usuario) para el módulo "WhatsApp" y las notificaciones de la campanita.
 *
 * Fuente: RPC `fn_wa_conversations()` (mig 081: SECURITY DEFINER con el MISMO
 * modelo de permisos que la RLS, evaluado UNA vez — admin/director/superadmin
 * ven toda la org; el asesor SOLO sus leads) + realtime en whatsapp_messages
 * para refrescar al instante cuando escribe un cliente.
 *
 * Se instancia UNA vez en App.jsx (evita suscripciones duplicadas) y se pasa
 * por props a la vista y a la campanita.
 *
 * Perf (ZONA CRÍTICA): removeChannel + clearInterval/clearTimeout en cleanup,
 * eventos debounced, guard de secuencia (respuesta vieja no pisa estado nuevo),
 * nada de trabajo con la pestaña oculta.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

const POLL_MS = 45000;
const DEBOUNCE_MS = 400;
/* Caché local POR USUARIO para pintado instantáneo de la bandeja (mismo patrón
   que el caché de leads del CRM): se muestra al abrir y la red refresca detrás.
   La clave incluye el user id → un asesor nunca ve el caché de otro. */
const CACHE_PREFIX = "stratos_wa_inbox_";
const CACHE_MAX = 100;

export function useWhatsAppInbox({ enabled }) {
  const { user } = useAuth();
  const cacheKey = user?.id ? `${CACHE_PREFIX}${user.id}` : null;
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const seqRef = useRef(0);
  const hydratedRef = useRef(false);

  // Pintado INSTANTÁNEO desde el caché del usuario (una sola vez por sesión).
  useEffect(() => {
    if (!enabled || !cacheKey || hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) {
          setConversations((prev) => (prev.length ? prev : arr));
          setLoading(false);
        }
      }
    } catch { /* caché corrupto: se ignora y la red manda */ }
  }, [enabled, cacheKey]);

  const load = useCallback(async () => {
    if (!enabled) return;
    const seq = ++seqRef.current;
    const { data, error } = await supabase.rpc("fn_wa_conversations");
    if (seq !== seqRef.current) return; // respuesta vieja: descartar
    if (!error && Array.isArray(data)) {
      setConversations(data);
      if (cacheKey) {
        try { localStorage.setItem(cacheKey, JSON.stringify(data.slice(0, CACHE_MAX))); }
        catch { /* cuota llena: el caché es solo una mejora */ }
      }
    }
    setLoading(false);
  }, [enabled, cacheKey]);

  useEffect(() => {
    if (!enabled) {
      setConversations([]);
      setLoading(false);
      return;
    }
    let debounceTimer = null;
    load();

    // Cliente escribió (o llegó cualquier mensaje) → refrescar la bandeja.
    // La RLS de realtime entrega a cada usuario solo lo que puede ver.
    // OJO: NO se pausa con la pestaña oculta — es justo cuando el contador del
    // título y la notificación nativa tienen que dispararse (un refetch
    // debounced disparado por evento es barato; el POLL sí queda pausado).
    const onWaMessage = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(load, DEBOUNCE_MS);
    };
    const ch = supabase
      .channel("wa-inbox-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        onWaMessage
      )
      .subscribe();

    const tick = () => {
      if (!document.hidden) load();
    };
    const pollTimer = setInterval(tick, POLL_MS);

    // Al volver a la pestaña: refrescar YA (mientras estuvo oculta pausamos
    // realtime y poll, así que el badge podía quedar viejo hasta 45s). Función
    // NOMBRADA + removeEventListener en cleanup (ZONA CRÍTICA de perf).
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
  }, [enabled, load]);

  /** Marca una conversación como leída (optimista + RPC + refresh). */
  const markRead = useCallback(
    async (leadId) => {
      if (!enabled || !leadId) return;
      setConversations((prev) =>
        prev.map((c) => (c.lead_id === leadId ? { ...c, unread_count: 0 } : c))
      );
      await supabase.rpc("fn_wa_mark_read", { p_lead_id: leadId });
    },
    [enabled]
  );

  const totalUnread = useMemo(
    () => conversations.reduce((s, c) => s + Number(c.unread_count || 0), 0),
    [conversations]
  );
  const unreadConversations = useMemo(
    () => conversations.filter((c) => Number(c.unread_count || 0) > 0),
    [conversations]
  );

  // Identidad estable del objeto devuelto: sin esto, el módulo WhatsApp (que
  // recibe `inbox` por props) re-renderiza en cada render del App (p.ej. el
  // poll de 5s), aunque los datos no cambien.
  return useMemo(
    () => ({ conversations, unreadConversations, totalUnread, loading, refresh: load, markRead }),
    [conversations, unreadConversations, totalUnread, loading, load, markRead]
  );
}
