-- El QA dorado cazó un bug de verdad: los KPIs decían «1 pendientes hoy» y
-- «0 cerrados». Alguien ya había arreglado el caso de "vencido/vencidos" pero
-- se olvidó de los otros dos contadores. Es chico, pero es de los que hacen que
-- un asesor sienta que el sistema está mal hecho.
-- Se corrige de raíz con un helper, para que no vuelva a pasar en el próximo
-- contador que se agregue.

create or replace function public._bot_plural(n text, singular text, plural text)
returns text language sql immutable as $$
  select n || ' ' || case when n = '1' then singular else plural end;
$$;

do $mig$
declare v_src text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='bot_get_dashboard_stats_v2';
  if v_src is null then raise exception 'no encontré bot_get_dashboard_stats_v2'; end if;

  v_new := replace(v_src,
    E'    ''. '' || (v_inner->>''pending_today'') || '' pendientes hoy'',\n'
    '    ''. '' || (v_inner->>''pending_overdue'') || case when (v_inner->>''pending_overdue'') = ''1'' then '' vencido'' else '' vencidos'' end,\n'
    '    ''. '' || (v_inner->>''closed'') || '' cerrados''',
    E'    ''. '' || public._bot_plural(v_inner->>''pending_today'', ''pendiente hoy'', ''pendientes hoy''),\n'
    '    ''. '' || public._bot_plural(v_inner->>''pending_overdue'', ''vencido'', ''vencidos''),\n'
    '    ''. '' || public._bot_plural(v_inner->>''closed'', ''cerrado'', ''cerrados'')');

  if v_new = v_src then raise exception 'no encontré las líneas de KPIs'; end if;
  execute v_new;
end $mig$;

-- Y el banco de pruebas vuelve a tener EXACTAMENTE 1 vencido, que es lo que el
-- caso dorado quiere comprobar (el bug original era decir "1 vencidos").
create or replace function public.fn_qa_reset_ventas()
returns text
language plpgsql security definer set search_path to 'public'
as $$
declare v_org uuid := 'ffffffff-0000-4000-a000-000000000001';
begin
  -- exactamente UNO vencido (ayer) → prueba el singular
  update leads set next_action_at = (current_date - interval '1 day') + time '14:37'
   where organization_id = v_org and name = 'Maria Sintetica';
  -- exactamente UNO para hoy
  update leads set next_action_at = current_date + time '16:00'
   where organization_id = v_org and name = 'Diana Prueba';
  -- los demás, en los próximos días
  update leads set next_action_at = current_date + interval '1 day' + time '21:37'
   where organization_id = v_org and name = 'Hector Acentos';
  update leads set next_action_at = current_date + interval '2 days' + time '16:37'
   where organization_id = v_org and name = 'Carlos Prueba' and stage = 'Seguimiento';
  update leads set next_action_at = current_date + interval '3 days' + time '19:37'
   where organization_id = v_org and name = 'Carlos Prueba' and stage = 'Zoom Agendado';
  return 'Cancha de QA de ventas re-fechada relativa a ' || current_date::text;
end $$;;
