-- 042_bot_my_clients_and_pipeline_fix.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Fixes en RPCs del bot de Telegram (org-agnósticas — resuelven org por
-- profiles.telegram_chat_id). Aditivo; no toca datos de leads.
--
--  #1  Boton "Mis clientes" (callback action 'list') listaba PENDIENTES.
--      Ahora lista los clientes del asesor (created_at DESC):
--      nombre · telefono · etapa · score. Total arriba.
--      → nueva fn bot_list_my_clients_v2 + wrapper de bot_handle_callback que
--        rutea action='list' a esa fn (resto delega a _core).
--
--  #2  Boton "Pipeline" (callback action 'pipeline') devolvía reply.text vacío:
--      bot_list_pipeline_summary_v2 iteraba v_inner->'stages' (no existe). El
--      inner bot_list_pipeline_summary devuelve {total, by_stage:{etapa:n}, ...}.
--      → ahora itera by_stage (desc por count) y agrega "Total: N".
--
-- Formato de salida alineado a los demás tools del dispatch:
--   { ok, data, reply:{ text, parse_mode, inline_keyboard } }.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── #1: lista de clientes del asesor ────────────────────────────────────────
create or replace function public.bot_list_my_clients_v2(p_telegram_chat_id bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_asesor record; v_total int; v_lines text[]; v_row record;
begin
  select id, organization_id into v_asesor
    from public.profiles where telegram_chat_id = p_telegram_chat_id and active = true;
  if not found then
    return public._bot_err_envelope(jsonb_build_object('error','asesor_not_paired'));
  end if;

  select count(*) into v_total from public.leads l
   where l.organization_id = v_asesor.organization_id and l.asesor_id = v_asesor.id and l.deleted_at is null;

  if v_total = 0 then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('total',0),
      'reply', jsonb_build_object('text','No tienes clientes aun.','parse_mode',null,'inline_keyboard', public._bot_kb_back()));
  end if;

  v_lines := array['Tus clientes (' || v_total || ', recientes primero):'];
  for v_row in
    select l.name, l.phone, l.stage, l.score from public.leads l
     where l.organization_id = v_asesor.organization_id and l.asesor_id = v_asesor.id and l.deleted_at is null
     order by l.created_at desc limit 20
  loop
    v_lines := v_lines || ('. ' || coalesce(v_row.name,'(sin nombre)') || ' . ' || coalesce(v_row.phone,'-')
                          || ' . ' || coalesce(v_row.stage,'-') || ' . score ' || coalesce(v_row.score::text,'-'));
  end loop;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('total', v_total),
    'reply', jsonb_build_object('text', array_to_string(v_lines, E'\n'), 'parse_mode', null, 'inline_keyboard', public._bot_kb_back()));
end; $function$;

revoke all on function public.bot_list_my_clients_v2(bigint) from public;
grant execute on function public.bot_list_my_clients_v2(bigint) to service_role;

-- ─── #2: pipeline por etapa (itera by_stage + total) ─────────────────────────
create or replace function public.bot_list_pipeline_summary_v2(p_telegram_chat_id bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_inner jsonb; v_lines text[]; v_k text; v_v text;
begin
  v_inner := public.bot_list_pipeline_summary(p_telegram_chat_id);
  if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;

  v_lines := array['Pipeline por etapa:'];
  for v_k, v_v in
    select key, value from jsonb_each_text(coalesce(v_inner->'by_stage','{}'::jsonb)) order by value::int desc
  loop
    v_lines := v_lines || ('. ' || v_k || ' - ' || v_v);
  end loop;
  v_lines := v_lines || ('Total: ' || coalesce(v_inner->>'total','0'));

  return jsonb_build_object('ok', true, 'data', v_inner,
    'reply', jsonb_build_object('text', array_to_string(v_lines, E'\n'), 'parse_mode', null, 'inline_keyboard', public._bot_kb_back()));
end; $function$;

-- ─── #1 routing: rename del handler de callbacks a _core + wrapper ───────────
-- El wrapper intercepta action='list' (Mis clientes) y delega el resto a _core.
alter function public.bot_handle_callback(bigint, text) rename to bot_handle_callback_core;

create or replace function public.bot_handle_callback(p_telegram_chat_id bigint, p_callback_data text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_verify jsonb;
begin
  v_verify := public._bot_cb_verify(p_callback_data);
  if (v_verify->>'valid')::boolean and (v_verify->>'action') = 'list' then
    return public.bot_list_my_clients_v2(p_telegram_chat_id);
  end if;
  return public.bot_handle_callback_core(p_telegram_chat_id, p_callback_data);
end; $function$;

revoke all on function public.bot_handle_callback(bigint, text) from public;
grant execute on function public.bot_handle_callback(bigint, text) to service_role;
