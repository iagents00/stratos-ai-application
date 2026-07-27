-- Fijar (o corregir) un objetivo con el cliente
create or replace function public.fn_client_set_objective(
  p_profile_id uuid, p_cliente text, p_titulo text,
  p_meta numeric default 100, p_unidad text default '%', p_due date default null)
returns text language plpgsql as $$
declare v_org uuid; v_cli record; v_id uuid;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_titulo),'') = '' then return '¿Cuál es el objetivo?'; end if;

  select * into v_cli from _client_find(v_org, p_cliente);
  if v_cli.id is null then
    return 'No encontré al cliente «'||coalesce(p_cliente,'')||'». Decime «agrega el cliente X» y lo doy de alta.';
  end if;

  select id into v_id from client_objectives
   where organization_id=v_org and lead_id=v_cli.id and deleted_at is null
     and titulo ilike '%'||trim(p_titulo)||'%' limit 1;

  if v_id is not null then
    update client_objectives set meta=coalesce(p_meta,meta), unidad=coalesce(p_unidad,unidad),
           due_date=coalesce(p_due,due_date), updated_at=now() where id=v_id;
    return '✓ Objetivo actualizado para '||v_cli.name||': «'||trim(p_titulo)||'» · meta '||coalesce(p_meta,100)||' '||coalesce(p_unidad,'%')||'.';
  end if;

  insert into client_objectives (organization_id, lead_id, titulo, meta, unidad, due_date, created_by)
  values (v_org, v_cli.id, trim(p_titulo), coalesce(p_meta,100), coalesce(p_unidad,'%'), p_due, p_profile_id);

  return '✓ Objetivo fijado con '||v_cli.name||': «'||trim(p_titulo)||'» · meta '||coalesce(p_meta,100)||' '||coalesce(p_unidad,'%')
      || coalesce(' · para el '||to_char(p_due,'DD Mon'),'')||'. Cuando avancemos decime «vamos en N» y lo actualizo.';
end $$;

-- Mover el progreso de un objetivo
create or replace function public.fn_client_progress(
  p_profile_id uuid, p_cliente text, p_titulo text, p_actual numeric)
returns text language plpgsql as $$
declare v_org uuid; v_cli record; v_o record; v_pct int;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  select * into v_cli from _client_find(v_org, p_cliente);
  if v_cli.id is null then return 'No encontré a ese cliente.'; end if;

  select * into v_o from client_objectives
   where organization_id=v_org and lead_id=v_cli.id and deleted_at is null
     and (p_titulo is null or titulo ilike '%'||trim(p_titulo)||'%')
   order by updated_at desc limit 1;
  if v_o.id is null then return 'No encontré ese objetivo en el expediente de '||v_cli.name||'.'; end if;

  update client_objectives
     set actual = greatest(0, p_actual),
         estado = case when p_actual >= meta then 'logrado' else 'activo' end,
         updated_at = now()
   where id = v_o.id;

  insert into client_updates (organization_id, lead_id, objective_id, texto, tipo, autor_id)
  values (v_org, v_cli.id, v_o.id, 'Progreso: '||p_actual||' de '||v_o.meta||' '||v_o.unidad, 'avance', p_profile_id);

  v_pct := round(p_actual / nullif(v_o.meta,0) * 100);
  return '✓ '||v_cli.name||' · «'||v_o.titulo||'»: '||p_actual||' de '||v_o.meta||' '||v_o.unidad
      || '  '||_barra(p_actual, v_o.meta)||' '||coalesce(v_pct,0)||'%'
      || case when p_actual >= v_o.meta then '  ¡Objetivo logrado!' else '' end;
end $$;

-- Registrar un avance / reunión / entrega / cobro en el expediente
create or replace function public.fn_client_log(
  p_profile_id uuid, p_cliente text, p_texto text, p_tipo text default 'avance')
returns text language plpgsql as $$
declare v_org uuid; v_cli record;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_texto),'') = '' then return '¿Qué anoto en el expediente?'; end if;
  select * into v_cli from _client_find(v_org, p_cliente);
  if v_cli.id is null then return 'No encontré al cliente «'||coalesce(p_cliente,'')||'».'; end if;

  insert into client_updates (organization_id, lead_id, texto, tipo, autor_id)
  values (v_org, v_cli.id, trim(p_texto), coalesce(nullif(trim(p_tipo),''),'avance'), p_profile_id);

  return '✓ Anotado en el expediente de '||v_cli.name||': «'||trim(p_texto)||'».';
