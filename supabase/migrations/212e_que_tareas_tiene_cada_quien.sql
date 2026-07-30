-- Pedido de Iván (30-jul): que el Copilot de NSG quede tan inteligente como el
-- de Duke. Probándolo con frases suyas y de Ángel salió una pregunta obvia entre
-- dos socios que el asistente NO sabía contestar:
--
--   «qué tareas tiene Ángel»  →  «No terminé de entenderte 🤔»
--
-- ⚠️ Y no era de NSG: Duke tampoco podía. El asistente sabe crear trabajo para
-- otro («que Ángel revise el flujo mañana») y sabe listar el propio («mis
-- pendientes»), pero no sabía mirar el de un compañero. En NSG duele más porque
-- son dos socios repartiéndose todo, pero se arregla para las dos.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CÓMO
--
-- Función nueva `bot_tareas_de_companero(chat, nombre)` que reusa las piezas que
-- ya existen: `_ventas_find_profile` para resolver a la persona dentro de SU
-- organización (con la lista de palabras que nunca son una persona, y con la
-- regla de la mig 209b de que en ventas los apodos de marketing van últimos), y
-- `_bot_agenda_reply_date` para que las fechas se lean igual que en el resto.
--
-- 🔑 QUIÉN PUEDE: sólo quien coordina (super_admin, admin, ceo, director). Un
--    asesor que pregunte por otro recibe «puedo mostrarte TUS pendientes».
--    No es un pedido por prompt: es un candado en la función — si no debe poder,
--    que técnicamente no pueda (CLAUDE.md §2, «la seguridad son llaves»).
--
-- 🔒 EL RUTEO SÓLO SE ACTIVA SI EL NOMBRE RESUELVE A UN COMPAÑERO REAL, y que no
--    sea uno mismo. Es lo que evita que se coma frases parecidas: si no hay
--    persona, el mensaje sigue su camino de siempre. Contra: preguntar por
--    alguien que no existe («qué tareas tiene Pedro») cae en el «no te entendí»
--    genérico en vez de un «no encontré a Pedro». Se prefirió no romper nada.
--
-- Entiende: «qué tareas tiene X» · «qué pendientes tiene X» · «qué tiene
-- pendiente X» · «tareas de X».
--
-- PROBADO 10/10: las 4 formas listan lo de Ángel · un asesor no puede ver lo de
-- otro · «mis pendientes» y «qué tengo hoy» siguen siendo la agenda propia · el
-- dictado al equipo y la tarea personal, intactos · golden de ventas 35/35.
--
-- REVERTIR: quitar el bloque del ruteo (la función nueva queda huérfana, no
-- molesta). Sin DDL destructivo, sin tocar datos.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.bot_tareas_de_companero(p_telegram_chat_id bigint, p_nombre text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_yo public.profiles%rowtype; v_tz text; v_p record; v_txt text; v_n int;
begin
  select * into v_yo from public.profiles
   where telegram_chat_id = p_telegram_chat_id and coalesce(active,true)
   order by updated_at desc nulls last limit 1;
  if v_yo.id is null then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object(
      'text','No estás conectado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;

  -- Ver el trabajo de otro es cosa de quien coordina, no de cualquiera.
  if coalesce(v_yo.role,'asesor') not in ('super_admin','admin','ceo','director') then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object(
      'text','Puedo mostrarte tus pendientes, pero no los de otra persona. Escribe “mis pendientes”.',
      'inline_keyboard','[]'::jsonb));
  end if;

  select * into v_p from public._ventas_find_profile(v_yo.organization_id, p_nombre) limit 1;
  if v_p.id is null then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object(
      'text','No encontré a “'||initcap(btrim(p_nombre))||'” en tu equipo.','inline_keyboard','[]'::jsonb));
  end if;

  v_tz := public.fn_user_tz(v_yo.organization_id, p_telegram_chat_id);

  select count(*), string_agg(
           '• ' || coalesce(public._bot_agenda_reply_date(ta.due_at, v_tz),'sin fecha') || ' — ' || ta.text,
           chr(10) order by ta.due_at nulls last)
    into v_n, v_txt
  from public.team_actions ta
  where ta.organization_id = v_yo.organization_id
    and ta.asesor_id = v_p.id
    and coalesce(ta.done,false) = false;

  if coalesce(v_n,0) = 0 then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object(
      'text', v_p.name || ' no tiene pendientes abiertos.','inline_keyboard','[]'::jsonb));
  end if;

  return jsonb_build_object('ok',true,'reply',jsonb_build_object(
    'text', v_p.name || ' tiene ' || v_n || case when v_n=1 then ' pendiente:' else ' pendientes:' end
            || chr(10) || chr(10) || v_txt,
    'inline_keyboard','[]'::jsonb));
end;
$fn$;

do $do$
declare v_def text; v_anchor text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='bot_nlu_dispatch_gvintell_required_fields_orig';

  v_anchor := '  if public._bot_is_docs_query(v_norm) then';
  if position(v_anchor in v_def) = 0 then
    raise exception 'No encontré el ancla del ruteo — no toco nada.';
  end if;

  execute replace(v_def, v_anchor,
       '  -- mig 212e: «qué tareas tiene Ángel». Sólo se activa si el nombre' || chr(10)
    || '  -- resuelve a un compañero REAL y distinto de uno mismo; si no, el' || chr(10)
    || '  -- mensaje sigue su camino de siempre y no se rompe nada.' || chr(10)
    || '  declare v_quien text; v_qid uuid;' || chr(10)
    || '  begin' || chr(10)
    || '    v_quien := coalesce(' || chr(10)
    || '      (regexp_match(v_norm, ''\m(?:tareas|pendientes|actividades)\s+(?:tiene|tienen|de|del)\s+([a-z][a-z ]{1,39}?)\s*\??$''))[1],' || chr(10)
    || '      (regexp_match(v_norm, ''\mtiene\s+(?:pendiente|pendientes|asignad\w+)\s+([a-z][a-z ]{1,39}?)\s*\??$''))[1]);' || chr(10)
    || '    if v_quien is not null then' || chr(10)
    || '      select f.id into v_qid from public.profiles me,' || chr(10)
    || '        lateral public._ventas_find_profile(me.organization_id, btrim(v_quien)) f' || chr(10)
    || '       where me.telegram_chat_id = p_telegram_chat_id and coalesce(me.active,true)' || chr(10)
    || '       and f.id <> me.id limit 1;' || chr(10)
    || '      if v_qid is not null then' || chr(10)
    || '        return public.bot_tareas_de_companero(p_telegram_chat_id, btrim(v_quien));' || chr(10)
    || '      end if;' || chr(10)
    || '    end if;' || chr(10)
    || '  end;' || chr(10) || chr(10)
    || v_anchor);
end
$do$;
