-- Pedido de Iván (30-jul): que el Copilot de NSG quede tan inteligente como el
-- de Duke. Midiendo NSG con la misma vara salió algo que NO era de NSG:
--
--   «ponme una tarea para mañana: armar el brochure»
--       → «Aún no hay desarrollos publicados en el catálogo»
--
-- Aislando la frase, el desvío lo dispara UNA palabra: «brochure». Está en la
-- lista de vocabulario del catálogo (`_bot_is_catalog_query`) junto con `ficha`,
-- `pdf`, `drive`, `top`, `opciones`, `casas`. Para una inmobiliaria eso es
-- correcto: un brochure es de una propiedad. Para NSG el brochure es SUYO —
-- es una tarea.
--
-- ⚠️ Pero el agujero NO es de NSG. Probado en la cancha de QA, a Duke le pasa
-- igual:
--
--   «recuérdame mandar el brochure a Diana mañana»        → catálogo
--   «recuérdame revisar el pdf del contrato el viernes»   → catálogo
--   «agéndame para mañana: preparar las opciones»         → catálogo
--   «recuérdame mandar la ficha a Diana mañana»           → «no encontré al
--                                                            cliente Recuerdame
--                                                            Mandar Diana Mana»
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LA CAUSA ES EL ORDEN, NO EL VOCABULARIO
--
-- El cerebro decidía así: dictado al equipo → docs → recomendar → clientes →
-- FICHA → zoom → CATÁLOGO → … y la agenda personal QUEDABA ÚLTIMA. Cualquier
-- palabra del catálogo le ganaba a un «recuérdame» explícito.
--
-- Sacar «brochure» de la lista habría roto a Duke, que sí lo usa para pedir el
-- material de una propiedad. La palabra no está mal: está mal el turno.
--
-- ⇒ La intención EXPLÍCITA de anotarme algo pasa a decidir ANTES que la ficha y
--   el catálogo. Es la misma lección de la mig 200 («los de seguimiento» es una
--   etapa, no un verbo): resolver por ESTRUCTURA, no por vocabulario. Una orden
--   directa al asistente («recuérdame/agéndame/ponme una tarea» + un momento)
--   es más fuerte que una palabra suelta del rubro.
--
-- ⚠️ El ZOOM queda afuera a propósito: «agéndame un zoom con Diana mañana»
--    cumple las dos condiciones pero tiene su propia rama más abajo, que busca
--    al cliente y pide la hora. Sin esa exclusión se rompía.
--
-- PROBADO 13/13 en los DOS sentidos y en las dos organizaciones:
--   · NSG y Duke: las 7 frases de tarea que caían al catálogo ahora son tareas.
--   · Duke: «mándame el brochure de Tulum», «qué propiedades tienes en Cancún»
--     y «muéstrame el catálogo» SIGUEN yendo al catálogo.
--   · «agéndame un zoom con Diana mañana a las 5» sigue siendo zoom.
--   · El dictado al equipo y la agenda personal, intactos.
--   · Golden de ventas 35/35 (cancha de QA, chat -990001).
--
-- REVERTIR: quitar el bloque agregado (queda igual que antes; el mismo chequeo
-- sigue existiendo más abajo en la cadena). Sin DDL, sin tocar datos.
-- ═══════════════════════════════════════════════════════════════════════════

do $do$
declare v_def text; v_anchor text; v_nuevo text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='bot_nlu_dispatch_gvintell_required_fields_orig';

  v_anchor := '  if public._bot_is_docs_query(v_norm) then';
  if position(v_anchor in v_def) = 0 then
    raise exception 'No encontré el ancla del ruteo — no toco nada.';
  end if;

  v_nuevo :=
       '  -- mig 212c: la intención EXPLÍCITA de anotarme algo decide ANTES que la' || chr(10)
    || '  -- ficha y el catálogo. «recuérdame mandar el brochure mañana» es una' || chr(10)
    || '  -- TAREA, no una consulta de catálogo: una palabra del rubro no puede' || chr(10)
    || '  -- ganarle a una orden directa al asistente. El zoom queda afuera porque' || chr(10)
    || '  -- tiene su propia rama más abajo (busca al cliente y pide la hora).' || chr(10)
    || '  if public._bot_agenda_is_create(v_tool, v_norm)' || chr(10)
    || '     and v_norm !~ ''\y(zoom|cita|reunion|meet|junta)\y'' then' || chr(10)
    || '    return public.bot_agenda_personal_create(p_telegram_chat_id, v_args || jsonb_build_object(''input_text'', v_text));' || chr(10)
    || '  end if;' || chr(10) || chr(10)
    || v_anchor;

  execute replace(v_def, v_anchor, v_nuevo);
end
$do$;
