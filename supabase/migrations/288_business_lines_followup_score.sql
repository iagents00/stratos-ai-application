-- Business labels/entry stages per organization and custom-pipeline follow-up points.
-- Reversal: restore the backed-up definitions; no lead or stage deletions.
-- Per-company business labels and entry stages. No company names in shared code.
CREATE OR REPLACE FUNCTION public.fn_crm_business_lines_remap(p_lines jsonb,p_renames jsonb,p_pipeline jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $fn$
DECLARE v_line jsonb; v_lines jsonb:='[]'; v_entry text; v_stages jsonb;
BEGIN
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN RETURN '[]'::jsonb; END IF;
 FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  v_entry:=coalesce(p_renames->>(v_line->>'entryStage'),v_line->>'entryStage');
  SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY ord),'[]'::jsonb) INTO v_stages FROM (
   SELECT coalesce(p_renames->>s,s) n,ord FROM jsonb_array_elements_text(coalesce(v_line->'stages','[]'::jsonb)) WITH ORDINALITY a(s,ord)
   WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(p_pipeline) p WHERE p->>'name'=coalesce(p_renames->>s,s))
  ) q;
  IF NOT(v_stages ? v_entry) THEN
   RAISE EXCEPTION 'La etapa inicial de % debe conservarse o cambiarse en su configuración de negocio.',v_line->>'label' USING ERRCODE='22023';
  END IF;
  v_lines:=v_lines||jsonb_build_array(v_line||jsonb_build_object('entryStage',v_entry,'stages',v_stages));
 END LOOP;
 RETURN v_lines;
END $fn$;
CREATE OR REPLACE FUNCTION public.fn_org_business_match(p_org uuid,p_input text)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $fn$
DECLARE v_lines jsonb; v_line jsonb; v_matches jsonb:='[]';
 v_text text:= ' '||regexp_replace(public.unaccent(lower(coalesce(p_input,''))),'[^a-z0-9]+',' ','g')||' ';
BEGIN
 SELECT meta_config#>'{crm,businessLines}' INTO v_lines FROM public.organizations WHERE id=p_org;
 IF jsonb_typeof(v_lines) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
 FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
  IF public.fn_org_stage(p_org,v_line->>'entryStage') IS NULL THEN CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(v_line->'aliases','[]'::jsonb)||jsonb_build_array(v_line->>'label',v_line->>'id')) a
     WHERE length(btrim(a))>1 AND strpos(v_text,' '||regexp_replace(public.unaccent(lower(btrim(a))),'[^a-z0-9]+',' ','g')||' ')>0) THEN
   v_matches:=v_matches||jsonb_build_array(v_line);
  END IF;
 END LOOP;
 IF jsonb_array_length(v_matches)>1 THEN RETURN jsonb_build_object('ambiguous',true,'choices',v_matches); END IF;
 RETURN v_matches->0;
