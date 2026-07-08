-- ═══════════════════════════════════════════════════════════════════════════
-- 066 · Landing pages personalizadas por cliente — persistencia + link público
-- ─────────────────────────────────────────────────────────────────────────────
-- El Marketing Studio (Create) genera landings tipo ficha técnica PERSONALIZADAS
-- con el nombre del cliente. Antes vivían solo en memoria del asesor (el link
-- de "Enviar al cliente" no abría nada). Con esta migración:
--   · Cada landing generada se guarda aquí con su slug único.
--   · El cliente la abre en /p/<slug> SIN login (fn_landing_public, anon).
--   · Las propiedades del catálogo se leen EN VIVO al abrir (precios/entrega
--     siempre actualizados); las demo/custom van congeladas en props_snapshot.
--   · views/last_viewed_at: el asesor ve si su cliente ya la abrió ("Vista").
-- Seguridad:
--   · RLS org-scoped para el CRM (mismo patrón que properties).
--   · anon NO puede leer la tabla; solo fn_landing_public(slug), que expone
--     únicamente campos públicos de las propiedades (NUNCA masterbroker,
--     contacto, notes ni recommended_by).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.landing_pages (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id),
  slug             text not null unique,          -- token del link público /p/<slug>
  client_name      text not null,                 -- personalización: "Preparado para X"
  agency_name      text,
  asesor_name      text,
  asesor_wa        text,
  asesor_cal       text,
  mensaje          text,                          -- mensaje personalizado del asesor
  budget_label     text,                          -- "$200K-$500K" (solo display CRM)
  property_ids     uuid[] not null default '{}',  -- fichas del catálogo (datos EN VIVO)
  props_snapshot   jsonb not null default '[]'::jsonb, -- demo/custom congeladas al generar
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  views            integer not null default 0,
  last_viewed_at   timestamptz,
  active           boolean not null default true,
  deleted_at       timestamptz
);

create index if not exists idx_landing_pages_org  on public.landing_pages (organization_id, created_at desc) where deleted_at is null;
create index if not exists idx_landing_pages_slug on public.landing_pages (slug) where deleted_at is null;

alter table public.landing_pages enable row level security;

drop policy if exists landing_pages_select on public.landing_pages;
create policy landing_pages_select on public.landing_pages for select
  using (organization_id = current_organization_id());
drop policy if exists landing_pages_insert on public.landing_pages;
create policy landing_pages_insert on public.landing_pages for insert
  with check (organization_id = current_organization_id());
drop policy if exists landing_pages_update on public.landing_pages;
create policy landing_pages_update on public.landing_pages for update
  using (organization_id = current_organization_id());
drop policy if exists landing_pages_no_hard_delete on public.landing_pages;
create policy landing_pages_no_hard_delete on public.landing_pages for delete
  using (false);

grant select, insert, update on public.landing_pages to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- fn_landing_public(slug) — la ÚNICA puerta pública. Devuelve la landing +
-- las propiedades del catálogo con datos vivos (solo campos públicos) e
-- incrementa el contador de vistas.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_landing_public(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lp    public.landing_pages%rowtype;
  v_props jsonb;
begin
  if p_slug is null or length(btrim(p_slug)) < 8 then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_lp from public.landing_pages
   where slug = btrim(p_slug) and active and deleted_at is null
   limit 1;
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  update public.landing_pages
     set views = views + 1, last_viewed_at = now()
   where id = v_lp.id;

  -- Solo campos PÚBLICOS de las propiedades. NUNCA masterbroker/contacto/notes.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.name, 'plaza', p.plaza, 'zona', p.zona,
           'price_tier', p.price_tier, 'ticket', p.ticket,
           'clasificacion', p.clasificacion, 'entrega', p.entrega,
           'financiamiento', p.financiamiento, 'como_se_entrega', p.como_se_entrega,
           'tipologia', p.tipologia, 'mantenimiento', p.mantenimiento,
           'drive_url', p.drive_url, 'maps_url', p.maps_url,
           'highlights', p.highlights, 'is_top', p.is_top,
           'cover_url', p.cover_url, 'updated_at', p.updated_at
         ) order by array_position(v_lp.property_ids, p.id)), '[]'::jsonb)
    into v_props
  from public.properties p
  where p.id = any(v_lp.property_ids) and p.deleted_at is null and p.active;

  return jsonb_build_object(
    'ok', true,
    'client_name',    v_lp.client_name,
    'agency_name',    v_lp.agency_name,
    'asesor_name',    v_lp.asesor_name,
    'asesor_wa',      v_lp.asesor_wa,
    'asesor_cal',     v_lp.asesor_cal,
    'mensaje',        v_lp.mensaje,
    'props_snapshot', v_lp.props_snapshot,
    'properties',     v_props,
    'created_at',     v_lp.created_at
  );
end $$;

grant execute on function public.fn_landing_public(text) to anon;
grant execute on function public.fn_landing_public(text) to authenticated;
