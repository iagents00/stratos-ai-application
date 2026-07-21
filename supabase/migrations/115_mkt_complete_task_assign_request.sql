-- 115: dos tools nuevas del Copilot de marketing (pedido de Ángel 21-jul tras sus pruebas).
-- ⚠️ ESTADO: **NO APLICADA AÚN a stratos-prod** — el permiso de la sesión de nube rechazó
--    el apply_migration (2 intentos). Aplicarla con OK humano (copiar/pegar en el SQL editor
--    de Supabase o correr apply_migration desde una sesión con permiso). Después de aplicarla:
--    actualizar el prompt del flujo n8n `lplLwsnJapOXtFcs` (tools complete_task y assign_request
--    en las reglas 2/3/4 + en el $fromAI del nodo mkt_dispatch) y PUBLICAR.
--
-- (a) fn_mkt_complete_task — "ya terminé X": marca la tarea hecha, INVITA a subir la
--     evidencia (botón cámara del Copilot) y avisa si con eso se desbloqueó la tarea
--     de otra persona (el valor real de las dependencias).
-- (b) fn_mkt_assign_request — "asígnale el flyer a Emmanuel": pone responsable a una
--     solicitud abierta (en las pruebas del 21-jul quedaron 2 solicitudes "sin asignar"
--     sin forma de asignarlas por chat).
-- (c) mkt_nlu_dispatch — suma los cases complete_task/assign_request y, al crear una
--     solicitud sin responsable, avisa: "Quedó sin responsable — dime «asígnasela a …»".
-- Aditivo y reversible (drop de las 2 funciones + CREATE OR REPLACE previo del dispatcher).

create or replace function public.fn_mkt_complete_task(p_profile_id uuid, p_titulo text)
 returns text language plpgsql
as $function$
declare
  v_org uuid; v_role text; v_task uuid; v_titulo text; v_dueno uuid;
  r record; v_extra text := '';
begin
  select organization_id, role into v_org, v_role from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_titulo),'') = '' then return '¿Cuál tarea terminaste?'; end if;

  -- Primero una tarea PROPIA que matchee; si no hay y es admin, de cualquiera del equipo.
  select id, titulo, assignee_id into v_task, v_titulo, v_dueno from mkt_tasks
    where organization_id=v_org and deleted_at is null and estado<>'hecha'
      and assignee_id=p_profile_id and titulo ilike '%'||trim(p_titulo)||'%'
    order by due_at nulls last, created_at limit 1;
  if v_task is null and v_role in ('super_admin','admin') then
    select id, titulo, assignee_id into v_task, v_titulo, v_dueno from mkt_tasks
      where organization_id=v_org and deleted_at is null and estado<>'hecha'
        and titulo ilike '%'||trim(p_titulo)||'%'
      order by due_at nulls last, created_at limit 1;
  end if;
  if v_task is null then
    return 'No encontré una tarea pendiente que se llame parecido a «'||trim(p_titulo)||'». Dime el nombre como aparece en tu Mi Día.';
  end if;

  update mkt_tasks set estado='hecha', avance_pct=100, updated_at=now() where id=v_task;

  for r in select t.titulo, coalesce(p.name,'alguien') quien
           from mkt_tasks t left join profiles p on p.id=t.assignee_id
           where t.organization_id=v_org and t.deleted_at is null
             and t.depends_on=v_task and t.estado<>'hecha' loop
    v_extra := v_extra || E'\nCon esto se desbloqueó «'||r.titulo||'» de '||r.quien||' — ya puede avanzar.';
  end loop;

  return '✓ «'||v_titulo||'» marcada como hecha.'
    || E'\nSi tienes evidencia (foto o video), tócame el botón de cámara y la adjunto a tu reporte — es opcional.'
    || v_extra;
end $function$;

create or replace function public.fn_mkt_assign_request(p_profile_id uuid, p_titulo text, p_assignee text)
 returns text language plpgsql
