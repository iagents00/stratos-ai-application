-- 107: Cerebro de MARKETING para el Copilot (F3) — funciones-herramienta que usa el
-- flujo n8n DUPLICADO del Copilot (solo rol marketing). Aditivo: no toca el cerebro
-- de asesores (bot_nlu_dispatch_gvintell) ni ninguna función existente.
-- Todas resuelven la org desde el profile y responden TEXTO listo para mostrar.

-- Resolver una persona del equipo de marketing por nombre (fuzzy)
create or replace function public._mkt_find_profile(p_org uuid, p_name text)
returns table(id uuid, name text) language sql stable as $$
  select p.id, p.name from profiles p
  where p.organization_id = p_org
    and p.role in ('marketing','super_admin','admin')
    and (p_name is null or p.name ilike '%'||p_name||'%')
  order by (p.role='marketing') desc, p.name limit 1;
$$;

-- Resolver marca por nombre o slug (fuzzy)
create or replace function public._mkt_find_brand(p_org uuid, p_brand text)
returns table(id uuid, nombre text) language sql stable as $$
  select b.id, b.nombre from mkt_brands b
  where b.organization_id = p_org and b.activo = true
    and (p_brand is null or b.nombre ilike '%'||p_brand||'%' or b.slug ilike '%'||replace(lower(p_brand),' ','-')||'%')
  order by b.orden limit 1;
$$;

-- Normalizar etapa del pipeline desde lenguaje natural
create or replace function public._mkt_norm_etapa(p text)
returns text language sql immutable as $$
  select case
    when p is null then null
    when lower(p) like '%selec%' then 'seleccionada'
    when lower(p) like '%agend%' then 'agendada'
    when lower(p) like '%grab%' and lower(p) not like '%esper%' then 'grabada'
    when lower(p) like '%edici%' or lower(p) like '%edit%' then 'en_edicion'
    when lower(p) like '%voz%' or lower(p) like '%esper%' then 'esperando_voz'
    when lower(p) like '%list%' then 'lista'
    when lower(p) like '%public%' then 'publicada'
    else null end;
$$;

-- ── MI DÍA ────────────────────────────────────────────────────────────────
create or replace function public.fn_mkt_my_day(p_profile_id uuid)
returns text language plpgsql stable as $$
declare
  v_org uuid; v_name text; v_hoy date; r record; out_txt text := '';
  sec text; n int := 0;
begin
  select organization_id, name into v_org, v_name from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  v_hoy := (now() at time zone 'America/Cancun')::date;

  -- Rodaje de hoy
  for r in select nombre, coalesce(locacion,'') loc from mkt_pipeline_items
           where organization_id=v_org and deleted_at is null and fecha_rodaje=v_hoy loop
    out_txt := out_txt || '📍 Rodaje hoy — ' || r.nombre || case when r.loc<>'' then ' · '||r.loc else '' end || E'\n';
  end loop;

  -- Vencidas
  sec := '';
  for r in select t.titulo, t.due_at from mkt_tasks t
           where t.organization_id=v_org and t.deleted_at is null and t.assignee_id=p_profile_id
             and t.estado<>'hecha' and t.due_at is not null
             and (t.due_at at time zone 'America/Cancun')::date < v_hoy
             and not exists (select 1 from mkt_tasks d where d.id=t.depends_on and d.estado<>'hecha')
           order by t.due_at limit 5 loop
    sec := sec || '🔴 ' || r.titulo || ' (venció ' || to_char(r.due_at at time zone 'America/Cancun','DD Mon') || E')\n';
  end loop;
  if sec <> '' then out_txt := out_txt || E'\nVENCIDAS:\n' || sec; end if;

  -- Para hoy (incluye sin fecha) + marca desbloqueadas
  sec := '';
  for r in select t.titulo, t.due_at,
             (t.depends_on is not null and exists (select 1 from mkt_tasks d where d.id=t.depends_on and d.estado='hecha')) as unlocked
           from mkt_tasks t
           where t.organization_id=v_org and t.deleted_at is null and t.assignee_id=p_profile_id
             and t.estado<>'hecha'
             and (t.due_at is null or (t.due_at at time zone 'America/Cancun')::date = v_hoy)
             and not exists (select 1 from mkt_tasks d where d.id=t.depends_on and d.estado<>'hecha')
           order by t.due_at nulls last limit 8 loop
    n := n + 1;
    sec := sec || '☐ ' || r.titulo
        || case when r.due_at is not null then ' · '||to_char(r.due_at at time zone 'America/Cancun','HH24:MI') else '' end
        || case when r.unlocked then ' · ✓ DESBLOQUEADA' else '' end || E'\n';
  end loop;
  out_txt := out_txt || E'\nPARA HOY:\n' || case when sec='' then E'Nada pendiente para hoy 🎉\n' else sec end;

  -- Bloqueadas
  sec := '';
  for r in select t.titulo, d.titulo dep_titulo, coalesce(pd.name,'') dep_quien,
                  greatest(0, (v_hoy - (d.created_at at time zone 'America/Cancun')::date)) dias
           from mkt_tasks t
           join mkt_tasks d on d.id = t.depends_on and d.estado<>'hecha'
           left join profiles pd on pd.id = d.assignee_id
           where t.organization_id=v_org and t.deleted_at is null and t.assignee_id=p_profile_id and t.estado<>'hecha'
           limit 5 loop
    sec := sec || '🔒 ' || r.titulo || ' — esperando: «' || r.dep_titulo || '»'
        || case when r.dep_quien<>'' then ' de '||r.dep_quien else '' end
        || ' · hace ' || r.dias || E' días\n';
  end loop;
  if sec <> '' then out_txt := out_txt || E'\nBLOQUEADAS (no dependen de ti):\n' || sec; end if;

  return coalesce(nullif(trim(out_txt),''), 'Sin pendientes 🎉');
