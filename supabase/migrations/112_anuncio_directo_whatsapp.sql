-- 112 — Anuncios que llevan directo a WhatsApp, sin landing.
--
-- Cambio de modelo: la landing se descarta. El anuncio abre WhatsApp y la
-- conversación nace ahí. Menos fricción, y el dato ya no depende de que la
-- persona dé un segundo clic.
--
-- El problema que eso crea: sin landing no hay código de pareo, así que hay
-- que saber de otra forma de qué anuncio vino la conversación.
--
-- Meta lo resuelve: en el PRIMER mensaje de un Click-to-WhatsApp manda
--
--   messages[0].referral = { source_id: '<ad_id>', source_type: 'ad',
--                            headline, body, ctwa_clid }
--
-- `source_id` es el anuncio. Esta función lo traduce a proyecto, campaña y
-- asesor reusando las reglas que ya existen en
-- meta_ads_lead_routing_overrides — las mismas que sirven para los
-- formularios instantáneos.
--
-- OJO: el parser de n8n hoy lee `metadata.display_phone_number` y
-- `value.messages`, pero NO lee `referral`. Para que la atribución llegue,
-- el nodo "Parsear Meta y asignar asesor" tiene que pasar
-- messages[].referral.source_id a esta función.

create or replace function public.fn_ruteo_anuncio_whatsapp(p_source_id text)
returns table (project text, campaign text, tag text, pool_key text, asesor_name text, asesor_id uuid)
language sql stable security definer set search_path = public
as $$
  select o.project, o.campaign, o.tag, o.pool_key, m.asesor_name, m.asesor_id
  from meta_ads_lead_routing_overrides o
  left join lead_assignment_pools p
    on p.organization_id = o.organization_id and p.pool_key = o.pool_key
  left join lead_assignment_pool_members m
    on m.pool_id = p.id and m.active
  where o.organization_id = '00000000-0000-0000-0000-000000000001'
    and o.active
    and o.match_value = p_source_id
    and o.match_type in ('ad_id','adset_id','campaign_id')
  order by o.priority, m.sort_order
  limit 1;
$$;

comment on function public.fn_ruteo_anuncio_whatsapp(text) is
  'Dado el referral.source_id de un anuncio Click-to-WhatsApp, devuelve proyecto, campaña y asesor. Sustituye al código de pareo cuando no hay landing.';

-- Las campañas se renombraron a "IA - <ASESOR>"; las reglas se alinean para
-- que el CRM etiquete con el nombre real.