END $fn$;
REVOKE ALL ON FUNCTION public.fn_crm_business_lines_remap(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_org_business_match(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_crm_business_lines_remap(jsonb,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_org_business_match(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_score_v2_row(l leads)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_stage text; v_base int; v_idx int; v_zoom_idx int := 8;
  v_zoom int := 0; v_seg int := 0; v_pres int := 0; v_bant int := 0; v_penal int := 0;
  v_di int; v_score int; v_hot boolean := false; v_postzoom boolean; v_custom boolean := false;
BEGIN
  v_stage := lower(btrim(coalesce(l.stage, '')));
  v_di := GREATEST(0, floor(extract(epoch FROM now() - coalesce(l.updated_at, l.created_at, now())) / 86400)::int);

  v_base := CASE v_stage
    WHEN 'contáctame ya' THEN 8   WHEN 'nuevo registro' THEN 8
    WHEN 'segundo intento' THEN 12 WHEN 'segundo contacto' THEN 12
    WHEN 'tercer intento' THEN 14  WHEN 'rotación' THEN 10
    WHEN 'remarketing ia' THEN 16  WHEN 'zoom agendado' THEN 45
    WHEN 'reactivar zoom' THEN 32  WHEN 'no show' THEN 32
    WHEN 'zoom concretado' THEN 60 WHEN 'seguimiento' THEN 70
    WHEN 'largo plazo' THEN 40     WHEN 'apartó' THEN 85
    WHEN 'visita agendada' THEN 80 WHEN 'cierre' THEN 95
    WHEN 'postventa' THEN 50       ELSE 10 END;

  v_idx := CASE v_stage
    WHEN 'contáctame ya' THEN 1 WHEN 'nuevo registro' THEN 1
    WHEN 'segundo intento' THEN 2 WHEN 'segundo contacto' THEN 2 WHEN 'rotación' THEN 2
    WHEN 'tercer intento' THEN 3 WHEN 'remarketing ia' THEN 4
    WHEN 'zoom agendado' THEN 6 WHEN 'reactivar zoom' THEN 7 WHEN 'no show' THEN 7
    WHEN 'zoom concretado' THEN 8 WHEN 'seguimiento' THEN 9 WHEN 'largo plazo' THEN 9
    WHEN 'apartó' THEN 11 WHEN 'visita agendada' THEN 12 WHEN 'cierre' THEN 13
    WHEN 'postventa' THEN 14 ELSE 1 END;

  SELECT CASE WHEN jsonb_typeof(meta_config#>'{crm,pipeline}')='array' THEN jsonb_array_length(meta_config#>'{crm,pipeline}')>=2 ELSE false END
    INTO v_custom FROM public.organizations WHERE id=l.organization_id;
  v_postzoom := v_stage IN ('zoom concretado','seguimiento','largo plazo','apartó','visita agendada','cierre');

  IF coalesce(l.visita_at, l.selected_time) > now() THEN v_zoom := v_zoom + 8; END IF;
  IF v_idx >= v_zoom_idx THEN v_zoom := v_zoom + 5; END IF;
  IF v_zoom > 13 THEN v_zoom := 13; END IF;

  IF v_custom THEN
    -- Custom pipelines: one point per recorded follow-up, in every stage.
    -- Keep all legacy stage/budget/inactivity weights and the overall 0-100 bound.
    v_seg := LEAST(GREATEST(coalesce(l.seguimientos,0),0),100);
  ELSIF v_postzoom THEN v_seg := LEAST(coalesce(l.seguimientos, 0) * 2, 12); END IF;

  v_pres := CASE
    WHEN coalesce(l.presupuesto, 0) >= 2000000 THEN 12 WHEN l.presupuesto >= 1000000 THEN 9
    WHEN l.presupuesto >= 500000 THEN 6 WHEN l.presupuesto >= 200000 THEN 4
    WHEN l.presupuesto > 0 THEN 2 ELSE 0 END;

  v_bant := (CASE WHEN l.asesor_id IS NOT NULL THEN 2 ELSE 0 END)
          + (CASE WHEN l.next_action_at IS NOT NULL THEN 2 ELSE 0 END)
          + (CASE WHEN length(coalesce(l.bio, '')) > 40 THEN 2 ELSE 0 END);

  IF v_stage NOT IN ('cierre','postventa') THEN
    v_penal := CASE WHEN v_di >= 21 THEN 15 WHEN v_di >= 14 THEN 10
                    WHEN v_di >= 7 THEN 6 WHEN v_di >= 4 THEN 3 ELSE 0 END;
  END IF;

  v_score := v_base + v_zoom + v_seg + v_pres + v_bant - v_penal;
  IF v_stage = 'postventa' AND NOT coalesce(v_custom,false) THEN v_score := LEAST(v_score, 60); END IF;
  v_score := GREATEST(0, LEAST(100, v_score));

  v_hot := (v_score >= 78 AND v_di <= 5)
        OR (v_stage = 'zoom agendado' AND v_di <= 7)
        OR (v_stage IN ('zoom concretado','seguimiento','reactivar zoom') AND v_di <= 3)
        OR (v_stage IN ('apartó','visita agendada') AND v_di <= 7);

  RETURN jsonb_build_object('score', v_score, 'hot_auto', v_hot,
    'breakdown', jsonb_build_object('stage_norm', v_stage, 'base', v_base, 'zoom', v_zoom,
      'followups',v_seg,'custom_pipeline',coalesce(v_custom,false),'seg_postzoom', v_seg, 'presupuesto', v_pres, 'bant', v_bant, 'penal', v_penal, 'dias_inact', v_di));
END; $function$;
CREATE OR REPLACE FUNCTION public.fn_leads_score_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE r jsonb;
BEGIN
  IF TG_OP='UPDATE' THEN
    -- Privileged, organization-scoped repair of calculated fields is not client activity.
    IF current_setting('stratos.score_recalculation_org',true)=NEW.organization_id::text
       AND (auth.role()='service_role' OR current_user IN ('postgres','supabase_admin'))
       AND (to_jsonb(NEW)-ARRAY['score','score_calc','hot_auto','hot','updated_at'])
         =(to_jsonb(OLD)-ARRAY['score','score_calc','hot_auto','hot','updated_at']) THEN
      NEW.updated_at:=OLD.updated_at; RETURN NEW;
    END IF;
    IF public.fn_is_pipeline_label_rename(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.score_managed := true;                 -- todo lead nuevo lo gestiona el motor v2
    r := public.fn_score_v2_row(NEW);
    NEW.score      := (r->>'score')::int;
    NEW.score_calc := (r->>'score')::int;
    NEW.hot_auto   := (r->>'hot_auto')::boolean;
    NEW.hot        := COALESCE(NEW.hot, false) OR (r->>'hot_auto')::boolean;  -- auto solo SUMA hot
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.score_managed, false)       -- solo leads gestionados (nuevos); los viejos NO se tocan
       AND ( NEW.stage          IS DISTINCT FROM OLD.stage
          OR NEW.seguimientos   IS DISTINCT FROM OLD.seguimientos
          OR NEW.presupuesto    IS DISTINCT FROM OLD.presupuesto
          OR NEW.next_action_at IS DISTINCT FROM OLD.next_action_at
          OR NEW.visita_at      IS DISTINCT FROM OLD.visita_at
          OR NEW.selected_time  IS DISTINCT FROM OLD.selected_time
          OR NEW.asesor_id      IS DISTINCT FROM OLD.asesor_id
          OR NEW.bio            IS DISTINCT FROM OLD.bio )
    THEN
      r := public.fn_score_v2_row(NEW);
      NEW.score      := (r->>'score')::int;
      NEW.score_calc := (r->>'score')::int;
      NEW.hot_auto   := (r->>'hot_auto')::boolean;
      NEW.hot        := COALESCE(NEW.hot, false) OR (r->>'hot_auto')::boolean;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $function$;
CREATE OR REPLACE FUNCTION public.fn_company_pipeline_publish(p_actor_id uuid, p_organization_id uuid, p_expected_updated_at timestamp with time zone, p_pipeline jsonb, p_copilot jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org public.organizations%rowtype;
  v_profile public.profiles%rowtype;
  v_pipeline jsonb;
  v_current jsonb;
  v_preserved jsonb := '{}'::jsonb;
  v_usage jsonb;
  v_stage record;
  v_color text;
  v_base integer;
  v_renames jsonb := '{}'::jsonb;
  v_aliases jsonb;
  v_rename record;
  v_previous_context text;
  v_renamed_clients integer := 0;
  v_appointment text;
  v_appointments text[];
  v_mapped_appointments text[];
  v_requested_appointments jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Solo el servidor.' using errcode='42501'; end if;
  select * into v_profile from public.profiles where id=p_actor_id for share;
  if not exists(select 1 from public.platform_admins a join public.organizations o on o.id=p_organization_id
    where a.user_id=p_actor_id and a.active is true and (a.scope_organization_id is null or a.scope_organization_id=o.parent_organization_id)
      and not exists(select 1 from public.profiles p where p.id=p_actor_id and p.active is false)) and (not found or v_profile.organization_id is distinct from p_organization_id
     or v_profile.active is not true or coalesce(v_profile.role,'') not in ('admin','super_admin')
     or v_profile.crm_only is true
     or (v_profile.is_marketing_admin is true and p_organization_id='00000000-0000-0000-0000-000000000001')) then
    raise exception 'Solo el administrador activo de tu propia empresa puede configurar sus etapas.' using errcode='42501';
  end if;
  select * into v_org from public.organizations where id=p_organization_id for update;
  if not found or v_org.active is not true or v_org.meta_config#>>'{features,crm}'='false' then
    raise exception 'La empresa no está activa o no tiene CRM.' using errcode='42501';
  end if;
  if p_expected_updated_at is null or v_org.updated_at is distinct from p_expected_updated_at then
    raise exception 'La configuración cambió en otra sesión. Recarga el pipeline antes de guardar.' using errcode='40001';
  end if;
  if jsonb_typeof(v_org.meta_config#>'{crm,pipelines}')='array'
     and jsonb_array_length(v_org.meta_config#>'{crm,pipelines}')>0 then
    raise exception 'Esta empresa tiene varios tableros. Solicita su configuración a soporte.' using errcode='40001';
  end if;
  if jsonb_typeof(p_pipeline) is distinct from 'array' then
    raise exception 'El pipeline debe ser una lista de etapas.' using errcode='22023';
  end if;
  if jsonb_array_length(p_pipeline) not between 2 and 30 then
    raise exception 'El pipeline debe tener entre 2 y 30 etapas.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_pipeline) s
    where jsonb_typeof(s->'name') is distinct from 'string' or jsonb_typeof(s->'color') is distinct from 'string'
      or length(regexp_replace(btrim(s->>'name'),'\s+',' ','g')) not between 2 and 48
      or s->>'color' !~ '^#[0-9A-Fa-f]{6}$'
      or (s ? 'previous_name' and jsonb_typeof(s->'previous_name') is distinct from 'string')) then
    raise exception 'Revisa los nombres y colores de las etapas.' using errcode='22023';
  end if;
  select jsonb_agg(jsonb_build_object('name',regexp_replace(btrim(s->>'name'),'\s+',' ','g'),
    'color',upper(s->>'color')) order by ord) into v_pipeline
    from jsonb_array_elements(p_pipeline) with ordinality x(s,ord);
  if exists(select 1 from jsonb_array_elements(v_pipeline) s group by lower(s->>'name') having count(*)>1) then
    raise exception 'Los nombres de las etapas no se pueden repetir.' using errcode='22023';
  end if;
  v_current:=public.fn_platform_crm_pipeline(p_organization_id);
  v_appointments:=public.fn_org_appointment_stages(p_organization_id);
  -- The original name comes from a stable editor row; never infer by position.
  for v_rename in select s->>'previous_name' old_name,s->>'name' raw_name
    from jsonb_array_elements(p_pipeline) s where s ? 'previous_name' loop
    if v_rename.old_name is null or not exists(select 1 from jsonb_array_elements(v_current) c where c->>'name'=v_rename.old_name) then
      raise exception 'La etapa original ya no existe. Recarga el pipeline.' using errcode='40001'; end if;
    if (select count(*) from jsonb_array_elements(p_pipeline) c where c->>'previous_name'=v_rename.old_name)>1 then
      raise exception 'Una etapa original no se puede renombrar dos veces.' using errcode='22023'; end if;
    v_rename.raw_name:=regexp_replace(btrim(v_rename.raw_name),'[[:space:]]+',' ','g');
    if exists(select 1 from jsonb_array_elements(v_current) c where lower(c->>'name')=lower(v_rename.raw_name) and c->>'name'<>v_rename.old_name) then
      raise exception 'El nuevo nombre ya pertenece a otra etapa. Usa un nombre diferente.' using errcode='22023'; end if;
    if v_rename.old_name<>v_rename.raw_name then v_renames:=v_renames||jsonb_build_object(v_rename.old_name,v_rename.raw_name); end if;
  end loop;
  if v_renames<>'{}'::jsonb then
    -- Freeze this tenant's rows before relabeling; other companies stay independent.
    perform 1 from public.leads where organization_id=p_organization_id order by id for update;
    if p_copilot is null and exists(select 1 from unnest(v_appointments) s where v_renames ? s) then
      p_copilot:=jsonb_build_object('appointment_stages',(select coalesce(jsonb_agg(coalesce(v_renames->>s,s)),'[]'::jsonb) from unnest(v_appointments) s));
    end if;
    select coalesce(jsonb_object_agg(key,coalesce(v_renames->>value,value)),'{}'::jsonb) into v_aliases
      from jsonb_each_text(case when jsonb_typeof(v_org.meta_config#>'{crm,stageAliases}')='object'
        then v_org.meta_config#>'{crm,stageAliases}' else '{}'::jsonb end);
    v_aliases:=v_aliases||v_renames;
    -- Existing names always retain their explicit meaning, rather than becoming aliases.
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_aliases from jsonb_each_text(v_aliases) a
      where not exists(select 1 from jsonb_array_elements(v_pipeline) s where lower(s->>'name')=lower(a.key));
    v_previous_context:=current_setting('stratos.pipeline_label_rename',true);
    perform set_config('stratos.pipeline_label_rename',jsonb_build_object('organization_id',p_organization_id,'names',v_renames)::text,true);
    update public.leads set stage=v_renames->>stage
      where organization_id=p_organization_id and v_renames ? stage;
    get diagnostics v_renamed_clients=row_count;
    perform set_config('stratos.pipeline_label_rename',coalesce(v_previous_context,''),true);
    update public.proactive_config c set
      terminal_stages=case when c.terminal_stages is null then null else array(select coalesce(v_renames->>s,s) from unnest(c.terminal_stages) s) end,
      inactivity_include_stages=case when c.inactivity_include_stages is null then null else array(select coalesce(v_renames->>s,s) from unnest(c.inactivity_include_stages) s) end,
      inactivity_exclude_stages=case when c.inactivity_exclude_stages is null then null else array(select coalesce(v_renames->>s,s) from unnest(c.inactivity_exclude_stages) s) end
      where c.organization_id=p_organization_id;
    update public.lead_assignment_pools set default_stage=v_renames->>default_stage
      where organization_id=p_organization_id and v_renames ? default_stage;
    update public.bot_pending_stage_move set from_stage=coalesce(v_renames->>from_stage,from_stage),to_stage=coalesce(v_renames->>to_stage,to_stage)
      where organization_id=p_organization_id and (v_renames ? from_stage or v_renames ? to_stage);
  end if;
  select coalesce(jsonb_object_agg(stage,total),'{}'::jsonb) into v_usage from (
    select stage,count(*) total from public.leads where organization_id=p_organization_id
      and deleted_at is null and nullif(stage,'') is not null group by stage
  ) counts;
  for v_stage in select key as name,value as total from jsonb_each(v_usage) loop
    if exists(select 1 from jsonb_array_elements(v_pipeline) s where s->>'name'=v_stage.name) then continue; end if;
    v_preserved:=v_preserved||jsonb_build_object(v_stage.name,v_stage.total);
    if exists(select 1 from jsonb_array_elements(v_pipeline) s where lower(s->>'name')=lower(v_stage.name)) then
      select jsonb_agg(case when lower(s->>'name')=lower(v_stage.name)
        then jsonb_set(s,'{name}',to_jsonb(v_stage.name)) else s end order by ord) into v_pipeline
        from jsonb_array_elements(v_pipeline) with ordinality x(s,ord);
    else
      select s->>'color' into v_color from jsonb_array_elements(v_current) s where s->>'name'=v_stage.name limit 1;
      v_pipeline:=v_pipeline||jsonb_build_array(jsonb_build_object('name',v_stage.name,'color',coalesce(v_color,'#64748B')));
    end if;
  end loop;
  if jsonb_array_length(v_pipeline)>30 then
    raise exception 'Hay más de 30 etapas al conservar las que tienen clientes. Muévelos antes de publicar.' using errcode='40001';
  end if;
  -- Older installed apps do not send the appointment selection. Their stage
  -- edit must never silently orphan the role chosen by the administrator.
  if p_copilot is null and (coalesce(v_org.meta_config->'crm','{}') ?| array['appointmentStage','appointmentStages'])
    and exists(select 1 from unnest(v_appointments) a
      where not exists(select 1 from jsonb_array_elements(v_pipeline) x where x->>'name'=coalesce(v_renames->>a,a))) then
    raise exception 'Para cambiar una etapa de citas, actualiza también su selección en Pipeline de mi empresa.' using errcode='40001';
  end if;
  -- Both legacy uniqueness constraints include inactive rows. Park ALL former
  -- positions below the existing minimum before reordering/reactivating names.
  -- Keep removed names as inactive history; no rows or clients are deleted.
  select least(coalesce(min(orden),0),0)-1 into v_base from public.org_stages where organization_id=p_organization_id;
  with parked as (select id,row_number() over(order by orden,id)::integer pos
    from public.org_stages where organization_id=p_organization_id)
  update public.org_stages s set orden=v_base-p.pos,activo=false from parked p
    where s.id=p.id and s.organization_id=p_organization_id;
  insert into public.org_stages(organization_id,orden,nombre,color,activo)
    select p_organization_id,ord::integer,s->>'name',s->>'color',true
    from jsonb_array_elements(v_pipeline) with ordinality x(s,ord)
    on conflict (organization_id,nombre) do update set orden=excluded.orden,color=excluded.color,activo=true,deleted_at=null;
  update public.organizations set meta_config=jsonb_set(coalesce(v_org.meta_config,'{}'::jsonb),'{crm}',
    coalesce(v_org.meta_config->'crm','{}'::jsonb)||jsonb_build_object('pipeline',v_pipeline,
      'pipelineUpdatedAt',clock_timestamp(),'pipelineUpdatedBy',p_actor_id)
      ||case when v_renames<>'{}'::jsonb then jsonb_build_object('stageAliases',v_aliases) else '{}'::jsonb end
      ||case when v_org.meta_config#>'{crm,businessLines}' is not null then jsonb_build_object('businessLines',public.fn_crm_business_lines_remap(v_org.meta_config#>'{crm,businessLines}',v_renames,v_pipeline)) else '{}'::jsonb end),updated_at=clock_timestamp()
    where id=p_organization_id returning * into v_org;
  if p_copilot is not null then
    if jsonb_typeof(p_copilot) is distinct from 'object'
      or (p_copilot-array['appointment_stage','appointment_stages'])<>'{}'::jsonb
      or not(p_copilot ?| array['appointment_stage','appointment_stages'])
      or (p_copilot ? 'appointment_stage' and p_copilot ? 'appointment_stages') then
      raise exception 'Configuración de citas inválida.' using errcode='22023'; end if;
    if p_copilot ? 'appointment_stages' then
      v_requested_appointments:=p_copilot->'appointment_stages';
    else
      if jsonb_typeof(p_copilot->'appointment_stage') not in ('string','null') then
        raise exception 'Configuración de cita inválida.' using errcode='22023'; end if;
      select coalesce(array_agg(coalesce(v_renames->>a,a)),'{}'::text[]) into v_mapped_appointments from unnest(v_appointments) a;
      v_appointment:=nullif(btrim(p_copilot->>'appointment_stage'),'');
      if cardinality(v_mapped_appointments)>1 then
        if v_appointment is distinct from v_mapped_appointments[1] then
          raise exception 'Esta empresa tiene varias etapas de cita. Usa la versión actual para cambiar su selección.' using errcode='40001'; end if;
        v_requested_appointments:=to_jsonb(v_mapped_appointments);
      else
        v_requested_appointments:=case when v_appointment is null then '[]'::jsonb else jsonb_build_array(v_appointment) end;
      end if;
    end if;
    perform public.fn_company_appointments_config(p_organization_id,v_requested_appointments);
    select * into v_org from public.organizations where id=p_organization_id;
  end if;
  return jsonb_build_object('copilot',jsonb_build_object('configured',coalesce(v_org.meta_config->'crm','{}'::jsonb)?'appointmentStage',
    'appointment_stage',public.fn_org_appointment_stage(p_organization_id),'appointment_stages',to_jsonb(public.fn_org_appointment_stages(p_organization_id))), 'ok',true,'organization',jsonb_build_object('id',v_org.id,'name',v_org.name,
    'meta_config',v_org.meta_config),'pipeline',v_pipeline,'usage',v_usage,'updated_at',v_org.updated_at,
    'preserved_stages',v_preserved,'renamed_stages',v_renames,'renamed_clients',v_renamed_clients);
end $function$;
CREATE OR REPLACE FUNCTION public.bot_stage_create_lead_pre_tarjeta(p_telegram_chat_id bigint, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_args jsonb := coalesce(p_args,'{}'::jsonb);
  v_asesor jsonb; v_org uuid; v_role text; v_can_reassign boolean; v_tz text; v_profile uuid;
  v_text text := trim(coalesce(v_args->>'input_text', v_args->>'text',''));
  v_name text := nullif(trim(coalesce(v_args->>'name', v_args->>'client_name', v_args->>'nombre','')),'');
  v_phone text := nullif(trim(coalesce(v_args->>'phone', v_args->>'telefono','')),'');
  v_email text := nullif(trim(coalesce(v_args->>'email','')),'');
  v_stage text := nullif(trim(coalesce(v_args->>'stage', v_args->>'etapa','')),'');
  v_project text := nullif(trim(coalesce(v_args->>'project', v_args->>'proyecto','')),'');
  v_campaign text := nullif(trim(coalesce(v_args->>'campaign', v_args->>'campana', v_args->>'campaña','')),'');
  v_budget_text text := nullif(trim(coalesce(v_args->>'budget_text', v_args->>'budget', v_args->>'presupuesto_texto','')),'');
  v_budget_num bigint := nullif(regexp_replace(coalesce(v_args->>'budget_numeric', v_args->>'presupuesto',''),'[^0-9]','','g'),'')::bigint;
  v_notas text := nullif(trim(coalesce(v_args->>'notas', v_args->>'nota', v_args->>'bio', v_args->>'comentario','')),'');
  v_next text := nullif(trim(coalesce(v_args->>'next_action', v_args->>'proxima_accion', v_args->>'accion','')),'');
  v_when text := nullif(trim(coalesce(v_args->>'next_action_at', v_args->>'fecha','')),'');
  v_asesor_req text := nullif(trim(coalesce(v_args->>'asesor_name', v_args->>'advisor_name', v_args->>'new_asesor_name','')),'');
  v_m text[]; v_at timestamptz;
  v_etoken text; v_epayload jsonb; v_p jsonb; v_token text; v_state text;
  v_fname text; v_fphone text; v_fstage text; v_fnext text; v_fwhen text;
  v_lines text[]; v_summary text; v_money text; v_fecha text; v_kb jsonb; v_reply jsonb;
  v_business jsonb; v_business_text text; v_business_pending boolean:=false; v_resolved_stage text;
  v_falta text[] := ARRAY[]::text[]; v_falta_txt text := ''; v_stage_given boolean := true;
begin
  v_asesor := public.identify_asesor_by_telegram(p_telegram_chat_id);
  if coalesce((v_asesor->>'paired')::boolean,false) is not true then
    return public._bot_err_envelope(jsonb_build_object('error','not_paired'));
  end if;
  v_org := (v_asesor->>'organization_id')::uuid;
  v_profile := (v_asesor->>'profile_id')::uuid;
  v_role := coalesce(v_asesor->>'role','asesor');
  v_can_reassign := v_role in ('super_admin','admin','ceo','director');
  v_tz := public.fn_user_tz(v_org, p_telegram_chat_id);

  if v_phone is null and v_text <> '' then
    v_m := regexp_match(regexp_replace(v_text,'[\s\-\(\)]','','g'), '(\+?\d{7,15})');
    if v_m is not null then v_phone := regexp_replace(v_m[1],'\D','','g'); end if;
  elsif v_phone is not null then
    v_phone := nullif(regexp_replace(v_phone,'[^0-9+]','','g'),'');
  end if;
  if v_asesor_req is not null and not v_can_reassign then v_asesor_req := null; end if;
  if v_can_reassign and v_asesor_req is null
     and v_text ~* '(asign\w+|al\s+asesor|para\s+el\s+asesor|reasign\w+)' then
    v_m := regexp_match(v_text, 'asesor\s+([A-Za-z0-9áéíóúñ]+(?:\s+[A-Za-z0-9áéíóúñ]+)?)', 'i');
    if v_m is not null then
      v_asesor_req := case when v_m[1] ~ '^[0-9]+$' then 'asesor '||v_m[1] else v_m[1] end;
    end if;
  end if;
  if v_next is null and v_text <> '' then
    v_next := nullif(trim(coalesce(
      (regexp_match(v_text, 'pr[oó]xima\s+acci[oó]n\s*(?:es|ser[ií]a|:)?\s*([a-záéíóúñ][a-záéíóúñ]+(?:\s+(?:le|lo|la|les))?)', 'i'))[1],
      (regexp_match(v_text, '\y(ll[aá]mar\w*|ll[aá]mal\w*|contact(?!os?\y)\w+|enviar\w*|envial\w*|mandar\w*|mandal\w*|visitar\w*|agendar\w*|escribir\w*|cotizar\w*|presentar\w*|reunir\w*|seguir\w*|mostrar\w*)\y', 'i'))[1]
    )),'');
  end if;

  select token, payload into v_etoken, v_epayload
  from public.bot_pending_actions
  where telegram_chat_id=p_telegram_chat_id and action_type='create_lead' and consumed_at is null
    and (expires_at is null or expires_at>now())
  order by created_at desc limit 1;

  if v_etoken is not null then
    if (v_phone is not null and nullif(v_epayload->>'phone','') is not null and v_phone <> (v_epayload->>'phone'))
       or (v_name is not null and nullif(v_epayload->>'name','') is not null and lower(v_name) <> lower(v_epayload->>'name')) then
      update public.bot_pending_actions set consumed_at=now() where token=v_etoken;
      v_etoken := null; v_epayload := null;
    end if;
  end if;

  v_p := coalesce(v_epayload,'{}'::jsonb)
    || (case when v_name is not null then jsonb_build_object('name',v_name) else '{}'::jsonb end)
    || (case when v_phone is not null then jsonb_build_object('phone',v_phone) else '{}'::jsonb end)
    || (case when v_email is not null then jsonb_build_object('email',v_email) else '{}'::jsonb end)
    || (case when v_stage is not null then jsonb_build_object('stage',v_stage) else '{}'::jsonb end)
    || (case when v_project is not null then jsonb_build_object('project',v_project) else '{}'::jsonb end)
    || (case when v_campaign is not null then jsonb_build_object('campaign',v_campaign) else '{}'::jsonb end)
    || (case when v_budget_text is not null then jsonb_build_object('budget_text',v_budget_text) else '{}'::jsonb end)
    || (case when v_budget_num is not null then jsonb_build_object('budget_numeric',v_budget_num) else '{}'::jsonb end)
    || (case when v_notas is not null then jsonb_build_object('notas',v_notas) else '{}'::jsonb end)
    || (case when v_next is not null then jsonb_build_object('next_action',v_next) else '{}'::jsonb end)
    || (case when v_asesor_req is not null then jsonb_build_object('new_asesor_name',v_asesor_req) else '{}'::jsonb end);

  v_at := coalesce(public.parse_relative_or_abs_es(v_when, v_tz), public.parse_relative_or_abs_es(v_text, v_tz));
  if v_at is not null then
    v_p := v_p || jsonb_build_object('next_action_at', to_char(v_at,'YYYY-MM-DD"T"HH24:MI:SSOF'));
  end if;

  v_fname := nullif(v_p->>'name','');
  v_fphone := nullif(v_p->>'phone','');
  v_fnext := nullif(v_p->>'next_action','');
  v_fwhen := nullif(v_p->>'next_action_at','');
  if v_fnext is null and v_fwhen is not null then v_fnext := 'Llamar'; v_p := v_p || jsonb_build_object('next_action','Llamar'); end if;
  -- Resolve business only during creation, using this organization's own configuration.
  -- Remove the known contact name before reading free-text business hints.
  v_business_text:=coalesce(nullif(v_args->>'business',''),nullif(v_args->>'negocio',''),v_text);
  if nullif(v_args->>'business','') is null and nullif(v_args->>'negocio','') is null and v_fname is not null then
    v_business_text:=replace(lower(v_business_text),lower(v_fname),' ');
  end if;
  v_business:=public.fn_org_business_match(v_org,v_business_text);
  if coalesce((v_business->>'ambiguous')::boolean,false) then
    v_business_pending:=true; v_p:=v_p-'stage';
  elsif v_business is not null then
    v_resolved_stage:=public.fn_org_stage(v_org,nullif(v_stage,''));
    if nullif(v_stage,'') is null
       or (public.unaccent(lower(v_stage)) in ('nuevo registro','contactame ya','primer contacto','primera etapa','nuevo','new','inbound')
           or v_resolved_stage=public.fn_org_stage(v_org,'primera etapa'))
          and strpos(public.unaccent(lower(v_text)),public.unaccent(lower(coalesce(v_stage,''))))=0 then
      v_p:=v_p||jsonb_build_object('stage',v_business->>'entryStage');
    elsif not(v_business->'stages' ? v_resolved_stage) then
      return jsonb_build_object('ok',false,'needs_input','business_stage','reply',jsonb_build_object('text','El negocio '||(v_business->>'label')||' no corresponde a la etapa indicada. Dime el negocio y la etapa que quieres usar.','inline_keyboard','[]'::jsonb));
    end if;
    v_p:=v_p||jsonb_build_object('_business_line',v_business->>'id','_business_label',v_business->>'label','_needs_business',false);
  elsif nullif(coalesce(v_args->>'business',v_args->>'negocio'),'') is not null or coalesce((v_epayload->>'_needs_business')::boolean,false) then
    v_business_pending:=true;
  end if;
  v_stage_given := nullif(v_p->>'stage','') is not null; v_fstage := public.fn_org_stage(v_org,coalesce(nullif(v_p->>'stage',''),'primera etapa'));
  if v_fstage is null and not v_business_pending then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text',
      'Indica una etapa de tu empresa: '||coalesce(array_to_string(public.fn_org_stages_list(v_org),' · '),'sin etapas configuradas')||'.','inline_keyboard','[]'::jsonb));
  end if;
  if not v_business_pending then v_p := v_p || jsonb_build_object('stage', v_fstage);
  else v_p:=v_p||jsonb_build_object('_needs_business',true); end if;

  if v_business_pending then v_state:='ask_business';
  elsif v_fphone is null then v_state := 'ask_phone';
  elsif v_fname is null then v_state := 'ask_name';
  elsif v_fnext is not null and v_fwhen is null then v_state := 'ask_time';
  else v_state := 'ready'; end if;

  v_p := v_p || jsonb_build_object('_ready', (v_state='ready'));
  v_token := public._bsc_upsert_pending(p_telegram_chat_id, v_profile, v_org, v_etoken, v_p);

  update public.bot_pending_actions set consumed_at=now()
  where telegram_chat_id=p_telegram_chat_id and consumed_at is null
    and action_type in ('create_lead','upsert_lead','update_fields')
    and token <> v_token;

  if v_state='ask_business' then
    return jsonb_build_object('ok',true,'needs_input','business','reply',jsonb_build_object('text','¿A qué negocio pertenece este contacto? '||(select string_agg(x->>'label',' · ') from jsonb_array_elements((select meta_config#>'{crm,businessLines}' from public.organizations where id=v_org)) x),'inline_keyboard','[]'::jsonb));
  elsif v_state='ask_phone' then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text','Para registrar el cliente necesito su teléfono. ¿Cuál es el número?','parse_mode',null,'inline_keyboard','[]'::jsonb));
  elsif v_state='ask_name' then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text','Tengo el teléfono '||public._bot_fmt_phone(v_fphone)||'. ¿Cómo se llama el cliente?','parse_mode',null,'inline_keyboard','[]'::jsonb));
  elsif v_state='ask_time' then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text','Anoté la próxima acción "'||v_fnext||'" para '||v_fname||'. ¿Para qué fecha y hora la agendo? (ej: "mañana 3pm", "hoy en 2 horas")','parse_mode',null,'inline_keyboard','[]'::jsonb));
  end if;

  v_money := case when (v_p->>'budget_numeric') is not null then public._bot_fmt_money((v_p->>'budget_numeric')::bigint)
                  else coalesce(nullif(v_p->>'budget_text',''),'—') end;
  v_fecha := case when v_fwhen is not null then public._bot_fmt_when(v_fwhen::timestamptz) else '—' end;
  v_lines := array['Voy a registrar el siguiente lead:'];
  v_lines := v_lines || ('Cliente: '||v_fname);
  if nullif(v_p->>'_business_label','') is not null then v_lines:=v_lines||('Negocio: '||(v_p->>'_business_label')); end if;
  v_lines := v_lines || ('Tel: '||public._bot_fmt_phone(v_fphone));
  v_lines := v_lines || ('Estatus: '||v_fstage);
  v_lines := v_lines || ('Presupuesto: '||v_money);
  v_lines := v_lines || ('Proyecto: '||coalesce(nullif(v_p->>'project',''),'—'));
  v_lines := v_lines || ('Campaña: '||coalesce(nullif(v_p->>'campaign',''),'—'));
  v_lines := v_lines || ('Próx. acción: '||coalesce(v_fnext,'—')||case when v_fwhen is not null then ' — '||v_fecha else '' end);
  v_lines := v_lines || ('Notas: '||coalesce(nullif(v_p->>'notas',''),'—'));
  if nullif(v_p->>'new_asesor_name','') is not null then
    v_lines := v_lines || ('Asesor: '||(v_p->>'new_asesor_name'));
  end if;
  v_summary := array_to_string(v_lines,E'\n');

  -- Aviso de datos faltantes: se incluye en el SUMMARY para que bot_finalize_reply lo conserve al re-armar la tarjeta.
  if v_money = '—' then v_falta := array_append(v_falta, 'presupuesto'); end if;
  if v_fnext is null then v_falta := array_append(v_falta, 'próxima acción'); end if;
  if not v_stage_given then v_falta := array_append(v_falta, 'etapa/status (lo dejé en "'||v_fstage||'")'); end if;
  if cardinality(v_falta) > 0 then
    v_falta_txt := E'\n\n📝 Para que tu registro quede completo me falta: ' || array_to_string(v_falta, ', ')
                || '. Pásamelo si lo tienes; o registralo así con el botón de abajo.';
    v_summary := v_summary || v_falta_txt;
  end if;

  update public.bot_pending_actions set summary=v_summary where token=v_token;
  v_kb := public._bot_kb_confirm(v_token);

  return jsonb_build_object('ok',true,'staged',true,'token',v_token,'reply',jsonb_build_object('text',v_summary||E'\n\n¿Confirmas?','parse_mode',null,'inline_keyboard',v_kb));
end; $function$;
CREATE OR REPLACE FUNCTION public._bot_execute_pending(p_telegram_chat_id bigint, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.bot_pending_actions;
  v_inner jsonb; v_phone text; v_as jsonb; v_org_id uuid; v_profile_id uuid; v_role text; v_notas text;
begin
  select * into v_row from public.bot_pending_actions
   where token = p_token and telegram_chat_id = p_telegram_chat_id and consumed_at is null limit 1;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'code','pending_not_found','reply', jsonb_build_object('text','Esta confirmación venció o ya se procesó.','parse_mode', null,'inline_keyboard', public._bot_kb_back()));
  end if;
  if v_row.expires_at < now() then
    update public.bot_pending_actions set consumed_at = now() where id = v_row.id;
    return jsonb_build_object('ok', false, 'code','pending_expired','reply', jsonb_build_object('text','Esta confirmación venció. Vuelve a pedirlo.','parse_mode', null,'inline_keyboard', public._bot_kb_back()));
  end if;
  if v_row.action_type='create_lead' and v_row.payload->>'_needs_business'='true' then
    return jsonb_build_object('ok',false,'needs_input','business','reply',jsonb_build_object('text','Todavía no registré el contacto. Primero dime a qué negocio pertenece.','inline_keyboard','[]'::jsonb));
  end if;
  update public.bot_pending_actions set consumed_at = now() where id = v_row.id;

  if left(v_row.action_type, 3) = 'gv_' then
    v_inner := public.bot_nlu_dispatch_gvintell_v2(
      p_telegram_chat_id,
      substring(v_row.action_type from 4),
      (v_row.payload - 'client_name' - 'name' - 'nombre')
        || jsonb_build_object('client_name', v_row.payload->>'phone'));
    return v_inner;
  end if;

  if v_row.action_type in ('reco','ficha') then
    v_phone := v_row.payload->>'phone';
    if v_row.action_type = 'reco' then
      return public.bot_recomendar_propiedades(p_telegram_chat_id, coalesce(v_phone,''), coalesce(v_row.payload->>'context',''));
    else
      return public.bot_ficha_cliente(p_telegram_chat_id, coalesce(v_phone,''));
    end if;
  end if;

  -- Reasignación tras elegir un homónimo: re-ejecuta con el teléfono elegido (resolución única).
  if v_row.action_type = 'reassign' then
    return public.bot_reassign_lead(p_telegram_chat_id, coalesce(v_row.payload->>'phone',''), coalesce(v_row.payload->>'target',''));
  end if;

  v_phone := v_row.payload->>'phone';
  if coalesce(v_phone,'') <> '' then
    v_as := public.identify_asesor_by_telegram(p_telegram_chat_id);
    if coalesce((v_as->>'paired')::boolean,false) then
      v_org_id := (v_as->>'organization_id')::uuid;
      v_profile_id := (v_as->>'profile_id')::uuid;
      v_role := coalesce(v_as->>'role','asesor');
      v_phone := public._bot_canonical_phone(v_org_id, v_profile_id, v_role, v_phone);
    end if;
  end if;

  case v_row.action_type
    when 'create_lead' then
      v_inner := public.bot_upsert_lead(p_telegram_chat_id, v_phone, v_row.payload->>'name', v_row.payload->>'email', v_row.payload->>'stage', v_row.payload->>'budget_text', nullif(v_row.payload->>'budget_numeric','')::bigint, v_row.payload->>'project', v_row.payload->>'campaign', null, nullif(v_row.payload->>'score','')::integer, nullif(v_row.payload->>'hot','')::boolean, v_row.payload->>'next_action', nullif(v_row.payload->>'next_action_at','')::timestamptz, v_row.payload->>'new_asesor_name');
      if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
      v_notas := nullif(trim(coalesce(v_row.payload->>'notas','')),'');
      if v_notas is not null then perform public.bot_add_expediente_note(p_telegram_chat_id, v_phone, 'Alta de cliente', v_notas, 'telegram'); end if;
    when 'upsert_lead' then
      v_inner := public.bot_upsert_lead(p_telegram_chat_id, v_phone, v_row.payload->>'name', v_row.payload->>'email', v_row.payload->>'stage', v_row.payload->>'budget_text', nullif(v_row.payload->>'budget_numeric','')::bigint, v_row.payload->>'project', v_row.payload->>'campaign', v_row.payload->>'bio', nullif(v_row.payload->>'score','')::integer, nullif(v_row.payload->>'hot','')::boolean, v_row.payload->>'next_action', nullif(v_row.payload->>'next_action_at','')::timestamptz, v_row.payload->>'new_asesor_name');
    when 'update_fields' then
      v_inner := public.bot_update_lead_fields(p_telegram_chat_id, v_phone, v_row.payload->>'name', v_row.payload->>'email', v_row.payload->>'stage', v_row.payload->>'budget_text', nullif(v_row.payload->>'budget_numeric','')::bigint, v_row.payload->>'project', v_row.payload->>'campaign', v_row.payload->>'bio', nullif(v_row.payload->>'score','')::integer, nullif(v_row.payload->>'hot','')::boolean, v_row.payload->>'next_action', nullif(v_row.payload->>'next_action_at','')::timestamptz, v_row.payload->>'new_asesor_name');
    when 'add_seguimiento' then
      v_inner := public.bot_add_seguimiento(p_telegram_chat_id, v_phone, v_row.payload->>'tipo', v_row.payload->>'resumen');
    when 'add_comunicacion' then
      v_inner := public.bot_add_comunicacion(p_telegram_chat_id, v_phone, v_row.payload->>'tipo', v_row.payload->>'resumen', v_row.payload->>'transcripcion', nullif(v_row.payload->>'ocurrio_en','')::timestamptz, nullif(v_row.payload->>'duracion_seg','')::integer);
    when 'add_expediente_note' then
      v_inner := public.bot_add_expediente_note(p_telegram_chat_id, v_phone, v_row.payload->>'titulo', v_row.payload->>'contenido', coalesce(v_row.payload->>'source','telegram'));
    when 'add_expediente_voice' then
      v_inner := public.bot_add_expediente_voice(p_telegram_chat_id, v_phone, v_row.payload->>'titulo', v_row.payload->>'transcripcion', nullif(v_row.payload->>'duracion_seg','')::integer, v_row.payload->>'storage_path');
    when 'add_task' then
      v_inner := public.bot_add_task(p_telegram_chat_id, v_phone, v_row.payload->>'text', nullif(v_row.payload->>'due_at','')::timestamptz, v_row.payload->>'priority');
    when 'set_ai_agent' then
      v_inner := public.bot_set_ai_agent(p_telegram_chat_id, v_phone, v_row.payload->>'agent_key');
    when 'create_deal' then
      v_inner := public.bot_create_deal(p_telegram_chat_id, v_phone, nullif(v_row.payload->>'amount','')::bigint, coalesce(v_row.payload->>'currency','USD'), nullif(v_row.payload->>'project_unit_id','')::uuid, nullif(v_row.payload->>'signed_at','')::timestamptz, v_row.payload->>'notes');
    when 'soft_delete' then
      v_inner := public.bot_soft_delete_lead(p_telegram_chat_id, v_phone, v_row.payload->>'reason');
    else
      return jsonb_build_object('ok', false, 'code','unknown_action_type','reply', jsonb_build_object('text','No conozco esa acción: ' || v_row.action_type,'parse_mode', null,'inline_keyboard', public._bot_kb_back()));
  end case;

  if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
  return jsonb_build_object('ok', true, 'data', v_inner,
    'reply', jsonb_build_object('text', public.fn_fmt_hecho(v_row.summary), 'parse_mode', null,
      'inline_keyboard', case when v_phone is not null then jsonb_build_array(jsonb_build_array(public._bot_btn('Ver ficha', 'view', regexp_replace(v_phone,'[^0-9]','','g')), public._bot_btn('Menú', 'menu', '_'))) else public._bot_kb_back() end));
end; $function$;
CREATE OR REPLACE FUNCTION public.bot_nlu_dispatch_gvintell(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_tool text := lower(coalesce(p_tool_name, ''));
  v_args jsonb := coalesce(p_args, '{}'::jsonb);
  v_stage text; v_zoom_when text; v_next_when text; v_has_next_action boolean;
  -- mig 245: el plan de la llamada · mig 255: la nota al expediente
  v_txt text; v_norm text; v_nota jsonb;
  v_plan_report uuid; v_plan_lead uuid; v_plan_org uuid;
  v_lead_name text; v_asesor_name text; v_zoom_at timestamptz;
  v_res jsonb; v_mgr bigint;
begin
  -- Space requests precede catalog routing and pending-plan consumption.
  v_txt:=public._bot_space_request_text(p_args);
  v_norm:=public.unaccent(lower(v_txt));
  if v_tool in ('space_documents','get_document','buscar_documentos','documents')
     or (public._bot_is_space_document_request(v_norm)
       and (v_norm ~ '(mi[[:space:]]*espa|mi[[:space:]]+space)' or v_norm !~ '\y(clientes?|pacientes?|prospectos?|expediente)\y')
       and v_tool not in
       ('create_lead','upsert_lead','change_stage','update_fields','add_expediente_note','add_expediente_voice','add_seguimiento','add_comunicacion','multi','multi_task','create_team_actions','create_team_action','create_personal_reminder','create_task','add_task','assign_task','delete_task','soft_delete')) then
    v_res:=public.bot_documentos_espacio(p_telegram_chat_id,coalesce(p_args,'{}'::jsonb)||jsonb_build_object('input_text',v_txt));
    if coalesce((v_res->>'found')::boolean,false)
      or v_tool in ('space_documents','get_document','buscar_documentos','documents')
      or v_norm ~ '(mi[[:space:]]*espa|mi[[:space:]]+space|docu[a-z]*|archivos?|contratos?|informes?|reportes?|presentacion|manual|notion|figma|excel|planilla|spreadsheet)' then
      return v_res;
    end if;
  end if;
  -- mig 318: repartir la cartera de un asesor (solo dirección) y deshacerlo.
  -- Se activa SOLO por tool_name exacto, nunca por el texto.
  if lower(coalesce(p_tool_name,'')) in ('redistribuir_leads','repartir_cartera','distribuir_leads') then
    -- mig 300: el detector del flujo manda solo origen/destinos, asi que
    -- «los mas antiguos» y «de segunda etapa» se perdian. Si la frase trae
    -- filtros (o no trae destino), la lee el parser de la base. Con DOS o mas
    -- destinos NO se toca: ese reparto lo arma bien el flujo.
    v_res := null;
    if coalesce(nullif(btrim(p_args->>'input_text'), ''), '') <> ''
       and (case when jsonb_typeof(p_args->'destinos') = 'array'
                 then jsonb_array_length(p_args->'destinos') else 0 end) <= 1
       and coalesce(p_args->>'etapa','') = ''
    then
      v_res := public.bot_reasignar_desde_texto(p_telegram_chat_id, p_args->>'input_text');
    end if;
    if v_res is not null then return v_res; end if;
    return public.bot_redistribuir_leads(p_telegram_chat_id, coalesce(p_args, '{}'::jsonb));
  end if;
  if lower(coalesce(p_tool_name,'')) in ('deshacer_redistribucion','undo_redistribucion') then
    return public.bot_deshacer_redistribucion(p_telegram_chat_id, coalesce(p_args, '{}'::jsonb));
  end if;

  -- mig 298: la misma orden, dicha en palabras («mueve los 50 clientes más
  -- antiguos de Gael de segunda etapa a Carlos»). Solo arma el PLAN y pide
  -- confirmación: por texto NUNCA se mueve una cartera. Devuelve null si la
  -- frase no era una reasignación, y el asistente sigue su curso.
  if v_tool in ('','menu') and coalesce(p_args->>'interpreted','') <> 'true' then
    v_res := public.bot_reasignar_desde_texto(p_telegram_chat_id,
               coalesce(nullif(btrim(p_args->>'input_text'), ''), ''));
    if v_res is not null then return v_res; end if;
  end if;

  -- mig 300: el desglose del intérprete manda. Va derecho al plural, que
  -- respeta responsable y hora de cada tarea. Nada de regex sobre el crudo.
  if lower(coalesce(p_tool_name,'')) in ('create_team_actions','create_team_action')
     and jsonb_typeof(p_args->'tareas') = 'array'
     and jsonb_array_length(p_args->'tareas') > 0 then
    v_res := public.bot_create_team_actions(p_telegram_chat_id, p_args->'tareas', false);
    -- Si quedó como plan a confirmar, se recuerda para que el «sí» lo aplique.
    if coalesce(v_res#>>'{reply,text}','') like 'Entendí%' then
      delete from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id;
      insert into public.bot_pending_confirm (telegram_chat_id, action, organization_id, payload)
      values (p_telegram_chat_id, 'team_plan',
              (select organization_id from public.profiles
                where telegram_chat_id = p_telegram_chat_id and coalesce(active,true)
                order by updated_at desc nulls last limit 1),
              jsonb_build_object('tareas', p_args->'tareas'));
    end if;
    return v_res;
  end if;

  -- mig 296: un ENCARGO a otra persona se reconoce al entrar.
  -- Exige responsable Y verbo: una pregunta nunca cumple las dos.
  if jsonb_typeof(p_args->'tareas') is distinct from 'array'
     and coalesce(p_args->>'interpreted','') <> 'true'
     and coalesce(lower(p_tool_name),'') in ('','menu')
     and coalesce(jsonb_array_length(public.fn_ventas_split_dictado(
           (select organization_id from public.profiles
             where telegram_chat_id = p_telegram_chat_id and coalesce(active,true)
             order by updated_at desc nulls last limit 1),
           coalesce(nullif(btrim(p_args->>'input_text'),''),
                    nullif(btrim(p_args->>'text'),''), ''))), 0) < 2
     and public._bot_responsable_del_texto(coalesce(
         nullif(btrim(p_args->>'input_text'),''),
         nullif(btrim(p_args->>'text'),''), '')) is not null
     and exists (select 1 from public._ventas_find_profile(
           (select organization_id from public.profiles
             where telegram_chat_id = p_telegram_chat_id and coalesce(active,true)
             order by updated_at desc nulls last limit 1),
           public._bot_responsable_del_texto(coalesce(
             nullif(btrim(p_args->>'input_text'),''),
             nullif(btrim(p_args->>'text'),''), ''))))
     and lower(coalesce(p_args->>'input_text', p_args->>'text', ''))
         ~ '(?i)\y(as[ií]gnale|asignar|asigna|ponle|d[ií]le|enc[aá]rgale|p[ií]dele|pedirle|solic[ií]tale)\y' then
    return public.bot_create_team_action(p_telegram_chat_id,
      coalesce(public._bot_tarea_del_texto(coalesce(p_args->>'input_text', p_args->>'text')),
               p_args->>'input_text'),
      coalesce(p_args->>'input_text', p_args->>'text'),
      public._bot_responsable_del_texto(coalesce(p_args->>'input_text', p_args->>'text')));
  end if;
  if jsonb_typeof(v_args->'query') = 'object' then
    if v_tool = '' then v_tool := lower(coalesce(v_args#>>'{query,tool_name}', '')); end if;
    if jsonb_typeof(v_args#>'{query,args}') = 'object' then v_args := v_args#>'{query,args}'; end if;
  end if;



  if exists(select 1 from public.bot_pending_actions a
      join public.profiles p on p.organization_id=a.organization_id and p.telegram_chat_id=a.telegram_chat_id and p.active
      where a.telegram_chat_id=p_telegram_chat_id and a.action_type='create_lead' and a.consumed_at is null
        and (a.expires_at is null or a.expires_at>now()) and a.payload->>'_needs_business'='true'
        and public.fn_org_business_match(a.organization_id,coalesce(v_args->>'input_text',v_args->>'text','')) is not null) then
    return public.bot_stage_create_lead(p_telegram_chat_id,v_args);
  end if;

  /* ── EL PLAN DE LA LLAMADA (mig 245) ──────────────────────────────────────
     Al tocar «Ya estudié, este es mi plan» queda un reporte `awaiting_plan`
     abierto y el asistente pide el plan. En Telegram el flujo de n8n atrapa esa
     respuesta ANTES del cerebro; el Copilot NO tiene esa rama, así que el plan
     caía como una nota suelta al expediente. Se resuelve donde vive la causa —el
     cerebro—: si hay un plan pendiente, lo que la persona escribe ES el plan. */
  v_txt := btrim(coalesce(v_args->>'input_text', v_args->>'texto', v_args->>'raw_text',
                          v_args->>'message', v_args->>'contenido', v_args->>'nota', ''));
  -- mig 268: agendar un Zoom o una visita CON UN CLIENTE no es una tarea de equipo.
  if v_txt <> '' and v_tool in ('add_task','create_task','team_action','add_team_action','crear_tarea','asignar_tarea','agenda_personal') then
    v_norm := public.unaccent(lower(v_txt));
    if v_norm ~ '\y(agend\w*|program\w*|reagend\w*|mueve|cambia)\y' then
      null;
    end if;
    -- mig 282: varias tareas en una frase, cada una con su hora.
    if v_tool in ('create_personal_reminder','add_task','create_team_action')
       and jsonb_array_length(public.fn_partir_tareas(v_txt)) > 1 then
      return public.bot_create_team_actions(p_telegram_chat_id,
               public.fn_partir_tareas(v_txt), true);
    end if;
    -- mig 274: «asignale a Fulano …» es una tarea PARA Fulano.
    -- mig 294: hace falta un VERBO de encargo. Sin eso, una pregunta
    -- («¿cuáles son mis actividades?») se convertía en tarea.
    if public._bot_responsable_del_texto(v_txt) is not null
       and v_norm ~ '\y(asigna\w*|asignale|ponle|dile|encargale|encargarle|pidele|pedirle|solicitale|solicitarle|recuerdale|recordarle|comentale|avisale|mandale|escribele)\y' then
      v_tool := 'create_team_action';
      v_args := v_args || jsonb_build_object('responsable', public._bot_responsable_del_texto(v_txt));
      if coalesce(btrim(v_args->>'text'),'') = '' and public._bot_tarea_del_texto(v_txt) is not null then
        v_args := v_args || jsonb_build_object('text', public._bot_tarea_del_texto(v_txt));
      end if;
    end if;
    if v_tool = 'create_team_action' then
      null;
    elsif v_norm ~ '\y(agend\w*|program\w*|reagend\w*|mueve|cambia)\y' then
      if v_norm ~ '\y(zoom|reunion|videollamada)\y' then
        v_tool := 'set_zoom_datetime';
      elsif v_norm ~ '\y(visita|recorrido|showing)\y' then
        v_tool := 'agendar_visita';
      end if;
      if v_tool in ('set_zoom_datetime','agendar_visita') then
        if coalesce(btrim(v_args->>'client_name'),'') = '' then
          v_args := v_args || jsonb_build_object('client_name', public._bot_cliente_del_texto(v_txt));
        end if;
        if coalesce(btrim(v_args->>'fecha'),'') = '' then
          v_args := v_args || jsonb_build_object('fecha', v_txt);
        end if;
      end if;
    end if;
    v_norm := null;
  end if;

  if v_txt <> '' then
    select r.id, r.lead_id, r.organization_id
      into v_plan_report, v_plan_lead, v_plan_org
    from public.proactive_pending_reports r
    where r.advisor_telegram_id = p_telegram_chat_id
      and r.status = 'open' and r.kind = 'awaiting_plan'
      and (r.expires_at is null or r.expires_at > now())
    order by r.created_at desc limit 1;
  end if;

  if v_plan_report is not null then
    v_norm := public.unaccent(lower(v_txt));

    if v_norm ~ '^/'
       or v_norm ~ '^(menu|inicio|start|home|ayuda|hola|buenas|buenos dias|buenas tardes|buenas noches)($|\s)'
       or v_norm ~ '^(si|no|ok|okay|dale|listo|cancelar|cancela|confirmar|confirmo)[.!]?$'
       or v_norm ~ '(mis clientes|lista de clientes|mis leads|mi agenda|mis pendientes|que tengo hoy|proximas acciones|kpis|indicadores|como voy|mis numeros|pipeline|embudo)' then
      null;  -- Es un comando: pasa, y el plan sigue pendiente (mismo escape que Telegram).

    elsif v_norm ~ '(no tengo (un |el )?plan|sin plan|no lo prepare|no alcance a|no pude preparar|no se que decirle|necesito (apoyo|ayuda))' then
      select l.name into v_lead_name from public.leads l where l.id = v_plan_lead;
      v_res := public.fn_proactive_plan_giveup(jsonb_build_object(
        'organization_id', v_plan_org, 'advisor_telegram_id', p_telegram_chat_id,
        'lead_id', v_plan_lead, 'report_id', v_plan_report, 'raw_text', v_txt));
      for v_mgr in
        select x::bigint from jsonb_array_elements_text(coalesce(v_res->'manager_telegram_ids','[]'::jsonb)) as t(x)
      loop
        begin
          perform public.fn_log_proactive_copilot(v_mgr,
            '▸ Un asesor necesita apoyo' || chr(10) || '· ' || coalesce(v_res->>'admin_text',''), 'ai');
        exception when others then null; end;
      end loop;
      return jsonb_build_object('ok', true,
        'reply', jsonb_build_object(
          'text', '▸ Sin problema, te apoyamos' || chr(10)
                || '· Lo dejé anotado en el expediente de «' || coalesce(v_lead_name,'este cliente') || '».' || chr(10)
                || '· Tu coordinador ya está avisado para prepararlo contigo.' || chr(10)
                || '· Puedes seguir usando el asistente con normalidad.',
          'parse_mode', null, 'inline_keyboard', '[]'::jsonb));

    else
      select l.name, coalesce(l.selected_time, l.next_action_at) into v_lead_name, v_zoom_at
        from public.leads l where l.id = v_plan_lead;
      select p.name into v_asesor_name from public.profiles p
        where p.telegram_chat_id = p_telegram_chat_id and coalesce(p.active,true)=true limit 1;

      v_res := public.fn_proactive_log_plan(jsonb_build_object(
        'lead_id', v_plan_lead, 'report_id', v_plan_report,
        'asesor_name', coalesce(v_asesor_name,'(sin asesor)'), 'plan', v_txt));

      if coalesce((v_res->>'ok')::boolean, false) then
        return jsonb_build_object('ok', true,
          'reply', jsonb_build_object(
            'text', '▸ Plan guardado' || coalesce(' — ' || v_lead_name, '') || chr(10)
                  || '· Quedó en el expediente del cliente; tu coordinador ya lo puede ver.'
                  || coalesce(chr(10) || '· Zoom: «' || public.fn_fmt_fecha_legible(v_zoom_at) || '»', '')
                  || chr(10) || '· Al terminar la llamada dime cómo te fue y actualizo la ficha.',
            'parse_mode', null, 'inline_keyboard', '[]'::jsonb));
      end if;
      perform public.fn_proactive_close_report(jsonb_build_object('id', v_plan_report, 'outcome', 'plan_no_guardado'));
    end if;
  end if;

  /* ── AÑADIR AL EXPEDIENTE (mig 255) ───────────────────────────────────────
     «Añade en el expediente de Angel G, que es una persona muy puntual» se iba a
     VER LA FICHA solo porque decía «expediente», y tomaba la frase entera como
     nombre del cliente. Acá se mira el VERBO: si es escribir, y el nombre resuelve
     a un cliente único de TU cartera, va por el camino de agregar nota —con el
     teléfono ya resuelto, para que nadie lo vuelva a adivinar—. Si no resuelve,
     no se toca nada y el asistente pregunta como siempre. */
  if v_txt <> ''
     and v_tool not in ('add_expediente_note','add_expediente_voice','add_seguimiento','add_comunicacion',
                        'upsert_lead','create_lead','update_fields','add_task','create_deal','soft_delete')
     and not exists (select 1 from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id)
  then
    begin
      v_nota := public._bot_nota_expediente_ref(p_telegram_chat_id, v_txt);
    exception when others then v_nota := jsonb_build_object('ok', false); end;

    if coalesce((v_nota->>'ok')::boolean, false) then
      return public.bot_nlu_dispatch_gvintell_required_fields_orig(
        p_telegram_chat_id, 'add_expediente_note',
        jsonb_build_object('phone', v_nota->>'phone', 'titulo', 'Nota del asesor',
                           'contenido', v_nota->>'contenido'));
    end if;
  end if;

  v_stage := nullif(btrim(coalesce(v_args->>'stage', v_args->>'st', v_args->>'etapa', '')), '');

  -- mig 239: «clientes sin movimiento» es una pregunta, no la lista de la cartera.
  if translate(lower(coalesce(v_args->>'input_text', v_args->>'texto', '')), 'áéíóú', 'aeiou')
     ~ '\y(sin\s+movimiento|sin\s+mover|sin\s+tocar|sin\s+actividad|inactivos?|abandonados?|enfriad)\y'
     and coalesce(v_tool,'') not in ('create_lead','upsert_lead','change_stage') then
    return public.bot_clientes_sin_movimiento(p_telegram_chat_id,
             coalesce(v_args->>'input_text', v_args->>'texto', ''));
  end if;

  -- mig 231: se suma lo que ESCRIBIÓ la persona (si no, el Zoom entraba en bucle).
  v_zoom_when := concat_ws(' ',
    v_args->>'zoom_at', v_args->>'zoom_datetime', v_args->>'selected_time', v_args->>'fecha_zoom',
    v_args->>'next_action_at', v_args->>'next_action_date',
    v_args->>'input_text', v_args->>'texto', v_args->>'raw_text');

  if v_stage = 'Zoom Agendado' and v_tool in ('change_stage', 'upsert_lead')
     and not public._bot_has_datetime_hint(v_zoom_when) then
    return jsonb_build_object('ok', false, 'needs_input', 'zoom_at',
      'reply', jsonb_build_object(
        'text', 'Perfecto. Para moverlo a Zoom Agendado necesito la fecha y hora exacta del Zoom. Ej: "mañana 5 pm" o "viernes 19 de julio 11 am".',
        'parse_mode', null, 'inline_keyboard', '[]'::jsonb));
  end if;

  v_has_next_action := nullif(btrim(coalesce(v_args->>'next_action', '')), '') is not null;
  v_next_when := concat_ws(' ',
    v_args->>'next_action_at', v_args->>'next_action_at_iso', v_args->>'next_action_date',
    v_args->>'when', v_args->>'due_at');

  if v_tool in ('update_next_action', 'add_task') and v_has_next_action
     and not public._bot_has_datetime_hint(v_next_when) then
    return jsonb_build_object('ok', false, 'needs_input', 'next_action_at',
      'reply', jsonb_build_object(
        'text', 'Listo, entiendo la próxima acción. ¿Para qué fecha y hora la programo? Ej: "hoy 4:30 pm", "mañana 10 am" o "en 3 horas".',
        'parse_mode', null, 'inline_keyboard', '[]'::jsonb));
  end if;

  return public.bot_nlu_dispatch_gvintell_required_fields_orig(p_telegram_chat_id, v_tool, v_args);
end;
$function$;
