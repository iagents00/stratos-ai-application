-- ─────────────────────────────────────────────────────────────────────────────
-- 173 · Marketing de Duke: alta de la marca «Legacy Design»
-- ─────────────────────────────────────────────────────────────────────────────
-- Pedido de Iván (27-jul-2026): que Legacy Design aparezca como marca en el
-- módulo Marketing, junto a Duke del Caribe, Mueblería, Brasa y Piedra, NK23,
-- Casa Ágata y NSG. Legacy Design ya estaba en el plan de replicación al
-- corporativo; hasta ahora no tenía su tarjeta en Marcas.
--
-- APLICADA EN PRODUCCIÓN (stratos-prod, glulgyhkrqpykxmujodb) vía MCP el
-- 27-jul-2026. Este archivo la deja versionada en Git.
--
-- ⚠️ SOLO MARKETING. No toca nada del CRM de ventas de Duke (leads, brokers,
--    bot_nlu_dispatch_gvintell): otra tabla, otro módulo, otro flujo n8n.
--
-- El color de la marca en la UI va por SLUG en BRAND_HEX (Marketing.jsx):
--   "legacy-design": { d: "#A3E635", l: "#65A30D" }
-- El slug NO se cambia aunque cambie el nombre visible.
--
-- El Copilot de marketing la reconoce solo: _mkt_find_brand() resuelve contra
-- esta misma tabla (probado: «Legacy Design», «legacy design» y «legacy» matchean).
--
-- REVERTIR (nada se borra):
--   update public.mkt_brands set activo = false
--   where organization_id = '00000000-0000-0000-0000-000000000001'
--     and slug = 'legacy-design';
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.mkt_brands (organization_id, nombre, slug, activo, orden)
values ('00000000-0000-0000-0000-000000000001', 'Legacy Design', 'legacy-design', true, 7)
on conflict (organization_id, slug) do update
  set nombre = excluded.nombre,
      activo = true,
      orden  = excluded.orden;
