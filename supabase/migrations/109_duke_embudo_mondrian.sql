-- 109 — El embudo de Mondrian, consultable sin tener que armar el query.
--
-- `duke_ad_clicks` guarda visitas y clics, pero nadie los ve: no hay pantalla
-- en el CRM que los muestre. Cada vez que alguien preguntaba "¿cuántos
-- clientes entraron?" había que escribir el cruce a mano — y la primera vez
-- que se hizo salió mal, porque los 33 de Meta son visitas a la landing, no
-- clientes.
--
-- Esta vista responde esa pregunta de una.
--
--   select * from v_duke_embudo_mondrian;

drop view if exists public.v_duke_embudo_mondrian;

create view public.v_duke_embudo_mondrian as
-- El registro de visitas arrancó después que el de clics (SW v380). Comparar
-- todo el histórico da ratios imposibles — Marco llegaba a 225% de conversión.
-- La ventana honesta empieza en la primera visita registrada.
with inicio as (
  select min(created_at) as desde from duke_ad_clicks where event = 'landing_view'
),
por_asesor as (
  select advisor_name,
         count(*) filter (where event='landing_view')                             as visitas,
         count(*) filter (where event='whatsapp_click')                           as clics_totales,
         count(*) filter (where event='whatsapp_click' and created_at >= i.desde) as clics_comparables,
         count(*) filter (where event='whatsapp_click' and lead_id is not null)   as clics_con_lead
  from duke_ad_clicks, inicio i
  group by advisor_name, i.desde
),
leads_crm as (
  select asesor_name as advisor_name, count(*) as leads
  from leads where project ilike '%mondrian%' and deleted_at is null
  group by 1
)
select
  coalesce(a.advisor_name, l.advisor_name)                        as asesor,
  a.visitas                                                       as llegaron_a_la_landing,
  a.clics_comparables                                             as pasaron_a_whatsapp,
  case when a.visitas > 0
       then round(100.0 * a.clics_comparables / a.visitas, 1) end as pct_conversion,
  a.clics_totales                                                 as clics_historicos,
  a.clics_con_lead                                                as clics_que_crearon_lead,
  coalesce(l.leads, 0)                                            as leads_en_el_crm
from por_asesor a
full outer join leads_crm l on l.advisor_name = a.advisor_name
order by a.visitas desc nulls last;

comment on view public.v_duke_embudo_mondrian is
  'Embudo de Mondrian por asesor. pct_conversion solo cuenta clics desde que se mide la visita (SW v380); clics_historicos incluye los de antes.';
