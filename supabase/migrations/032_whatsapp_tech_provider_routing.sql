-- 032_whatsapp_tech_provider_routing.sql
-- ============================================================================
-- RUTEO MULTI-CLIENTE DE WHATSAPP — preparación para Meta Tech Provider.
--
-- PROBLEMA:
--   `fn_asesor_del_numero` hardcodea organization_id = Stratos
--   ('00000000-0000-0000-0000-000000000001') y rutea por los últimos 10
--   dígitos del número. Con Embedded Signup cada cliente conecta su propia
--   WABA, así que el WhatsApp de Grupo 28 o Vega resolvería a la org de
--   Stratos y sus leads caerían en el CRM equivocado.
--
-- SOLUCIÓN:
--   El identificador estable que Meta manda en cada webhook es
--   `metadata.phone_number_id` (y `entry[].id` = WABA ID). Se rutea por ahí,
--   con fallback al número visible para no romper los canales ya conectados
--   a mano (Gael G).
--
-- IDEMPOTENTE: se puede re-ejecutar; deja el mismo estado final.
-- ============================================================================

-- (1) Campos de Tech Provider en el catálogo de canales -----------------------

alter table public.whatsapp_numero_asesor
  add column if not exists waba_id          text,
  add column if not exists phone_number_id  text,
  add column if not exists platform_type    text,
  add column if not exists verified_name    text,
  add column if not exists quality_rating   text,
  add column if not exists onboarded_via    text not null default 'manual',
  add column if not exists onboarded_at     timestamptz;

comment on column public.whatsapp_numero_asesor.waba_id is
  'WhatsApp Business Account ID del cliente (entry[].id del webhook de Meta).';
comment on column public.whatsapp_numero_asesor.phone_number_id is
  'Phone Number ID de Meta (metadata.phone_number_id). Clave de ruteo y de envío.';
comment on column public.whatsapp_numero_asesor.platform_type is
  'CLOUD_API | ON_PREMISE. ON_PREMISE no recibe webhooks de Cloud API — ver ops/ESTADO-FINAL-marco-whatsapp.md';