as $function$
declare v_org uuid; v_req uuid; v_titulo text; v_asg record;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_titulo),'') = '' then return '¿Cuál solicitud quieres asignar?'; end if;
  if coalesce(trim(p_assignee),'') = '' then return '¿A quién se la asigno?'; end if;

  select id, titulo into v_req, v_titulo from mkt_requests
    where organization_id=v_org and deleted_at is null and estado<>'entregada'
      and titulo ilike '%'||trim(p_titulo)||'%'
    order by created_at desc limit 1;
  if v_req is null then
    return 'No encontré una solicitud abierta que se llame parecido a «'||trim(p_titulo)||'».';
  end if;

  select * into v_asg from _mkt_find_profile(v_org, p_assignee);
  if v_asg.id is null then
    return 'No encontré a «'||trim(p_assignee)||'» en el equipo.';
  end if;

  update mkt_requests set assignee_id=v_asg.id, updated_at=now() where id=v_req;
  return '✓ «'||v_titulo||'» asignada a '||v_asg.name||'.';
end $function$;

create or replace function public.mkt_nlu_dispatch(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb DEFAULT '{}'::jsonb)
 returns jsonb language plpgsql
as $function$
declare
  v_profile record;
  v_due timestamptz; v_entrega date;
  v_reply text; v_cat jsonb;
begin
  select id, name, role, organization_id into v_profile
  from profiles where telegram_chat_id = p_telegram_chat_id limit 1;

  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'reply',
      'No encontré tu usuario. Entrá al CRM una vez para activar tu identidad y volvé a intentar.');
  end if;
  if v_profile.role not in ('marketing','super_admin','admin') then
    return jsonb_build_object('ok', false, 'reply',
      'Este asistente es del equipo de marketing. Tu usuario no tiene ese rol.');
  end if;

  begin v_due := nullif(p_args->>'due','')::timestamptz; exception when others then v_due := null; end;
  begin v_entrega := nullif(p_args->>'entrega','')::date; exception when others then v_entrega := null; end;

  case coalesce(p_tool_name,'')
    when 'my_day' then
      v_reply := fn_mkt_my_day(v_profile.id);
    when 'create_task' then
      v_reply := fn_mkt_create_task(v_profile.id,
        p_args->>'titulo', nullif(p_args->>'assignee',''), v_due,
        nullif(p_args->>'brand',''), nullif(p_args->>'project',''));
    when 'complete_task' then
      v_reply := fn_mkt_complete_task(v_profile.id, p_args->>'titulo');
    when 'move_pipeline' then
      v_reply := fn_mkt_move_pipeline(v_profile.id, p_args->>'nombre', p_args->>'etapa');
    when 'create_request' then
      v_reply := fn_mkt_create_request(v_profile.id,
        p_args->>'titulo', nullif(p_args->>'brand',''),
        coalesce(nullif(p_args->>'complejidad',''),'A'), v_entrega,
        nullif(p_args->>'assignee',''), nullif(p_args->>'objetivo',''));
      if nullif(p_args->>'assignee','') is null and v_reply like '✓%' then
        v_reply := v_reply || ' Quedó sin responsable — cuando decidas, dime «asígnasela a …».';
      end if;
    when 'assign_request' then
      v_reply := fn_mkt_assign_request(v_profile.id, p_args->>'titulo', p_args->>'assignee');
    when 'pipeline_summary' then
      v_reply := fn_mkt_pipeline_summary(v_profile.id);
    when 'person_pending' then
      v_reply := fn_mkt_person_pending(v_profile.id, p_args->>'nombre');
    when 'buscar_drive' then
      v_cat := bot_buscar_proyectos(p_telegram_chat_id, jsonb_build_object('query', coalesce(p_args->>'query','')));
      v_reply := coalesce(v_cat->'reply'->>'text', v_cat->>'reply', 'No encontré resultados en el catálogo.');
      v_reply := regexp_replace(v_reply, '[🏗️🏢📁🏠🌊⭐✨🔑💎🌴]+\s?', '', 'g');
    else
      v_reply := 'Puedo ayudarte con: tu día, crear y completar tareas, mover propiedades del pipeline, solicitudes de diseño (y asignarlas), resumen del pipeline, pendientes de una persona y buscar el drive de una propiedad.';
  end case;

  return jsonb_build_object('ok', true, 'reply', coalesce(v_reply,'Listo.'));
exception when others then
  return jsonb_build_object('ok', false, 'reply',
    'Uy, algo falló procesando eso ('||sqlerrm||'). Probá decirlo de otra forma.');
end $function$;
