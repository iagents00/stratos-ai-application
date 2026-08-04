-- 100: Evita doble burbuja en Copilot web.
--
-- El frontend actual ya registra el mensaje del usuario y la respuesta AI con
-- copilot_log_msg. Este RPC debe limitarse a crear/deduplicar la accion y
-- devolver el texto; si tambien escribe en tg_bot_activity aparecen dos
-- burbujas para el mismo recordatorio.

create or replace function public.copilot_agenda_create_from_text(
  p_text text,
  p_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_profile public.profiles%rowtype;
  v_chat_id bigint;
  v_args jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select *
    into v_profile
  from public.profiles
  where id = auth.uid()
    and coalesce(active, true) = true
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  v_chat_id := v_profile.telegram_chat_id;
  if v_chat_id is null then
    return jsonb_build_object('ok', false, 'error', 'telegram_not_paired');
  end if;

  v_args := jsonb_build_object(
    'input_text', coalesce(p_text,''),
    'category', coalesce(p_category, '')
  );

  return public.bot_agenda_personal_create(v_chat_id, v_args);
end;
$$;

grant execute on function public.copilot_agenda_create_from_text(text, text) to authenticated;
grant execute on function public.copilot_agenda_create_from_text(text, text) to service_role;
revoke all on function public.copilot_agenda_create_from_text(text, text) from public, anon;

notify pgrst, 'reload schema';
