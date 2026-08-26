-- 034_email_marketing.sql
-- ============================================================================
-- MOTOR DE EMAIL MARKETING — multi-cliente, con los eventos de vuelta al CRM.
--
-- PROBLEMA:
--   No existe nada de correo en el sistema: ni proveedor, ni tablas, ni
--   registro. Duke necesita invitar a su base al webinar del 2 de septiembre
--   y hoy no hay por dónde.
--
-- SOLUCIÓN:
--   La lista NO se va a una plataforma externa. Vive aquí, junto a los leads,
--   y cada evento del proveedor (entregado, abierto, clic, rebote, queja)
--   regresa a `comunicaciones` y `lead_events`, que ya aceptan tipo 'email'.
--   El asesor abre el lead y ve que abrió la invitación dos veces sin
--   registrarse.
--
--   Tres tablas:
--     · email_campaigns    — un correo de la secuencia
--     · email_recipients   — un destinatario, con su estado y su token de baja
--     · email_suppressions — quién NO vuelve a recibir nunca. La más importante.
--
-- AISLAMIENTO:
--   Todo filtrado por organization_id con el mismo idiom del resto del CRM
--   (current_organization_id() / is_admin_or_above()). Grupo 28, TGenius y
--   Vega heredan el motor sin tocar código.
--
-- SUPERFICIE ANÓNIMA: cero. Ni anon ni authenticated pueden escribir. El
--   endpoint público de baja corre en una edge function con service_role y
--   está acotado por token de un solo uso.
--
-- IDEMPOTENTE: se puede re-ejecutar; deja el mismo estado final.
-- ============================================================================

-- (1) 'email' como canal válido de campaña -----------------------------------
--     El CHECK actual no lo contempla y bloquea el alta de la campaña.

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'campaigns_channel_check') then
    alter table public.campaigns drop constraint campaigns_channel_check;
  end if;

  alter table public.campaigns add constraint campaigns_channel_check
    check (channel is null or channel = any (array[
      'facebook','instagram','google','linkedin','tiktok','referral','event',
      'organic','manual','telegram','whatsapp','web','email','other'
    ]));
end $$;


-- (2) email_campaigns --------------------------------------------------------

create table if not exists public.email_campaigns (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  slug              text not null,
  nombre            text not null,
  asunto            text not null,
  asunto_b          text,
  preheader         text,
  from_name         text not null default 'Duke del Caribe',
  from_email        text not null,
  reply_to          text,
  plantilla         text not null,
  cuerpo_html       text,
  cuerpo_texto      text,
  estado            text not null default 'borrador',
  programado_para   timestamptz,
  segmentos         text[] not null default array['A','B','C'],
  metadata          jsonb  not null default '{}'::jsonb,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_campaigns_slug_uq') then
    alter table public.email_campaigns
      add constraint email_campaigns_slug_uq unique (organization_id, slug);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'email_campaigns_estado_chk') then
    alter table public.email_campaigns add constraint email_campaigns_estado_chk
      check (estado in ('borrador','listo','enviando','enviado','pausado','cancelado'));
  end if;
end $$;

comment on table  public.email_campaigns is
  'Un correo de una secuencia de email marketing. El slug es estable y sirve de llave natural desde los scripts.';
comment on column public.email_campaigns.plantilla is
  'Nombre del archivo en src/emails/ sin extensión. Ej: webinar-01-invitacion';
comment on column public.email_campaigns.segmentos is
  'Segmentos del pipeline que reciben este correo: A calientes, B tibios, C fríos.';
comment on column public.email_campaigns.cuerpo_html is
  'HTML final ya renderizado desde src/emails/. El motor solo sustituye {{nombre}} y {{unsub_url}} por destinatario, así que la edge function no necesita el repo.';
comment on column public.email_campaigns.asunto_b is
  'Asunto alterno para prueba A/B. El motor reparte mitad y mitad y `reporte` compara aperturas. Sin él, todos reciben el asunto A.';
