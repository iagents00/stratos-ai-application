-- ════════════════════════════════════════════════════════════════════════
-- 210 — Call Center nativo en Stratos: esquema, config y separación de vías
-- ────────────────────────────────────────────────────────────────────────
-- Por qué (verificado 2026-07-28): las 3 llamadas de prueba se despacharon
-- desde la cola, pero en el historial de Retell NO EXISTEN — la última
-- llamada real de la cuenta era del 26-jul. O sea: el salto n8n -> Retell
-- está roto y falla en silencio (la fila queda 'completed' sin que suene
-- ningún teléfono).
--
-- En cambio la base SÍ llega a Retell: pg_net 0.20 devolvió HTTP 200 en
-- list-agents, list-phone-numbers y list-calls. El agente tiene versión
-- publicada (v55) y el número saliente +17479779711 existe en la cuenta.
--
-- Decisión: que Stratos llame a Retell por sí mismo. Esta migración prepara
-- el terreno; la 211 trae el marcador.
--
-- Clave para no romper lo que ya existe: la cola pasa a tener `source`.
--   · source='n8n_legacy'     -> la sigue atendiendo n8n (fn_get_pending_calls),
--                                que es como Retell agenda "márcame en 15 min".
--   · source='stratos_native' -> la atiende SOLO el marcador nativo.
-- Así las dos vías no se roban filas y no hay doble llamada.
--
-- Revertir: alter table drop de las columnas nuevas + quitar el filtro de
-- source en fn_get_pending_calls.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.scheduled_calls
  ADD COLUMN IF NOT EXISTS source          TEXT NOT NULL DEFAULT 'n8n_legacy',
  ADD COLUMN IF NOT EXISTS retell_call_id  TEXT,
  ADD COLUMN IF NOT EXISTS dispatch_status TEXT,
  ADD COLUMN IF NOT EXISTS dispatch_error  TEXT,
  ADD COLUMN IF NOT EXISTS net_request_id  BIGINT,
  ADD COLUMN IF NOT EXISTS lead_id         UUID;

COMMENT ON COLUMN public.scheduled_calls.source IS
  'Quién atiende esta fila: n8n_legacy (flujo 04, re-agendamientos de Retell) o stratos_native (marcador propio de Stratos). Evita que las dos vías se roben filas.';
COMMENT ON COLUMN public.scheduled_calls.dispatch_status IS
  'Resultado real del POST a Retell: enviado / ok / error. NULL = todavía no se intentó.';
COMMENT ON COLUMN public.scheduled_calls.net_request_id IS
  'id de pg_net para poder leer después la respuesta de Retell en net._http_response.';

CREATE INDEX IF NOT EXISTS scheduled_calls_native_due_idx
  ON public.scheduled_calls (scheduled_at)
  WHERE status = 'pending' AND source = 'stratos_native';

-- ───────── config por organización (listo para white-label) ─────────────
CREATE TABLE IF NOT EXISTS public.voice_campaign_config (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id),
  enabled         BOOLEAN     NOT NULL DEFAULT false,
  from_number     TEXT        NOT NULL,
  agent_id        TEXT        NOT NULL,
  work_start      TIME        NOT NULL DEFAULT '09:00',
  work_end        TIME        NOT NULL DEFAULT '20:00',
  work_tz         TEXT        NOT NULL DEFAULT 'America/Cancun',
  max_per_tick    INT         NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.voice_campaign_config IS
  'Config del call center por organización: desde qué número llama, qué agente usa, en qué horario y cuántas llamadas por minuto como máximo. enabled=false deja todo apagado (interruptor maestro).';
COMMENT ON COLUMN public.voice_campaign_config.max_per_tick IS
  'Techo de llamadas por corrida del cron (1/min por defecto). Es el freno contra la estampida: aunque se encolen 150 juntas, salen de a una.';

ALTER TABLE public.voice_campaign_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS voice_campaign_config_org_r ON public.voice_campaign_config;
CREATE POLICY voice_campaign_config_org_r ON public.voice_campaign_config
  FOR SELECT USING (organization_id = current_organization_id());

