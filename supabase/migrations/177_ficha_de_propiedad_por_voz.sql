-- 177 — La ficha de la propiedad, también hablando
--
-- Termina de reemplazar al Sheet: el registro ya no depende de que alguien abra
-- el CRM. Se llena y se consulta desde el Copilot, igual que la bitácora.
--   pipeline_set   → "los crudos de Casa Lago están en <enlace>"
--   pipeline_ficha → "¿cómo va Casa Lago?" (etapa, precio, tipo, fechas, enlaces)
--
-- Resuelve la propiedad por coincidencia parcial del nombre, igual que
-- fn_mkt_move_pipeline. Si hay varias, PREGUNTA en vez de adivinar: escribir en
-- la propiedad equivocada es peor que pedir que la aclaren.
--
-- ⚠️ Esta versión tiene un bug que arregla la migración 178 (los nombres de
-- salida del RETURNS TABLE chocaban con las columnas de la tabla). Se deja tal
-- cual se aplicó, para que el historial no mienta.

create or replace function public._mkt_pick_pipeline(p_org uuid, p_nombre text)
returns table (id uuid, nombre text, varias text)
language plpgsql
stable
as $$
declare v_n int; v_opts text;
begin
  select count(*) into v_n from mkt_pipeline_items
  where organization_id=p_org and deleted_at is null and nombre ilike '%'||p_nombre||'%';
  if v_n = 0 then
    return query select null::uuid, null::text, 'NINGUNA'::text; return;
  end if;
  if v_n > 1 then
    select string_agg(s.nombre, ' · ') into v_opts from (
      select mp.nombre from mkt_pipeline_items mp
      where mp.organization_id=p_org and mp.deleted_at is null and mp.nombre ilike '%'||p_nombre||'%' limit 4) s;
    return query select null::uuid, null::text, v_opts; return;
  end if;
  return query
    select mp.id, mp.nombre, null::text from mkt_pipeline_items mp
    where mp.organization_id=p_org and mp.deleted_at is null and mp.nombre ilike '%'||p_nombre||'%' limit 1;
end $$;

-- fn_mkt_pipeline_set y fn_mkt_pipeline_ficha se crearon acá y quedaron en su
-- forma final en la migración 178 — ver ese archivo para el cuerpo vigente.
