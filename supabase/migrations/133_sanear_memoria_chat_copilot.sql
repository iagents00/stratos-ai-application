-- ⚠️ Si dos mensajes del MISMO usuario entran a la vez, la memoria del Copilot queda
-- desordenada (ai con tool_use → human → tool). La API de Anthropic exige que a un
-- tool_use le siga INMEDIATAMENTE su tool_result, así que a partir de ahí TODA respuesta
-- falla con "Bad request" y el chat queda muerto para esa persona hasta que alguien
-- limpie la tabla a mano. Esta función deja la memoria consistente: borra desde el primer
-- punto roto en adelante y conserva el historial anterior. Idempotente y barata.
create or replace function public.fn_sanear_memoria_chat(p_session text)
returns integer language plpgsql as $$
declare v_desde integer; v_borrados integer := 0;
begin
  if coalesce(trim(p_session),'') = '' then return 0; end if;

  with m as (
    select id,
           message->>'type' as tipo,
           coalesce(jsonb_array_length(message->'tool_calls'),0) > 0 as tiene_call,
           lead(message->>'type') over (order by id) as sig
    from n8n_chat_histories where session_id = p_session
  )
  select min(id) into v_desde
  from m
  where (tipo = 'ai' and tiene_call and coalesce(sig,'') <> 'tool')   -- llamada sin resultado
     or (tipo = 'tool' and id = (select min(id) from m));             -- resultado huérfano al inicio

  if v_desde is null then return 0; end if;

  delete from n8n_chat_histories where session_id = p_session and id >= v_desde;
  get diagnostics v_borrados = row_count;
  return v_borrados;
end $$;;
