-- 193 · VENTAS: que dictar actividades funcione como en marketing
--
-- Aplicado en la base como: 193 · 193b · 193c · 193d · 193e · 193f (29-jul-2026).
-- Los cuerpos vivos están en Supabase (y en el volcado diario de .github/workflows/backup.yml).
-- Acá queda el PORQUÉ y la lógica nueva; las dos funciones largas (el separador
-- y fn_due_ventas) se documentan abajo sin copiar el cuerpo, como ya se hizo en
-- la migración 183.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POR QUÉ. Ángel, 29-jul, probó LA MISMA frase en los dos Copilots:
--
--   «Hola qué tal necesito que Carlos Ayala haga mañana 50 llamadas con
--    clientes de las primeras etapas del CRM haga rol Play de las llamadas de
--    zoom y que todo esto esté listo antes de las cuatro de la tarde, tiene
--    hasta las 5:30 como máximo el límite»
--
--   · MARKETING (Yazz) → 3 tareas creadas, con responsable.
--   · VENTAS (Carlos Ayala) → «No encontré un recordatorio personal pendiente
--     que coincida.» No registró NADA.
--
-- LA CAUSA — no fue el modelo. La ejecución 1212427 del flujo 8ZasBukTkSx26m2A
-- muestra que el agente clasificó BIEN:
--     {"tool_name":"create_team_action",
--      "args":{...,"responsable":"Carlos Ayala","due_at":"mañana antes de las
--              cuatro de la tarde"}}
-- El mensaje se perdió DESPUÉS, ya dentro de la base. En el camino real
-- (bot_nlu_dispatch_gvintell → …_required_fields_orig) hay un guardia que
-- corre antes que todo:
--     _bot_agenda_is_done = '(^| )(…|listo|lista|hecho|hecha|…)( |$)'
-- Bastaba con que «listo» apareciera EN CUALQUIER PARTE del mensaje para
-- leerlo como «ya terminé mi recordatorio». La frase decía «…que todo esto
-- esté LISTO antes de las cuatro…». Verificado: daba true.
--
-- Y no rompía sólo el dictado: cualquier mensaje de ventas con listo/lista/
-- hecho/hecha/completado/completada suelto quedaba secuestrado («la propuesta
-- ya está lista, mándasela a Gael»).
--
-- SEGUNDO HALLAZGO — un arreglo en un camino que no se recorre:
-- la corrección del 29-jul («organizar el día» / «pídele a» → acción de
-- equipo) vive en bot_nlu_dispatch_gvintell_inner, que en la cadena real está
-- al final (…_orig → bot_smart_queries → _inner). El mensaje moría arriba y
-- nunca llegaba. El arreglo existía y no corría.
--
-- LO QUE NO CAMBIA: leads, brokers, etapas, pipeline, catálogo, expedientes,
-- zooms. bot_create_team_action(s) no se tocan. Nada se escribe sin que el
-- admin confirme: se muestra el plan y espera el «sí».
-- QA dorado antes y después: ventas 26/26 · marketing 15/17 (idéntico).
--
-- REVERTIR: cada función vuelve con un CREATE OR REPLACE a su cuerpo anterior.
-- No hay DDL destructivo ni datos migrados.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. ¿A quién del equipo le está encargando trabajo?  (193)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public._ventas_menciona_companero(p_org uuid, p_texto text)
returns text
language plpgsql
stable
as $fn$
declare
  v_norm text;
  v_pats text[] := array[
    '\m(?:pidele|dile|recuerdale|encargale|asignale|registrale|anotale|apuntale|mandale|ponle|ponele)\s+a\s+([a-z]{3,})(?:\s+([a-z]{3,}))?',
    '\m(?:necesito|quiero|ocupo|requiero)\s+que\s+([a-z]{3,})(?:\s+([a-z]{3,}))?',
    '\mque\s+([a-z]{3,})(?:\s+([a-z]{3,}))?\s+(?:haga|hagan|llame|llamen|prepare|preparen|revise|revisen|arme|armen|mande|manden|envie|envien|suba|suban|actualice|actualicen|atienda|atiendan|contacte|contacten|agende|agenden|termine|terminen|entregue|entreguen|cierre|cierren)\M',
    '\mtareas?\s+para\s+([a-z]{3,})(?:\s+([a-z]{3,}))?',
    '\m([a-z]{3,})(?:\s+([a-z]{3,}))?\s+(?:tiene|tienen)\s+que\M',
    '\m([a-z]{3,})(?:\s+([a-z]{3,}))?\s+(?:debe|deben)\M'
  ];
  -- Sin este filtro, _ventas_find_profile (busca por LIKE '%x%') haría que
  -- «ang» matcheara «Ángel».
  v_stop text[] := array[
    'que','los','las','sus','como','para','con','del','este','esta','esto','estos','estas',
    'todo','toda','todos','todas','equipo','vendedores','asesores','asesor','vendedor',
    'cliente','clientes','lead','leads','manana','hoy','ayer','tarde','noche','dia','dias',
    'semana','lunes','martes','miercoles','jueves','viernes','sabado','domingo',
    'llamadas','llamada','zoom','zooms','crm','pipeline','etapa','etapas','tablero',
    'una','uno','unos','unas','cada','otro','otra','mismo','misma','favor','porfa',
    'ellos','ellas','nosotros','ustedes','alguien','nadie','gente','persona','personas',
    'hacer','haga','llamar','mandar','enviar','revisar','preparar','actualizar','atender'
  ];
  m text[]; pat text; v_c1 text; v_c2 text; v_rec record;
begin
  v_norm := lower(unaccent(coalesce(p_texto, '')));
  if btrim(v_norm) = '' or p_org is null then return null; end if;

  foreach pat in array v_pats loop
    m := regexp_match(v_norm, pat);
    if m is null then continue; end if;
    v_c1 := m[1]; v_c2 := m[2];
    if v_c1 is null or v_c1 = any(v_stop) then continue; end if;
    if v_c2 = any(v_stop) then v_c2 := null; end if;

    if v_c2 is not null then
      select * into v_rec from public._ventas_find_profile(p_org, v_c1 || ' ' || v_c2);
      if v_rec.id is not null then return v_rec.name; end if;
    end if;
    select * into v_rec from public._ventas_find_profile(p_org, v_c1);
    if v_rec.id is not null then return v_rec.name; end if;
  end loop;

  return null;
end
$fn$;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. El candado: ¿esto es un dictado de trabajo al equipo?  (193)
--    Pide las TRES cosas, no una: jefe + verbo de encargo + persona real.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public._ventas_es_dictado_equipo(p_telegram_chat_id bigint, p_texto text)
returns boolean
language plpgsql
stable
as $fn$
declare v_jefe record; v_norm text; v_encargo boolean; v_al_equipo boolean;
begin
  v_norm := lower(unaccent(coalesce(p_texto, '')));
  if btrim(v_norm) = '' then return false; end if;

  select id, coalesce(role,'asesor') as role, organization_id into v_jefe
  from public.profiles
  where telegram_chat_id = p_telegram_chat_id and coalesce(active,true)
  order by updated_at desc nulls last limit 1;
  if not found then return false; end if;
  if v_jefe.role not in ('super_admin','admin','ceo','director') then return false; end if;

  v_encargo :=
       v_norm ~ '\m(pidele|dile|recuerdale|encargale|asignale|registrale|anotale|apuntale|mandale)\s+a\s'
    or v_norm ~ '\m(necesito|quiero|ocupo|requiero)\s+que\s'
    or v_norm ~ '\mtareas?\s+para\s'
    or v_norm ~ 'organi\w*\s*(me|cemos)?\s+(el\s+)?(dia|semana)'
    or v_norm ~ '\mrepart\w+\s+(el\s+)?(dia|trabajo|tareas)\M'
    or v_norm ~ '\mque\s+\w+\s+(haga|hagan|llame|llamen|prepare|preparen|revise|revisen|arme|armen|mande|manden|envie|envien|suba|suban|actualice|actualicen|atienda|atiendan|contacte|contacten|agende|agenden|termine|terminen|entregue|entreguen)\M';
  if not v_encargo then return false; end if;

  v_al_equipo := v_norm ~ '\m(todos los vendedores|todos los asesores|todo el equipo|los vendedores|el equipo)\M';
  if v_al_equipo then return true; end if;

  return public._ventas_menciona_companero(v_jefe.organization_id, p_texto) is not null;
end
$fn$;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. «listo» cierra un pendiente cuando ES el mensaje, no cuando va perdido
--    dentro de una instrucción de 45 palabras.  (193)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public._bot_agenda_is_done(p_norm text)
returns boolean
language sql
immutable
as $fn$
  select coalesce(p_norm,'') ~
    '^\s*(ok[,\s]+|oye[,\s]+|hola[,\s]+|bueno[,\s]+|ya\s+)?(ya lo hice|ya la hice|ya quedo|hecho|hecha|listo|lista|completado|completada)\M';
$fn$;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. fn_quitar_tiempo: le faltaban anclas de palabra.  (193)
--    «tiene hasta las 5:30» quedaba en «tiene hast» (se comía el «a las 5:30»
--    de dentro de «hastA LAS»). Igual «tienen 3 horas» → «tien».
--    Se agregó \m a cada patrón y se sumaron hasta/antes de/para.
--    Cuerpo vivo en Supabase.
-- ───────────────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────────────
-- 5. fn_ventas_split_dictado — el separador.  (193b · 193c · 193d · 193e)
--    Cuerpo vivo en Supabase. Lo que se le agregó:
--    · 193b  quita el saludo de entrada («Hola qué tal, necesito que…») y
--            entiende «necesito/quiero/ocupo que <persona>» como apertura.
--    · 193c  una MISMA persona encadena varias cosas («que X haga A … haga B»)
--            → se parte en varias; y «y queTodo» pegado (dictado por voz).
--    · 193d  «que TODO ESTO esté listo» es la COSA, no la gente: antes caía en
--            la rama de equipo y la actividad se le asignaba a los 12
--            vendedores en vez de a la persona de la que se venía hablando.
--    · 193e  la fecha dicha UNA vez vale para todo el dictado («haga MAÑANA 50
--            llamadas … haga rol play …» → las dos quedan para mañana).
-- ───────────────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────────────
-- 6. fn_due_ventas — un día SIN hora vence al CIERRE de su jornada.  (193f)
--    parse_relative_or_abs_es (compartido, lo usa medio CRM) EXIGE una hora:
--    «el viernes» resolvía pero «mañana» devolvía null y la actividad nacía
--    «sin fecha». No se tocó el parser: se resuelve del lado de ventas, con la
--    misma regla que ya rige en marketing (mig 181). Sólo lo usan
--    bot_create_team_action y bot_create_team_actions. Cuerpo vivo en Supabase.
-- ───────────────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────────────
-- 7. El camino REAL: atender el dictado antes de los guardias de agenda. (193)
--    Mismo cuerpo de siempre de …_required_fields_orig; sólo se agregó el
--    bloque «mig 193» que se ve abajo. Cuerpo completo vivo en Supabase.
--
--    if v_tool not in ('add_expediente_note','add_expediente_voice',
--                      'add_note_bulk','upsert_lead','create_lead','add_client',
--                      'create_client','nuevo_cliente','registrar_cliente',
--                      'bulk_register')
--       and public._ventas_es_dictado_equipo(p_telegram_chat_id, v_text) then
--      return public.bot_nlu_dispatch_gvintell_inner(
--        p_telegram_chat_id, 'create_team_action',
--        v_args || jsonb_build_object('input_text', v_text));
--    end if;
--
--    Se excluyen altas y notas de cliente: su contenido puede traer
--    legítimamente un «pídele a…» dentro del texto de la nota.
-- ───────────────────────────────────────────────────────────────────────────
