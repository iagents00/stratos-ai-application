-- Salió probando la ruta nueva con la frase de Iván: le pasé «mañana antes de
-- las 3 de la tarde» y el plan lo puso HOY a las 3. La hora bien, el día no.
--
-- Es el «me lo puso hoy en vez de mañana» de sus capturas.
--
-- CAUSA: en `parse_relative_or_abs_es`, el bloque que lee «<día> a las <hora>
-- de la <tarde/noche>» exige que después del día venga, como mucho, un «a las»:
--
--     (hoy|mañana|lunes|...)?\s*(?:a\s+las?\s+)?(\d{1,2})...
--
-- Con «mañana ANTES DE las 3 de la tarde» ese «antes de» no encaja, así que el
-- grupo del día queda VACÍO y el patrón engancha más adelante, en «las 3 de la
-- tarde» — sin día ⇒ hoy.
--
-- Y «antes de las tres» / «a más tardar a las tres» es exactamente como habla un
-- jefe cuando pone un límite. Es la forma natural del pedido, no un caso raro.
--
-- ⇒ El día ahora tolera entre medio: «antes de», «a más tardar», «más tardar»,
--   «hasta», «para» (con y sin tilde), y el «las» suelto.
--
-- PROBADO 9/9: las 4 formas nuevas caen en el día correcto («mañana antes de las
-- 3 de la tarde» → mañana 15:00; «mañana antes de las 8 de la noche» → mañana
-- 20:00; «el lunes antes de las 3 de la tarde» → lunes 15:00) y las 4 que ya
-- andaban no se mueven («mañana a las 3 de la tarde», «mañana a las 10», «hoy a
-- las 3 de la tarde», «mañana 3pm»). Golden de ventas 35/35.
--
-- REVERTIR: volver el fragmento a `(?:a\s+las?\s+)?`. Sin DDL, sin tocar datos.

do $do$
declare v_def text; v_a text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='parse_relative_or_abs_es';

  v_a := '(hoy|pasado\s+ma[ñn]ana|ma[ñn]ana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)?\s*(?:a\s+las?\s+)?';
  if position(v_a in v_def) = 0 then
    raise exception 'No encontré el patrón del día — no toco nada.';
  end if;

  execute replace(v_def, v_a,
    '(hoy|pasado\s+ma[ñn]ana|ma[ñn]ana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)?\s*'
 || '(?:(?:antes\s+de|a\s+m[aá]s\s+tardar|m[aá]s\s+tardar|hasta|para)\s+)?(?:a\s+)?(?:las?\s+)?');
end
$do$;
