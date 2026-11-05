CREATE OR REPLACE FUNCTION public.fn_proactive_get_pending(payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%ROWTYPE; v_hour int; v_in_quiet boolean := false;
  v_limit int := COALESCE(NULLIF(payload->>'limit','')::int,50); v_rows jsonb; v_synth int;
  v_tipos text[] := COALESCE(ARRAY(SELECT jsonb_array_elements_text(payload->'tipo_in')), ARRAY[]::text[]);
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id=v_org;
  IF NOT FOUND OR NOT v_cfg.enabled THEN RETURN jsonb_build_object('ok',true,'count',0,'reminders','[]'::jsonb,'reason','disabled'); END IF;
  v_hour := EXTRACT(hour FROM (now() AT TIME ZONE v_cfg.timezone))::int;
  IF v_cfg.quiet_start_hour > v_cfg.quiet_end_hour THEN v_in_quiet := (v_hour >= v_cfg.quiet_start_hour OR v_hour < v_cfg.quiet_end_hour);
  ELSE v_in_quiet := (v_hour >= v_cfg.quiet_start_hour AND v_hour < v_cfg.quiet_end_hour); END IF;
  WITH cand AS (
    SELECT r.id,r.lead_id,r.asesor_id,r.asesor_name,r.tipo,r.scheduled_at,r.payload,pr.telegram_chat_id AS advisor_tg,
      coalesce(pr.role,'asesor') AS role,
      row_number() OVER (PARTITION BY pr.telegram_chat_id ORDER BY date_trunc('minute', r.scheduled_at), (CASE WHEN r.tipo LIKE 'zoom%' OR r.tipo LIKE 'visita%' THEN 0 WHEN r.tipo LIKE 'next_action%' THEN 1 WHEN r.tipo IN ('team_action','personal','admin_overdue') THEN 2 WHEN r.tipo LIKE 'inactividad%' THEN 9 ELSE 5 END), r.scheduled_at, r.id) AS rn
    FROM public.proactive_reminders r
    JOIN public.profiles pr ON pr.organization_id=v_org AND (pr.id=r.asesor_id OR lower(pr.name)=lower(r.asesor_name)) AND pr.telegram_chat_id IS NOT NULL
    WHERE r.organization_id=v_org AND coalesce(pr.active,true) AND r.status='pending' AND r.scheduled_at<=now() AND (NOT v_in_quiet OR r.ignore_quiet)
      AND (cardinality(v_tipos)=0 OR r.tipo = ANY(v_tipos))
      AND (
        NOT (r.tipo LIKE 'inactividad%' OR r.tipo = 'next_action_3h')
        OR r.ignore_quiet
        OR public.fn_mkt_in_window(pr.id, now())
      )
      AND (
        r.tipo LIKE 'zoom%' OR r.tipo LIKE 'next_action%' OR r.tipo IN ('team_action','personal') OR r.tipo LIKE 'visita%' OR r.tipo LIKE 'evidence%' OR r.tipo LIKE 'admin%'
        OR NOT EXISTS (SELECT 1 FROM public.proactive_pending_reports o WHERE o.organization_id=v_org AND o.advisor_telegram_id=pr.telegram_chat_id AND o.status='open' AND (o.expires_at IS NULL OR o.expires_at>now()))
      )
  ), pick AS (SELECT * FROM cand WHERE rn=1 ORDER BY scheduled_at LIMIT v_limit),
  claimed AS (UPDATE public.proactive_reminders r SET status='sent',sent_at=now(),attempts=attempts+1 FROM pick WHERE r.id=pick.id
    RETURNING r.id,pick.lead_id,pick.asesor_id,pick.asesor_name,pick.tipo,pick.payload,pick.advisor_tg,pick.role),
  reports AS (INSERT INTO public.proactive_pending_reports (organization_id,advisor_telegram_id,lead_id,reminder_id,kind,status,expires_at)
    SELECT v_org,c.advisor_tg,c.lead_id,c.id,c.tipo,'open',
      CASE WHEN c.tipo='zoom_brief' THEN COALESCE(NULLIF(c.payload->>'zoom_at','')::timestamptz,now()+interval '4 hours')
           WHEN c.tipo LIKE 'next_action%' THEN COALESCE(NULLIF(c.payload->>'next_action_at','')::timestamptz,now()+interval '4 hours')
           ELSE now()+interval '12 hours' END
    FROM claimed c
    WHERE (c.advisor_tg > 0 or exists(select 1 from public.organizations o where o.id=v_org and o.meta_config#>>'{crm,copilotReminders}'='true'))
      AND c.tipo NOT IN ('team_action','personal','zoom_1h_missing','zoom_1h_ok','zoom_15min') AND c.tipo NOT LIKE 'visita%' AND c.tipo NOT LIKE 'evidence%' AND c.tipo NOT LIKE 'admin%'
    RETURNING reminder_id,id AS report_id),
  logged AS (
    /* Formato visual de los avisos (Ángel, 31-jul: «que no se vean secos»).
       Encabezado con «▸» (el chat lo pinta en menta y esconde la flecha; en
       Telegram queda una flecha limpia — ahí no hay Markdown, por eso NO se
       usan asteriscos) y el dato que importa entre comillas angulares, que se
       resalta sin mostrarse. La línea «▸» se pinta entera: no lleva comillas. */
    INSERT INTO public.tg_bot_activity (organization_id, telegram_chat_id, role, content, meta)
    SELECT v_org, c.advisor_tg, 'ai',
      COALESCE(
        CASE WHEN c.tipo='team_action' AND NULLIF(c.payload->>'text','') IS NOT NULL THEN
          CASE c.payload->>'fase'
            WHEN 'asignada' THEN '▸ Nueva actividad asignada'||chr(10)||'· «'||(c.payload->>'text')||'»'||chr(10)
                                 ||COALESCE('· Te la asignó '||NULLIF(c.payload->>'quien_asigna','')||' · la ves en Mi Espacio → Agenda','· La ves en Mi Espacio → Agenda')
            WHEN '60' THEN '▸ En 1 hora'||chr(10)||'· '||(c.payload->>'text')||COALESCE(' · «'||public.fn_fmt_cuando_legible(NULLIF(c.payload->>'due_at','')::timestamptz, COALESCE(NULLIF(c.payload->>'tz',''),'America/Cancun'))||'»','')
            WHEN '10' THEN '▸ En 10 minutos'||chr(10)||'· '||(c.payload->>'text')
            WHEN '0'  THEN '▸ Es la hora'||chr(10)||'· '||(c.payload->>'text')
            ELSE NULL
          END
        WHEN c.tipo='personal' AND NULLIF(c.payload->>'text','') IS NOT NULL THEN '▸ Recordatorio'||chr(10)||'· '||(c.payload->>'text') END,
        NULLIF(c.payload->>'text',''), NULLIF(c.payload->>'message',''),
        CASE WHEN c.tipo='zoom_brief' THEN (select case
              when c.lead_id is null then '▸ Zoom con un cliente'||chr(10)||'· Próximamente · estudia su información y prepárate.'
              else coalesce(
                '▸ Zoom'
                || coalesce(' — ' || nullif(public.fn_fmt_fecha_legible(coalesce(l2.selected_time, l2.next_action_at)), ''), '')
                || chr(10) || chr(10)
                || nullif(public.fn_lead_briefing_text(c.lead_id), '')
                || chr(10) || chr(10) || 'Repasa esto antes de entrar.',
                '▸ Zoom con un cliente'||chr(10)||'· Próximamente · estudia su información y prepárate.')
            end
            from public.leads l2 where l2.id = c.lead_id)
             WHEN c.tipo LIKE 'next_action%' THEN CASE WHEN coalesce(nullif(btrim(coalesce(c.payload->>'lead_name','')),''),'') = ''
                    THEN '▸ Acción programada con un cliente'||chr(10)||'· Próximamente · repasa su ficha antes de entrar.'
                    ELSE '▸ ' || btrim(c.payload->>'lead_name')
                      || chr(10) || '· ' || coalesce(nullif(btrim(coalesce(c.payload->>'next_action','')),''), 'Acción programada')
                      || coalesce(' · «' || public.fn_fmt_fecha_legible(nullif(c.payload->>'next_action_at','')::timestamptz) || '»', '')
                      || chr(10) || '· Repasa su ficha antes de entrar.' END
             WHEN c.tipo LIKE 'visita%' THEN '▸ Visita o recorrido'||chr(10)||'· Tienes uno agendado con un cliente próximamente.'
             WHEN c.tipo LIKE 'inactividad%' AND NULLIF(c.payload#>>'{leads_abandonados,texto}','') IS NOT NULL
               THEN '▸ Estos clientes siguen sin movimiento'||chr(10)
                    ||replace(c.payload#>>'{leads_abandonados,texto}', '• ', '· ')||chr(10)
                    ||'· Dales seguimiento o muévelos de etapa para que no se acumulen.'
             ELSE '▸ Recordatorio'||chr(10)||'· ' || c.tipo END),
      CASE WHEN c.tipo='team_action' THEN jsonb_build_object('kind','team_action','fase', COALESCE(c.payload->>'fase',''), 'action_id', c.payload->>'action_id')
           ELSE jsonb_build_object('kind', c.tipo) END
    FROM claimed c WHERE c.advisor_tg < 0
    RETURNING 1)
  SELECT
    jsonb_agg(jsonb_build_object('reminder_id',c.id,'report_id',rp.report_id,'lead_id',c.lead_id,'asesor_id',c.asesor_id,'asesor_name',c.asesor_name,'advisor_telegram_id',c.advisor_tg,'tipo',c.tipo,'payload',c.payload)) FILTER (WHERE c.advisor_tg > 0),
    count(*) FILTER (WHERE c.advisor_tg < 0)
  INTO v_rows, v_synth
  FROM claimed c LEFT JOIN reports rp ON rp.reminder_id=c.id;

  RETURN jsonb_build_object('ok',true,'count',COALESCE(jsonb_array_length(v_rows),0),'shadow_mode',v_cfg.shadow_mode,'test_telegram_id',v_cfg.test_telegram_id,'reminders',COALESCE(v_rows,'[]'::jsonb),
    'synthetic_logged', COALESCE(v_synth,0));
END; $function$;

CREATE OR REPLACE FUNCTION public.bot_nlu_dispatch_gvintell_v2(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_tool text := lower(coalesce(p_tool_name,''));
  v_args jsonb := coalesce(p_args,'{}'::jsonb);
  v_text text := trim(coalesce(v_args->>'input_text', v_args->>'text', v_args->>'query', ''));
  v_org_id uuid; v_profile_id uuid; v_view_all boolean := false; v_role text;
  v_name text; v_stage text; v_stage_in text; v_next_action text; v_zoom_at_text text; v_zoom_at timestamptz;
  v_lead record; m_name text[]; v_client_name text; v_advisor_name text;
  v_advisor_id uuid; v_advisor_label text; v_lead_id uuid; v_lead_name text; v_tz text;
begin
  if jsonb_typeof(v_args->'query') = 'object' then
    if v_tool = '' then v_tool := lower(coalesce(v_args#>>'{query,tool_name}','')); end if;
    if jsonb_typeof(v_args#>'{query,args}') = 'object' then v_args := v_args#>'{query,args}'; end if;
    v_text := trim(coalesce(v_args->>'input_text', v_args->>'text', v_args->>'query', v_text));
  end if;
  select p.organization_id, p.id, coalesce(p.view_all_leads,false), coalesce(p.role,'asesor')
    into v_org_id, v_profile_id, v_view_all, v_role
  from public.profiles p where p.telegram_chat_id = p_telegram_chat_id and coalesce(p.active,true)=true
  order by p.updated_at desc nulls last limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No estas conectado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;
  v_tz := public.fn_user_tz(v_org_id, p_telegram_chat_id);

  if v_tool in ('assign_client','reassign_client','assign_lead') then
    if v_role not in ('super_admin','admin','ceo','director') then
      return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No tienes permisos para asignar clientes.','inline_keyboard','[]'::jsonb));
    end if;
    v_client_name := nullif(trim(coalesce(v_args->>'client_name', v_args->>'name', '')), '');
    v_advisor_name := nullif(trim(coalesce(v_args->>'advisor_name', v_args->>'asesor_name', '')), '');
    if v_client_name is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Indica el nombre o teléfono del cliente a asignar.','inline_keyboard','[]'::jsonb)); end if;
    if v_advisor_name is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Indica el asesor destino. Ejemplo: asesor 2.','inline_keyboard','[]'::jsonb)); end if;
    select p2.id, p2.name into v_advisor_id, v_advisor_label from public.profiles p2
    where p2.organization_id = v_org_id and coalesce(p2.active,true)=true
      -- mig 228: cualquiera del lado VENTAS puede recibir un cliente (incluidos los
      -- directivos); solo se excluye el lado marketing (regla marketing ≠ ventas).
      and coalesce(p2.role,'asesor') <> 'marketing' and coalesce(p2.is_marketing_admin,false) = false
      and (public.fn_norm_nombre(p2.name) like '%'||public.fn_norm_nombre(v_advisor_name)||'%'
           or public.fn_obj_matchea(v_advisor_name, p2.name)
           or (regexp_replace(v_advisor_name,'[^0-9]','','g') <> '' and regexp_replace(coalesce(p2.name,''),'[^0-9]','','g') = regexp_replace(v_advisor_name,'[^0-9]','','g')))
    order by length(p2.name) asc limit 1;
    if v_advisor_id is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré al asesor destino "'||v_advisor_name||'".','inline_keyboard','[]'::jsonb)); end if;
    -- mig 232: elige por calidad de coincidencia y pregunta si hay empate.
    return public._bot_assign_client_safe(v_org_id, v_client_name, v_advisor_id, v_advisor_label);
    if v_lead_id is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré cliente con referencia "'||v_client_name||'".','inline_keyboard','[]'::jsonb)); end if;
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Listo. Asigné a '||coalesce(v_lead_name,'cliente')||' con '||coalesce(v_advisor_label,'asesor')||' y lo puse en Contáctame Ya (prioridad 1).','inline_keyboard','[]'::jsonb));
  end if;

  if public.unaccent(lower(v_text)) ~ '^(¿)?(que|cuales|cuantas) (son las |son mis |son |hay de |hay |son )?etapas' then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text',
      'Las etapas de tu empresa son: '||coalesce(array_to_string(public.fn_org_stages_list(v_org_id), ' · '),'sin etapas')||'.','inline_keyboard','[]'::jsonb));
  end if;

  if v_text ~* '(^|\s)(/clientes|mis\s+clientes|dame\s+el\s+nombre\s+de\s+mis\s+clientes|nombre\s+de\s+mis\s+clientes)(\s|$)' then v_tool := 'agenda';
  elsif v_text ~* '(^|\s)(/pipeline|pipeline|embudo)(\s|$)' then v_tool := 'pipeline'; end if;

  if v_tool in ('', 'auto') then
    if v_text ~* '(fecha.*zoom|zoom.*(mañana|manana|hoy|\d{1,2}|am|pm|:))' then v_tool := 'set_zoom_datetime';
    elsif v_text ~* '(cambia|mueve|actualiza).*(etapa)' then v_tool := 'change_stage';
    elsif v_text ~* '(cambia|actualiza).*(pr[oó]xima acci[oó]n)' then v_tool := 'update_next_action'; end if;
  end if;

  if v_tool in ('change_stage','update_stage','move_stage') then
    v_name := coalesce(v_args->>'client_name', v_args->>'name', v_args->>'nombre', null);
    v_stage := coalesce(v_args->>'stage', v_args->>'new_stage', v_args->>'etapa', null);
    v_zoom_at_text := coalesce(v_args->>'zoom_at', v_args->>'next_action_at', v_args->>'fecha_zoom', null);
    -- Copilot can send raw text without an LLM-provided stage. Parse both
    -- parts together, then resolve the target against THIS company's stages.
    m_name := regexp_match(v_text, '(?i)^(?:cambia|cambiar|actualiza|actualizar)\s+(?:la\s+)?etapa\s+(?:de|del)\s+(.+?)\s+(?:a|al)\s+(.+?)[.!]?$');
    if m_name is not null then
      v_name := coalesce(nullif(btrim(v_name),''),btrim(m_name[1]));
      v_stage := coalesce(nullif(btrim(v_stage),''),btrim(m_name[2]));
    end if;

    if v_name is null or trim(v_name)='' then m_name := regexp_match(v_text, '(?i)a\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]+)$'); if m_name is not null then v_name := trim(m_name[1]); end if; end if;
    if v_name is null or trim(v_name)='' then v_name := nullif(trim(regexp_replace(v_text, '(?i)\b(cambia|cambiar|actualiza|etapa|a|de|del|la|el|cliente|mueve|pasar|stage|zoom|agendado|concretado|mañana|manana|hoy|am|pm|\d{1,2}:?\d{0,2})\b',' ','g')), ''); end if;
    if v_name is null or trim(v_name)='' then v_name := (regexp_match(v_text, '(\+?[0-9][0-9 ().\-]{6,}[0-9])'))[1]; end if;
    if v_stage is null or trim(v_stage)='' then
      if v_text ~* 'zoom\s+agendado' then v_stage := 'Zoom Agendado';
      elsif v_text ~* 'zoom\s+concretado' then v_stage := 'Zoom Concretado';
      elsif v_text ~* 'seguimiento' then v_stage := 'Seguimiento';
      elsif v_text ~* 'nuevo\s+registro' then v_stage := 'Nuevo Registro'; end if;
    end if;
    if v_name is null or v_stage is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Indica cliente y etapa destino.','inline_keyboard','[]'::jsonb)); end if;
    v_stage_in := v_stage;
    v_stage := public.fn_org_stage(v_org_id,v_stage_in);
    if v_stage is null then
      return jsonb_build_object('ok', true, 'reply', jsonb_build_object(
        'text','No reconozco la etapa "'||v_stage_in||'". Las etapas de tu CRM son: '||
               array_to_string(public.fn_org_stages_list(v_org_id), ', ')||
               '. ¿A cuál lo muevo?','inline_keyboard','[]'::jsonb));
    end if;
    if (lower(v_stage)=lower(public.fn_org_appointment_stage(v_org_id)) or lower(v_stage)=lower('Visita Agendada')) and (v_zoom_at_text is null or trim(v_zoom_at_text)='') then
      v_zoom_at := public.parse_relative_or_abs_es(v_text, v_tz);
      if v_zoom_at is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Para pasar a "'||v_stage||'" necesito la fecha y hora. Ejemplo: "cambia etapa a '||v_stage||' mañana 9am".','inline_keyboard','[]'::jsonb)); end if;
    else v_zoom_at := public.parse_relative_or_abs_es(v_zoom_at_text, v_tz); end if;
    update public.leads l set stage = v_stage,
           next_action_at = case when lower(v_stage)=lower(public.fn_org_appointment_stage(v_org_id)) and v_zoom_at is not null then v_zoom_at else l.next_action_at end,
           next_action_date = case when lower(v_stage)=lower(public.fn_org_appointment_stage(v_org_id)) and v_zoom_at is not null then to_char(v_zoom_at at time zone v_tz,'YYYY-MM-DD HH24:MI') else l.next_action_date end,
           visita_at = case when lower(v_stage)=lower('Visita Agendada') and v_zoom_at is not null then v_zoom_at else l.visita_at end,
           updated_at = now()
     where l.id = (select l2.id from public.leads l2 where l2.organization_id = v_org_id and l2.deleted_at is null and (v_view_all or l2.asesor_id = v_profile_id)
         and (public.fn_norm_nombre(l2.name) like '%'||public.fn_norm_nombre(v_name)||'%' or (length(regexp_replace(v_name,'[^0-9]','','g')) >= 7 and l2.phone_normalized = regexp_replace(v_name,'[^0-9]','','g')))
         order by l2.updated_at desc nulls last limit 1)
    returning l.id, l.name, l.stage, l.next_action_at into v_lead;
    if not found then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré cliente con nombre o teléfono parecido a "'||v_name||'".','inline_keyboard','[]'::jsonb)); end if;
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text',
      'Listo. Etapa de '||v_lead.name||' actualizada a "'||v_lead.stage||'".' ||
      case when lower(v_lead.stage)=lower(public.fn_org_appointment_stage(v_org_id)) and v_zoom_at is not null then E'\nFecha '||v_lead.stage||': '||public.fn_fmt_fecha_legible(v_zoom_at, v_tz) when lower(v_lead.stage)=lower('Visita Agendada') and v_zoom_at is not null then E'\nFecha visita: '||public.fn_fmt_fecha_legible(v_zoom_at, v_tz) else '' end
    ,'inline_keyboard','[]'::jsonb));
  end if;

  if v_tool in ('set_zoom_datetime','update_zoom_datetime','zoom_date','set_zoom_date') then
    v_name := coalesce(v_args->>'client_name', v_args->>'name', v_args->>'nombre', null);
    v_zoom_at_text := coalesce(v_args->>'zoom_at', v_args->>'next_action_at', v_args->>'fecha_zoom', null);
    if v_name is null or trim(v_name)='' then m_name := regexp_match(v_text, '(?i)a\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]+)$'); if m_name is not null then v_name := trim(m_name[1]); end if; end if;
    if v_name is null or trim(v_name)='' then v_name := nullif(trim(regexp_replace(v_text, '(?i)\b(pon|poner|fecha|zoom|agendado|a|de|del|la|el|cliente|mañana|manana|hoy|pasado|en|las|pm|am|\d{1,2}:?\d{0,2})\b',' ','g')), ''); end if;
    if v_name is null or trim(v_name)='' then v_name := (regexp_match(v_text, '(\+?[0-9][0-9 ().\-]{6,}[0-9])'))[1]; end if;
    if v_name is null or trim(v_name)='' then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Dime el cliente para actualizar la fecha del Zoom.','inline_keyboard','[]'::jsonb)); end if;
    v_zoom_at := public.parse_relative_or_abs_es(coalesce(v_zoom_at_text, v_text), v_tz);
    if v_zoom_at is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No pude interpretar la fecha/hora. Ejemplo: mañana 9am o en 3 horas','inline_keyboard','[]'::jsonb)); end if;
    update public.leads l set next_action_at = v_zoom_at, next_action_date = to_char(v_zoom_at at time zone v_tz,'YYYY-MM-DD HH24:MI'), stage = case when lower(coalesce(l.stage,'')) in ('zoom concretado','seguimiento','cierre','perdido','visita agendada')              then l.stage else coalesce(public.fn_org_stage(v_org_id,'Zoom Agendado'),l.stage) end, next_action = case when coalesce(l.next_action,'') ~* 'zoom' then l.next_action else 'Zoom' end, updated_at = now()
     where l.id = (select l2.id from public.leads l2 where l2.organization_id = v_org_id and l2.deleted_at is null and (v_view_all or l2.asesor_id = v_profile_id)
         and (public.fn_norm_nombre(l2.name) like '%'||public.fn_norm_nombre(v_name)||'%' or (length(regexp_replace(v_name,'[^0-9]','','g')) >= 7 and l2.phone_normalized = regexp_replace(v_name,'[^0-9]','','g')))
         order by l2.updated_at desc nulls last limit 1)
    returning l.id, l.name, l.stage, l.next_action_at into v_lead;
    if not found then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré cliente con nombre o teléfono parecido a "'||v_name||'".','inline_keyboard','[]'::jsonb)); end if;
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Listo. Fecha del Zoom de '||v_lead.name||' actualizada a '||to_char(v_lead.next_action_at at time zone v_tz,'YYYY-MM-DD HH24:MI')||'.','inline_keyboard','[]'::jsonb));
  end if;

  if v_tool in ('update_next_action','next_action_update','set_next_action') then
    v_name := coalesce(v_args->>'client_name', v_args->>'name', v_args->>'nombre', null);
    v_next_action := coalesce(v_args->>'next_action', v_args->>'accion', v_args->>'proxima_accion', null);
    v_zoom_at_text := coalesce(v_args->>'next_action_at', v_args->>'zoom_at', v_args->>'fecha_zoom', null);
    if v_name is null or trim(v_name)='' then m_name := regexp_match(v_text, '(?i)a\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]+)$'); if m_name is not null then v_name := trim(m_name[1]); end if; end if;
    if v_name is null or trim(v_name)='' then v_name := nullif(trim(regexp_replace(v_text, '(?i)\b(cambia|actualiza|proxima|pr[oó]xima|accion|acci[oó]n|a|de|del|la|el|cliente|para)\b',' ','g')), ''); end if;
    if v_name is null or trim(v_name)='' then v_name := (regexp_match(v_text, '(\+?[0-9][0-9 ().\-]{6,}[0-9])'))[1]; end if;
    if v_name is null or trim(v_name)='' then return public.bot_nlu_dispatch(p_telegram_chat_id, v_tool, v_args); end if;
    if v_next_action is null or trim(v_next_action)='' then v_next_action := v_text; end if;
    v_zoom_at := public.parse_relative_or_abs_es(coalesce(v_zoom_at_text, case when v_text ~* '(mañana|manana|hoy|en\s+\d|\d{1,2}(:\d{2})?\s*(am|pm)?)' then v_text else null end), v_tz);
    update public.leads l set next_action = v_next_action, next_action_at = coalesce(v_zoom_at, l.next_action_at),
           next_action_date = case when v_zoom_at is not null then to_char(v_zoom_at at time zone v_tz,'YYYY-MM-DD HH24:MI') else l.next_action_date end, updated_at = now()
     where l.id = (select l2.id from public.leads l2 where l2.organization_id = v_org_id and l2.deleted_at is null and (v_view_all or l2.asesor_id = v_profile_id)
         and (public.fn_norm_nombre(l2.name) like '%'||public.fn_norm_nombre(v_name)||'%' or (length(regexp_replace(v_name,'[^0-9]','','g')) >= 7 and l2.phone_normalized = regexp_replace(v_name,'[^0-9]','','g')))
         order by l2.updated_at desc nulls last limit 1)
    returning l.id, l.name, l.next_action, l.next_action_at into v_lead;
    if not found then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré cliente con nombre o teléfono parecido a "'||v_name||'" para actualizar la próxima acción.','inline_keyboard','[]'::jsonb)); end if;
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text',
      'La próxima acción para '||v_lead.name||' ha sido actualizada a "'||v_lead.next_action||'".' ||
      case when v_lead.next_action_at is not null then E'\nFecha: '||to_char(v_lead.next_action_at at time zone v_tz,'YYYY-MM-DD HH24:MI') else '' end
    ,'inline_keyboard','[]'::jsonb));
  end if;

  return public.bot_nlu_dispatch(p_telegram_chat_id, v_tool, v_args);
end; $function$;

CREATE OR REPLACE FUNCTION public.fn_proactive_reschedule_apply(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_lead uuid := NULLIF(payload->>'lead_id','')::uuid;
  v_tg bigint := NULLIF(payload->>'advisor_telegram_id','')::bigint;
  v_new timestamptz; v_ai timestamptz; v_parsed timestamptz;
  v_agent_id uuid; v_name text; v_stage text; v_legible text; v_is_zoom boolean;
  v_label text;
  v_raw text := NULLIF(btrim(payload->>'raw_text'),'');
  v_now_cancun timestamptz := now() AT TIME ZONE 'America/Cancun';
BEGIN
  IF v_lead IS NULL OR v_tg IS NULL THEN RETURN jsonb_build_object('ok',false,'text','Faltan datos.'); END IF;
  IF v_raw IS NOT NULL THEN
    BEGIN v_parsed := public.parse_relative_or_abs_es(v_raw, 'America/Cancun'); EXCEPTION WHEN others THEN v_parsed := NULL; END;
  END IF;
  BEGIN v_ai := (payload->>'new_datetime_iso')::timestamptz; EXCEPTION WHEN others THEN v_ai := NULL; END;
  IF v_parsed IS NOT NULL THEN v_new := v_parsed;
  ELSIF v_raw IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'text','No entendí la fecha. Mándame algo como: mañana 3pm, en 3 horas, el jueves 3pm, o '||public.fn_fecha_humana((v_now_cancun + interval '1 day'),'America/Cancun',true)||'.');
  ELSIF v_ai IS NOT NULL THEN v_new := v_ai;
  ELSE RETURN jsonb_build_object('ok',false,'text','No entendí la fecha. Mándame algo como: mañana 3pm, en 3 horas, el jueves 3pm, o 22/05 15:00.'); END IF;
  IF (v_new AT TIME ZONE 'America/Cancun') < (v_now_cancun - interval '2 hours')
     OR extract(year FROM (v_new AT TIME ZONE 'America/Cancun')) < extract(year FROM v_now_cancun)
     OR extract(year FROM (v_new AT TIME ZONE 'America/Cancun')) > extract(year FROM v_now_cancun) + 1 THEN
    RETURN jsonb_build_object('ok',false,'text','Esa fecha quedó en pasado. Mándame una futura, ej: mañana 3pm, en 3 horas, el jueves 3pm, o '||public.fn_fecha_humana((v_now_cancun + interval '1 day'),'America/Cancun',true)||'.');
  END IF;

  SELECT name, stage INTO v_name, v_stage FROM public.leads WHERE id=v_lead AND organization_id=v_org AND deleted_at IS NULL;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok',false,'text','No encontré ese lead.'); END IF;
  SELECT id INTO v_agent_id FROM public.profiles WHERE organization_id=v_org AND telegram_chat_id=v_tg AND COALESCE(active,true)=true LIMIT 1;
  v_is_zoom := coalesce(v_stage,'') ILIKE 'Zoom%' or v_stage=public.fn_org_appointment_stage(v_org);
  v_label := case when v_is_zoom then coalesce(public.fn_org_appointment_stage(v_org),'Zoom') else 'la próxima acción' end;
  v_legible := public.fn_fecha_es(v_new,'America/Cancun');

  IF v_is_zoom THEN
    UPDATE public.leads SET stage=coalesce(public.fn_org_appointment_stage(v_org),stage), next_action='Zoom con cliente (reagendado)', next_action_at=v_new,
      next_action_date=public.fn_fecha_humana(v_new,'America/Cancun',true), updated_at=now(), last_activity=to_char(now(),'YYYY-MM-DD HH24:MI')
    WHERE id=v_lead AND organization_id=v_org;
  ELSE
    -- Próxima acción: cambiar SOLO el cuándo; conservar la acción original (el qué).
    UPDATE public.leads SET next_action_at=v_new,
      next_action_date=public.fn_fecha_humana(v_new,'America/Cancun',true), updated_at=now(), last_activity=to_char(now(),'YYYY-MM-DD HH24:MI')
    WHERE id=v_lead AND organization_id=v_org;
  END IF;

  INSERT INTO public.comunicaciones (lead_id,organization_id,tipo,resumen,asesor_id,ocurrio_en)
  VALUES (v_lead,v_org,'nota',(case when v_is_zoom then 'Zoom' else 'Próxima acción' end)||' reagendado para '||v_legible||'.',v_agent_id,now());
  INSERT INTO public.expediente_items (lead_id,organization_id,tipo,titulo,descripcion,asesor_id,metadata)
  VALUES (v_lead,v_org,'nota',(case when v_is_zoom then 'Zoom' else 'Próxima acción' end)||' reagendada (recordatorio IA)',
          (case when v_is_zoom then 'Zoom' else 'Próxima acción' end)||' reagendada para '||v_legible||'.',v_agent_id,
          jsonb_build_object('source','proactive_reschedule_apply','new_datetime',v_new,'raw_text',v_raw));
  UPDATE public.proactive_pending_reports SET status='closed', outcome='reagendado'
  WHERE organization_id=v_org AND advisor_telegram_id=v_tg AND lead_id=v_lead AND status='open';

  RETURN jsonb_build_object('ok',true,'text','Listo, reagendé '||v_label||' de '||v_name||' para '||v_legible||'.','next_action_at',v_new);
END; $function$;

CREATE OR REPLACE FUNCTION public.bot_agendar_visita(p_telegram_chat_id bigint, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_as jsonb := public.identify_asesor_by_telegram(p_telegram_chat_id);
  v_org uuid; v_tz text; v_stage text; v_managed boolean;
  v_client text := nullif(btrim(coalesce(p_args->>'client_name', p_args->>'name', p_args->>'cliente', p_args->>'lead','')),'');
  v_raw    text := nullif(btrim(coalesce(p_args->>'when', p_args->>'fecha', p_args->>'datetime', p_args->>'cuando', p_args->>'visita_at','')),'');
  v_lugar  text := nullif(btrim(coalesce(p_args->>'lugar', p_args->>'place', p_args->>'ubicacion', p_args->>'location', p_args->>'proyecto','')),'');
  v_texto  text := coalesce(p_args->>'input_text','');
  v_digits text; m text[];
  v_when timestamptz; v_lead_id uuid; v_lead_name text; v_legible text; v_accion text;
begin
  if not coalesce((v_as->>'paired')::boolean,false) then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Conecta tu Telegram al CRM primero.','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;
  v_org := (v_as->>'organization_id')::uuid;
  select meta_config#>>'{crm,copilotReminders}'='true' into v_managed from public.organizations where id=v_org;
  v_stage:=case when coalesce(v_managed,false) then public.fn_org_appointment_stage(v_org) else 'Visita Agendada' end;
  if coalesce(v_managed,false) and v_stage is null then
   return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Esta empresa no utiliza una etapa de citas. El administrador puede elegirla en Pipeline de mi empresa.')); end if;
  v_tz := coalesce(public.fn_user_tz(v_org,p_telegram_chat_id),'America/Cancun');
  if v_client is null then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','¿Para qué cliente agendo la visita? Dime su nombre o teléfono.','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;
  v_when := public.parse_relative_or_abs_es(coalesce(v_raw, v_texto, v_client), v_tz);
  if v_when is null then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','¿Para cuándo es la visita? Por ejemplo: «el sábado a las 4 de la tarde».','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;
  if v_when <= now() then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Esa fecha ya pasó. Dime una fecha futura para la visita.','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;

  -- El lugar, si no vino en un campo, se saca del propio pedido («… en Portofino»).
  if v_lugar is null and v_texto <> '' then
    m := regexp_match(v_texto, '(?i)\sen\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9''. -]{2,40})\s*$');
    if m is not null then v_lugar := btrim(m[1]); end if;
  end if;

  v_accion := 'Visita' || coalesce(' en ' || v_lugar, '');
  v_digits := regexp_replace(v_client,'[^0-9]','','g');

  update public.leads l
     set visita_at = v_when,
         stage = v_stage,
         next_action = v_accion,
         next_action_at = v_when,
         next_action_date = to_char(v_when at time zone v_tz,'YYYY-MM-DD HH24:MI'),
         updated_at = now()
   where l.id = (
     select l2.id from public.leads l2
      where l2.organization_id = v_org and l2.deleted_at is null
        and ( public.unaccent(coalesce(l2.name,'')) ilike public.unaccent('%'||v_client||'%')
              or (v_digits <> '' and regexp_replace(coalesce(l2.phone_normalized, l2.phone, ''),'[^0-9]','','g') = v_digits)
              or l2.id = public.fn_uuid_o_nulo(v_client) )
      order by l2.updated_at desc limit 1)
   returning l.id, l.name into v_lead_id, v_lead_name;

  if v_lead_id is null then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No encontré al cliente «'||v_client||'». Revisa el nombre o dime su teléfono.','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;

  -- El lugar queda escrito en el expediente: es lo que el asesor va a buscar.
  if v_lugar is not null then
    perform public.bot_add_expediente_note(p_telegram_chat_id, v_lead_id::text, 'Visita agendada',
      'Visita en ' || v_lugar || ' — ' || public.fn_fecha_humana(v_when, v_tz, true), 'telegram');
  end if;

  v_legible := public.fn_fecha_humana(v_when, v_tz, true);
  return jsonb_build_object('ok',true,'reply',jsonb_build_object(
    'text',coalesce(v_stage,'Visita agendada')||' con **'||coalesce(v_lead_name,'el cliente')||'**'
        || coalesce(' en **'||v_lugar||'**','') || chr(10) || '«'||v_legible||'»' || chr(10)
        || case when coalesce(v_managed,false) then 'Copilot te recordará la cita 3 horas antes.' else public.fn_visita_avisos_texto(v_when) end,
    'parse_mode',null,'inline_keyboard',public._bot_kb_back()));
end;
$function$;


create or replace function public.fn_managed_appointment_date_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_stage text; v_managed boolean;
begin
 select meta_config#>>'{crm,copilotReminders}'='true' into v_managed from public.organizations where id=new.organization_id;
 if not coalesce(v_managed,false) then return new; end if;
 v_stage:=public.fn_org_appointment_stage(new.organization_id);
 if lower(coalesce(new.stage,'')) in ('zoom agendado','visita agendada') and not exists(
   select 1 from public.fn_effective_org_stages(new.organization_id) where nombre=new.stage
 ) and v_stage is not null then new.stage:=v_stage; end if;
 if new.stage=v_stage then
  if tg_op='INSERT' or old.stage is distinct from new.stage or new.next_action_at is distinct from old.next_action_at then
   new.next_action_at:=coalesce(new.next_action_at,new.selected_time,new.visita_at);
   new.selected_time:=new.next_action_at;
  elsif new.selected_time is distinct from old.selected_time then new.next_action_at:=new.selected_time;
  end if;
 end if;
 if new.stage=v_stage and (tg_op='INSERT' or old.stage is distinct from new.stage) then
   new.next_action_at:=coalesce(new.next_action_at,new.selected_time,new.visita_at);
   if new.next_action_at is null or new.next_action_at<=now() then
    raise exception 'Para la etapa «%», indica una fecha y hora futuras para la cita.',v_stage using errcode='22023'; end if;
 end if;
 return new;
end $fn$;
create trigger managed_appointment_date_guard before insert or update of stage,next_action_at,selected_time,visita_at
 on public.leads for each row execute function public.fn_managed_appointment_date_guard();
revoke all on function public.fn_managed_appointment_date_guard() from public,anon,authenticated;
