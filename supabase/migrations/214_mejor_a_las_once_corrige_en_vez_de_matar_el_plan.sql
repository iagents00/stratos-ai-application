-- De la prueba real de Iván (30-jul): registró una actividad, dijo «mejor a las
-- 11 am»… y el Copilot contestó «No entendí qué acciones querés registrar».
-- Peor: si había un plan esperando el «sí», cualquier texto que no fuera sí/no
-- lo BORRABA en silencio (else delete del bloque de pendientes).
--
-- Corregir una hora es la continuación natural de dictar. Dos escenarios:
--
-- 1. PLAN MOSTRADO, AÚN SIN CONFIRMAR + «mejor a las 11» → se corrige la hora
--    de las actividades del plan (conservando el DÍA que ya tenían) y se vuelve
--    a preguntar ¿Confirmo?. El pendiente se reemplaza por el corregido.
--
-- 2. RECIÉN CONFIRMADO (sin pendiente) + «mejor a la 1 pm» → se mueven las
--    actividades que ESE admin registró en los últimos 10 minutos: mismo día,
--    hora nueva, en la zona horaria real. Responde «Movida(s): …».
--
-- GUARDIAS (para no secuestrar frases que no son corrección):
--   · texto corto (≤80) · patrón de corrección (mejor/cambia/mueve/corre/que sea)
--   · con HORA EXPLÍCITA (_bot_hora_explicita — un número suelto no cuenta)
--   · NO es un dictado nuevo (_ventas_es_dictado_equipo lo excluye)
--   · NO trae palabras de creación (ponme/tarea/recuérdame/agendame/necesito)
--   · escenario 2: solo admins, solo lo creado por ELLOS hace <10 min
--
-- ⚠️ La extracción del día usa lower(unaccent(...)) — NO translate con lista de
-- vocales: en el ensayo «mañana» no matcheaba porque la ñ no se normalizaba y
-- el plan corregido caía en HOY. unaccent sí convierte ñ→n.
--
-- PROBADO en ensayo revertido: plan pendiente corregido re-pregunta y conserva
-- el día · «sí» registra con la hora corregida · «mejor a la 1 pm» mueve la
-- recién registrada (13:00) · un dictado con «mejor» adentro NO se confunde ·
-- golden ventas 35/35.
--
-- REVERTIR: quitar el elsif y el bloque nuevo de _inner (CREATE OR REPLACE con
-- el cuerpo anterior). Sin DDL, sin tocar datos.

