-- La memoria conversacional del Copilot guarda también los pasos internos de las
-- herramientas (ai→tool_use, tool→tool_result). Eso rompe el chat de dos maneras:
--  (1) dos mensajes a la vez interleavean los pares;
--  (2) la ventana de N mensajes corta un par por la mitad
-- y la API de Anthropic rechaza TODA respuesta posterior ("tool_use sin tool_result"),
-- dejando el chat muerto para esa persona hasta limpiar la tabla a mano.
-- La conversación no necesita esos pasos: la respuesta final del asistente ya dice qué hizo.
create or replace function public.fn_sanear_memoria_copilot()
returns integer language plpgsql
security definer set search_path to 'public' as $$
declare v_borrados integer := 0;
begin
  delete from n8n_chat_histories
  where session_id like 'nsg:%'
    and ( message->>'type' = 'tool'
       or (message->>'type' = 'ai' and coalesce(jsonb_array_length(message->'tool_calls'),0) > 0) );
  get diagnostics v_borrados = row_count;
  return v_borrados;
end $$;

select cron.schedule('copilot-nsg-memoria-limpia', '* * * * *', $$select public.fn_sanear_memoria_copilot();$$);;
