-- Probando NSG con frases de Iván y Ángel:
--
--   «necesito que Ángel deje el APK nuevo mañana temprano»
--       → tarea «Deje el APK nuevo»
--
-- Debería decir «Dejar el APK nuevo». La regla de paridad con marketing
-- (mig 196) es que el título se guarda en INFINITIVO: en la agenda del otro, el
-- subjuntivo del jefe se lee como una orden suelta.
--
-- La conversión la hace `fn_titulo_limpio` con una lista escrita a mano de ~60
-- verbos. «dejar» no estaba. Tampoco arreglar, probar, configurar, cobrar,
-- aprobar, compartir, crear… — casi todo el vocabulario con el que Ángel habla
-- de su trabajo (deployar, arreglar, probar, configurar) y con el que Iván habla
-- del suyo (cobrar, facturar, firmar, aprobar, negociar).
--
-- ⚠️ NO lo resolví por regla morfológica, aunque se podía: en español el
-- subjuntivo de los verbos en -ar termina en «-e», así que «deje → dejar» sale
-- solo. El problema es que **muchos sustantivos también terminan en -e**, y esta
-- función convierte la PRIMERA palabra del título: «Informe mensual» se
-- volvería «Informar mensual», y «Reporte de cierres» → «Reportar de cierres».
-- Una lista explícita es más tonta pero no inventa verbos donde hay sustantivos.
-- Es la contracara de la lección de la mig 200: ahí la estructura era más segura
-- que el vocabulario; acá es al revés, y conviene decirlo en vez de aplicar la
-- misma receta por costumbre.
--
-- Se agregan 31 verbos (singular y plural).
--
-- PROBADO 17/17: los 10 nuevos salen en infinitivo · los 5 que ya andaban
-- (haga/arme/revise/mande/llame) intactos · y lo que NO es verbo sigue sin
-- tocarse («Reunión con Ken», «Brochure de NSG»).
--
-- REVERTIR: quitar las filas agregadas de `v_map`. Sin DDL, sin tocar datos.

do $do$
declare v_def text; v_anchor text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='fn_titulo_limpio';

  v_anchor := '    [''den'',''Dar''],[''vayan'',''Ir''],[''vaya'',''Ir'']';
  if position(v_anchor in v_def) = 0 then
    raise exception 'No encontré el final del mapa de verbos — no toco nada.';
  end if;

  execute replace(v_def, v_anchor,
      '    [''dejen'',''Dejar''],[''deje'',''Dejar''],' || chr(10)
   || '    [''bajen'',''Bajar''],[''baje'',''Bajar''],' || chr(10)
   || '    [''arreglen'',''Arreglar''],[''arregle'',''Arreglar''],' || chr(10)
   || '    [''ajusten'',''Ajustar''],[''ajuste'',''Ajustar''],' || chr(10)
   || '    [''prueben'',''Probar''],[''pruebe'',''Probar''],' || chr(10)
   || '    [''documenten'',''Documentar''],[''documente'',''Documentar''],' || chr(10)
   || '    [''editen'',''Editar''],[''edite'',''Editar''],' || chr(10)
   || '    [''diseñen'',''Diseñar''],[''diseñe'',''Diseñar''],' || chr(10)
   || '    [''facturen'',''Facturar''],[''facture'',''Facturar''],' || chr(10)
   || '    [''cobren'',''Cobrar''],[''cobre'',''Cobrar''],' || chr(10)
   || '    [''paguen'',''Pagar''],[''pague'',''Pagar''],' || chr(10)
   || '    [''compartan'',''Compartir''],[''comparta'',''Compartir''],' || chr(10)
   || '    [''exporten'',''Exportar''],[''exporte'',''Exportar''],' || chr(10)
   || '    [''migren'',''Migrar''],[''migre'',''Migrar''],' || chr(10)
   || '    [''conecten'',''Conectar''],[''conecte'',''Conectar''],' || chr(10)
   || '    [''integren'',''Integrar''],[''integre'',''Integrar''],' || chr(10)
   || '    [''configuren'',''Configurar''],[''configure'',''Configurar''],' || chr(10)
   || '    [''instalen'',''Instalar''],[''instale'',''Instalar''],' || chr(10)
   || '    [''limpien'',''Limpiar''],[''limpie'',''Limpiar''],' || chr(10)
   || '    [''ordenen'',''Ordenar''],[''ordene'',''Ordenar''],' || chr(10)
   || '    [''planeen'',''Planear''],[''planee'',''Planear''],' || chr(10)
   || '    [''definan'',''Definir''],[''defina'',''Definir''],' || chr(10)
   || '    [''aprueben'',''Aprobar''],[''apruebe'',''Aprobar''],' || chr(10)
   || '    [''firmen'',''Firmar''],[''firme'',''Firmar''],' || chr(10)
   || '    [''abran'',''Abrir''],[''abra'',''Abrir''],' || chr(10)
   || '    [''creen'',''Crear''],[''cree'',''Crear''],' || chr(10)
   || '    [''generen'',''Generar''],[''genere'',''Generar''],' || chr(10)
   || '    [''calculen'',''Calcular''],[''calcule'',''Calcular''],' || chr(10)
   || '    [''analicen'',''Analizar''],[''analice'',''Analizar''],' || chr(10)
   || '    [''resuman'',''Resumir''],[''resuma'',''Resumir''],' || chr(10)
   || '    [''mejoren'',''Mejorar''],[''mejore'',''Mejorar''],' || chr(10)
   || '    [''desplieguen'',''Desplegar''],[''despliegue'',''Desplegar''],' || chr(10)
   || '    [''corrijan'',''Corregir''],[''corrija'',''Corregir''],' || chr(10)
   || v_anchor);
end
$do$;
