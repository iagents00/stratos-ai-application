-- ─────────────────────────────────────────────────────────────────────────────
-- RESUMEN DIARIO — el pedido original de Ángel: "que al despertarme sepa a dónde
-- voy sin depender de que Iván conteste".
-- Llega al ARRANCAR la jornada de cada quien (su horario, su zona), una vez al día:
-- lo vencido, lo de hoy, los proyectos en curso y cómo va cada cliente.
-- Se activa POR ORGANIZACIÓN (meta_config.mkt.dailyDigest) → cuando esto se copie a
-- Mueblería / Legacy / Brasa y Piedra es prender una bandera, no programar de nuevo.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_resumen_diario(p_profile_id uuid)
returns text language plpgsql
security definer set search_path to 'public' as $$
declare
  v_org uuid; v_name text; v_tz text; v_hoy date;
  v_venc text; v_hoy_t text; v_curso text; v_proy text; v_cli text;
  v_nv int; v_nh int; v_nc int;
begin
  select organization_id, split_part(coalesce(name,''),' ',1), coalesce(work_tz, timezone, 'America/Cancun')
    into v_org, v_name, v_tz
  from profiles where id = p_profile_id;
  if v_org is null then return null; end if;
  v_hoy := (now() at time zone v_tz)::date;

  -- vencidas
  select count(*), string_agg('• '||titulo||' (venció '||to_char(due_at at time zone v_tz,'DD Mon')||')', E'\n' order by due_at)
    into v_nv, v_venc
  from mkt_tasks
  where organization_id=v_org and assignee_id=p_profile_id and deleted_at is null
    and estado <> 'hecha' and due_at is not null and (due_at at time zone v_tz)::date < v_hoy;

  -- para hoy
  select count(*), string_agg('• '||titulo||' — '||to_char(due_at at time zone v_tz,'HH24:MI'), E'\n' order by due_at)
    into v_nh, v_hoy_t
  from mkt_tasks
  where organization_id=v_org and assignee_id=p_profile_id and deleted_at is null
    and estado <> 'hecha' and due_at is not null and (due_at at time zone v_tz)::date = v_hoy;

  -- ya empezadas
  select count(*), string_agg('• '||titulo, E'\n') into v_nc, v_curso
  from mkt_tasks
  where organization_id=v_org and assignee_id=p_profile_id and deleted_at is null and estado='en_curso';

  -- proyectos vivos
  select string_agg('• '||pr.nombre||': '||
           (select count(*) from mkt_tasks t where t.project_id=pr.id and t.deleted_at is null and t.estado<>'hecha')::text
           ||' pendiente(s)', E'\n' order by pr.nombre)
    into v_proy
  from mkt_projects pr where pr.organization_id=v_org and pr.deleted_at is null;

  -- clientes y su progreso
  select string_agg('• '||l.name||coalesce(' — '||(
           select string_agg(o.titulo||' '||_barra(o.actual,o.meta)||' '||coalesce(round(o.actual/nullif(o.meta,0)*100),0)||'%', ' · ')
           from client_objectives o where o.lead_id=l.id and o.deleted_at is null and o.estado='activo'), ''), E'\n' order by l.name)
    into v_cli
  from leads l where l.organization_id=v_org;

  return 'Buen día'||coalesce(', '||v_name,'')||'. Esto es lo tuyo para hoy '||to_char(v_hoy,'DD Mon')||'.'
    || coalesce(E'\n\n'||'VENCIDO ('||v_nv||')'||E'\n'||v_venc, '')
    || coalesce(E'\n\n'||'HOY ('||v_nh||')'||E'\n'||v_hoy_t, E'\n\nHOY: nada con hora fija.')
    || coalesce(E'\n\n'||'YA EMPEZADO ('||v_nc||')'||E'\n'||v_curso, '')
    || coalesce(E'\n\n'||'PROYECTOS'||E'\n'||v_proy, '')
    || coalesce(E'\n\n'||'CLIENTES'||E'\n'||v_cli, '')
    || E'\n\n'||'Si algo no es para ti, dime «elimina la tarea …». Para arrancar algo: «ya empecé …».';
end $$;

-- El cron: manda el resumen al arrancar la jornada de cada quien, una sola vez al día
create or replace function public.fn_resumen_diario_tick()
returns integer language plpgsql
security definer set search_path to 'public' as $$
declare r record; v_txt text; v_local time; v_ini time; v_hoy date; v_n int := 0;
begin
  for r in
    select p.id, p.name, p.telegram_chat_id, p.organization_id,
           coalesce(p.work_tz, p.timezone, 'America/Cancun') as tz,
           coalesce(p.work_start, '10:00'::time) as inicio
    from profiles p
    join organizations o on o.id = p.organization_id
    where coalesce(o.meta_config->'mkt'->>'dailyDigest','false') = 'true'
      and p.telegram_chat_id is not null
  loop
    begin
      v_local := (now() at time zone r.tz)::time;
      v_hoy   := (now() at time zone r.tz)::date;
      v_ini   := r.inicio;
      -- ventana: desde que arranca su jornada hasta 40 min después
      if v_local >= v_ini and v_local < (v_ini + interval '40 minutes')::time then
        v_txt := fn_resumen_diario(r.id);
        if v_txt is not null then
          perform _mkt_notify(r.organization_id, r.id, r.name, r.telegram_chat_id,
                              'resumen_diario', v_txt, 'resumen-'||r.id::text||'-'||v_hoy::text);
          v_n := v_n + 1;
        end if;
      end if;
    exception when others then null;  -- un perfil con problema no frena a los demás
    end;
  end loop;
  return v_n;
end $$;

-- Prender el resumen para NSG (las otras empresas: misma bandera cuando toque)
update organizations
set meta_config = jsonb_set(coalesce(meta_config,'{}'::jsonb), '{mkt}',
      coalesce(meta_config->'mkt','{}'::jsonb) || '{"dailyDigest":"true"}'::jsonb, true)
where id = '4a17b181-35d2-41b3-b639-6e0bd4c38acc';

select cron.schedule('resumen-diario-tick', '*/15 * * * *', $$select public.fn_resumen_diario_tick();$$);;
