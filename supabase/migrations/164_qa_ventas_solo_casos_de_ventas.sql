-- El QA dorado de VENTAS daba 22/43 y parecía una regresión. No lo era: la
-- función corría los **43** casos de la tabla, incluidos los **17 de marketing**,
-- y los mandaba al cerebro de VENTAS. Ese cerebro contesta, bien, «no conozco esa
-- acción: create_request» — porque create_request es de marketing.
--
-- La tabla ya tiene la columna `superficie` (26 ventas · 17 marketing); la función
-- simplemente no la miraba. Se agrega el filtro. Ahora el número vuelve a
-- significar algo: un 26/26 quiere decir «el cerebro de ventas está sano», no
-- «también corrí casos de otro producto».
--
-- Un número de QA que mezcla suites es peor que no tener QA: da miedo cuando no
-- pasa nada y tapa las fallas de verdad.

create or replace function public.fn_qa_run_golden(p_chat bigint default '-990001'::bigint)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  r record; v_raw jsonb; v_reply text; v_botones text; v_all text;
  v_pass boolean; v_err text;
  v_out jsonb := '[]'::jsonb; v_ok int := 0; v_tot int := 0;
begin
  for r in
    select * from qa_golden_cases
     where activo
       and coalesce(superficie, 'ventas') = 'ventas'   -- ← el filtro que faltaba
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
