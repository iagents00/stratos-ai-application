-- 111 — Cada número de WhatsApp cae con su asesor.
--
-- Objetivo: que TODO cliente que le escriba a Óscar, Ken o Marco aparezca en
-- Stratos — venga de campaña o sea un mensaje directo. Como ya pasa con Gael.
--
-- Por qué no pasaba: la función que crea el lead desde WhatsApp tenía el
-- asesor escrito a fuego.
--
--     asesor_name = 'iAgents'
--
-- Recibía el inbox_id y lo guardaba solo como metadato. Daba igual de qué
-- número viniera el mensaje: todos terminaban en el mismo lugar. Conectar el
-- número de Óscar no habría servido de nada — el lead habría llegado, pero no
-- a su cuenta.
--
-- Se enruta por NÚMERO, no por inbox, a propósito: los asesores van a seguir
-- usando WhatsApp desde su celular, y el puente que espeje esos mensajes
-- puede identificar el canal de varias formas (inbox, instancia, número).
-- Lo único que TODOS saben es a qué número nuestro llegó el mensaje.
--
-- La comparación usa los últimos 10 dígitos: así el +52 contra +521, con o
-- sin lada, con espacios o guiones, dejan de importar. Ese detalle es la
-- causa más común de que un mapeo de estos falle en México.

create table if not exists public.whatsapp_numero_asesor (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null default '00000000-0000-0000-0000-000000000001',
  numero_whatsapp text        not null,
  asesor_id       uuid        references public.profiles(id) on delete set null,
  asesor_name     text        not null,
  inbox_id        int,
  proveedor       text,
  nota            text,
  active          boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.whatsapp_numero_asesor is
  'De qué asesor es cada número de WhatsApp del negocio. Enruta el mensaje entrante a su dueño, sin importar qué puente lo traiga.';

create unique index if not exists whatsapp_numero_asesor_ult10_idx
  on public.whatsapp_numero_asesor (organization_id, right(regexp_replace(numero_whatsapp,'[^0-9]','','g'),10))
  where active;

create index if not exists whatsapp_numero_asesor_inbox_idx
  on public.whatsapp_numero_asesor (organization_id, inbox_id) where inbox_id is not null;

alter table public.whatsapp_numero_asesor enable row level security;

drop policy if exists whatsapp_numero_asesor_lectura on public.whatsapp_numero_asesor;
create policy whatsapp_numero_asesor_lectura on public.whatsapp_numero_asesor
  for select to authenticated
  using (organization_id = (select organization_id from public.profiles where id = auth.uid()));

create or replace function public.fn_asesor_del_numero(p_numero text, p_inbox_id int default null)
returns table (asesor_id uuid, asesor_name text, numero_whatsapp text)
language sql stable security definer set search_path = public
as $$
  select m.asesor_id, m.asesor_name, m.numero_whatsapp
  from public.whatsapp_numero_asesor m
  where m.organization_id = '00000000-0000-0000-0000-000000000001' and m.active
    and ( (p_numero is not null
           and right(regexp_replace(m.numero_whatsapp,'[^0-9]','','g'),10)
             = right(regexp_replace(p_numero,'[^0-9]','','g'),10))
      or  (p_inbox_id is not null and m.inbox_id = p_inbox_id) )
  order by (p_numero is not null) desc
  limit 1;
$$;

comment on function public.fn_asesor_del_numero(text,int) is
  'De quién es un número de WhatsApp nuestro. Igual si el puente identifica el canal por inbox o por número.';

-- fn_upsert_lead_from_chatwoot pasa a resolver el asesor con esta función.
-- Con respaldo: si no se puede resolver el número, queda 'iAgents' como
-- siempre. Y al actualizar un lead que ya tiene dueño no se le quita a nadie.
-- (El cuerpo completo se aplicó por MCP; ver el PR.)