end $$;

-- ── CREAR TAREA ───────────────────────────────────────────────────────────
create or replace function public.fn_mkt_create_task(
  p_profile_id uuid, p_titulo text, p_assignee text default null,
  p_due timestamptz default null, p_brand text default null, p_project text default null)
returns text language plpgsql as $$
declare
  v_org uuid; v_asg record; v_brand record; v_proj record; v_id uuid;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_titulo),'') = '' then return 'Decime qué hay que hacer (el título de la tarea).'; end if;

  select * into v_asg from _mkt_find_profile(v_org, p_assignee);
  if p_assignee is not null and v_asg.id is null then
    return 'No encontré a «'||p_assignee||'» en el equipo. ¿Yazz, Luis o Emmanuel?';
  end if;
  select * into v_brand from _mkt_find_brand(v_org, p_brand);
  if p_project is not null then
    select id, nombre, brand_id into v_proj from mkt_projects
    where organization_id=v_org and deleted_at is null and nombre ilike '%'||p_project||'%'
    order by created_at desc limit 1;
  end if;

  insert into mkt_tasks (organization_id, brand_id, project_id, titulo, assignee_id, created_by,
                         estado, prioridad, avance_pct, due_at, origen)
  values (v_org, coalesce(v_proj.brand_id, v_brand.id), v_proj.id, trim(p_titulo),
          coalesce(v_asg.id, p_profile_id), p_profile_id, 'por_hacer', 'media', 0, p_due, 'copilot')
  returning id into v_id;

  return '✓ Tarea creada: «'||trim(p_titulo)||'»'
    || ' · para '||coalesce(v_asg.name,'ti')
    || coalesce(' · marca '||v_brand.nombre, '')
    || coalesce(' · proyecto '||v_proj.nombre, '')
    || coalesce(' · vence '||to_char(p_due at time zone 'America/Cancun','DD Mon HH24:MI'), '')
    || '. La ves en el módulo Marketing.';
end $$;

-- ── MOVER PROPIEDAD EN EL PIPELINE ────────────────────────────────────────
create or replace function public.fn_mkt_move_pipeline(p_profile_id uuid, p_nombre text, p_etapa text)
returns text language plpgsql as $$
declare
  v_org uuid; v_et text; v_item record; v_n int; v_voz int; v_opts text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  v_et := _mkt_norm_etapa(p_etapa);
  if v_et is null then
    return 'No entendí la etapa «'||coalesce(p_etapa,'')||'». Opciones: seleccionada, agendada, grabada, en edición, esperando voz, lista, publicada.';
  end if;

  select count(*) into v_n from mkt_pipeline_items
  where organization_id=v_org and deleted_at is null and nombre ilike '%'||p_nombre||'%';
  if v_n = 0 then return 'No encontré ninguna propiedad que se llame como «'||p_nombre||'» en el pipeline.'; end if;
  if v_n > 1 then
    select string_agg(nombre, ' · ') into v_opts from (
      select nombre from mkt_pipeline_items
      where organization_id=v_org and deleted_at is null and nombre ilike '%'||p_nombre||'%' limit 4) s;
    return 'Hay varias que coinciden: '||v_opts||'. ¿Cuál exactamente?';
  end if;

  select * into v_item from mkt_pipeline_items
  where organization_id=v_org and deleted_at is null and nombre ilike '%'||p_nombre||'%' limit 1;

  update mkt_pipeline_items set etapa=v_et, updated_at=now() where id=v_item.id;
  select count(*) into v_voz from mkt_pipeline_items
  where organization_id=v_org and deleted_at is null and etapa='esperando_voz';

  return '✓ «'||v_item.nombre||'» movida a '||replace(v_et,'_',' ')
    || case when v_voz >= 3 then '. ⚠️ Ojo: quedan '||v_voz||' propiedades en Esperando voz.' else '.' end;
