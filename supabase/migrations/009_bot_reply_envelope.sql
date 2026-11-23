-- ============================================================================
-- 009_bot_reply_envelope.sql
--
-- Construye la capa de presentación del bot enteramente en Postgres:
--   - Tablas operativas (bot_config, bot_pending_actions, bot_rate_limit)
--   - Helpers de formato (texto plano sin Markdown ni emojis)
--   - Helpers de teclado inline (inline_keyboard listos para Telegram)
--   - Helpers de firma HMAC para anti-spoofing de callback_data
--   - Funciones envoltura que componen el "sobre estándar" { ok, data, reply }
--
-- Filosofía:
--   - Postgres-first: TODA la decisión de "qué texto y qué botones mostrar"
--     vive en SQL. n8n solo transporta.
--   - Cero emojis (regla de voz del bot). Iconos tipográficos: · → ─ ◆ ▸
--   - Sobre estándar de respuesta:
--       { ok: bool, code?: text, data?: jsonb,
--         reply: { text: text, parse_mode: null, inline_keyboard: [[btn]] } }
--
-- Esta migración NO toca ninguna de las 16 RPCs originales (compat con web).
-- Crea funciones nuevas con sufijo _v2 que envuelven a las originales.
-- ============================================================================

set search_path = public;

-- ----------------------------------------------------------------------------
-- TABLAS OPERATIVAS DEL BOT
-- ----------------------------------------------------------------------------

-- Configuración key/value del bot (secretos, settings)
create table if not exists public.bot_config (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);
alter table public.bot_config enable row level security;

-- Solo super_admin / service_role pueden leer/escribir
drop policy if exists bot_config_admin_all on public.bot_config;
create policy bot_config_admin_all on public.bot_config
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','admin'))
  );

grant select on public.bot_config to service_role;

-- Seed inicial — el HMAC secret se debe rotar después en producción
insert into public.bot_config(key, value, description)
values
  ('hmac_secret', encode(gen_random_bytes(32), 'hex'),
   'Secreto HMAC para firmar callback_data del bot. Rotar trimestralmente.'),
  ('callback_ttl_minutes', '60',
   'Minutos antes de que un callback_data firmado expire.'),
  ('pending_action_ttl_minutes', '10',
   'Minutos antes de que una confirmación pendiente expire.')
on conflict (key) do nothing;

-- Acciones de escritura pendientes de confirmación (Sí/Editar/Cancelar)
create table if not exists public.bot_pending_actions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,                 -- 12 chars, lo que va en callback_data
  asesor_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  telegram_chat_id bigint not null,
  action_type text not null,                  -- 'upsert_lead', 'update_fields', 'add_task', etc.
  payload jsonb not null,                     -- args a pasar a la RPC al confirmar
  summary text not null,                      -- texto que el bot mostró
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_bot_pending_token on public.bot_pending_actions(token);
create index if not exists idx_bot_pending_chat on public.bot_pending_actions(telegram_chat_id, created_at desc);
create index if not exists idx_bot_pending_expires on public.bot_pending_actions(expires_at) where consumed_at is null;

alter table public.bot_pending_actions enable row level security;
grant all on public.bot_pending_actions to service_role;

-- Rate limit por chat_id (anti-flood)
create table if not exists public.bot_rate_limit (
  telegram_chat_id bigint primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);
alter table public.bot_rate_limit enable row level security;
grant all on public.bot_rate_limit to service_role;

-- ----------------------------------------------------------------------------
-- HELPERS DE FORMATO (texto)
-- ----------------------------------------------------------------------------

-- Formatea teléfono solo dígitos -> "555 123 4567"
create or replace function public._bot_fmt_phone(p_phone text)
returns text language sql immutable as $$
  select case
    when p_phone is null or length(regexp_replace(p_phone,'[^0-9]','','g')) < 7 then coalesce(p_phone,'')
    else regexp_replace(
      regexp_replace(p_phone,'[^0-9]','','g'),
      '^([0-9]{3})([0-9]{3})([0-9]{4,})$', '\1 \2 \3'
    )
  end;