comment on column public.whatsapp_numero_asesor.onboarded_via is
  'manual | embedded_signup — cómo se conectó el canal.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'whatsapp_numero_asesor_platform_type_chk'
  ) then
    alter table public.whatsapp_numero_asesor
      add constraint whatsapp_numero_asesor_platform_type_chk
      check (platform_type is null or platform_type in ('CLOUD_API','ON_PREMISE'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'whatsapp_numero_asesor_onboarded_via_chk'
  ) then
    alter table public.whatsapp_numero_asesor
      add constraint whatsapp_numero_asesor_onboarded_via_chk
      check (onboarded_via in ('manual','embedded_signup'));
  end if;
end $$;

-- phone_number_id es único global: Meta no lo repite entre clientes.
create unique index if not exists whatsapp_numero_asesor_phone_number_id_uidx
  on public.whatsapp_numero_asesor (phone_number_id)
  where phone_number_id is not null;

create index if not exists whatsapp_numero_asesor_waba_id_idx
  on public.whatsapp_numero_asesor (waba_id)
  where waba_id is not null;

create index if not exists whatsapp_numero_asesor_org_active_idx
  on public.whatsapp_numero_asesor (organization_id, active);


-- (2) Resolver de canal — SIN org hardcodeada --------------------------------
--
-- Prioridad de match:
--   1. phone_number_id  (exacto, el que manda Meta en cada webhook)
--   2. waba_id          (cuando el cliente tiene un solo número)
--   3. últimos 10 dígitos del número visible (compatibilidad con lo manual)
--
-- p_organization_id acota la búsqueda cuando el llamante ya sabe el tenant.

create or replace function public.fn_resolver_canal_whatsapp(
  p_phone_number_id      text default null,
  p_waba_id              text default null,
  p_display_phone_number text default null,
  p_organization_id      uuid default null
)
returns table (
  organization_id  uuid,
  org_slug         text,
  asesor_id        uuid,
  asesor_name      text,
  numero_whatsapp  text,
  phone_number_id  text,
  waba_id          text,
  platform_type    text,
  match_by         text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with candidatos as (
    select
      m.organization_id                                   as c_org_id,
      o.slug                                              as c_org_slug,
      m.asesor_id                                         as c_asesor_id,
      m.asesor_name                                       as c_asesor_name,
      m.numero_whatsapp                                   as c_numero,
      m.phone_number_id                                   as c_pnid,
      m.waba_id                                           as c_waba,
      m.platform_type                                     as c_platform,
      case
        when p_phone_number_id is not null
         and m.phone_number_id = p_phone_number_id                      then 1
        when p_waba_id is not null
         and m.waba_id = p_waba_id                                      then 2
        when p_display_phone_number is not null
         and right(regexp_replace(m.numero_whatsapp, '[^0-9]', '', 'g'), 10)
           = right(regexp_replace(p_display_phone_number, '[^0-9]', '', 'g'), 10)
                                                                        then 3
        else null
      end                                                 as c_prioridad
    from public.whatsapp_numero_asesor m
    join public.organizations o on o.id = m.organization_id
    where m.active
      and (p_organization_id is null or m.organization_id = p_organization_id)
  )
  select
    c.c_org_id,
    c.c_org_slug,
    c.c_asesor_id,
    c.c_asesor_name,
    c.c_numero,
    c.c_pnid,
    c.c_waba,
    c.c_platform,
    case c.c_prioridad
      when 1 then 'phone_number_id'
      when 2 then 'waba_id'
      else        'display_phone_number'
    end
  from candidatos c
  where c.c_prioridad is not null
  order by c.c_prioridad, c.c_org_id
  limit 1;
$function$;

comment on function public.fn_resolver_canal_whatsapp(text,text,text,uuid) is
  'Resuelve tenant + asesor desde un webhook de WhatsApp. Reemplaza a fn_asesor_del_numero, que hardcodeaba la org de Stratos.';


-- (3) Alta de canal desde Embedded Signup ------------------------------------
--
-- La llama el callback de Embedded Signup (vía n8n) cuando un cliente termina
-- de conectar su número. Rechaza ON_PREMISE de entrada: esos números no
-- reciben webhooks de Cloud API y quedan mudos sin avisar.

create or replace function public.fn_registrar_canal_whatsapp(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org       uuid;
  v_pnid      text := nullif(payload->>'phone_number_id', '');
  v_waba      text := nullif(payload->>'waba_id', '');
  v_numero    text := nullif(payload->>'numero_whatsapp', '');
  v_asesor    text := nullif(payload->>'asesor_name', '');
  v_asesor_id uuid := nullif(payload->>'asesor_id', '')::uuid;
  v_verified  text := nullif(payload->>'verified_name', '');
  v_quality   text := nullif(payload->>'quality_rating', '');
  v_platform  text := upper(coalesce(nullif(payload->>'platform_type', ''), 'CLOUD_API'));
  v_via       text := coalesce(nullif(payload->>'onboarded_via', ''), 'embedded_signup');
  v_id        uuid;
begin
  v_org := coalesce(
    nullif(payload->>'organization_id', '')::uuid,
    (select o.id from public.organizations o where o.slug = nullif(payload->>'org_slug', ''))
  );

  if v_org is null then
    return jsonb_build_object('ok', false, 'error', 'Falta organization_id u org_slug válido');
  end if;
  if v_pnid is null then
    return jsonb_build_object('ok', false, 'error', 'Falta phone_number_id');
  end if;
  if v_platform = 'ON_PREMISE' then
    return jsonb_build_object(
      'ok', false,
      'error', 'El número está en ON_PREMISE (API vieja). No recibe webhooks de Cloud API: hay que migrarlo antes de conectarlo.'
    );
  end if;

  v_asesor := coalesce(v_asesor, v_verified, v_numero, v_pnid);

  insert into public.whatsapp_numero_asesor as w (
    organization_id, numero_whatsapp, asesor_id, asesor_name,
    waba_id, phone_number_id, platform_type, verified_name, quality_rating,
    onboarded_via, onboarded_at, active
  )
  values (
    v_org, coalesce(v_numero, v_pnid), v_asesor_id, v_asesor,
    v_waba, v_pnid, v_platform, v_verified, v_quality,
    v_via, now(), true
  )
  on conflict (phone_number_id) where phone_number_id is not null
  do update set
    organization_id = excluded.organization_id,
    numero_whatsapp = coalesce(excluded.numero_whatsapp, w.numero_whatsapp),
    asesor_id       = coalesce(excluded.asesor_id, w.asesor_id),
    asesor_name     = coalesce(excluded.asesor_name, w.asesor_name),
    waba_id         = coalesce(excluded.waba_id, w.waba_id),
    platform_type   = excluded.platform_type,
    verified_name   = coalesce(excluded.verified_name, w.verified_name),
    quality_rating  = coalesce(excluded.quality_rating, w.quality_rating),
    onboarded_via   = excluded.onboarded_via,
    active          = true,
    updated_at      = now()
  returning w.id into v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'organization_id', v_org,
    'phone_number_id', v_pnid,
    'waba_id', v_waba,
    'asesor_name', v_asesor
  );
end;
$function$;

comment on function public.fn_registrar_canal_whatsapp(jsonb) is
  'Alta/actualización de un canal de WhatsApp desde el callback de Embedded Signup. Rechaza ON_PREMISE.';


-- (4) Grants — solo service_role (n8n). Coherente con la migración 030. ------

-- OJO: `revoke ... from public` NO alcanza. Supabase concede EXECUTE explícito a
-- `anon` y `authenticated` vía default privileges, así que hay que revocarles
-- de forma nominal o el anon key público del bundle JS puede llamar estas RPC.
revoke all on function public.fn_resolver_canal_whatsapp(text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.fn_registrar_canal_whatsapp(jsonb)             from public, anon, authenticated;

grant execute on function public.fn_resolver_canal_whatsapp(text,text,text,uuid) to service_role;
grant execute on function public.fn_registrar_canal_whatsapp(jsonb)             to service_role;