comment on column public.email_campaigns.cuerpo_texto is
  'Alternativa en texto plano. Sin ella el correo pierde puntos de entregabilidad.';


-- (3) email_recipients -------------------------------------------------------

create table if not exists public.email_recipients (
  id                   uuid primary key default gen_random_uuid(),
  campaign_id          uuid not null references public.email_campaigns(id) on delete cascade,
  organization_id      uuid not null,
  lead_id              uuid references public.leads(id) on delete set null,
  email                text not null,
  nombre               text,
  segmento             text,
  variante             text not null default 'a',
  estado               text not null default 'pendiente',
  provider_message_id  text,
  unsub_token          text not null default encode(sha256((gen_random_uuid()::text || clock_timestamp()::text)::bytea), 'hex'),
  sent_at              timestamptz,
  delivered_at         timestamptz,
  opened_at            timestamptz,
  clicked_at           timestamptz,
  bounced_at           timestamptz,
  complained_at        timestamptz,
  aperturas            int  not null default 0,
  clics                int  not null default 0,
  error                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_recipients_estado_chk') then
    alter table public.email_recipients add constraint email_recipients_estado_chk
      check (estado in ('pendiente','enviado','entregado','rebote','queja','error','omitido'));
  end if;
end $$;

-- IDEMPOTENCIA DE ENVÍO: si el script se corre dos veces, nadie recibe el
-- correo repetido. Con una base que ya conoce a Duke, un duplicado es una
-- queja de spam casi asegurada.
create unique index if not exists email_recipients_campaign_email_uq
  on public.email_recipients (campaign_id, lower(email));

create unique index if not exists email_recipients_unsub_token_uq
  on public.email_recipients (unsub_token);

create index if not exists email_recipients_pendientes_ix
  on public.email_recipients (campaign_id, estado) where estado = 'pendiente';

create index if not exists email_recipients_msgid_ix
  on public.email_recipients (provider_message_id) where provider_message_id is not null;

create index if not exists email_recipients_lead_ix
  on public.email_recipients (lead_id);

comment on column public.email_recipients.variante is
  'a | b — qué asunto le tocó en la prueba A/B.';
comment on column public.email_recipients.unsub_token is
  'Token del enlace de baja en un clic (RFC 8058). Único, no adivinable, sin exponer el id del lead.';


-- (4) email_suppressions -----------------------------------------------------
--     Un correo que rebotó duro o que se quejó JAMÁS se vuelve a contactar.
--     Esta tabla es lo que sostiene la reputación del dominio a un año vista.

create table if not exists public.email_suppressions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  email            text not null,
  motivo           text not null,
  detalle          text,
  campaign_id      uuid references public.email_campaigns(id) on delete set null,
  created_at       timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_suppressions_motivo_chk') then
    alter table public.email_suppressions add constraint email_suppressions_motivo_chk
      check (motivo in ('rebote_duro','queja','baja','manual','invalido'));
  end if;
end $$;

create unique index if not exists email_suppressions_org_email_uq
  on public.email_suppressions (organization_id, lower(email));

comment on table public.email_suppressions is
  'Lista de exclusión permanente. El motor la consulta antes de CADA envío, sin excepción.';


-- (5) updated_at automático --------------------------------------------------

create or replace function public.fn_email_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_email_campaigns_touch on public.email_campaigns;
create trigger trg_email_campaigns_touch before update on public.email_campaigns
  for each row execute function public.fn_email_touch_updated_at();

drop trigger if exists trg_email_recipients_touch on public.email_recipients;
create trigger trg_email_recipients_touch before update on public.email_recipients
  for each row execute function public.fn_email_touch_updated_at();


-- (6) RLS --------------------------------------------------------------------

alter table public.email_campaigns    enable row level security;
alter table public.email_recipients   enable row level security;
alter table public.email_suppressions enable row level security;

drop policy if exists email_campaigns_select on public.email_campaigns;
create policy email_campaigns_select on public.email_campaigns
  for select using (organization_id = current_organization_id());

drop policy if exists email_campaigns_write_admin on public.email_campaigns;
create policy email_campaigns_write_admin on public.email_campaigns
  for all using (organization_id = current_organization_id() and is_admin_or_above())
  with check (organization_id = current_organization_id() and is_admin_or_above());

drop policy if exists email_recipients_select on public.email_recipients;
create policy email_recipients_select on public.email_recipients
  for select using (organization_id = current_organization_id());

drop policy if exists email_suppressions_select on public.email_suppressions;
create policy email_suppressions_select on public.email_suppressions
  for select using (organization_id = current_organization_id());

drop policy if exists email_suppressions_write_admin on public.email_suppressions;
create policy email_suppressions_write_admin on public.email_suppressions
  for all using (organization_id = current_organization_id() and is_admin_or_above())
  with check (organization_id = current_organization_id() and is_admin_or_above());

-- La escritura de email_recipients es exclusiva del motor (service_role):
-- nadie desde el navegador marca un correo como entregado.


-- (7) Cerrar la puerta al anon key -------------------------------------------
--     En Supabase `revoke from public` no basta: toda tabla nace legible por
--     la llave anon pública, que va en el bundle del frontend.

revoke all on public.email_campaigns    from anon;
revoke all on public.email_recipients   from anon, authenticated;
revoke all on public.email_suppressions from anon;

grant select on public.email_campaigns    to authenticated;
grant select on public.email_suppressions to authenticated;


-- (8) fn_email_audiencia — quién es elegible ---------------------------------
--     Un solo lugar decide a quién se le puede escribir. Los scripts, la UI y
--     cualquier automatización futura preguntan aquí y no reimplementan reglas.

create or replace function public.fn_email_audiencia(
  p_org        uuid,
  p_segmentos  text[] default array['A','B','C']
)
returns table (lead_id uuid, email text, nombre text, segmento text, stage text, asesor_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with elegibles as (
    select
      l.id,
      lower(trim(l.email)) as em,
      l.name,
      l.stage,
      l.asesor_name,
      l.created_at,
      case
        when l.stage in ('Nuevo Registro','Zoom Concretado','Zoom Agendado','Apartó','Visita Agendada') then 'A'
        when l.stage in ('Reactivar Zoom','Contáctame Ya','Seguimiento','Pensando el presupuesto','Sin contactar') then 'B'
        else 'C'
      end as seg
    from public.leads l
    where l.organization_id = p_org
      and l.deleted_at is null
      and coalesce(l.do_not_contact, false) = false
      and coalesce(l.opt_out, false)        = false
      -- sintaxis mínima; la validación de MX vive en scripts/email_validate.mjs
      and l.email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'
  ),
  -- Un correo puede estar en varios leads: gana el más reciente.
  deduplicados as (
    select distinct on (em) id, em, name, stage, asesor_name, seg
    from elegibles
    order by em, created_at desc
  )
  select d.id, d.em, d.name, d.seg, d.stage, d.asesor_name
  from deduplicados d
  where d.seg = any (p_segmentos)
    and not exists (
      select 1 from public.email_suppressions s
      where s.organization_id = p_org and lower(s.email) = d.em
    );
$$;

comment on function public.fn_email_audiencia(uuid, text[]) is
  'Audiencia elegible de correo para una organización. Aplica borrados, do_not_contact, opt_out, sintaxis, deduplicado y lista de exclusión. Fuente única de verdad de a quién se le puede escribir.';

revoke all on function public.fn_email_audiencia(uuid, text[]) from public, anon, authenticated;
-- El `revoke ... from public` de arriba se lleva también a service_role, que
-- heredaba el EXECUTE por default. El motor lo necesita: se le regresa explícito.
grant execute on function public.fn_email_audiencia(uuid, text[]) to service_role;
