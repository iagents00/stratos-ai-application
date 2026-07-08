-- ═══════════════════════════════════════════════════════════════════════════
-- 055 · Inventario de Propiedades (catálogo de proyectos con links de Drive)
-- ─────────────────────────────────────────────────────────────────────────────
-- Reemplaza el Google Sheet "DRIVES DUKE DEL CARIBE": catálogo curado de
-- proyectos por plaza (Tulum, Playa, Cancún, ...) y rango de precio, con el
-- link al Drive de cada propiedad. Fuente de verdad: esta tabla.
--   · Módulo web "Propiedades" (todo el equipo, asesores incluidos).
--   · Bot Telegram: "dame el top inversiones de Cancún", "/propiedades tulum".
-- Multi-tenant: org-scoped por organization_id + RLS (mismo patrón que
-- team_actions). Nada específico de Duke hardcodeado.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.properties (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id),
  name             text not null,
  plaza            text not null,            -- p.ej. 'Tulum', 'Playa del Carmen', 'Cancún'
  price_tier       text,                     -- '80-150K' | '200-350K' | '500-800K' | 'LUXURY'
  highlights       text,                     -- por qué recomendarla (pitch corto)
  drive_url        text,                     -- link al Drive con brochures/fotos/precios
  tags             text[] not null default '{}',
  is_top           boolean not null default false,  -- destacada / top inversión
  recommended_by   text,                     -- asesor que la propone (texto libre)
  notes            text,
  active           boolean not null default true,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index if not exists idx_properties_org_plaza on public.properties (organization_id, plaza) where deleted_at is null;
create index if not exists idx_properties_org_tier  on public.properties (organization_id, price_tier) where deleted_at is null;

alter table public.properties enable row level security;

-- Mismo patrón que team_actions: cada org solo ve/edita lo suyo.
drop policy if exists properties_select on public.properties;
create policy properties_select on public.properties for select
  using (organization_id = current_organization_id());
drop policy if exists properties_insert on public.properties;
create policy properties_insert on public.properties for insert
  with check (organization_id = current_organization_id());
drop policy if exists properties_update on public.properties;
create policy properties_update on public.properties for update
  using (organization_id = current_organization_id());
-- Sin hard-delete desde el cliente: se archiva con deleted_at (papelera).
drop policy if exists properties_no_hard_delete on public.properties;
create policy properties_no_hard_delete on public.properties for delete
  using (false);

