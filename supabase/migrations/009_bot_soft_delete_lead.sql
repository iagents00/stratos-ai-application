-- ============================================================
-- Stratos AI — Migración 009: bot_soft_delete_lead
--
-- Único RPC faltante para que el bot de Telegram tenga paridad
-- razonable con la página del CRM. La auditoría vía MCP Supabase
-- (proyecto glulgyhkrqpykxmujodb) confirmó que el resto de las
-- operaciones del CRM ya están cubiertas por la migración
-- `bot_crm_rpcs` (30/abr/2026):
--
--   bot_upsert_lead, bot_view_lead, bot_get_lead_by_phone,
--   bot_get_lead_full_context, bot_search_leads_by_name,
--   bot_list_leads_by_filter, bot_list_pending,
--   bot_list_pipeline_summary, bot_update_lead_fields
--   (incluye reasignación vía p_new_asesor_name),
--   bot_add_seguimiento, bot_add_comunicacion,
--   bot_add_task, bot_complete_task, bot_create_deal.
--
-- Lo único que faltaba era poder descartar/borrar suavemente un
-- lead desde Telegram, equivalente al "Trash2" del expediente
-- en el frontend (que hoy está deshabilitado en UI pero sí filtra
-- por `deleted_at IS NULL`).
--
-- Idempotente: CREATE OR REPLACE FUNCTION.
-- Aplicar en: Supabase Dashboard → SQL Editor → Run
--             o vía MCP `apply_migration`.
-- ============================================================

CREATE OR REPLACE FUNCTION public.bot_soft_delete_lead(
  p_telegram_chat_id bigint,
  p_phone            text,
  p_reason           text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asesor      RECORD;
  v_lead        RECORD;
  v_phone_norm  TEXT;
  v_separator   TEXT;
  v_timestamp   TEXT;
  v_reason      TEXT;
BEGIN
  -- 1. Asesor por chat_id (bloquea inactivos automáticamente)
  SELECT id, name, role, organization_id INTO v_asesor
    FROM public.profiles
   WHERE telegram_chat_id = p_telegram_chat_id
     AND active = true
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'asesor_not_paired');
  END IF;

  -- 2. Normalizar teléfono (mismo regex que el resto de bot_*)
  v_phone_norm := NULLIF(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  IF v_phone_norm IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_phone');
  END IF;

  -- 3. Localizar el lead (mismo patrón FOR UPDATE que bot_update_lead_fields)
  SELECT id, asesor_id, name, deleted_at INTO v_lead
    FROM public.leads
   WHERE organization_id  = v_asesor.organization_id
     AND phone_normalized = v_phone_norm
   FOR UPDATE
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lead_not_found');
  END IF;

  -- Idempotencia: si ya está borrado, devolvemos ok sin tocar nada
  IF v_lead.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success',     true,
      'lead_id',     v_lead.id,
      'lead_name',   v_lead.name,
      'already_deleted', true,
      'deleted_at',  v_lead.deleted_at
    );
  END IF;

  -- Permiso: dueño del lead, o rol superior
  IF v_lead.asesor_id IS NOT NULL
     AND v_lead.asesor_id <> v_asesor.id
     AND v_asesor.role NOT IN ('super_admin','admin','ceo','director') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- 4. Soft-delete + dejar rastro en `notas` y `last_activity`
  v_timestamp := to_char(now() AT TIME ZONE 'America/Cancun', 'DD-Mon HH24:MI');
  v_reason    := coalesce(NULLIF(trim(p_reason), ''), 'Sin motivo');
  v_separator := format(E'\n[%s · descartado · %s] %s',
                  v_timestamp, v_asesor.name, v_reason);

  UPDATE public.leads
     SET deleted_at    = now(),
         notas         = CASE
                           WHEN coalesce(notas, '') = '' THEN trim(both E'\n' from v_separator)
                           ELSE notas || v_separator
                         END,
         last_activity = 'Descartado · ' || left(v_reason, 60),
         updated_at    = now()
   WHERE id = v_lead.id;

  -- 5. Registrar evento estructurado si la tabla existe (no falla si no).
  --    Usamos type='sistema' por el CHECK constraint de lead_events:
  --    (tarea, seguimiento, completada, registrada, etapa, asignacion,
  --     nota, llamada, whatsapp, email, zoom, visita, score_change,
  --     hot_change, playbook_done, sistema).
  BEGIN
    INSERT INTO public.lead_events (
      lead_id, organization_id, actor_id, actor_name, type, action, metadata
    ) VALUES (
      v_lead.id, v_asesor.organization_id, v_asesor.id, v_asesor.name,
      'sistema', 'Lead descartado vía Telegram',
      jsonb_build_object('reason', v_reason, 'source', 'bot_soft_delete_lead')
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN check_violation THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success',   true,
    'lead_id',   v_lead.id,
    'lead_name', v_lead.name,
    'reason',    v_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_soft_delete_lead(bigint, text, text) TO service_role;

-- Refrescar el schema cache de PostgREST para que /rpc/ vea la nueva función al instante.
NOTIFY pgrst, 'reload schema';

-- Verificación post-deploy:
--   SELECT proname FROM pg_proc WHERE proname = 'bot_soft_delete_lead';   -- esperar 1
--   SELECT public.bot_soft_delete_lead(0::bigint, '0', 'smoke');          -- esperar {"error":"asesor_not_paired"}
