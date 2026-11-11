-- Final delivery replies are dialogue, not automatic reminder notifications.
CREATE OR REPLACE FUNCTION public.fn_copilot_contexto(p_chat bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_prof record; v_turnos jsonb; v_avisos jsonb;
  v_recientes jsonb; v_pend jsonb; v_tz text;
begin
  select id, organization_id, name, coalesce(role,'asesor') as role into v_prof
  from profiles where telegram_chat_id = p_chat and coalesce(active,true) limit 1;
  if v_prof.id is null then return jsonb_build_object('ok', false); end if;
  v_tz := coalesce(public.fn_user_tz(v_prof.organization_id, p_chat), 'America/Cancun');

  -- LA CONVERSACIÓN: solo turnos reales, en orden, sin repetidos.
  with reales as (
    select a.role, a.content, a.created_at, a.id,
           lower(regexp_replace(replace(replace(replace(coalesce(a.content,''),'**',''),'«',''),'»',''),
                 '\s+', ' ', 'g')) as esencia
    from public.tg_bot_activity a
    where a.organization_id=v_prof.organization_id and a.telegram_chat_id = p_chat
      and coalesce(a.meta->>'kind','') in ('','copilot_delivery')          -- (1) fuera los avisos automáticos
      and coalesce(btrim(a.content),'') <> ''
      and a.content<>'Estoy atendiendo tu solicitud. Te confirmaré aquí el resultado.'
    order by a.created_at desc, (a.role = 'ai') desc, a.id desc
    limit 36
  ), ordenados as (
    select r.*, row_number() over (order by r.created_at, (r.role = 'user') desc, r.id) as n
    from reales r                                  -- (2) usuario antes que asistente
  ), sin_repes as (
    select o.* from ordenados o
    left join ordenados prev on prev.n = o.n - 1
    where prev.esencia is null or prev.esencia <> o.esencia   -- (3) sin duplicados
  )
  select coalesce(jsonb_agg(jsonb_build_object('rol', s.role, 'texto', left(s.content, 4000))
                            order by s.n), '[]'::jsonb)
    into v_turnos
  from (select * from sin_repes order by n desc limit 20) s;  -- (4) 14 turnos reales

  -- Los avisos que le mandó el sistema, aparte y resumidos: contexto, no diálogo.
  select coalesce(jsonb_agg(jsonb_build_object('aviso', left(t.content, 120)) order by t.created_at), '[]'::jsonb)
    into v_avisos
  from (select content, created_at from public.tg_bot_activity
        where organization_id=v_prof.organization_id and telegram_chat_id = p_chat and meta->>'kind' is not null and meta->>'kind'<>'copilot_delivery'
        order by created_at desc limit 4) t;

  select coalesce(jsonb_agg(jsonb_build_object('titulo', text, 'para', asesor_name,
           'cuando', fn_fmt_cuando_legible(due_at, v_tz)) order by created_at desc), '[]'::jsonb)
    into v_recientes
  from (select text, asesor_name, due_at, created_at from team_actions
        where organization_id=v_prof.organization_id and created_by = v_prof.id and created_at > now() - interval '40 minutes'
          and coalesce(done,false) = false
        order by created_at desc limit 5) t;

  select to_jsonb(x) into v_pend from (
    select action, coalesce(jsonb_array_length(payload->'tareas'),0) as tareas_n, payload->'tareas' as tareas
    from bot_pending_confirm where organization_id=v_prof.organization_id and telegram_chat_id = p_chat and created_at>now()-interval '24 hours'
      and not exists(select 1 from public.bot_pending_actions a where a.organization_id=v_prof.organization_id and a.telegram_chat_id=p_chat
       and a.consumed_at is null and a.expires_at>now() and a.created_at>bot_pending_confirm.created_at) limit 1) x;

  return jsonb_build_object('ok', true, 'quien_escribe', v_prof.name, 'rol', v_prof.role,
    'equipo', (select coalesce(jsonb_agg(jsonb_build_object('nombre', name, 'rol', coalesce(role,'asesor')) order by name), '[]'::jsonb)
                from profiles where organization_id = v_prof.organization_id and coalesce(active,true)),
    'empresa',(select name from public.organizations where id=v_prof.organization_id),
    'etapas',to_jsonb(public.fn_org_stages_list(v_prof.organization_id)),
    'negocios',(select meta_config#>'{crm,businessLines}' from public.organizations where id=v_prof.organization_id),
    'fichas_por_negocio_habilitadas',(select coalesce((meta_config#>>'{crm,allowBusinessContactCopies}')::boolean,false) from public.organizations where id=v_prof.organization_id),
    'registro_en_curso',(select jsonb_build_object('tipo',action_type,'datos',payload,'listo',payload->'_ready')
       from public.bot_pending_actions where organization_id=v_prof.organization_id and telegram_chat_id=p_chat
       and action_type='create_lead' and consumed_at is null and expires_at>now() order by created_at desc limit 1),
    'clientes_recientes',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nombre',c.name,'etapa',c.stage,'telefono',c.phone,'ficha_original',c.business_entry_of,'negocio',public.fn_crm_business_for_stage(v_prof.organization_id,c.stage)->>'label')),'[]'::jsonb)
      from(select id,name,stage,phone,business_entry_of from public.leads where organization_id=v_prof.organization_id and deleted_at is null
        and (v_prof.role in ('admin','super_admin','director','ceo') or asesor_id=v_prof.id)
        order by updated_at desc limit 8)c),
    'ultimos_mensajes', v_turnos,
    'avisos_automaticos_recientes', v_avisos,
    'tareas_recien_registradas', v_recientes,
    'plan_esperando_confirmacion', coalesce(v_pend, 'null'::jsonb));
end;
$function$;

-- A completed registration must not ask the person to register it again.
CREATE OR REPLACE FUNCTION public.fn_fmt_hecho(p_summary text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare v_h text; v_rest text; v_p int;
begin
  if coalesce(btrim(p_summary),'') = '' then return '▸ Listo'; end if;
  v_p := position(chr(10) in p_summary);
  v_h    := case when v_p > 0 then left(p_summary, v_p - 1) else p_summary end;
  v_rest := case when v_p > 0 then substr(p_summary, v_p) else '' end;

  v_h := btrim(regexp_replace(v_h, '^\s*▸\s*', ''));
  v_h := regexp_replace(v_h, '\.\s*$', '');

  if v_h ~* '^Voy a registrar (a |el cliente)' then
    v_rest:=replace(v_rest,'Pásamelo si lo tienes; o regístralo así con el botón de abajo.','Puedes pasarme esos datos cuando los tengas; el cliente ya quedó registrado.');
  end if;

  v_h := regexp_replace(v_h, '^Voy a agregar al expediente de\s+',            'lo guardé en el expediente de ', 'i');
  v_h := regexp_replace(v_h, '^Voy a guardar la nota de voz en\s+',           'guardé la nota de voz de ', 'i');
  v_h := regexp_replace(v_h, '^Voy a registrar un contacto por\s+',           'registré el contacto por ', 'i');
  v_h := regexp_replace(v_h, '^Voy a registrar un seguimiento por\s+',        'registré el seguimiento por ', 'i');
  v_h := regexp_replace(v_h, '^Voy a registrar venta cerrada con\s+',         'registré la venta con ', 'i');
  v_h := regexp_replace(v_h, '^Voy a registrar a\s+',                         'registré a ', 'i');
  v_h := regexp_replace(v_h, '^Voy a registrar el cliente',                   'registré al cliente', 'i');
  v_h := regexp_replace(v_h, '^Voy a actualizar\s+',                          'actualicé a ', 'i');
  v_h := regexp_replace(v_h, '^Voy a crear una tarea para\s+',                'creé la tarea para ', 'i');
  v_h := regexp_replace(v_h, '^Voy a enviar a papelera el cliente\s+',        'mandé a la papelera a ', 'i');
  v_h := regexp_replace(v_h, '^Voy a asignar el agente\s+',                   'asigné el agente ', 'i');
  v_h := regexp_replace(v_h, '^Voy a quitar el agente IA de\s+',              'quité el agente de ', 'i');
  v_h := regexp_replace(v_h, '^Voy a\s+',                                     '', 'i');

  return '▸ Listo · ' || v_h || v_rest;
end;
$function$;
