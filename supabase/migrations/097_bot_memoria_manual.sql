-- ============================================================================
-- 097 — Bot Telegram (Stratos): MEMORIA conversacional + link del manual +
--       fallback amable. Aplicado en stratos-prod vía MCP (2026-07-13).
--
-- MEMORIA: tabla bot_chat_context (por telegram_chat_id, TTL 30 min). Las
--   funciones de cliente (ficha/proxima/ultima/top_hot) recuerdan el último
--   cliente mostrado; el router (bot_smart_queries) resuelve "ese cliente",
--   "su teléfono", "su presupuesto", "su próxima/última acción" al recordado.
--   Si no hay memoria vigente -> re-pregunta.
-- MANUAL: organizations.meta_config->>'manual_tg_url' (por-org / white-label).
--   bot_render_capabilities lo agrega al final. Duke:
--   https://app.stratoscapitalgroup.com/manual-asistente-telegram
-- FALLBACK: el router reemplaza "No conozco esa acción" por una re-pregunta útil.
--
-- Rumbo (decisión de Iván): "segundo cerebro con límites" = híbrido seguro
--   (interpretar todo, NUNCA inventar datos; todo dato sale del CRM real).
--
-- REVERT: drop de bot_chat_context + helpers; restaurar bot_smart_queries y
--   bot_render_capabilities previas; borrar manual_tg_url de meta_config.
-- ============================================================================

create table if not exists public.bot_chat_context (
  telegram_chat_id bigint primary key,
  organization_id uuid,
  last_lead_id uuid,
  last_lead_name text,
  last_lead_phone text,
  last_asesor_id uuid,
  last_asesor_name text,
  updated_at timestamptz not null default now()
);
alter table public.bot_chat_context enable row level security;  -- solo SECURITY DEFINER / service_role

create or replace function public._bot_remember_lead(p_chat bigint, p_org uuid, p_lead uuid, p_name text, p_phone text)
returns void language sql security definer set search_path to 'public','pg_temp' as $fn$
  insert into public.bot_chat_context(telegram_chat_id, organization_id, last_lead_id, last_lead_name, last_lead_phone, updated_at)
  values (p_chat, p_org, p_lead, p_name, nullif(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),''), now())
  on conflict (telegram_chat_id) do update set
    organization_id=excluded.organization_id, last_lead_id=excluded.last_lead_id,
    last_lead_name=excluded.last_lead_name, last_lead_phone=excluded.last_lead_phone, updated_at=now();
$fn$;

create or replace function public._bot_remember_asesor(p_chat bigint, p_org uuid, p_aid uuid, p_name text)
returns void language sql security definer set search_path to 'public','pg_temp' as $fn$
  insert into public.bot_chat_context(telegram_chat_id, organization_id, last_asesor_id, last_asesor_name, updated_at)
  values (p_chat, p_org, p_aid, p_name, now())
  on conflict (telegram_chat_id) do update set
    organization_id=excluded.organization_id, last_asesor_id=excluded.last_asesor_id,
    last_asesor_name=excluded.last_asesor_name, updated_at=now();
$fn$;

create or replace function public._bot_recall_lead(p_chat bigint)
returns table(lead_id uuid, lead_name text, lead_phone text)
language sql stable security definer set search_path to 'public','pg_temp' as $fn$
  select last_lead_id, last_lead_name, last_lead_phone
  from public.bot_chat_context
  where telegram_chat_id=p_chat and last_lead_id is not null and updated_at > now() - interval '30 minutes';
$fn$;

-- meta_config (Duke): url del manual del asistente
update public.organizations
set meta_config = coalesce(meta_config,'{}'::jsonb) || jsonb_build_object('manual_tg_url','https://app.stratoscapitalgroup.com/manual-asistente-telegram')
where id='00000000-0000-0000-0000-000000000001';

-- bot_render_capabilities (con manual), integración de memoria en ficha/proxima/
-- ultima/top_hot, y bot_smart_queries (anáfora + fallback): cuerpos aplicados por
-- MCP; ver la base (pg_get_functiondef) y memory/reports del AIOS.
