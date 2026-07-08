-- 074_whatsapp_reads_y_bandeja.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Bandeja de WhatsApp (módulo "WhatsApp" del CRM + notificaciones de la campana).
--
-- Aporta:
--   • Tabla `whatsapp_reads` — marca de "hasta cuándo leyó" cada usuario por
--     conversación (lead). Es POR USUARIO: el no-leído de Cecilia no depende del
--     de un admin. RLS: cada quien ve/marca solo lo suyo; nadie borra.
--   • `fn_wa_conversations()` — lista de conversaciones (último mensaje + no
--     leídos del usuario actual). SECURITY INVOKER: la RLS de whatsapp_messages
--     / leads filtra sola (asesor ve SUS leads, admin los de la org).
--   • `fn_wa_mark_read(lead_id)` — marca una conversación como leída (upsert).
--
-- NOTA: `fn_wa_conversations` se REESCRIBE en 075 para soportar multimedia
-- (preview "📷 Foto" / "🎤 Audio" cuando el último mensaje no tiene texto).
-- Este archivo documenta el estado aplicado a prod (stratos-prod).
-- Reversible: DROP de la tabla/funciones (no destruye whatsapp_messages).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tabla de marcas de lectura ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_reads (
  user_id         uuid NOT NULL DEFAULT auth.uid(),
  lead_id         uuid NOT NULL,
  organization_id uuid NOT NULL,
  last_read_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_wa_reads_lead ON public.whatsapp_reads(lead_id);

ALTER TABLE public.whatsapp_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_reads_select    ON public.whatsapp_reads;
DROP POLICY IF EXISTS wa_reads_insert    ON public.whatsapp_reads;
DROP POLICY IF EXISTS wa_reads_update    ON public.whatsapp_reads;
DROP POLICY IF EXISTS wa_reads_no_delete ON public.whatsapp_reads;

CREATE POLICY wa_reads_select ON public.whatsapp_reads
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY wa_reads_insert ON public.whatsapp_reads
  FOR INSERT WITH CHECK (user_id = auth.uid() AND organization_id = current_organization_id());
CREATE POLICY wa_reads_update ON public.whatsapp_reads
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Nadie borra marcas de lectura (histórico intacto).
CREATE POLICY wa_reads_no_delete ON public.whatsapp_reads
  FOR DELETE USING (false);

-- ── Lista de conversaciones (versión inicial; 075 la reescribe con media) ─────
CREATE OR REPLACE FUNCTION public.fn_wa_conversations()
RETURNS TABLE(
  lead_id uuid, lead_name text, lead_phone text, asesor_name text, stage text,
  last_content text, last_direction text, last_sender text,
  last_at timestamptz, unread_count bigint
)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH ranked AS (
    SELECT m.lead_id, m.content, m.direction, m.sender_name, m.message_created_at,
           row_number() OVER (PARTITION BY m.lead_id ORDER BY m.message_created_at DESC) AS rn
    FROM public.whatsapp_messages m
    WHERE m.lead_id IS NOT NULL
  ),
  last_msg AS (SELECT * FROM ranked WHERE rn = 1),
  unread AS (
    SELECT m.lead_id, count(*) AS c
    FROM public.whatsapp_messages m
    LEFT JOIN public.whatsapp_reads r
      ON r.lead_id = m.lead_id AND r.user_id = auth.uid()
    WHERE m.direction = 'in' AND m.lead_id IS NOT NULL
      AND m.message_created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
    GROUP BY m.lead_id
  )
  SELECT lm.lead_id, ld.name, ld.phone, ld.asesor_name, ld.stage,
         COALESCE(NULLIF(lm.content, ''), ''),
         lm.direction, lm.sender_name, lm.message_created_at,
         COALESCE(u.c, 0)
  FROM last_msg lm
  JOIN public.leads ld ON ld.id = lm.lead_id AND ld.deleted_at IS NULL
  LEFT JOIN unread u ON u.lead_id = lm.lead_id
  ORDER BY lm.message_created_at DESC
  LIMIT 200;
$$;

-- ── Marcar conversación como leída ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_wa_mark_read(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.whatsapp_reads (user_id, lead_id, organization_id, last_read_at)
  VALUES (auth.uid(), p_lead_id, current_organization_id(), now())
  ON CONFLICT (user_id, lead_id) DO UPDATE SET last_read_at = now();
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Solo usuarios logueados (la RLS hace el resto). Nunca anon.
REVOKE ALL ON FUNCTION public.fn_wa_conversations()          FROM public, anon;
REVOKE ALL ON FUNCTION public.fn_wa_mark_read(uuid)          FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_wa_conversations()       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_wa_mark_read(uuid)       TO authenticated, service_role;
