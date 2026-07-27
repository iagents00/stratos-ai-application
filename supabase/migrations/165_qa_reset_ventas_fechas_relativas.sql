-- El QA dorado de VENTAS se pudría solo con el paso de los días.
--
-- Los leads del banco de pruebas se sembraron el 22-jul con fechas fijas
-- ("2026-07-22 14:37"). Cinco días después TODAS quedaron en el pasado, así que
-- «¿qué tengo hoy?» contestaba, con razón, «no tienes pendientes» — y 3 casos
-- fallaban sin que hubiera ningún bug. Un QA que se rompe solo con el calendario
-- entrena al equipo a ignorarlo, que es peor que no tenerlo.
--
-- `fn_qa_reset_ventas()` vuelve a poner las fechas RELATIVAS a hoy, igual que
-- hace `fn_qa_reset_mkt()` con las de marketing. Se corre antes de la suite.
-- Solo toca la org de QA (`ffffffff-…0001`): jamás roza datos reales.

create or replace function public.fn_qa_reset_ventas()
returns text
language plpgsql security definer set search_path to 'public'
as $$
declare v_org uuid := 'ffffffff-0000-4000-a000-000000000001'; v_n int;
begin
  -- Cada lead vuelve a su posición relativa: uno vencido (ayer), uno hoy,
  -- y los demás repartidos en los próximos días.
  update leads set next_action_at = (current_date - interval '1 day') + time '14:37'
   where organization_id = v_org and name = 'Maria Sintetica';

  update leads set next_action_at = current_date + time '16:00'
   where organization_id = v_org and name = 'Diana Prueba';

  update leads set next_action_at = current_date + interval '1 day' + time '21:37'
   where organization_id = v_org and name = 'Hector Acentos';

  update leads set next_action_at = current_date + interval '2 days' + time '16:37'
   where organization_id = v_org and name = 'Carlos Prueba' and stage = 'Seguimiento';

  update leads set next_action_at = current_date + interval '3 days' + time '19:37'
   where organization_id = v_org and name = 'Carlos Prueba' and stage = 'Zoom Agendado';

  get diagnostics v_n = row_count;
  return 'Cancha de QA de ventas re-fechada relativa a ' || current_date::text;
end $$;

-- La suite se re-fecha sola antes de correr: así el número siempre significa
-- «el cerebro está sano», nunca «pasaron unos días».
create or replace function public.fn_qa_run_golden(p_chat bigint default '-990001'::bigint)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  r record; v_raw jsonb; v_reply text; v_botones text; v_all text;
  v_pass boolean; v_err text;
  v_out jsonb := '[]'::jsonb; v_ok int := 0; v_tot int := 0;
begin
  perform fn_qa_reset_ventas();

  for r in
    select * from qa_golden_cases
     where activo and coalesce(superficie, 'ventas') = 'ventas'
     order by id
  loop
    v_tot := v_tot + 1; v_err := null; v_reply := null; v_botones := null;
    begin
      v_raw := public.bot_nlu_dispatch_gvintell(p_chat, r.tool_name, jsonb_build_object('input_text', r.frase));
      v_reply := v_raw #>> '{reply,text}';
      select string_agg(b->>'text', ' | ') into v_botones
      from jsonb_array_elements(coalesce(v_raw#>'{reply,inline_keyboard}','[]'::jsonb)) fila,
           jsonb_array_elements(fila) b;
    exception when others then
      v_err := SQLERRM;
    end;
    v_all := coalesce(v_reply,'') || ' ' || coalesce(v_botones,'');
    v_pass := v_err is null
          and length(btrim(v_all)) > 0
          and (r.esperado_ilike  is null or v_all ilike '%'||r.esperado_ilike||'%')
          and (r.prohibido_ilike is null or v_all not ilike '%'||r.prohibido_ilike||'%');
    if v_pass then v_ok := v_ok + 1; end if;
    v_out := v_out || jsonb_build_object(
      'id', r.id, 'cat', r.categoria, 'frase', r.frase, 'pass', v_pass,
      'error', v_err, 'reply', left(v_all, 160));
  end loop;
  return jsonb_build_object('suite','ventas','total', v_tot, 'ok', v_ok,
                            'score', v_ok||'/'||v_tot, 'casos', v_out);
end $function$;;
