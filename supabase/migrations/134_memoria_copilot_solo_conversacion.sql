-- Por qué: la memoria guardaba también los pasos internos (ai→tool_use, tool→tool_result).
-- Dos fallos por eso: (1) si entran 2 mensajes a la vez, los pares se interleavean; (2) la
-- ventana de N mensajes corta un par por la mitad y la API recibe un tool_result sin su
-- tool_use. En ambos casos el chat queda MUERTO para esa persona ("Bad request") hasta que
-- alguien limpie la tabla a mano.
-- Solución: la memoria conversacional guarda solo el DIÁLOGO (human/ai final). La respuesta
-- final del asistente ya resume lo que hizo la herramienta, así que no se pierde contexto útil.
create or replace function public.fn_sanear_memoria_chat(p_session text)
returns integer language plpgsql as $$
declare v_borrados integer := 0;
begin
  if coalesce(trim(p_session),'') = '' then return 0; end if;

  delete from n8n_chat_histories
  where session_id = p_session
    and ( message->>'type' = 'tool'                                        -- resultado de herramienta
       or (message->>'type' = 'ai'
           and coalesce(jsonb_array_length(message->'tool_calls'),0) > 0)  -- llamada a herramienta
        );
  get diagnostics v_borrados = row_count;
  return v_borrados;
end $$;;