$$;

-- Formatea presupuesto numérico -> "200,000 USD"
create or replace function public._bot_fmt_money(p_amount bigint, p_currency text default 'USD')
returns text language sql immutable as $$
  select case
    when p_amount is null or p_amount = 0 then ''
    else to_char(p_amount, 'FM999G999G999') || ' ' || coalesce(p_currency,'USD')
  end;
$$;

-- Tiempo relativo: "hace 2h", "mañana 11:00", "hoy 16:00"
create or replace function public._bot_fmt_when(p_ts timestamptz)
returns text language plpgsql immutable as $$
declare
  v_local timestamptz; v_today date; v_target_date date; v_diff_seconds bigint;
begin
  if p_ts is null then return ''; end if;
  v_local := p_ts at time zone 'America/Cancun';
  v_today := (now() at time zone 'America/Cancun')::date;
  v_target_date := v_local::date;
  v_diff_seconds := extract(epoch from (p_ts - now()))::bigint;

  if abs(v_diff_seconds) < 3600 then
    if v_diff_seconds >= 0 then return 'en ' || (v_diff_seconds/60) || 'min';
    else return 'hace ' || (abs(v_diff_seconds)/60) || 'min'; end if;
  end if;

  if v_target_date = v_today then
    return 'hoy ' || to_char(v_local, 'HH24:MI');
  elsif v_target_date = v_today + 1 then
    return 'mañana ' || to_char(v_local, 'HH24:MI');
  elsif v_target_date = v_today - 1 then
    return 'ayer ' || to_char(v_local, 'HH24:MI');
  elsif v_target_date between v_today and v_today + 6 then
    return lower(to_char(v_local, 'TMDy HH24:MI'));
  else
    return to_char(v_local, 'DD Mon HH24:MI');
  end if;
end;
$$;

-- Renderiza una ficha completa de lead en texto plano (sin Markdown)
create or replace function public._bot_fmt_lead_card(p_lead public.leads)
returns text language plpgsql immutable as $$
declare
  v_lines text[];
  v_temp text;
begin
  v_lines := array[]::text[];
  v_lines := v_lines || (p_lead.name || ' · ' || public._bot_fmt_phone(p_lead.phone));
  v_lines := v_lines || ('Etapa ' || p_lead.stage || ' · Score ' || p_lead.score ||
                         case when p_lead.hot then ' · caliente' else '' end);

  v_temp := public._bot_fmt_money(p_lead.presupuesto);
  if v_temp <> '' then
    v_lines := v_lines || (v_temp ||
      case when coalesce(p_lead.project,'') <> '' then ' · ' || p_lead.project else '' end);
  elsif coalesce(p_lead.project,'') <> '' then
    v_lines := v_lines || ('Proyecto: ' || p_lead.project);
  end if;

  if p_lead.seguimientos > 0 then
    v_lines := v_lines || (p_lead.seguimientos || ' seguimientos' ||
      case when p_lead.days_inactive > 0 then ' · última hace ' || p_lead.days_inactive || ' días' else '' end);
  end if;

  if coalesce(p_lead.next_action,'') <> '' then
    v_lines := v_lines || ('Próxima acción: ' || p_lead.next_action ||
      case when p_lead.next_action_at is not null then ' — ' || public._bot_fmt_when(p_lead.next_action_at) else '' end);
  end if;

  if coalesce(p_lead.ai_agent,'') <> '' then
    v_lines := v_lines || ('Agente IA: ' || p_lead.ai_agent);
  end if;

  return array_to_string(v_lines, E'\n');
end;
$$;

-- ----------------------------------------------------------------------------
-- HELPERS HMAC (firma de callback_data)
-- ----------------------------------------------------------------------------

create or replace function public._bot_hmac_secret()
returns text language sql stable as $$
  select value from public.bot_config where key = 'hmac_secret' limit 1;
$$;

-- HMAC-SHA256 truncado a 8 chars hex
create or replace function public._bot_hmac8(p_payload text)
returns text language sql stable as $$
  select substr(encode(extensions.hmac(p_payload, public._bot_hmac_secret(), 'sha256'),'hex'), 1, 8);
