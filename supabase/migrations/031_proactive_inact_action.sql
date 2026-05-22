-- ════════════════════════════════════════════════════════════════════════
-- 031 — fn_proactive_inact_action: 3 botones del recordatorio de abandono
-- ────────────────────────────────────────────────────────────────────────
-- Acciones que el asesor toca desde el recordatorio de cliente abandonado:
--   · contacte  — registra una comunicación (tipo='nota', porque el CHECK de
--                 comunicaciones no permite 'seguimiento') + reactiva la
--                 actividad del lead (updated_at, last_activity, days_inactive=0,
--                 seguimientos+1).
--   · reagendar — crea un lead_task a +2 días + setea next_action/next_action_at
--                 del lead (para que la próxima acción se vea en el CRM).
--   · ficha     — solo lectura: resumen del lead (nombre, proyecto, presupuesto,
--                 objeción, último contacto, pendiente).
--
-- SECURITY DEFINER, service_role only. Scoped a Duke. Siempre devuelve {ok,text}.
-- Aditivo: solo INSERT (comunicaciones, lead_tasks) + UPDATE de actividad del
-- lead; no borra nada. Validado con dry-run sobre el lead demo.
-- IMPORTANTE: ejecutada vía MCP en producción.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_proactive_inact_action(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org_id   uuid   := '00000000-0000-0000-0000-000000000001'::uuid;
  v_action   text   := lower(COALESCE(payload->>'action',''));
  v_lead_id  uuid   := NULLIF(payload->>'lead_id','')::uuid;
  v_tg       bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint;
  v_agent_id uuid;
  v_lead     RECORD;
  v_last     RECORD;
  v_text     text;
BEGIN
  IF v_action NOT IN ('contacte','reagendar','ficha') THEN
    RETURN jsonb_build_object('ok', false, 'text', 'Acción inválida. Usá: contacte, reagendar o ficha.');
  END IF;
  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'text', 'Falta lead_id.');
  END IF;

  SELECT * INTO v_lead FROM public.leads
  WHERE id = v_lead_id AND organization_id = v_org_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'text', 'No encontré ese lead.');
  END IF;

  SELECT id INTO v_agent_id FROM public.profiles
  WHERE organization_id = v_org_id AND telegram_chat_id = v_tg AND COALESCE(active,true)=true LIMIT 1;

  IF v_action = 'contacte' THEN
    INSERT INTO public.comunicaciones (lead_id, organization_id, tipo, resumen, asesor_id, ocurrio_en)
    VALUES (v_lead_id, v_org_id, 'nota',
            'El asesor confirmó que ya contactó al cliente desde el recordatorio proactivo.',
            v_agent_id, now());
    UPDATE public.leads
    SET updated_at = now(),
        last_activity = to_char(now(), 'YYYY-MM-DD HH24:MI'),
        days_inactive = 0,
        seguimientos = COALESCE(seguimientos,0) + 1
    WHERE id = v_lead_id;
    RETURN jsonb_build_object('ok', true,
      'text', 'Listo, registré que ya lo contactaste. El cliente vuelve a tu seguimiento activo.');

  ELSIF v_action = 'reagendar' THEN
    INSERT INTO public.lead_tasks (lead_id, organization_id, text, due_at, priority, created_by, metadata)
    VALUES (v_lead_id, v_org_id, 'Seguimiento al cliente (reagendado desde recordatorio proactivo)',
            now() + interval '2 days', 'normal', v_agent_id,
            jsonb_build_object('source','proactive_inact_action'));
    UPDATE public.leads
    SET next_action = 'Seguimiento al cliente (reagendado por recordatorio proactivo)',
        next_action_at = now() + interval '2 days',
        next_action_date = to_char((now() + interval '2 days') AT TIME ZONE 'America/Cancun', 'DD Mon, HH24:MI'),
        updated_at = now(),
        last_activity = to_char(now(), 'YYYY-MM-DD HH24:MI'),
        days_inactive = 0
    WHERE id = v_lead_id;
    RETURN jsonb_build_object('ok', true,
      'text', 'Te puse un recordatorio de seguimiento para dentro de 2 días. Si quieres otra fecha, dímela en el chat.');

  ELSE  -- ficha
    SELECT tipo, resumen, ocurrio_en INTO v_last
    FROM public.comunicaciones WHERE lead_id = v_lead_id
    ORDER BY ocurrio_en DESC LIMIT 1;

    v_text :=
      '📋 ' || COALESCE(v_lead.name, 's/ nombre') || E'\n'
      || 'Proyecto: ' || COALESCE(NULLIF(v_lead.project,''), 'n/d') || E'\n'
      || 'Presupuesto: ' || COALESCE(NULLIF(v_lead.budget,''), 'n/d') || E'\n'
      || 'Objeción / perfil: ' || COALESCE(NULLIF(v_lead.notas,''), NULLIF(v_lead.bio,''), 'n/d') || E'\n'
      || 'Último contacto: ' || COALESCE(to_char(v_last.ocurrio_en AT TIME ZONE 'America/Cancun', 'DD Mon HH24:MI')
            || ' — ' || v_last.resumen, 'sin registros') || E'\n'
      || 'Pendiente: ' || COALESCE(NULLIF(v_lead.next_action,''), 'n/d');

    RETURN jsonb_build_object('ok', true, 'text', v_text);
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_proactive_inact_action(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_proactive_inact_action(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
