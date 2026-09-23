-- 246_temporary_login_credentials.sql
-- Conserva de forma cifrada la clave inicial de usuarios nuevos mientras siga vigente.
-- Nunca guarda texto plano y elimina automáticamente el registro al cambiar la clave.

create table if not exists public.temporary_login_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_name text not null,
  login_email text not null,
  encrypted_password text not null,
  encryption_iv text not null,
  key_version smallint not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists temporary_login_credentials_org_idx
  on public.temporary_login_credentials (organization_id, created_at desc);

alter table public.temporary_login_credentials enable row level security;
revoke all on table public.temporary_login_credentials from public, anon, authenticated;

comment on table public.temporary_login_credentials is
  'Custodia privada y cifrada de credenciales iniciales. Solo Edge Functions con service_role pueden leerla; la fila desaparece al cambiar la contraseña.';

create or replace function public.clear_temporary_login_credential_on_password_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if old.encrypted_password is distinct from new.encrypted_password then
    delete from public.temporary_login_credentials where user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.clear_temporary_login_credential_on_password_change() from public, anon, authenticated;

drop trigger if exists clear_temporary_login_credential_after_password_change on auth.users;
create trigger clear_temporary_login_credential_after_password_change
after update of encrypted_password on auth.users
for each row
execute function public.clear_temporary_login_credential_on_password_change();

-- Las altas anteriores guardaban el correo únicamente en auth.users. El flujo
-- por código busca profiles.recovery_email y por eso respondía “enviado” sin
-- disparar el correo. Solo completamos vacíos; nunca sustituimos una dirección
-- de recuperación elegida por la persona.
update public.profiles p
set recovery_email = lower(trim(u.email))
from auth.users u
where u.id = p.id
  and nullif(trim(p.recovery_email), '') is null
  and u.email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
