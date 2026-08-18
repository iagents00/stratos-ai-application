-- 108 — Capturar a TODOS los que llegan a la landing, no solo a los que dan clic.
--
-- Hasta ahora `duke_ad_clicks` guardaba únicamente el clic al botón de
-- WhatsApp. En Mondrian eso dejó fuera a 2 de cada 3 personas: 33 visitas
-- contra 9 clics. De las 24 restantes no sabíamos nada, ni siquiera que
-- habían existido.
--
-- Dos cambios:
--   1. `event` distingue la visita del clic, y la tabla pasa a ser el registro
--      de todo lo que ocurre en la landing.
--   2. `pair_code` es un código corto que viaja dentro del mensaje de
--      WhatsApp. Cuando el prospecto escribe, ese código dice de qué anuncio
--      vino — que es lo único que la conversación no trae consigo.
--
-- Idempotente: se puede correr dos veces.

alter table public.duke_ad_clicks
  add column if not exists event     text not null default 'whatsapp_click',
  add column if not exists pair_code text,
  add column if not exists lead_id   uuid references public.leads(id) on delete set null;

comment on column public.duke_ad_clicks.event is
  'landing_view = llegó a la landing · whatsapp_click = se fue a WhatsApp';
comment on column public.duke_ad_clicks.pair_code is
  'Código corto incrustado en el mensaje de WhatsApp para amarrar la conversación con el anuncio';
comment on column public.duke_ad_clicks.lead_id is
  'Lead creado en el CRM a partir del clic, si se pudo resolver el asesor';

-- El código se busca al llegar el WhatsApp: tiene que ser instantáneo.
create unique index if not exists duke_ad_clicks_pair_code_idx
  on public.duke_ad_clicks (pair_code) where pair_code is not null;

create index if not exists duke_ad_clicks_event_fecha_idx
  on public.duke_ad_clicks (event, created_at desc);

create index if not exists duke_ad_clicks_asesor_fecha_idx
  on public.duke_ad_clicks (advisor_key, created_at desc);

-- Las filas que ya existían son todas clics (es lo único que se registraba).
update public.duke_ad_clicks set event = 'whatsapp_click' where event is null;
