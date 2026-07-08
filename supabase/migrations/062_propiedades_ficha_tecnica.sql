-- ═══════════════════════════════════════════════════════════════════════════
-- 062 · Ficha técnica de propiedades + sync desde el Google Sheet
-- ─────────────────────────────────────────────────────────────────────────────
-- Extiende `properties` (060) con los campos de la ficha técnica que el equipo
-- mantiene en la pestaña "Top Desarrollos" del Sheet DRIVES DUKE DEL CARIBE:
-- ticket (precio), entrega, financiamiento, tipología, masterbroker, etc.
-- Los asesores presentan estas fichas a clientes desde el Marketing Studio.
--
-- fn_properties_sheet_sync(org, rows) es el ÚNICO punto de escritura del sync:
-- lo llama el seed 063 y el workflow de n8n "Propiedades · Sync Sheet" (cron)
-- con el CSV vivo del Sheet, para que precios/entrega/disponibilidad estén
-- siempre actualizados. Upsert por (org, nombre normalizado).
--   · Campos que el Sheet manda SIEMPRE (se sobreescriben, incluso a vacío):
--     ticket, clasificacion, entrega, financiamiento, como_se_entrega,
--     tipologia, mantenimiento, masterbroker, contacto.
--   · Campos que el Sheet solo mejora (coalesce, no pisa curado del CRM):
--     plaza, zona, drive_url, maps_url, highlights, price_tier.
--   · Campos que NUNCA toca: is_top, tags, recommended_by, notes, cover_url,
--     active, deleted_at (si el equipo archivó algo en el CRM, se respeta).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.properties
  add column if not exists ticket           text,   -- precio tal cual el Sheet ("581,241 USD", "3.2 A 6.4 MDP")
  add column if not exists clasificacion    text,
  add column if not exists entrega          text,   -- "INMEDIATA", "REVENTA", "diciembre 2027"…
  add column if not exists financiamiento   text,   -- "SI" / "NO" / condiciones
  add column if not exists como_se_entrega  text,   -- "Equipado", "Llave en mano"…
  add column if not exists tipologia        text,   -- "1, 2 y 3 BD"
  add column if not exists mantenimiento    text,
  add column if not exists masterbroker     text,   -- DATO INTERNO: no se muestra al cliente
  add column if not exists contacto         text,   -- DATO INTERNO
  add column if not exists zona             text,
  add column if not exists maps_url         text,
  add column if not exists cover_url        text,   -- imagen de portada opcional (editable en CRM)
  add column if not exists source           text;   -- 'sheet' = fila que mantiene el sync

create or replace function public.fn_properties_sheet_sync(p_org uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r       jsonb;
  v_name  text;
  v_id    uuid;
  v_ins   int := 0;
  v_upd   int := 0;
  v_skip  int := 0;
begin
  if p_org is null or p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'fn_properties_sheet_sync: org y arreglo de filas requeridos';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_name := nullif(btrim(r->>'name'), '');
    if v_name is null then
      v_skip := v_skip + 1;
      continue;
    end if;

    select id into v_id from public.properties
     where organization_id = p_org
       and lower(btrim(name)) = lower(v_name)
     limit 1;

    if v_id is null then
      insert into public.properties (
        organization_id, name, plaza, zona, price_tier, ticket, clasificacion,
        entrega, financiamiento, como_se_entrega, tipologia, mantenimiento,
        masterbroker, contacto, drive_url, maps_url, highlights, source
      ) values (
        p_org, v_name,
        coalesce(nullif(btrim(r->>'plaza'), ''), 'Riviera Maya'),
        nullif(btrim(r->>'zona'), ''),
        nullif(btrim(r->>'price_tier'), ''),
        nullif(btrim(r->>'ticket'), ''),
        nullif(btrim(r->>'clasificacion'), ''),
        nullif(btrim(r->>'entrega'), ''),
        nullif(btrim(r->>'financiamiento'), ''),
        nullif(btrim(r->>'como_se_entrega'), ''),
        nullif(btrim(r->>'tipologia'), ''),
        nullif(btrim(r->>'mantenimiento'), ''),
        nullif(btrim(r->>'masterbroker'), ''),
        nullif(btrim(r->>'contacto'), ''),
        nullif(btrim(r->>'drive_url'), ''),
        nullif(btrim(r->>'maps_url'), ''),
        nullif(btrim(r->>'highlights'), ''),
        'sheet'
      );
      v_ins := v_ins + 1;
    else
      update public.properties set
        plaza           = coalesce(nullif(btrim(r->>'plaza'), ''), plaza),
        zona            = coalesce(nullif(btrim(r->>'zona'), ''), zona),
        price_tier      = coalesce(nullif(btrim(r->>'price_tier'), ''), price_tier),
        ticket          = nullif(btrim(r->>'ticket'), ''),
        clasificacion   = nullif(btrim(r->>'clasificacion'), ''),
        entrega         = nullif(btrim(r->>'entrega'), ''),
        financiamiento  = nullif(btrim(r->>'financiamiento'), ''),
        como_se_entrega = nullif(btrim(r->>'como_se_entrega'), ''),
        tipologia       = nullif(btrim(r->>'tipologia'), ''),
        mantenimiento   = nullif(btrim(r->>'mantenimiento'), ''),
        masterbroker    = nullif(btrim(r->>'masterbroker'), ''),
        contacto        = nullif(btrim(r->>'contacto'), ''),
        drive_url       = coalesce(nullif(btrim(r->>'drive_url'), ''), drive_url),
        maps_url        = coalesce(nullif(btrim(r->>'maps_url'), ''), maps_url),
        highlights      = coalesce(nullif(btrim(r->>'highlights'), ''), highlights),
        source          = coalesce(source, 'sheet'),
        updated_at      = now()
      where id = v_id;
      v_upd := v_upd + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_ins, 'updated', v_upd, 'skipped', v_skip);
end $$;

-- Solo el sync de servidor (n8n vía rol postgres / service_role) puede llamarla.
revoke all on function public.fn_properties_sheet_sync(uuid, jsonb) from public;
revoke all on function public.fn_properties_sheet_sync(uuid, jsonb) from anon;
revoke all on function public.fn_properties_sheet_sync(uuid, jsonb) from authenticated;
grant execute on function public.fn_properties_sheet_sync(uuid, jsonb) to service_role;
