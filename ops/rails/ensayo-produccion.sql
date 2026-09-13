-- Ejecutar dentro de una transacción con 245 cargada; terminar siempre con ROLLBACK.
-- Solo usa QA Lab y no modifica perfiles, asignaciones ni comunicaciones.
DO $$
DECLARE
  v_actor public.profiles; v_lead public.leads; v_id uuid := gen_random_uuid();
  v_result jsonb; v_retry jsonb; v_when timestamptz := date_trunc('minute',now()) + interval '2 days';
  v_meta jsonb; v_version timestamptz; v_denied boolean := false;
BEGIN
  SELECT * INTO v_actor FROM public.profiles
  WHERE organization_id='ffffffff-0000-4000-a000-000000000001'
    AND active IS DISTINCT FROM false AND role IN ('admin','super_admin','ceo','director') LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Falta administrador de QA Lab; no usar clientes reales.'; END IF;
  SELECT * INTO v_lead FROM public.leads
  WHERE organization_id=v_actor.organization_id AND deleted_at IS NULL AND opt_out IS DISTINCT FROM true
    AND stage NOT IN ('Cierre','Postventa','Descartado','Zoom Agendado') ORDER BY id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Falta cliente de prueba elegible.'; END IF;
  v_version:=v_lead.updated_at;
  SELECT coalesce(meta_config,'{}'::jsonb) INTO v_meta FROM public.organizations WHERE id=v_actor.organization_id;
  PERFORM set_config('request.jwt.claim.sub',v_actor.id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor.id,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  v_result:=public.rails_resolver_accion(v_id,v_lead.id,v_version,'qa','Ensayo reversible',
    'contactado','Ensayo de despliegue, se revierte','otro','Revisar propuesta de prueba',v_when,'America/Tijuana');
  IF (v_result->'lead'->>'next_action_at')::timestamptz IS DISTINCT FROM v_when THEN RAISE EXCEPTION 'Desfase horario'; END IF;
  IF (v_result->'lead'->>'sprint_toques')::int <> coalesce(v_lead.sprint_toques,0)+1 THEN RAISE EXCEPTION 'Contador incorrecto'; END IF;
  v_retry:=public.rails_resolver_accion(v_id,v_lead.id,v_version,'qa','Ensayo reversible',
    'contactado','Ensayo de despliegue, se revierte','otro','Revisar propuesta de prueba',v_when,'America/Tijuana');
  IF v_retry->>'repetido'<>'true' THEN RAISE EXCEPTION 'Reintento no idempotente'; END IF;
  IF (SELECT count(*) FROM public.rails_eventos WHERE id=v_id)<>1 THEN RAISE EXCEPTION 'Evidencia no visible o duplicada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rails_agenda_del_dia('America/Tijuana') WHERE lead_id=v_lead.id AND estado='hecho') THEN RAISE EXCEPTION 'Agenda no confirmada'; END IF;
  PERFORM public.rails_guardar_config('{"activo":true}'::jsonb,v_meta->'rails',v_actor.organization_id);
  PERFORM public.rails_guardar_config('{"activo":false}'::jsonb,'{"activo":true}'::jsonb,v_actor.organization_id);
  BEGIN
    PERFORM public.rails_guardar_config('{"activo":true}'::jsonb,'{"activo":true}'::jsonb,v_actor.organization_id);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Otro administrador%' THEN RAISE; END IF;
    v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'No rechazó configuración obsoleta'; END IF;
  RESET ROLE;
  IF (SELECT meta_config-'rails' FROM organizations WHERE id=v_actor.organization_id) IS DISTINCT FROM (v_meta-'rails') THEN RAISE EXCEPTION 'Cambió configuración ajena a Rails'; END IF;
END $$;
