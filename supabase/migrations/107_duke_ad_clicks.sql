-- 107_duke_ad_clicks.sql
-- Clics al WhatsApp desde las landings de anuncios de Duke.
-- La landing de marca no pide datos, así que el clic es la única atribución
-- disponible hasta que el prospecto escribe. Se guarda aparte de `leads` para
-- no ensuciar el pipeline con registros sin teléfono.
CREATE TABLE IF NOT EXISTS public.duke_ad_clicks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL,
  advisor_key        text,
  advisor_name       text,
  advisor_phone_e164 text,
  project            text,
  campaign           text,
  landing_path       text,
  page_url           text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  fbclid             text,
  referrer           text,
  user_agent         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_duke_ad_clicks_created
  ON public.duke_ad_clicks (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duke_ad_clicks_project
  ON public.duke_ad_clicks (organization_id, project, created_at DESC);

ALTER TABLE public.duke_ad_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS duke_ad_clicks_read ON public.duke_ad_clicks;
CREATE POLICY duke_ad_clicks_read ON public.duke_ad_clicks
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

REVOKE ALL ON public.duke_ad_clicks FROM anon;
GRANT SELECT ON public.duke_ad_clicks TO authenticated;
