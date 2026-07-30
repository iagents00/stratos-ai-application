-- Iván, 30-jul, con tres capturas del Copilot en la mano:
--
--   «aquí le falta ser más inteligente, se equivocó en la actividad dos que
--    sugiere mañana mañana»
--   «yo no le dije en ningún momento a las diez y me lo está poniendo en todas»
--   «hace muchos mensajes y muy complicado en vez de simplificarlo y que quede
--    todo accionable»
--
-- Reproducido con sus frases exactas contra el cerebro vivo. El separador parte
-- el dictado por verbos y usa PEDAZOS CRUDOS de la transcripción como título:
--
--   caso 1 → 3 pedazos, uno es literalmente «mañana»
--   caso 2 → 5 pedazos: «claridad es eso estar listo más tardar y la segunda»,
--            «clientes pagar contactos y los demás»
--
-- Esta migración arregla lo que SÍ es determinista. Lo otro —redactar bien la
-- actividad— no se arregla con reglas y se dice abajo.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. UN PEDAZO QUE ES SOLO TIEMPO NO ES UNA ACTIVIDAD
--
--    `_es_accion_de_verdad` descarta lo que no puede ser una tarea: sólo una
--    expresión de tiempo («mañana», «el lunes», «hoy 3 pm»), sin ninguna letra,
--    una palabra hueca («listo», «todo», «eso»), o una sola palabra.
--
--    Se enchufa en `bot_create_team_actions`, que es el cuello por donde pasa
--    TODO — venga del separador o del modelo. Así el filtro protege las dos vías.
--
--    El caso 1 de Iván pasa de 3 actividades (una basura) a 2 correctas.
--
-- 2. EL PLAN, COMPACTO Y SIN RUIDO (pedido de Iván: «simple, compacto, sin
--    emojis, íconos simples, puntos a la izquierda»)
--
--    Antes:  «Entendí 3 acciones:» · numeradas «1.» · «Así quedarían en la
--            agenda de cada quien. ¿Confirmas?» · «Me faltó la fecha de: …»
--    Ahora:  «2 actividades» · viñeta «· » · « — hora» · «¿Confirmo?»
--
--    ⚠️ Se conserva a propósito el «▸ Nombre» del responsable: `Copilot.jsx`
--    lo detecta con ese signo exacto para pintarlo en verde menta. Quitarlo
--    (que era lo primero que iba a hacer) habría apagado el color del nombre.
--    Y la viñeta pasa a «·» —no «▪»— porque es la que el Copilot ya sangra.
--    El formato se diseñó PARA el render que existe, no contra él.
--
-- 3. EL CASO DORADO #44, ACTUALIZADO A PROPÓSITO
--
--    Esperaba el texto literal «Entendí 2 acciones», que es justo lo que Iván
--    pidió cambiar. Cuando cambia la expectativa y no el código, se actualiza la
--    expectativa — y se deja dicho quién lo pidió. Pasa a «2 actividades».
--
-- ⚠️ LO QUE ESTO NO ARREGLA — Y NO SE ARREGLA CON REGLAS
--    Los títulos siguen siendo transcripción cruda («Organiza sus CRM para que
--    tenga bien entrar a sus prioridades aspectos») y las horas siguen mal
--    («hoy 3:00 p.m.» en vez de mañana; «10:00 p.m.» que es el cierre de jornada
--    de Gael y que Iván nunca dijo). Ninguna regex convierte «claridad es eso
--    estar listo más tardar» en «Organizar el CRM por prioridades»: eso no es
--    partir texto, es entenderlo y volver a redactarlo. Eso lo hace el modelo,
--    y el prompt de n8n hoy se lo PROHÍBE explícitamente («TODO el texto que ve
--    el asesor lo produce el backend, vos SOLO elegís tool_name»). Ahí está el
--    techo, y ahí va el siguiente paso.
--
-- PROBADO: caso 1 pasa de 3 a 2 actividades sin la basura · 7/7 actividades
-- legítimas se conservan («Revisar el pipeline», «Llamar a Gael», «Organizar el
-- CRM por prioridades», «Hacer 30 seguimientos», …) · golden ventas 35/35.
--
-- REVERTIR: quitar la línea del filtro y volver los textos del armador.
-- Sin DDL destructivo, sin tocar datos de negocio.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public._es_accion_de_verdad(p_texto text)
returns boolean language sql immutable set search_path to 'public','pg_temp' as $fn$
  with t as (select btrim(lower(unaccent(coalesce(p_texto,'')))) as s)
  select case
    when (select s from t) = '' then false
    when (select s from t) !~ '[a-z]' then false
    -- es SOLO una expresión de tiempo: «mañana», «el lunes», «hoy 3 pm»
    when (select s from t) ~ ('^(el\s+|la\s+|para\s+|antes\s+de\s+|a\s+)*'
           || '(hoy|manana|pasado\s+manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|'
           || 'temprano|mediodia|primera\s+hora)'
           || '(\s+(a\s+)?(las?\s+)?\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)?)?\s*$') then false
    -- una palabra hueca, sin nada que hacer
    when (select s from t) ~ '^(listo|todo|eso|esto|ya|bien|ok|nada|algo|cosa|cosas|si|no)\s*$' then false
    when array_length(regexp_split_to_array((select s from t), '\s+'), 1) < 2 then false
    else true end;