$$;

-- Firma un callback_data como "<action>:<payload>:<hmac8>"
-- Telegram limita callback_data a 64 bytes — el caller debe garantizar brevedad.
create or replace function public._bot_cb_sign(p_action text, p_payload text default '_')
returns text language sql stable as $$
  select p_action || ':' || coalesce(p_payload,'_') || ':' ||
         public._bot_hmac8(p_action || ':' || coalesce(p_payload,'_'));
$$;

-- Verifica firma. Retorna { action, payload, valid }.
create or replace function public._bot_cb_verify(p_callback_data text)
returns jsonb language plpgsql stable as $$
declare
  v_parts text[]; v_action text; v_payload text; v_sig text; v_expected text;
begin
  if p_callback_data is null then
    return jsonb_build_object('valid', false, 'reason','null');
  end if;
  v_parts := string_to_array(p_callback_data, ':');
  if array_length(v_parts, 1) < 3 then
    return jsonb_build_object('valid', false, 'reason','format');
  end if;
  v_action  := v_parts[1];
  v_sig     := v_parts[array_length(v_parts,1)];
  v_payload := array_to_string(v_parts[2:array_length(v_parts,1)-1], ':');
  v_expected := public._bot_hmac8(v_action || ':' || v_payload);
  return jsonb_build_object(
    'valid', v_sig = v_expected,
    'action', v_action,
    'payload', v_payload
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- HELPERS DE TECLADO (inline_keyboard)
-- ----------------------------------------------------------------------------

-- Botón único helper
create or replace function public._bot_btn(p_text text, p_action text, p_payload text default '_')
returns jsonb language sql stable as $$
  select jsonb_build_object('text', p_text, 'callback_data', public._bot_cb_sign(p_action, p_payload));
$$;

-- Menú raíz: 5 botones, 2-2-1
create or replace function public._bot_kb_root_menu()
returns jsonb language sql stable as $$
  select jsonb_build_array(
    jsonb_build_array(
      public._bot_btn('Mis clientes', 'list', 'mine'),
      public._bot_btn('Agenda', 'pending', '_')
    ),
    jsonb_build_array(
      public._bot_btn('KPIs', 'kpi', 'me'),
      public._bot_btn('Buscar', 'searchprompt', '_')
    ),
    jsonb_build_array(
      public._bot_btn('Pipeline', 'pipeline', '_')
    )
  );
$$;

-- Botones de una ficha de lead (6 acciones)
create or replace function public._bot_kb_lead_card(p_phone_norm text)
returns jsonb language sql stable as $$
  select jsonb_build_array(
    jsonb_build_array(
      public._bot_btn('Expediente', 'expediente', p_phone_norm),
      public._bot_btn('Historial', 'history', p_phone_norm)
    ),
    jsonb_build_array(
      public._bot_btn('Cambiar etapa', 'stagepick', p_phone_norm),
      public._bot_btn('Próx. acción', 'nextpick', p_phone_norm)
    ),
    jsonb_build_array(
      public._bot_btn('Agregar tarea', 'taskprompt', p_phone_norm),
      public._bot_btn('Agente IA', 'agentpick', p_phone_norm)
    ),
    jsonb_build_array(
      public._bot_btn('Pinear', 'pin', p_phone_norm || ':1'),
      public._bot_btn('← Menú', 'menu', '_')
    )
  );
$$;

-- 10 etapas en 5 filas de 2
create or replace function public._bot_kb_stage_picker(p_phone_norm text)
returns jsonb language sql stable as $$
  select jsonb_build_array(
    jsonb_build_array(
      public._bot_btn('Nuevo Registro', 'stage', p_phone_norm || ':nuevo'),
      public._bot_btn('Primer Contacto', 'stage', p_phone_norm || ':primer')
    ),
    jsonb_build_array(
      public._bot_btn('Seguimiento', 'stage', p_phone_norm || ':seguim'),
      public._bot_btn('Zoom Agendado', 'stage', p_phone_norm || ':zoom-ag')
    ),
    jsonb_build_array(
      public._bot_btn('Zoom Concretado', 'stage', p_phone_norm || ':zoom-co'),
      public._bot_btn('Visita Agendada', 'stage', p_phone_norm || ':vis-ag')
    ),
    jsonb_build_array(
      public._bot_btn('Visita Concretada', 'stage', p_phone_norm || ':vis-co'),
      public._bot_btn('Negociación', 'stage', p_phone_norm || ':negoc')
    ),
    jsonb_build_array(
      public._bot_btn('Cierre', 'stage', p_phone_norm || ':cierre'),
      public._bot_btn('Perdido', 'stage', p_phone_norm || ':perdido')
    ),
    jsonb_build_array(public._bot_btn('← Volver', 'view', p_phone_norm))
  );
$$;

-- Resuelve slug de etapa a nombre canónico
create or replace function public._bot_stage_from_slug(p_slug text)
returns text language sql immutable as $$
  select case p_slug
    when 'nuevo'    then 'Nuevo Registro'
    when 'primer'   then 'Primer Contacto'
    when 'seguim'   then 'Seguimiento'
    when 'zoom-ag'  then 'Zoom Agendado'
    when 'zoom-co'  then 'Zoom Concretado'
    when 'vis-ag'   then 'Visita Agendada'
    when 'vis-co'   then 'Visita Concretada'
    when 'negoc'    then 'Negociación'
    when 'cierre'   then 'Cierre'
    when 'perdido'  then 'Perdido'
    else null
  end;
$$;

-- Selector de agente IA
create or replace function public._bot_kb_agent_picker(p_phone_norm text)
returns jsonb language sql stable as $$
  select jsonb_build_array(
    jsonb_build_array(
      public._bot_btn('Reactivar', 'agent', p_phone_norm || ':reactivar'),
      public._bot_btn('Seguimiento', 'agent', p_phone_norm || ':seguimiento')
    ),
    jsonb_build_array(
      public._bot_btn('Callcenter', 'agent', p_phone_norm || ':callcenter'),
      public._bot_btn('Calificar', 'agent', p_phone_norm || ':calificar')
    ),
    jsonb_build_array(
      public._bot_btn('Quitar agente', 'agent', p_phone_norm || ':none'),
      public._bot_btn('← Volver', 'view', p_phone_norm)
    )
  );
$$;

-- Confirmación de un write pendiente
create or replace function public._bot_kb_confirm(p_token text)
returns jsonb language sql stable as $$
  select jsonb_build_array(
    jsonb_build_array(
      public._bot_btn('Sí, registrar', 'confirm', p_token),
      public._bot_btn('Cancelar', 'cancel', p_token)
    )
  );
$$;

-- Una lista de leads como botones (1 por fila)
create or replace function public._bot_kb_lead_list(p_leads jsonb)
returns jsonb language plpgsql stable as $$
declare v_kb jsonb; v_row jsonb;
begin
  v_kb := jsonb_build_array();
  for v_row in select * from jsonb_array_elements(coalesce(p_leads,'[]'::jsonb)) loop
    v_kb := v_kb || jsonb_build_array(
      jsonb_build_array(
        public._bot_btn(
          coalesce(v_row->>'name','(sin nombre)') || ' · ' || public._bot_fmt_phone(v_row->>'phone'),
          'view',
          regexp_replace(coalesce(v_row->>'phone',''),'[^0-9]','','g')
        )
      )
    );
  end loop;
  v_kb := v_kb || jsonb_build_array(jsonb_build_array(public._bot_btn('← Menú', 'menu', '_')));
  return v_kb;
end;
$$;

-- Botón solo "volver al menú"
create or replace function public._bot_kb_back()
returns jsonb language sql stable as $$
  select jsonb_build_array(jsonb_build_array(public._bot_btn('← Menú', 'menu', '_')));
$$;

-- ----------------------------------------------------------------------------
-- ENVUELVE UNA RPC ORIGINAL EN UN SOBRE { ok, data, reply }
-- ----------------------------------------------------------------------------

-- Helper genérico para envolver errores comunes en sobre estándar
create or replace function public._bot_err_envelope(p_inner jsonb)
returns jsonb language plpgsql stable as $$
declare v_code text; v_text text; v_kb jsonb;
begin
  v_code := p_inner->>'error';
  case v_code
    when 'not_paired' then
      v_text := 'Tu Telegram no está vinculado a una cuenta. Envíame /start para vincular.';
      v_kb := public._bot_kb_back();
    when 'lead_not_found' then
      v_text := 'No encontré ese cliente. Verifica el teléfono o búscalo por nombre.';
      v_kb := jsonb_build_array(
        jsonb_build_array(
          public._bot_btn('Buscar por nombre', 'searchprompt', '_'),
          public._bot_btn('← Menú', 'menu', '_')
        )
      );
    when 'lead_assigned_to_other_asesor' then
      v_text := 'Ese cliente está asignado a otro asesor. Pídele al director que lo reasigne desde el web.';
      v_kb := public._bot_kb_back();
    when 'query_too_short' then
      v_text := 'Necesito al menos 2 caracteres para buscar.';
      v_kb := public._bot_kb_back();
    when 'invalid_agent_key' then
      v_text := 'Agente inválido. Opciones: reactivar, seguimiento, callcenter, calificar.';
      v_kb := public._bot_kb_back();
    else
      v_text := 'Algo salió mal. Intenta en un minuto.';
      v_kb := public._bot_kb_back();
  end case;
  return jsonb_build_object(
    'ok', false,
    'code', v_code,
    'reply', jsonb_build_object('text', v_text, 'parse_mode', null, 'inline_keyboard', v_kb)
  );
end;
$$;

-- view: bot_get_lead_by_phone -> sobre con ficha + botones de acción
create or replace function public.bot_view_lead_v2(
  p_telegram_chat_id bigint,
  p_phone text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inner jsonb; v_lead public.leads; v_phone_norm text;
begin
  v_inner := public.bot_get_lead_by_phone(p_telegram_chat_id, p_phone);
  if v_inner ? 'error' then
    return public._bot_err_envelope(v_inner);
  end if;

  v_phone_norm := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  select * into v_lead from public.leads where id = (v_inner->>'lead_id')::uuid;

  return jsonb_build_object(
    'ok', true,
    'data', v_inner,
    'reply', jsonb_build_object(
      'text', public._bot_fmt_lead_card(v_lead),
      'parse_mode', null,
      'inline_keyboard', public._bot_kb_lead_card(v_phone_norm)
    )
  );
end;
$$;
grant execute on function public.bot_view_lead_v2(bigint, text) to service_role;

-- pending: bot_list_pending -> sobre con lista + botones por lead
create or replace function public.bot_list_pending_v2(
  p_telegram_chat_id bigint,
  p_window_hours integer default 24
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inner jsonb; v_leads jsonb; v_text text; v_row jsonb; v_lines text[];
begin
  v_inner := public.bot_list_pending(p_telegram_chat_id, p_window_hours);
  if v_inner ? 'error' then
    return public._bot_err_envelope(v_inner);
  end if;

  v_leads := coalesce(v_inner->'leads', v_inner->'data', '[]'::jsonb);
  if jsonb_array_length(v_leads) = 0 then
    return jsonb_build_object(
      'ok', true, 'data', v_inner,
      'reply', jsonb_build_object('text', 'No tienes pendientes en las próximas ' || p_window_hours || ' horas.',
                                  'parse_mode', null,
                                  'inline_keyboard', public._bot_kb_back())
    );
  end if;

  v_lines := array[jsonb_array_length(v_leads) || ' pendientes próximos:'];
  for v_row in select * from jsonb_array_elements(v_leads) loop
    v_lines := v_lines || ('· ' || coalesce(public._bot_fmt_when((v_row->>'next_action_at')::timestamptz), 'sin fecha') ||
                          ' — ' || coalesce(v_row->>'name','(sin nombre)') ||
                          ' · ' || coalesce(v_row->>'next_action','—'));
  end loop;

  return jsonb_build_object(
    'ok', true, 'data', v_inner,
    'reply', jsonb_build_object(
      'text', array_to_string(v_lines, E'\n'),
      'parse_mode', null,
      'inline_keyboard', public._bot_kb_lead_list(v_leads)
    )
  );
end;
$$;
grant execute on function public.bot_list_pending_v2(bigint, integer) to service_role;

-- dashboard: bot_get_dashboard_stats -> sobre con KPIs formateados
create or replace function public.bot_get_dashboard_stats_v2(
  p_telegram_chat_id bigint,
  p_scope text default 'me'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inner jsonb; v_lines text[];
begin
  v_inner := public.bot_get_dashboard_stats(p_telegram_chat_id, p_scope);
  if v_inner ? 'error' then
    return public._bot_err_envelope(v_inner);
  end if;

  v_lines := array[
    'Tus números (' || (v_inner->>'scope') || ')',
    '· ' || (v_inner->>'active') || ' leads en pipeline',
    '· ' || (v_inner->>'hot') || ' calientes',
    '· score promedio ' || (v_inner->>'avg_score'),
    '· pipeline ' || public._bot_fmt_money((v_inner->>'pipeline_value')::bigint),
    '',
    '· ' || (v_inner->>'pending_today') || ' pendientes hoy',
    '· ' || (v_inner->>'pending_overdue') || ' vencidos',
    '· ' || (v_inner->>'closed') || ' cerrados'
  ];

  return jsonb_build_object(
    'ok', true, 'data', v_inner,
    'reply', jsonb_build_object(
      'text', array_to_string(v_lines, E'\n'),
      'parse_mode', null,
      'inline_keyboard', jsonb_build_array(
        jsonb_build_array(
          public._bot_btn('Ver pendientes', 'pending', '_'),
          public._bot_btn('← Menú', 'menu', '_')
        )
      )
    )
  );
end;
$$;
grant execute on function public.bot_get_dashboard_stats_v2(bigint, text) to service_role;

-- search: bot_quick_search -> sobre con botones por resultado
create or replace function public.bot_quick_search_v2(
  p_telegram_chat_id bigint,
  p_query text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inner jsonb; v_results jsonb; v_text text; v_count int;
begin
  v_inner := public.bot_quick_search(p_telegram_chat_id, p_query, 10);
  if v_inner ? 'error' then
    return public._bot_err_envelope(v_inner);
  end if;

  v_results := coalesce(v_inner->'results', '[]'::jsonb);
  v_count := jsonb_array_length(v_results);

  if v_count = 0 then
    v_text := 'Sin coincidencias para "' || p_query || '".';
    return jsonb_build_object(
      'ok', true, 'data', v_inner,
      'reply', jsonb_build_object('text', v_text, 'parse_mode', null,
                                  'inline_keyboard', public._bot_kb_back())
    );
  end if;

  v_text := v_count || ' coincidencias para "' || p_query || '":';
  return jsonb_build_object(
    'ok', true, 'data', v_inner,
    'reply', jsonb_build_object(
      'text', v_text, 'parse_mode', null,
      'inline_keyboard', public._bot_kb_lead_list(v_results)
    )
  );
end;
$$;
grant execute on function public.bot_quick_search_v2(bigint, text) to service_role;

-- pipeline: bot_list_pipeline_summary -> conteo por etapa
create or replace function public.bot_list_pipeline_summary_v2(
  p_telegram_chat_id bigint
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inner jsonb; v_lines text[]; v_row jsonb;
begin
  v_inner := public.bot_list_pipeline_summary(p_telegram_chat_id);
  if v_inner ? 'error' then
    return public._bot_err_envelope(v_inner);
  end if;

  v_lines := array['Pipeline por etapa:'];
  for v_row in select * from jsonb_array_elements(coalesce(v_inner->'stages', v_inner->'data', '[]'::jsonb)) loop
    v_lines := v_lines || ('· ' || (v_row->>'stage') || ' — ' || (v_row->>'count'));
  end loop;

  return jsonb_build_object(
    'ok', true, 'data', v_inner,
    'reply', jsonb_build_object(
      'text', array_to_string(v_lines, E'\n'),
      'parse_mode', null,
      'inline_keyboard', public._bot_kb_back()
    )
  );
end;
$$;
grant execute on function public.bot_list_pipeline_summary_v2(bigint) to service_role;

-- expediente: bot_list_expediente -> lista de items del expediente
create or replace function public.bot_list_expediente_v2(
  p_telegram_chat_id bigint,
  p_phone text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inner jsonb; v_lines text[]; v_row jsonb; v_phone_norm text;
begin
  v_inner := public.bot_list_expediente(p_telegram_chat_id, p_phone, 10);
  if v_inner ? 'error' then
    return public._bot_err_envelope(v_inner);
  end if;

  v_phone_norm := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');

  if jsonb_array_length(coalesce(v_inner->'items','[]'::jsonb)) = 0 then
    return jsonb_build_object(
      'ok', true, 'data', v_inner,
      'reply', jsonb_build_object(
        'text', 'Sin items en el expediente de ' || (v_inner->>'lead_name') || '.',
        'parse_mode', null,
        'inline_keyboard', jsonb_build_array(
          jsonb_build_array(public._bot_btn('← Volver', 'view', v_phone_norm))
        )
      )
    );
  end if;

  v_lines := array['Expediente de ' || (v_inner->>'lead_name') || ':'];
  for v_row in select * from jsonb_array_elements(v_inner->'items') loop
    v_lines := v_lines || ('· ' || public._bot_fmt_when((v_row->>'created_at')::timestamptz) ||
                          ' [' || (v_row->>'tipo') || '] ' ||
                          substring(coalesce(v_row->>'descripcion', v_row->>'titulo', ''), 1, 80));
  end loop;

  return jsonb_build_object(
    'ok', true, 'data', v_inner,
    'reply', jsonb_build_object(
      'text', array_to_string(v_lines, E'\n'),
      'parse_mode', null,
      'inline_keyboard', jsonb_build_array(
        jsonb_build_array(public._bot_btn('← Volver', 'view', v_phone_norm))
      )
    )
  );
end;
$$;
grant execute on function public.bot_list_expediente_v2(bigint, text) to service_role;

-- history: bot_get_lead_history -> timeline
create or replace function public.bot_get_lead_history_v2(
  p_telegram_chat_id bigint,
  p_phone text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inner jsonb; v_lines text[]; v_row jsonb; v_phone_norm text;
begin
  v_inner := public.bot_get_lead_history(p_telegram_chat_id, p_phone, 15);
  if v_inner ? 'error' then
    return public._bot_err_envelope(v_inner);
  end if;

  v_phone_norm := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');

  if jsonb_array_length(coalesce(v_inner->'events','[]'::jsonb)) = 0 then
    return jsonb_build_object(
      'ok', true, 'data', v_inner,
      'reply', jsonb_build_object(
        'text', 'Sin historial de ' || (v_inner->>'lead_name') || '.',
        'parse_mode', null,
        'inline_keyboard', jsonb_build_array(jsonb_build_array(public._bot_btn('← Volver', 'view', v_phone_norm)))
      )
    );
  end if;

  v_lines := array['Historial de ' || (v_inner->>'lead_name') || ':'];
  for v_row in select * from jsonb_array_elements(v_inner->'events') loop
    v_lines := v_lines || ('· ' || public._bot_fmt_when((v_row->>'occurred_at')::timestamptz) ||
                          ' — ' || coalesce(v_row->>'action', v_row->>'type'));
  end loop;

  return jsonb_build_object(
    'ok', true, 'data', v_inner,
    'reply', jsonb_build_object(
      'text', array_to_string(v_lines, E'\n'),
      'parse_mode', null,
      'inline_keyboard', jsonb_build_array(jsonb_build_array(public._bot_btn('← Volver', 'view', v_phone_norm)))
    )
  );
end;
$$;
grant execute on function public.bot_get_lead_history_v2(bigint, text) to service_role;

-- tasks: bot_list_tasks -> lista con checkboxes (botón completar por tarea)
create or replace function public.bot_list_tasks_v2(
  p_telegram_chat_id bigint,
  p_phone text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inner jsonb; v_lines text[]; v_row jsonb; v_phone_norm text; v_kb jsonb;
begin
  v_inner := public.bot_list_tasks(p_telegram_chat_id, p_phone, true);
  if v_inner ? 'error' then
    return public._bot_err_envelope(v_inner);
  end if;

  v_phone_norm := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  v_kb := jsonb_build_array();

  if jsonb_array_length(coalesce(v_inner->'tasks','[]'::jsonb)) = 0 then
    return jsonb_build_object(
      'ok', true, 'data', v_inner,
      'reply', jsonb_build_object(
        'text', 'Sin tareas pendientes para ' || (v_inner->>'lead_name') || '.',
        'parse_mode', null,
        'inline_keyboard', jsonb_build_array(
          jsonb_build_array(
            public._bot_btn('Agregar tarea', 'taskprompt', v_phone_norm),
            public._bot_btn('← Volver', 'view', v_phone_norm)
          )
        )
      )
    );
  end if;

  v_lines := array['Tareas pendientes — ' || (v_inner->>'lead_name') || ':'];
  for v_row in select * from jsonb_array_elements(v_inner->'tasks') loop
    v_lines := v_lines || ('· ' || (v_row->>'text') ||
                          case when v_row->>'due_at' is not null
                               then ' — ' || public._bot_fmt_when((v_row->>'due_at')::timestamptz)
                               else '' end);
    v_kb := v_kb || jsonb_build_array(jsonb_build_array(
      public._bot_btn('Completar: ' || substring(v_row->>'text', 1, 30), 'taskdone', v_row->>'id')
    ));
  end loop;
  v_kb := v_kb || jsonb_build_array(jsonb_build_array(public._bot_btn('← Volver', 'view', v_phone_norm)));

  return jsonb_build_object(
    'ok', true, 'data', v_inner,
    'reply', jsonb_build_object('text', array_to_string(v_lines, E'\n'),
                                'parse_mode', null,
                                'inline_keyboard', v_kb)
  );
end;
$$;
grant execute on function public.bot_list_tasks_v2(bigint, text) to service_role;

-- Helper: respuesta para el menú raíz
create or replace function public.bot_render_menu()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'ok', true,
    'reply', jsonb_build_object(
      'text', 'Hola. ¿Qué necesitas?' || E'\n' ||
              '· Toca un botón o escríbeme libremente.',
      'parse_mode', null,
      'inline_keyboard', public._bot_kb_root_menu()
    )
  );
$$;
grant execute on function public.bot_render_menu() to service_role;

-- ----------------------------------------------------------------------------
-- FIN DE LA MIGRACIÓN 009
-- ----------------------------------------------------------------------------
-- Funciones expuestas al bot tras esta migración:
--   _bot_fmt_phone, _bot_fmt_money, _bot_fmt_when, _bot_fmt_lead_card
--   _bot_hmac8, _bot_cb_sign, _bot_cb_verify
--   _bot_btn, _bot_kb_root_menu, _bot_kb_lead_card, _bot_kb_stage_picker,
--   _bot_kb_agent_picker, _bot_kb_confirm, _bot_kb_lead_list, _bot_kb_back
--   _bot_stage_from_slug, _bot_err_envelope
--   bot_view_lead_v2, bot_list_pending_v2, bot_get_dashboard_stats_v2,
--   bot_quick_search_v2, bot_list_pipeline_summary_v2, bot_list_expediente_v2,
--   bot_get_lead_history_v2, bot_list_tasks_v2, bot_render_menu
--
-- Las RPCs originales (bot_get_lead_by_phone, bot_list_pending, etc.) NO se tocaron.
-- ============================================================================
