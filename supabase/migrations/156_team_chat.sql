-- Chat de equipo dentro de Stratos (pedido de Ángel, 27-jul-2026):
--   «y si hagamos un chat de equipo y demás. recuerda pensarlo a futuro si hay
--    otros desarrolladores»
-- El objetivo real: que Iván deje de mandar todo por WhatsApp y el trabajo del
-- equipo quede DENTRO del sistema, donde el Copilot y el cerebro lo pueden ver.
--
-- Por qué canales y no un solo cuarto: con 2 socios da igual, pero con 4-5
-- desarrolladores un único hilo se vuelve inservible. Se nace con canales.

create table if not exists public.team_chat_channels (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nombre          text not null,
  slug            text not null,
  descripcion     text,
  tipo            text not null default 'canal',   -- canal | proyecto
  project_id      uuid,
  orden           int  not null default 100,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  archived_at     timestamptz,
  unique (organization_id, slug)
);

create table if not exists public.team_chat_messages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_id      uuid not null references public.team_chat_channels(id) on delete cascade,
  author_id       uuid,
  body            text not null default '',
  attachment_path text,
  attachment_type text,
  reply_to        uuid references public.team_chat_messages(id) on delete set null,
  menciones       uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz,
  deleted_by      uuid
);

create table if not exists public.team_chat_reads (
  channel_id   uuid not null references public.team_chat_channels(id) on delete cascade,
  profile_id   uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, profile_id)
);

create index if not exists team_chat_msg_canal_idx on public.team_chat_messages (channel_id, created_at desc);
create index if not exists team_chat_msg_org_idx   on public.team_chat_messages (organization_id, created_at desc);

alter table public.team_chat_channels enable row level security;
alter table public.team_chat_messages enable row level security;
alter table public.team_chat_reads    enable row level security;

-- Cada quien ve solo el chat de SU organización (mismo patrón que el resto del CRM).
drop policy if exists chat_canales_org on public.team_chat_channels;
create policy chat_canales_org on public.team_chat_channels for all to authenticated
  using (organization_id = (select organization_id from public.profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from public.profiles where id = auth.uid()));

drop policy if exists chat_msgs_org on public.team_chat_messages;
create policy chat_msgs_org on public.team_chat_messages for all to authenticated
  using (organization_id = (select organization_id from public.profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from public.profiles where id = auth.uid()));

drop policy if exists chat_reads_propio on public.team_chat_reads;
create policy chat_reads_propio on public.team_chat_reads for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Que los mensajes lleguen solos a la pantalla del otro (sin recargar).
do $$
begin
  alter publication supabase_realtime add table public.team_chat_messages;
exception when duplicate_object then null;
end $$;;