grant select, insert, update on public.properties to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- bot_propiedades(tg, args) — consulta del catálogo desde Telegram.
-- El clasificador (n8n) manda tool_name='buscar_propiedades' con args
-- {plaza, rango, keyword, top}; si vienen vacíos se deducen del texto crudo.
-- Org-scoped: se resuelve la org desde el telegram_chat_id (white-label).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.bot_propiedades(p_telegram_chat_id bigint, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_org uuid;
  v_args jsonb := coalesce(p_args,'{}'::jsonb);
  v_text text; v_norm text;
  v_plaza text; v_tier text; v_kw text; v_top boolean := false;
  v_r record; v_out text := ''; v_rows int := 0; v_total int := 0;
  v_summary text := ''; v_note text := '';
begin
  select organization_id into v_org
  from public.profiles
  where telegram_chat_id = p_telegram_chat_id and coalesce(active,true) = true
  order by updated_at desc nulls last limit 1;

  if v_org is null then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object(
      'text','No encuentro tu perfil. Conecta tu Telegram desde el CRM (Perfil → Conectar Telegram).',
      'inline_keyboard','[]'::jsonb));
  end if;

  v_text := trim(coalesce(v_args->>'input_text', v_args->>'text', v_args->>'query', ''));
  v_norm := public.unaccent(lower(v_text));

  v_plaza := nullif(trim(coalesce(v_args->>'plaza', v_args->>'zona', v_args->>'ciudad','')),'');
  v_tier  := nullif(trim(coalesce(v_args->>'rango', v_args->>'price_tier', v_args->>'presupuesto','')),'');
  v_kw    := nullif(trim(coalesce(v_args->>'keyword','')),'');
  begin v_top := coalesce((v_args->>'top')::boolean, false); exception when others then v_top := false; end;

  -- Deducción desde el texto crudo (fallback determinista, accent-insensitive).
  if not v_top and v_norm ~ '\y(top|mejores|mejor|destacad\w*)\y' then v_top := true; end if;

  if v_plaza is null then
    -- Matchea cualquier palabra (>=4 letras) de las plazas registradas en la org:
    -- "de playa" → 'Playa del Carmen', "cancun" → 'Cancún'. Sin plazas hardcodeadas.
    select p2.plaza into v_plaza
    from (select distinct plaza from public.properties
          where organization_id = v_org and deleted_at is null and active) p2
    where exists (
      select 1 from regexp_split_to_table(public.unaccent(lower(p2.plaza)), '\s+') w
      where length(w) >= 4 and v_norm ~ ('\y' || w || '\y'))
    limit 1;
  end if;

  if v_tier is null and v_norm <> '' then
    if    v_norm ~ '(\y80k?\y|\y150k?\y)'            then v_tier := '80-150K';
    elsif v_norm ~ '(\y200k?\y|\y350k?\y)'           then v_tier := '200-350K';
    elsif v_norm ~ '(\y500k?\y|\y800k?\y)'           then v_tier := '500-800K';
    elsif v_norm ~ '(lux|lujo|premium)'              then v_tier := 'LUXURY';
    end if;
  end if;

  -- Normaliza el rango si el clasificador mandó algo tipo "200 a 350" / "luxury".
  if v_tier is not null then
    v_tier := upper(replace(replace(v_tier,' ',''),'–','-'));
    if    v_tier ~ '(80|150)'        then v_tier := '80-150K';
    elsif v_tier ~ '(200|350)'       then v_tier := '200-350K';
    elsif v_tier ~ '(500|800)'       then v_tier := '500-800K';
    elsif v_tier ~ '(LUX|LUJO|PREM)' then v_tier := 'LUXURY';
    end if;
  end if;

  select count(*) into v_total
  from public.properties
  where organization_id = v_org and deleted_at is null and active
    and (v_plaza is null or public.unaccent(lower(plaza)) like '%'||public.unaccent(lower(v_plaza))||'%')
    and (v_tier  is null or upper(coalesce(price_tier,'')) = v_tier)
    and (not v_top or is_top)
    and (v_kw is null or public.unaccent(lower(coalesce(name,'')||' '||coalesce(highlights,'')||' '||array_to_string(tags,' ')))
         like '%'||public.unaccent(lower(v_kw))||'%');

  -- Si pidió "top" pero nadie marcó destacadas aún, degrada a mostrar todas.
  if v_top and v_total = 0 then
    v_top := false;
    v_note := E'(Aún no hay propiedades marcadas como ⭐ top con esos filtros; te muestro todas)\n\n';
    select count(*) into v_total
    from public.properties
    where organization_id = v_org and deleted_at is null and active
      and (v_plaza is null or public.unaccent(lower(plaza)) like '%'||public.unaccent(lower(v_plaza))||'%')
      and (v_tier  is null or upper(coalesce(price_tier,'')) = v_tier)
      and (v_kw is null or public.unaccent(lower(coalesce(name,'')||' '||coalesce(highlights,'')||' '||array_to_string(tags,' ')))
           like '%'||public.unaccent(lower(v_kw))||'%');
  end if;

  -- Sin filtros y sin intención clara → resumen del catálogo + cómo pedirlo.
  if v_plaza is null and v_tier is null and v_kw is null and not v_top then
    select string_agg('  · ' || plaza || ': ' || cnt || (case when cnt = 1 then ' propiedad' else ' propiedades' end), E'\n' order by plaza)
      into v_summary
    from (select plaza, count(*) cnt from public.properties
          where organization_id = v_org and deleted_at is null and active
          group by plaza) s;
    if v_summary is null then
      return jsonb_build_object('ok',true,'reply',jsonb_build_object(
        'text','Aún no hay propiedades en el catálogo. Agrégalas en el CRM → módulo Propiedades.',
        'inline_keyboard','[]'::jsonb));
    end if;
    return jsonb_build_object('ok',true,'reply',jsonb_build_object(
      'text', E'🏗 Catálogo de propiedades\n' || v_summary ||
              E'\n\nPídeme por ejemplo:\n' ||
              E'  · "propiedades de Tulum de 200 a 350"\n' ||
              E'  · "top inversiones de Cancún"\n' ||
              E'  · "propiedades luxury de playa"',
      'inline_keyboard','[]'::jsonb));
  end if;

  for v_r in
    select * from public.properties
    where organization_id = v_org and deleted_at is null and active
      and (v_plaza is null or public.unaccent(lower(plaza)) like '%'||public.unaccent(lower(v_plaza))||'%')
      and (v_tier  is null or upper(coalesce(price_tier,'')) = v_tier)
      and (not v_top or is_top)
      and (v_kw is null or public.unaccent(lower(coalesce(name,'')||' '||coalesce(highlights,'')||' '||array_to_string(tags,' ')))
           like '%'||public.unaccent(lower(v_kw))||'%')
    order by is_top desc,
             plaza,
             case coalesce(price_tier,'') when '80-150K' then 1 when '200-350K' then 2
                                          when '500-800K' then 3 when 'LUXURY' then 4 else 5 end,
             name
    limit 12
  loop
    v_rows := v_rows + 1;
    v_out := v_out || E'\n\n'
      || (case when v_r.is_top then '⭐ ' else '🏗 ' end) || v_r.name
      || E'\n📍 ' || v_r.plaza
      || coalesce(' · ' || nullif(v_r.price_tier,''), '')
      || coalesce(E'\n💡 ' || nullif(v_r.highlights,''), '')
      || coalesce(E'\n👤 Recomienda: ' || nullif(v_r.recommended_by,''), '')
      || coalesce(E'\n🔗 ' || nullif(v_r.drive_url,''), E'\n🔗 (sin link aún — pídelo en el CRM)');
  end loop;

  if v_rows = 0 then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object(
      'text','No encontré propiedades con esos filtros'
             || coalesce(' (plaza: '||v_plaza||')','') || coalesce(' (rango: '||v_tier||')','')
             || E'.\nEscribe "propiedades" para ver el catálogo disponible.',
      'inline_keyboard','[]'::jsonb));
  end if;

  return jsonb_build_object('ok',true,'reply',jsonb_build_object(
    'text', v_note || (case when v_top then '⭐ Top propiedades' else '🏗 Propiedades' end)
            || coalesce(' · ' || v_plaza, '') || coalesce(' · ' || v_tier, '')
            || ' (' || v_rows || (case when v_total > v_rows then ' de ' || v_total else '' end) || ')'
            || v_out
            || (case when v_total > v_rows then E'\n\nAfina con plaza o rango para ver el resto.' else '' end),
    'inline_keyboard','[]'::jsonb));
end;
$function$;
