-- 111 — Que cada número de WhatsApp caiga con su asesor.
--
-- El de Gael funciona perfecto: le escriben y el lead aparece en Stratos. La
-- tubería es WhatsApp → Chatwoot → n8n → fn_upsert_lead_from_chatwoot → CRM,
-- y lleva 1,403 mensajes con 99.7% de conversión a lead.
--
-- Pero replicarlo con Óscar, Marco o Ken no funcionaba, y el motivo estaba
-- escrito a fuego en la función:
--
--     asesor_name = 'iAgents'
--
-- El `inbox_id` llegaba en el payload y se leía... solo para guardarlo como
-- metadato. Da igual de qué número venga el mensaje: todos terminaban igual.
--
-- En Chatwoot cada número es un inbox distinto. Esta tabla es la traducción
-- que faltaba: inbox → asesor. Conectar un número nuevo pasa a ser agregar
-- una fila, no tocar código.

create table if not exists public.chatwoot_inbox_asesor (
  organization_id uuid        not null default '00000000-0000-0000-0000-000000000001',
  inbox_id        int         not null,
  asesor_id       uuid        references public.profiles(id) on delete set null,
  asesor_name     text        not null,
  numero_whatsapp text,
  nota            text,
  active          boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (organization_id, inbox_id)
);

comment on table public.chatwoot_inbox_asesor is
  'De qué asesor es cada inbox de Chatwoot. Un inbox = un número de WhatsApp = un asesor.';

alter table public.chatwoot_inbox_asesor enable row level security;

drop policy if exists chatwoot_inbox_asesor_lectura on public.chatwoot_inbox_asesor;
create policy chatwoot_inbox_asesor_lectura on public.chatwoot_inbox_asesor
  for select to authenticated
  using (organization_id = (select organization_id from public.profiles where id = auth.uid()));

-- La función queda con respaldo: si el inbox no está mapeado se comporta
-- exactamente como antes ('iAgents'). Nada de lo que ya corre se rompe.
-- Y al actualizar un lead existente solo se asigna asesor si no tenía dueño:
-- no le quitamos leads a nadie.
