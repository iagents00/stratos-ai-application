-- 110 — Un solo WhatsApp puede atender a los tres asesores.
--
-- La captura automática de WhatsApp existe y funciona muy bien: 1,399 de 1,403
-- mensajes se convirtieron en lead (99.7%). El problema es que está atada a UN
-- número de WhatsApp Business — el de Cloud API — y ese no es el de Marco, ni
-- el de Ken, ni el de Oscar. Todo lo que les escriben a ellos es invisible.
--
-- Conectar los tres números a Cloud API tiene un costo que suele ser
-- inaceptable: un número en Cloud API ya no puede usar la app normal de
-- WhatsApp. El asesor pierde su WhatsApp de siempre.
--
-- La salida: mandar a todos al número que YA está conectado, y que el código
-- del mensaje diga de quién era el anuncio. Esta función hace esa traducción.
--
--   select * from fn_asesor_por_codigo_pareo('...texto del whatsapp...');

create or replace function public.fn_asesor_por_codigo_pareo(p_texto text)
returns table (
  pair_code   text,
  asesor_id   uuid,
  asesor_name text,
  project     text,
  campaign    text,
  clic_en     timestamptz
)
language sql stable security definer set search_path = public
as $$
  with codigo as (
    select upper((regexp_match(coalesce(p_texto,''), 'MD-[A-Z0-9]{4}', 'i'))[1]) as c
  )
  select c.pair_code,
         l.asesor_id,
         c.advisor_name,
         c.project,
         c.campaign,
         c.created_at
  from duke_ad_clicks c
  left join leads l on l.id = c.lead_id
  where c.pair_code = (select c from codigo)
  limit 1;
$$;

comment on function public.fn_asesor_por_codigo_pareo(text) is
  'Dado el texto de un WhatsApp entrante, extrae el código MD-XXXX y devuelve de qué anuncio y de qué asesor vino.';
