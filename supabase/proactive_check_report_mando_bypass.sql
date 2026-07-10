-- ─────────────────────────────────────────────────────────────────────────────
-- fn_proactive_check_report — bypass para MANDO + detección de catálogo (2026-07-10)
-- Aplicado en stratos-prod (glulgyhkrqpykxmujodb) vía MCP. Fuente de verdad en GitHub.
--
-- Problema: un asesor/mando con un REPORTE PROACTIVO abierto (ej. "inactividad")
-- quedaba atrapado: su siguiente mensaje se rutea al flujo del reporte en n8n,
-- salvo que sea un "comando de escape". Las preguntas de CATÁLOGO no estaban en
-- esa lista → el bot respondía el reporte en vez del catálogo. (Visto con Iván.)
--
-- Dos capas de fix en esta función (el "Check Reporte" de n8n la llama con
-- {advisor_telegram_id, organization_id}):
--   1) MANDO (super_admin/admin/ceo/director): un reporte PASIVO de 'inactividad'
--      NO bloquea el chat (por diseño, mando recibe escalados, no recordatorios
--      operativos). Los kinds interactivos (awaiting_*, zoom_brief, next_action_3h)
--      se siguen detectando para TODOS (para capturar la respuesta). Asesores intactos.
--   2) BYPASS DE CATÁLOGO (forward-compatible): si el nodo n8n empieza a pasar el
--      texto del mensaje (payload.text/input_text), una consulta de catálogo
--      devuelve has_report=false → fluye al AI Agent. DORMIDO hasta que n8n mande
--      el texto (hoy "Check Reporte" solo manda advisor_telegram_id+org). 100% aditivo.
--      → Cuando n8n vuelva a estar conectado: agregar `text: $json.input_text` al
--        bodyParams del nodo "Check Reporte" de BOTv5 y esta capa se activa para
--        TODOS los roles (también asesores).
-- Revertir: restaurar la versión previa (sin v_is_mando ni el bloque de catálogo).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_proactive_check_report(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid := coalesce(nullif(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_tg bigint := nullif(payload->>'advisor_telegram_id','')::bigint;
  v_id uuid; v_lead uuid; v_kind text; v_mgr bigint; v_mgrs bigint[]; v_role text;
  v_text text := trim(coalesce(payload->>'text', payload->>'input_text', payload->>'texto', payload->>'message', ''));
  v_norm text;
  v_is_mando boolean;
begin
  if v_tg is null then return jsonb_build_object('ok',false,'error','advisor_telegram_id required'); end if;
  select coalesce(array_agg(telegram_chat_id order by telegram_chat_id), array[]::bigint[]) into v_mgrs
  from public.profiles where organization_id=v_org and role in ('super_admin','admin','ceo','director') and coalesce(active,true)=true and telegram_chat_id is not null;
  v_mgr := coalesce((select manager_telegram_id from public.proactive_config where organization_id=v_org), v_mgrs[1]);
  select p.role into v_role from public.profiles p where p.organization_id = v_org and p.telegram_chat_id = v_tg and coalesce(p.active,true)=true limit 1;
  v_is_mando := v_role in ('super_admin','admin','ceo','director');

  -- (2) BYPASS DE CATÁLOGO (forward-compatible; dormido hasta que n8n pase el texto)
  v_norm := public.unaccent(lower(coalesce(v_text,'')));
  if v_norm <> '' and (
       v_norm ~ 'catalogo'
    or v_norm ~ '(propiedad|propiedades|proyecto|proyectos|desarrollo|desarrollos|inmueble|inmuebles|departamento|departamentos|villa|villas|condo|condos|terreno|terrenos)'
    or v_norm ~ '(recamara|recamaras|habitacion|habitaciones)'
    or v_norm ~ '(cerca del mar|frente al mar|frente a la playa|vista al mar)'
    or v_norm ~ '\d+\s*(k|mil|mdp)\s*(a|-|y|hasta)\s*\d+'
    or (v_norm ~ 'top\s*\d+' and v_norm ~ '(\d+\s*(k|mil|mdp|usd|millon)|playa del carmen|tulum|cancun|merida|(^| )cabo)')
  ) then
    return jsonb_build_object('ok',true,'has_report',false,'awaiting_reschedule',false,'awaiting_next_action',false,'catalog_bypass',true,'manager_telegram_id',v_mgr,'manager_telegram_ids',to_jsonb(v_mgrs));
  end if;

  -- (1) MANDO no se bloquea por 'inactividad' pasiva
  select id,lead_id,kind into v_id,v_lead,v_kind from public.proactive_pending_reports
  where organization_id=v_org and advisor_telegram_id=v_tg and status='open'
    and kind in ('zoom_brief','awaiting_reschedule','awaiting_next_action','next_action_3h','awaiting_plan','inactividad')
    and not (v_is_mando and kind = 'inactividad')
    and (expires_at is null or expires_at>now())
  order by (case when kind in ('awaiting_plan','awaiting_reschedule') then 0 else 1 end), created_at desc, id desc limit 1;
  if v_id is null then
    return jsonb_build_object('ok',true,'has_report',false,'awaiting_reschedule',false,'awaiting_next_action',false,'manager_telegram_id',v_mgr,'manager_telegram_ids',to_jsonb(v_mgrs));
  end if;
  return jsonb_build_object('ok',true,'has_report',true,
    'awaiting_reschedule',(v_kind='awaiting_reschedule'),
    'awaiting_next_action',(v_kind='awaiting_next_action'),
    'report_kind',v_kind,'lead_id',v_lead,'report_id',v_id,'manager_telegram_id',v_mgr,'manager_telegram_ids',to_jsonb(v_mgrs));
end; $function$;