-- Duke / Stratos: los valores que ya usaba el flujo 04, con el horario más
-- conservador que corresponde a una lista mayormente de EE.UU.
-- Nace APAGADO a propósito: se prende cuando el dueño lo diga.
INSERT INTO public.voice_campaign_config
  (organization_id, enabled, from_number, agent_id, work_start, work_end, work_tz, max_per_tick)
VALUES
  ('00000000-0000-0000-0000-000000000001'::UUID, false,
   '+17479779711', 'agent_a0fca02d06fc89401d84546aa3',
   '09:00', '20:00', 'America/Cancun', 1)
ON CONFLICT (organization_id) DO NOTHING;

-- ───────── n8n deja de ver las filas del marcador nativo ────────────────
CREATE OR REPLACE FUNCTION public.fn_get_pending_calls()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id  UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  v_calls   jsonb;
  v_blocked INT  := 0;
BEGIN
  WITH bloqueadas AS (
    UPDATE public.scheduled_calls sc
    SET status = 'cancelled', updated_at = now()
    WHERE sc.status = 'pending'
      AND sc.organization_id = v_org_id
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.organization_id = v_org_id
          AND l.do_not_contact IS TRUE
          AND public.fn_phone_canon(coalesce(l.voice_phone_e164, l.whatsapp_phone_e164,
                                             l.phone_normalized, l.phone))
              = public.fn_phone_canon(sc.phone_e164)
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_blocked FROM bloqueadas;

  WITH claimed AS (
    UPDATE public.scheduled_calls
    SET status = 'completed', attempted_at = now(), updated_at = now()
    WHERE status = 'pending'
      AND scheduled_at <= now()
      AND organization_id = v_org_id
      AND source <> 'stratos_native'   -- ← el marcador nativo las atiende él
    RETURNING id, phone_e164, scheduled_at, created_at, attempted_at
  ),
  enriched AS (
    SELECT
      c.id, c.phone_e164, c.scheduled_at, c.created_at, c.attempted_at,
      ld.id                                                     AS lead_id,
      COALESCE(public.fn_clean_lead_name(ld.name), 'Cliente')    AS full_name,
      COALESCE(NULLIF(btrim(ld.stage), ''), 'Perfilamiento')     AS pipeline_stage,
      CASE WHEN ld.selected_time IS NOT NULL
             OR COALESCE(ld.zoom_join_url, '') <> '' THEN 'si' ELSE 'no' END AS tiene_meet,
      COALESCE(to_char(ld.selected_time AT TIME ZONE 'America/Cancun',
                       'DD/MM/YYYY HH24:MI'), '')                AS fecha_meet,
      CASE WHEN vc.call_summary IS NOT NULL THEN 'si' ELSE 'no' END AS hubo_llamada_previa,
      COALESCE(vc.call_summary, '')                              AS resumen_llamada_previa,
      COALESCE(dd.data, '{}'::jsonb)                             AS discovery
    FROM claimed c
    LEFT JOIN LATERAL (
      SELECT l.* FROM public.leads l
      WHERE l.organization_id = v_org_id
        AND l.deleted_at IS NULL
        AND public.fn_phone_canon(coalesce(l.voice_phone_e164, l.whatsapp_phone_e164,
                                           l.phone_normalized, l.phone))
            = public.fn_phone_canon(c.phone_e164)
      ORDER BY l.updated_at DESC NULLS LAST
      LIMIT 1
    ) ld ON TRUE
    LEFT JOIN LATERAL (
      SELECT v.call_summary FROM public.voice_call_logs v
      WHERE v.lead_id = ld.id AND COALESCE(v.call_summary, '') <> ''
      ORDER BY v.created_at DESC
      LIMIT 1
    ) vc ON TRUE
    LEFT JOIN public.discovery_data dd ON dd.lead_id = ld.id
  )
  SELECT jsonb_agg(to_jsonb(e)) INTO v_calls FROM enriched e;

  RETURN jsonb_build_object(
    'ok', true,
    'count', COALESCE(jsonb_array_length(v_calls), 0),
    'blocked_do_not_contact', v_blocked,
    'calls', COALESCE(v_calls, '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_get_pending_calls() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_pending_calls() TO service_role;
