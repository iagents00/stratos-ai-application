-- La mig 212d le enseñó 31 verbos nuevos al limpiador de títulos
-- (`fn_titulo_limpio`) para que «deje el APK» se guarde como «Dejar el APK».
-- Pero el sistema tiene TRES listas de verbos que deben coincidir, y sólo se
-- había tocado una:
--
--   1. `fn_titulo_limpio`        — cómo se ESCRIBE el título (subjuntivo → infinitivo)
--   2. `_ventas_verbos_encargo`  — el portero: ¿esto es encargarle trabajo a alguien?
--   3. `_ventas_verbos_split`    — dónde se PARTE un dictado de varias acciones
--
-- Con sólo la 1 arreglada quedaba esto:
--
--   «que Ángel migre a Postgres 15 mañana»   → «No terminé de entenderte 🤔»
--   «que Ángel deje el APK nuevo mañana»     → «No terminé de entenderte 🤔»
--   «que Ángel configure el dominio»         → «No terminé de entenderte 🤔»
--
-- El título estaba listo para un verbo que el portero no dejaba pasar. Se
-- sincronizan las tres con los mismos 31 verbos.
--
-- ⚠️ DEUDA QUE DEJO ANOTADA A PROPÓSITO: tres listas que deben decir lo mismo es
-- una trampa — este bug va a volver la próxima vez que alguien agregue un verbo
-- en un solo lado. El arreglo de fondo es UNA sola lista compartida que las tres
-- consuman. No lo hice ahora porque toca tres puntos calientes del dictado el
-- mismo día que ya se tocaron otras cinco cosas, y prefiero que eso vaya solo,
-- con su propia prueba. Queda dicho para que se decida, no escondido.
--
-- ⚠️ LÍMITE CONOCIDO (viejo, no lo introduce esta migración): las listas son de
-- SUBJUNTIVO («revise», «arme»). En presente indicativo —«mañana Ángel revisa el
-- flujo y arma el reporte»— el dictado NO se entiende. Agregar las formas
-- indicativas es tentador pero riesgoso: «manda», «llama», «pasa» son palabras
-- comunes y dispararían dictados falsos. Necesita su propio análisis.
--
-- PROBADO 8/9 (el 9º es el límite indicativo de arriba, que ya fallaba antes):
-- los 5 verbos nuevos ya se entienden · los viejos intactos · el dictado de
-- VARIAS acciones sigue partiendo bien («…mañana Y que prepare… el lunes» → 2
-- acciones) · golden ventas 35/35 → 35/35 · golden marketing 15/17 → 15/17.
--
-- REVERTIR: volver las dos funciones a su lista anterior (quitar el prefijo).

create or replace function public._ventas_verbos_encargo()
returns text language sql immutable set search_path to 'public','pg_temp' as $x$
  select '(deje|dejen|arregle|arreglen|pruebe|prueben|configure|configuren|'
      || 'cobre|cobren|facture|facturen|pague|paguen|apruebe|aprueben|'
      || 'comparta|compartan|cree|creen|genere|generen|migre|migren|'
      || 'despliegue|desplieguen|corrija|corrijan|instale|instalen|'
      || 'integre|integren|conecte|conecten|edite|editen|documente|documenten|'
      || 'ajuste|ajusten|limpie|limpien|ordene|ordenen|planee|planeen|'
      || 'defina|definan|firme|firmen|abra|abran|calcule|calculen|'
      || 'analice|analicen|resuma|resuman|mejore|mejoren|baje|bajen|'
      || 'exporte|exporten|diseñe|diseñen|'
      || 'haga|hagan|llame|llamen|marque|marquen|prepare|preparen|revise|revisen|'
      || 'arme|armen|mande|manden|envie|envien|suba|suban|actualice|actualicen|'
      || 'atienda|atiendan|contacte|contacten|agende|agenden|termine|terminen|'
      || 'entregue|entreguen|cierre|cierren|cotice|coticen|reporte|reporten|'
      || 'confirme|confirmen|pase|pasen|siga|sigan|busque|busquen|visite|visiten|'
      || 'presente|presenten|organice|organicen|complete|completen|valide|validen|'
      || 'hable|hablen|escriba|escriban|arranque|arranquen|empiece|empiecen|'
      || 'programe|programen|cargue|carguen|depure|depuren|recupere|recuperen)';
$x$;

create or replace function public._ventas_verbos_split()
returns text language sql immutable set search_path to 'public','pg_temp' as $x$
  select '(deje|dejen|arregle|arreglen|pruebe|prueben|configure|configuren|'
      || 'cobre|cobren|facture|facturen|pague|paguen|apruebe|aprueben|'
      || 'comparta|compartan|cree|creen|genere|generen|migre|migren|'
      || 'despliegue|desplieguen|corrija|corrijan|instale|instalen|'
      || 'integre|integren|conecte|conecten|edite|editen|documente|documenten|'
      || 'ajuste|ajusten|limpie|limpien|ordene|ordenen|planee|planeen|'
      || 'defina|definan|firme|firmen|abra|abran|calcule|calculen|'
      || 'analice|analicen|resuma|resuman|mejore|mejoren|baje|bajen|'
      || 'exporte|exporten|diseñe|diseñen|'
      || 'haga|hagan|llame|llamen|marque|marquen|prepare|preparen|revise|revisen|'
      || 'arme|armen|mande|manden|envie|envien|suba|suban|actualice|actualicen|'
      || 'atienda|atiendan|contacte|contacten|agende|agenden|termine|terminen|'
      || 'entregue|entreguen|cierre|cierren|cotice|coticen|confirme|confirmen|'
      || 'busque|busquen|visite|visiten|organice|organicen|complete|completen|'
      || 'valide|validen|hable|hablen|escriba|escriban|arranque|arranquen|'
      || 'empiece|empiecen|programe|programen|depure|depuren|recupere|recuperen)';
$x$;