$fn$;

do $do$
declare v_def text; v_a text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='bot_create_team_actions';

  v_a := '    if nullif(v_txt,'''') is null then continue; end if;';
  if position(v_a in v_def) = 0 then
    raise exception 'No encontré el filtro de título vacío — no toco nada.';
  end if;
  v_def := replace(v_def, v_a, v_a || chr(10)
    || '    -- mig 213: un pedazo que es sólo tiempo («mañana») no es una actividad.' || chr(10)
    || '    if not public._es_accion_de_verdad(v_txt) then continue; end if;');

  -- viñeta «·» (el Copilot ya la sangra) + hora en la misma línea
  v_def := replace(v_def,
       '    v_out := v_out || ''   '' || v_i || ''. '' || (v_p->>''texto'')'
    || chr(10) || '      || case' || chr(10)
    || '           when v_p->>''due'' is null then ''  ·  sin fecha''' || chr(10)
    || '           else ''  ·  '' || fn_fmt_cuando_legible((v_p->>''due'')::timestamptz, v_tz)' || chr(10)
    || '         end' || chr(10)
    || '      || E''\n'';',
       '    v_out := v_out || ''· '' || (v_p->>''texto'')' || chr(10)
    || '      || case when v_p->>''due'' is null then '' — sin fecha''' || chr(10)
    || '           else '' — '' || fn_fmt_cuando_legible((v_p->>''due'')::timestamptz, v_tz) end' || chr(10)
    || '      || E''\n'';');

  v_def := replace(v_def,
    '''text'', case when v_n = 1 then ''Entendí una acción:'' else ''Entendí '' || v_n || '' acciones:'' end || E''\n\n'' || v_out',
    '''text'', case when v_n = 1 then ''1 actividad'' else v_n || '' actividades'' end || E''\n\n'' || v_out');
  v_def := replace(v_def,
    'E''\nMe faltó la fecha de: «''||array_to_string(v_faltan,''», «'')||''». Decime cuándo y las completo.''',
    'E''\nFalta la fecha de: ''||array_to_string(v_faltan,'' / '')||''. Decime cuándo.''');
  v_def := replace(v_def, 'E''\nAsí quedarían en la agenda de cada quien. ¿Confirmas?''', 'E''\n¿Confirmo?''');
  v_def := replace(v_def,
    '''text'', case when v_n = 1 then ''Listo, quedó registrada:'' else ''Listo, registré ''||v_n||'' acciones:'' end',
    '''text'', case when v_n = 1 then ''Registrada'' else ''Registradas ''||v_n||'' actividades'' end');

  execute v_def;
end
$do$;

-- El caso dorado estaba anclado al texto que Iván pidió cambiar.
update public.qa_golden_cases
   set esperado_ilike = '2 actividades'
 where id = 44 and coalesce(superficie,'ventas') = 'ventas';