do $do$
declare v_def text; v_a1 text; v_elsif text; v_bloque2 text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='bot_nlu_dispatch_gvintell_inner';

  v_a1 := '    else delete from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id; end if;';
  if position(v_a1 in v_def) = 0 then raise exception 'ancla A1 no encontrada — no toco nada'; end if;
  if position('CORRECCIÓN: nota SINGULAR' in v_def) = 0 then raise exception 'ancla A2 no encontrada — no toco nada'; end if;

  -- Escenario 1: corregir el plan pendiente
  v_elsif :=
       '    elsif v_pend.action = ''team_plan''' || chr(10)
    || '       and jsonb_typeof(v_pend.payload->''tareas'') = ''array''' || chr(10)
    || '       and length(v_text) <= 80' || chr(10)
    || '       and v_norm ~ ''\m(mejor|cambial[oa]|cambia|muevel[oa]|mueve|correl[oa]|que sea)\M''' || chr(10)
    || '       and v_norm !~ ''\m(ponme|tarea|recuerdame|recordame|agendame|necesito|tengo que)\M''' || chr(10)
    || '       and public._bot_hora_explicita(v_norm) is not null' || chr(10)
    || '       and not public._ventas_es_dictado_equipo(p_telegram_chat_id, v_text) then' || chr(10)
    || '      declare v_h text[]; v_ts jsonb := ''[]''::jsonb; v_e jsonb; v_dia text;' || chr(10)
    || '      begin' || chr(10)
    || '        v_h := public._bot_hora_explicita(v_norm);' || chr(10)
    || '        for v_e in select value from jsonb_array_elements(v_pend.payload->''tareas'') loop' || chr(10)
    || '          v_dia := coalesce((regexp_match(lower(unaccent(coalesce(v_e->>''cuando'',''''))),' || chr(10)
    || '                     ''(pasado manana|manana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo)''))[1],''hoy'');' || chr(10)
    || '          v_ts := v_ts || jsonb_set(v_e,''{cuando}'',to_jsonb(v_dia||'' a las ''||v_h[1]||'':''||lpad(v_h[2],2,''0'')));' || chr(10)
    || '        end loop;' || chr(10)
    || '        v_result := public.bot_create_team_actions(p_telegram_chat_id, v_ts, false);' || chr(10)
    || '        delete from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id;' || chr(10)
    || '        if coalesce((v_result->>''necesita_confirmacion'')::boolean,false) then' || chr(10)
    || '          insert into public.bot_pending_confirm (telegram_chat_id, action, organization_id, payload)' || chr(10)
    || '          values (p_telegram_chat_id,''team_plan'',v_pend.organization_id, jsonb_build_object(''tareas'', v_ts));' || chr(10)
    || '        end if;' || chr(10)
    || '        return v_result;' || chr(10)
    || '      end;';
  v_def := replace(v_def, v_a1, v_elsif || chr(10) || v_a1);

  -- Escenario 2: mover lo recién registrado (sin pendiente)
  v_bloque2 :=
       '  -- mig 214: corrección de hora sobre lo RECIÉN registrado (últimos 10 min)' || chr(10)
    || '  if length(v_text) <= 80' || chr(10)
    || '     and v_norm ~ ''\m(mejor|cambial[oa]|cambia|muevel[oa]|mueve|correl[oa]|que sea)\M''' || chr(10)
    || '     and v_norm !~ ''\m(ponme|tarea|recuerdame|recordame|agendame|necesito|tengo que)\M''' || chr(10)
    || '     and public._bot_hora_explicita(v_norm) is not null' || chr(10)
    || '     and not public._ventas_es_dictado_equipo(p_telegram_chat_id, v_text) then' || chr(10)
    || '    declare v_c2 record; v_h2 text[]; v_tz2 text; v_k int := 0; v_out2 text := ''''; r2 record; v_new2 timestamptz;' || chr(10)
    || '    begin' || chr(10)
    || '      select id, name, coalesce(role,''asesor'') as role, organization_id into v_c2' || chr(10)
    || '        from public.profiles where telegram_chat_id = p_telegram_chat_id and coalesce(active,true)' || chr(10)
    || '        order by updated_at desc nulls last limit 1;' || chr(10)
    || '      if found and v_c2.role in (''super_admin'',''admin'',''ceo'',''director'') then' || chr(10)
    || '        v_h2 := public._bot_hora_explicita(v_norm);' || chr(10)
    || '        v_tz2 := public.fn_user_tz(v_c2.organization_id, p_telegram_chat_id);' || chr(10)
    || '        for r2 in select * from public.team_actions' || chr(10)
    || '                   where organization_id = v_c2.organization_id and created_by = v_c2.id' || chr(10)
    || '                     and created_at > now() - interval ''10 minutes''' || chr(10)
    || '                     and coalesce(done,false) = false and due_at is not null' || chr(10)
    || '                   order by created_at desc loop' || chr(10)
    || '          v_new2 := (((r2.due_at at time zone v_tz2)::date)::timestamp' || chr(10)
    || '                     + make_interval(hours => v_h2[1]::int, mins => v_h2[2]::int)) at time zone v_tz2;' || chr(10)
    || '          update public.team_actions set due_at = v_new2 where id = r2.id;' || chr(10)
    || '          v_k := v_k + 1;' || chr(10)
    || '          v_out2 := v_out2 || ''· '' || r2.text || '' — '' || public.fn_fmt_cuando_legible(v_new2, v_tz2) || chr(10);' || chr(10)
    || '        end loop;' || chr(10)
    || '        if v_k > 0 then' || chr(10)
    || '          return jsonb_build_object(''ok'',true,''reply'',jsonb_build_object(' || chr(10)
    || '            ''text'', case when v_k = 1 then ''Movida:'' else ''Movidas ''||v_k||'' actividades:'' end' || chr(10)
    || '                    || chr(10) || chr(10) || v_out2,' || chr(10)
    || '            ''inline_keyboard'',''[]''::jsonb));' || chr(10)
    || '        end if;' || chr(10)
    || '      end if;' || chr(10)
    || '    end;' || chr(10)
    || '  end if;' || chr(10) || chr(10);
  v_def := replace(v_def, '  -- CORRECCIÓN: nota SINGULAR', v_bloque2 || '  -- CORRECCIÓN: nota SINGULAR');

  execute v_def;
end
$do$;
