-- A request for a saved report is different from assigning someone to report.
create or replace function public._bot_is_space_document_request(p_norm text) returns boolean
language sql immutable set search_path=public,pg_temp as $f$
 select coalesce(public.unaccent(lower(p_norm)) ~
   '(mi[[:space:]]*espa|mi[[:space:]]+space|docu[a-z]*|archivos?|contratos?|informes?|reportes?|presentacion|manual|notion|figma|hoja de calculo|planilla|spreadsheet|excel|\ysop\y|\yenlaces?\y|\ylinks?\y)'
 and public.unaccent(lower(p_norm)) ~
   '^[[:space:]¿?¡!]*(por favor[[:space:]]+)?((pasame|pasa|dame|mandame|manda|enviame|envia|muestrame|muestra|mostrame|mostra|comparteme|comparte|buscame|busca|buscar|encuentra|quiero|abre|abrir|abrime|abri|donde|tenes|tienes|que|cual|cuales|lista|mis|los|documento|documentos|archivo|archivos|informe|reporte|contrato|manual|mi)\y|necesito[[:space:]]+(el|la|un|una|ver|abrir|consultar)\y)'
 and public.unaccent(lower(p_norm)) !~
   '^[[:space:]]*(no[[:space:]]+|recuerda[a-z]*|recorda[a-z]*|agend[a-z]*|crea[a-z]*|genera[a-z]*|agrega[a-z]*|guarda[a-z]*|sube|elimina[a-z]*|borra[a-z]*|mueve|cambia[a-z]*|anota[a-z]*|asigna[a-z]*|encarga[a-z]*|pide[a-z]*|dile)\y',false)
$f$;
revoke all on function public._bot_is_space_document_request(text) from public,anon,authenticated;
grant execute on function public._bot_is_space_document_request(text) to service_role;