end $$;

-- ── CREAR SOLICITUD DE DISEÑO ─────────────────────────────────────────────
create or replace function public.fn_mkt_create_request(
  p_profile_id uuid, p_titulo text, p_brand text default null, p_complejidad text default 'A',
  p_entrega date default null, p_assignee text default null, p_objetivo text default null)
returns text language plpgsql as $$
declare v_org uuid; v_asg record; v_brand record; v_cx text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_titulo),'') = '' then return '¿Qué necesitas que diseñemos?'; end if;
  v_cx := upper(coalesce(p_complejidad,'A'));
  if v_cx not in ('A','AA','AAA') then v_cx := 'A'; end if;
  select * into v_asg from _mkt_find_profile(v_org, p_assignee);
  select * into v_brand from _mkt_find_brand(v_org, p_brand);

  insert into mkt_requests (organization_id, brand_id, titulo, objetivo, complejidad,
                            fecha_entrega, solicitante, assignee_id, estado)
  values (v_org, v_brand.id, trim(p_titulo), p_objetivo, v_cx, p_entrega, p_profile_id,
          case when p_assignee is not null then v_asg.id else null end, 'nueva');

  return '✓ Solicitud creada: «'||trim(p_titulo)||'» · complejidad '||v_cx
    || coalesce(' · marca '||v_brand.nombre,'')
    || coalesce(' · entrega '||to_char(p_entrega,'DD Mon'),'')
    || coalesce(' · asignada a '||case when p_assignee is not null then v_asg.name end,'')
    || '. Quedó en la bandeja de Solicitudes.';
end $$;

-- ── RESUMEN DEL PIPELINE ──────────────────────────────────────────────────
create or replace function public.fn_mkt_pipeline_summary(p_profile_id uuid)
returns text language plpgsql stable as $$
declare v_org uuid; r record; out_txt text := 'Pipeline de propiedades:'; v_voz int := 0;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  for r in
    select e.et, e.lbl, count(p.id) n
    from (values ('seleccionada','Seleccionada',1),('agendada','Agendada',2),('grabada','Grabada',3),
                 ('en_edicion','En edición',4),('esperando_voz','Esperando voz',5),('lista','Lista',6),('publicada','Publicada',7)) as e(et,lbl,ord)
    left join mkt_pipeline_items p on p.etapa=e.et and p.organization_id=v_org and p.deleted_at is null
    group by e.et, e.lbl, e.ord order by e.ord loop
    out_txt := out_txt || E'\n' || r.lbl || ': ' || r.n;
    if r.et='esperando_voz' then v_voz := r.n; end if;
  end loop;
  if v_voz >= 3 then out_txt := out_txt || E'\n⚠️ El cuello es la voz en off: '||v_voz||' videos parados.'; end if;
  return out_txt;
end $$;

-- ── PENDIENTES DE UNA PERSONA ─────────────────────────────────────────────
create or replace function public.fn_mkt_person_pending(p_profile_id uuid, p_name text)
returns text language plpgsql stable as $$
declare v_org uuid; v_p record; r record; out_txt text := ''; v_n int := 0;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  select * into v_p from _mkt_find_profile(v_org, p_name);
  if v_p.id is null then return 'No encontré a «'||coalesce(p_name,'')||'» en el equipo.'; end if;
  for r in select t.titulo, t.due_at, t.estado,
             exists (select 1 from mkt_tasks d where d.id=t.depends_on and d.estado<>'hecha') as blocked
           from mkt_tasks t
           where t.organization_id=v_org and t.deleted_at is null and t.assignee_id=v_p.id and t.estado<>'hecha'
           order by t.due_at nulls last limit 8 loop
    v_n := v_n + 1;
    out_txt := out_txt || case when r.blocked then '🔒 ' else '☐ ' end || r.titulo
      || coalesce(' · '||to_char(r.due_at at time zone 'America/Cancun','DD Mon'),'') || E'\n';
  end loop;
  if v_n = 0 then return v_p.name||' no tiene tareas pendientes en el módulo. 🎉'; end if;
  return 'Pendientes de '||v_p.name||E':\n'||out_txt;
end $$;