end $$;

-- "¿En qué vamos con Duke?"
create or replace function public.fn_client_status(p_profile_id uuid, p_cliente text)
returns text language plpgsql as $$
declare v_org uuid; v_cli record; v_obj text; v_upd text; v_tar text; v_n int;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  select * into v_cli from _client_find(v_org, p_cliente);
  if v_cli.id is null then return 'No encontré al cliente «'||coalesce(p_cliente,'')||'».'; end if;

  select count(*), string_agg('• '||titulo||': '||actual||' de '||meta||' '||unidad||'  '||_barra(actual,meta)
         ||' '||coalesce(round(actual/nullif(meta,0)*100),0)||'%'
         || coalesce(' · para el '||to_char(due_date,'DD Mon'),'')
         || case when estado='logrado' then '  ✓ logrado' else '' end, E'\n' order by estado, due_date nulls last)
    into v_n, v_obj
  from client_objectives where organization_id=v_org and lead_id=v_cli.id and deleted_at is null;

  select string_agg('• '||to_char(created_at at time zone 'America/Cancun','DD Mon')||' — '||texto, E'\n' order by created_at desc)
    into v_upd
  from (select * from client_updates where organization_id=v_org and lead_id=v_cli.id and deleted_at is null
        order by created_at desc limit 5) u;

  select string_agg('• '||titulo, E'\n') into v_tar
  from mkt_tasks where organization_id=v_org and deleted_at is null and estado <> 'hecha'
    and (titulo ilike '%'||v_cli.name||'%' or descripcion ilike '%'||v_cli.name||'%');

  return v_cli.name||E'\n'
      || case when coalesce(v_n,0)=0 then 'Todavía no hay objetivos fijados. Decime «fija un objetivo con '||v_cli.name||': …» y lo registro.'
              else 'OBJETIVOS'||E'\n'||v_obj end
      || coalesce(E'\n\n'||'ÚLTIMOS AVANCES'||E'\n'||v_upd, E'\n\n(Sin avances registrados todavía.)')
      || coalesce(E'\n\n'||'TAREAS ABIERTAS RELACIONADAS'||E'\n'||v_tar, '');
end $$;

-- Todos los clientes con su progreso (para el tablero y el resumen diario)
create or replace function public.fn_clients_overview(p_profile_id uuid)
returns text language plpgsql as $$
declare v_org uuid; v_txt text; v_n int;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  select count(*), string_agg(linea, E'\n' order by linea) into v_n, v_txt
  from (
    select '• '||l.name||' ('||l.stage||')'
           || coalesce(' — '||(select string_agg(o.titulo||' '||_barra(o.actual,o.meta)||' '
                 ||coalesce(round(o.actual/nullif(o.meta,0)*100),0)||'%', ' · ')
               from client_objectives o
               where o.lead_id=l.id and o.deleted_at is null and o.estado='activo'), ' — sin objetivos fijados') as linea
    from leads l where l.organization_id = v_org
  ) s;

  if coalesce(v_n,0)=0 then return 'Todavía no hay clientes cargados. Decime «agrega el cliente X» y lo doy de alta.'; end if;
  return 'Clientes ('||v_n||'):'||E'\n'||v_txt;
end $$;

-- Alta rápida de un cliente
create or replace function public.fn_client_add(
  p_profile_id uuid, p_nombre text, p_etapa text default 'Cliente activo')
returns text language plpgsql as $$
declare v_org uuid; v_ya text;
begin
  select organization_id into v_org from profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;
  if coalesce(trim(p_nombre),'') = '' then return '¿Cómo se llama el cliente?'; end if;

  select name into v_ya from leads where organization_id=v_org and name ilike trim(p_nombre) limit 1;
  if v_ya is not null then return 'Ya está «'||v_ya||'» en el tablero.'; end if;

  insert into leads (organization_id, name, stage, asesor_id, bio)
  values (v_org, trim(p_nombre), coalesce(nullif(trim(p_etapa),''),'Cliente activo'), p_profile_id,
          'Cliente de NSG. Expediente con objetivos y avances.');
  return '✓ Cliente agregado: «'||trim(p_nombre)||'». Fíjale objetivos diciendo «fija un objetivo con '||trim(p_nombre)||': …».';
end $$;;
