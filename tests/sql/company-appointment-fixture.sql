create schema auth; create role anon; create role authenticated; create role service_role;
create function auth.role() returns text language sql stable as $$ select coalesce(current_setting('request.jwt.claim.role',true),'service_role') $$;
create sequence tg_bot_activity_id_seq;
create table leads("id" uuid default gen_random_uuid() not null,"name" text not null,"email" text,"phone" text,"source" text default 'manual'::text,"stage" text default 'Nuevo Registro'::text not null,"score" integer default 50 not null,"hot" boolean default false not null,"is_new" boolean default true not null,"presupuesto" bigint default 0,"project" text,"campaign" text,"seguimientos" integer default 0 not null,"next_action" text,"next_action_date" text,"last_activity" text,"days_inactive" integer default 0 not null,"ai_agent" text,"asesor_name" text,"action_history" jsonb default '[]'::jsonb not null,"tasks" jsonb default '[]'::jsonb not null,"bio" text,"risk" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"deleted_at" timestamp with time zone,"budget" text,"notas" text,"friction" text,"tag" text,"priority" text,"priority_order" integer,"asesor_id" uuid,"organization_id" uuid not null,"telegram_user_id" bigint,"phone_normalized" text,"next_action_at" timestamp with time zone,"playbook" jsonb default '[]'::jsonb not null,"fecha_ingreso" timestamp with time zone,"project_id" uuid,"campaign_id" uuid,"whatsapp_phone_e164" text,"whatsapp_wa_id" text,"voice_phone_e164" character varying(20),"chatwoot_conversation_id" integer,"call_attempts" integer default 0 not null,"diagnostico_payload" jsonb,"diagnostico_score" integer,"diagnostico_nivel" text,"diagnostico_recomendacion" text,"dolor_principal" text,"contexto_previo" text,"cal_event_id" text,"cal_event_url" text,"zoom_join_url" text,"selected_time" timestamp with time zone,"do_not_contact" boolean default false,"urgency_status" text,"reminder_24h_sent_at" timestamp with time zone,"reminder_3h_sent_at" timestamp with time zone,"reminder_1h_sent_at" timestamp with time zone,"reminder_10min_sent_at" timestamp with time zone,"internal_reminder_3h_sent_at" timestamp with time zone,"internal_reminder_1h_sent_at" timestamp with time zone,"internal_reminder_5min_sent_at" timestamp with time zone,"visita_at" timestamp with time zone,"score_calc" integer,"hot_auto" boolean default false,"score_managed" boolean default false not null,"meta_lead_id" text,"meta_form_id" text,"meta_page_id" text,"meta_campaign_id" text,"meta_adset_id" text,"meta_ad_id" text,"id_document" text,"id_document_path" text,"clasificacion" text,"clasificacion_razon" text,"clasificacion_at" timestamp with time zone,"sprint_toques" integer default 0 not null,"sprint_ultimo_canal" text,"sprint_inicio" timestamp with time zone,"nurture_desde" timestamp with time zone,"reactivar_at" timestamp with time zone,"enganche_liquido" bigint,"enganche_disponible" boolean,"uso" text,"codecisor_nombre" text,"codecisor_relacion" text,"criterios_decision" jsonb,"nivel_duda" text,"opt_out" boolean default false not null,"sprint_ultimo_contacto_at" timestamp with time zone,"whatsapp_bsuid" text,"whatsapp_username" text);
create table org_stages("id" uuid default gen_random_uuid() not null,"organization_id" uuid not null,"orden" integer not null,"nombre" text not null,"color" text,"activo" boolean default true not null,"created_at" timestamp with time zone default now() not null,"deleted_at" timestamp with time zone,"grupo" text);
create table organizations("id" uuid default gen_random_uuid() not null,"name" text not null,"slug" text not null,"plan" text default 'starter'::text not null,"seats" integer default 5 not null,"active" boolean default true not null,"logo_url" text,"primary_color" text,"stripe_customer_id" text,"stripe_subscription_id" text,"trial_ends_at" timestamp with time zone,"subscription_status" text default 'trial'::text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"meta_config" jsonb,"parent_organization_id" uuid);
create table platform_admin_events("id" uuid default gen_random_uuid() not null,"event_type" text not null,"actor_user_id" uuid not null,"partner_organization_id" uuid,"organization_id" uuid,"payload" jsonb default '{}'::jsonb not null,"notification_status" text default 'pending'::text not null,"notification_attempts" integer default 0 not null,"notification_error" text,"notified_at" timestamp with time zone,"created_at" timestamp with time zone default now() not null);
create table platform_admins("user_id" uuid not null,"active" boolean default true not null,"granted_by" uuid,"granted_at" timestamp with time zone default now() not null,"note" text,"scope_organization_id" uuid,"company_limit" integer,"support_only" boolean default true not null);
create table proactive_config("organization_id" uuid not null,"enabled" boolean default false not null,"inactivity_days" integer default 3 not null,"inactivity_signal" text default 'updated_at'::text not null,"zoom_reminder_hours" numeric default 3 not null,"zoom_escalation_minutes" integer default 30 not null,"zoom_stage_label" text default 'Zoom Agendado'::text not null,"quiet_start_hour" integer default 21 not null,"quiet_end_hour" integer default 8 not null,"timezone" text default 'America/Cancun'::text not null,"shadow_mode" boolean default true not null,"test_telegram_id" bigint,"test_asesor_names" text[] default ARRAY['iAgents'::text] not null,"terminal_stages" text[] default ARRAY['Cierre'::text, 'Rotación'::text, 'Postventa'::text] not null,"updated_at" timestamp with time zone default now() not null,"demo_lead_id" uuid,"manager_telegram_id" bigint,"inactivity_exclude_stages" text[] default ARRAY[]::text[],"inactivity_hours" integer,"inactivity_include_stages" text[],"team_requires_evidence" boolean default false not null,"expenses_enabled" boolean default false not null,"team_reminder_offsets" integer[] default ARRAY[60, 10],"team_notify_on_assign" boolean default false not null);
create table proactive_pending_reports("id" uuid default gen_random_uuid() not null,"organization_id" uuid not null,"advisor_telegram_id" bigint not null,"lead_id" uuid,"reminder_id" uuid,"status" text default 'open'::text not null,"outcome" text,"expires_at" timestamp with time zone,"created_at" timestamp with time zone default now() not null,"escalated_at" timestamp with time zone,"kind" text);
create table proactive_reminders("id" uuid default gen_random_uuid() not null,"organization_id" uuid not null,"lead_id" uuid,"asesor_id" uuid,"asesor_name" text,"tipo" text not null,"scheduled_at" timestamp with time zone default now() not null,"status" text default 'pending'::text not null,"payload" jsonb default '{}'::jsonb not null,"dedupe_key" text,"ignore_quiet" boolean default false not null,"attempts" integer default 0 not null,"sent_at" timestamp with time zone,"created_at" timestamp with time zone default now() not null);
create table profiles("id" uuid not null,"name" text not null,"role" text default 'asesor'::text not null,"phone" text,"active" boolean default true not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"organization_id" uuid not null,"telegram_chat_id" bigint,"telegram_pairing_code" character varying(8),"telegram_pairing_expires_at" timestamp with time zone,"telegram_paired_at" timestamp with time zone,"view_all_leads" boolean default false not null,"crm_prefs" jsonb default '{}'::jsonb not null,"crm_only" boolean default false not null,"timezone" text default 'America/Cancun'::text not null,"recovery_email" text,"receives_sales_alerts" boolean default true not null,"is_marketing_admin" boolean default false not null,"work_start" time without time zone,"work_end" time without time zone,"work_tz" text,"alias" text[],"area" text);
create table tg_bot_activity("id" bigint default nextval('tg_bot_activity_id_seq'::regclass) not null,"organization_id" uuid,"telegram_chat_id" bigint,"role" text,"content" text,"created_at" timestamp with time zone default now(),"media_path" text,"media_type" text,"meta" jsonb);
alter table organizations add primary key(id); alter table profiles add primary key(id); alter table org_stages add primary key(id); alter table org_stages add unique(organization_id,nombre); alter table org_stages add unique(organization_id,orden); alter table proactive_config add primary key(organization_id); alter table proactive_reminders add primary key(id); alter table proactive_reminders add unique(dedupe_key);
create function fn_effective_org_stages(p_org uuid) returns table(organization_id uuid,nombre text,orden int,activo boolean,deleted_at timestamptz,grupo text) language sql stable as $$ select p_org,s->>'name',ord::int,true,null::timestamptz,null::text from organizations o,jsonb_array_elements(o.meta_config#>'{crm,pipeline}') with ordinality x(s,ord) where o.id=p_org $$;
create function fn_platform_crm_pipeline(p_organization_id uuid) returns jsonb language sql stable as $$ select meta_config#>'{crm,pipeline}' from organizations where id=p_organization_id $$;
create function unaccent(text) returns text language sql immutable as $$select $1$$;
create function fn_fmt_fecha_legible(timestamptz) returns text language sql as $$select $1::text$$;
create function fn_fmt_cuando_legible(timestamptz,text) returns text language sql as $$select $1::text$$;
create function fn_mkt_in_window(uuid,timestamptz) returns boolean language sql as $$select true$$;
create function fn_lead_briefing_text(uuid) returns text language sql as $$select 'Cliente: '||name from leads where id=$1$$;
create function fn_log_proactive_copilot(bigint,text,text) returns jsonb language sql as $$insert into tg_bot_activity(telegram_chat_id,content,role) values($1,$2,$3) returning '{}'::jsonb$$;
create function fn_proactive_scan_inactive(jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;
create function fn_proactive_scan_insist(jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;
create function fn_proactive_scan_next_action_escalations(jsonb) returns jsonb language sql as $$select '{"escalations":[]}'::jsonb$$;
CREATE OR REPLACE FUNCTION public.fn_proactive_scan_zooms(payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid := COALESCE(NULLIF(payload->>'organization_id','')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%ROWTYPE;
  v_enqueued int := 0;
BEGIN
  SELECT * INTO v_cfg FROM public.proactive_config WHERE organization_id = v_org_id;
  IF NOT FOUND OR NOT v_cfg.enabled THEN
    RETURN jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'disabled');
  END IF;
  WITH candidates AS (
    SELECT l.id, l.asesor_id, l.asesor_name, l.name AS lead_name, l.next_action_at,
           GREATEST(l.next_action_at - (v_cfg.zoom_reminder_hours * interval '1 hour'), now()) AS fire_at
    FROM public.leads l
    WHERE l.organization_id = v_org_id
      AND l.deleted_at IS NULL
      AND lower(l.stage) = lower(v_cfg.zoom_stage_label)
      AND l.next_action_at IS NOT NULL
      AND l.next_action_at > now()
      AND l.next_action_at <= now() + interval '24 hours'
      AND (NOT v_cfg.shadow_mode OR l.asesor_name = ANY (v_cfg.test_asesor_names))
  ),
  admins AS (
    SELECT p.id, p.name FROM public.profiles p
    WHERE p.organization_id = v_org_id AND COALESCE(p.active,true)=true
      AND p.role IN ('super_admin','admin','ceo','director') AND p.telegram_chat_id IS NOT NULL
      AND COALESCE(p.receives_sales_alerts,true)
  ),
  ins AS (
    INSERT INTO public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    SELECT v_org_id, c.id, c.asesor_id, c.asesor_name, 'zoom_brief', c.fire_at,
           'zoom_brief:' || c.id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI'),
           true, jsonb_build_object('zoom_at', c.next_action_at, 'zoom_at_fmt', public.fn_fmt_fecha_legible(c.next_action_at))
    FROM candidates c
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ),
  ins_admin AS (
    INSERT INTO public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    SELECT v_org_id, c.id, a.id, a.name, 'zoom_brief', c.fire_at,
           'zoom_brief:' || c.id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI') || ':admincc:' || a.id::text,
           true, jsonb_build_object('zoom_at', c.next_action_at, 'zoom_at_fmt', public.fn_fmt_fecha_legible(c.next_action_at), 'admin_cc', true)
    FROM candidates c CROSS JOIN admins a
    WHERE c.asesor_id IS NULL AND (c.asesor_name IS NULL OR btrim(c.asesor_name) = '')
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ),
  t1h AS (
    SELECT c.*,
           EXISTS (SELECT 1 FROM public.proactive_pending_reports o
                   WHERE o.organization_id=v_org_id AND o.lead_id=c.id
                     AND o.kind IN ('zoom_brief','awaiting_plan') AND o.status='open') AS plan_missing
    FROM candidates c
    WHERE c.next_action_at <= now() + interval '1 hour'
  ),
  ins_1h AS (
    INSERT INTO public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    SELECT v_org_id, c.id, c.asesor_id, c.asesor_name,
           CASE WHEN c.plan_missing THEN 'zoom_1h_missing' ELSE 'zoom_1h_ok' END,
           now(),
           'zoom_1h:' || c.id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI'),
           true,
           jsonb_build_object('zoom_at', c.next_action_at, 'zoom_at_fmt', public.fn_fmt_fecha_legible(c.next_action_at), 'text',
             CASE WHEN c.plan_missing
               THEN 'En 1 hora el Zoom de '||coalesce(c.lead_name,'tu cliente')||' y todavía no cargaste el plan. Armalo ya para llegar listo.'
               ELSE 'En 1 hora tu Zoom con '||coalesce(c.lead_name,'tu cliente')||'. Plan listo — repasá los puntos clave y a darle.' END)
    FROM t1h c
    WHERE c.asesor_id IS NOT NULL OR (c.asesor_name IS NOT NULL AND btrim(c.asesor_name) <> '')
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ),
  ins_1h_admin AS (
    INSERT INTO public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    SELECT v_org_id, c.id, a.id, a.name, 'zoom_1h_missing', now(),
           'zoom_1h:' || c.id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI') || ':admincc:' || a.id::text,
           true,
           jsonb_build_object('zoom_at', c.next_action_at, 'zoom_at_fmt', public.fn_fmt_fecha_legible(c.next_action_at), 'admin_cc', true, 'text',
             ''||coalesce(c.asesor_name,'Un asesor')||' tiene Zoom en 1h con '||coalesce(c.lead_name,'un cliente')||' y NO cargó el plan.')
    FROM t1h c CROSS JOIN admins a
    WHERE c.plan_missing
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  ),
  t15 AS (
    SELECT c.* FROM candidates c WHERE c.next_action_at <= now() + interval '15 minutes'
  ),
  ins_15 AS (
    INSERT INTO public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    SELECT v_org_id, c.id, c.asesor_id, c.asesor_name, 'zoom_15min', now(),
           'zoom_15min:' || c.id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI'),
           true,
           jsonb_build_object('zoom_at', c.next_action_at, 'zoom_at_fmt', public.fn_fmt_fecha_legible(c.next_action_at), 'text',
             'En 15 min tu Zoom con '||coalesce(c.lead_name,'tu cliente')||'. Last check: link, cámara y el plan a mano.')
    FROM t15 c
    WHERE c.asesor_id IS NOT NULL OR (c.asesor_name IS NOT NULL AND btrim(c.asesor_name) <> '')
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_enqueued FROM (
    SELECT 1 FROM ins UNION ALL SELECT 1 FROM ins_admin
    UNION ALL SELECT 1 FROM ins_1h UNION ALL SELECT 1 FROM ins_1h_admin
    UNION ALL SELECT 1 FROM ins_15
  ) z;
  RETURN jsonb_build_object('ok', true, 'enqueued', v_enqueued, 'organization_id', v_org_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_proactive_next_action_reminders(payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid := coalesce(nullif(payload->>'organization_id','')::uuid,'00000000-0000-0000-0000-000000000001'::uuid);
  v_cfg public.proactive_config%rowtype; v_enq int := 0;
begin
  select * into v_cfg from public.proactive_config where organization_id = v_org;
  if not found or not v_cfg.enabled then return jsonb_build_object('ok', true, 'enqueued', 0, 'reason', 'disabled'); end if;
  with candidates as (
    select l.id as lead_id, l.asesor_id, l.asesor_name, l.name as lead_name, l.next_action, l.next_action_at,
           pf.telegram_chat_id as advisor_telegram_id, k.kind, k.win_start, k.win_end
    from public.leads l
    join public.profiles pf on pf.id = l.asesor_id and pf.organization_id = v_org
    cross join lateral (values
        ('next_action_3h',    l.next_action_at - interval '3 hours',    l.next_action_at - interval '10 minutes'),
        ('next_action_10min', l.next_action_at - interval '10 minutes', l.next_action_at)
      ) as k(kind, win_start, win_end)
    where l.organization_id = v_org and l.deleted_at is null and l.asesor_name is not null and l.next_action_at is not null
      and now() >= k.win_start and now() < k.win_end
      and lower(coalesce(l.stage,'')) <> lower(v_cfg.zoom_stage_label)
      and not exists (select 1 from unnest(v_cfg.terminal_stages) t where lower(t) = lower(l.stage))
      and (not v_cfg.shadow_mode or l.asesor_name = any (v_cfg.test_asesor_names))
      and coalesce(pf.active,true) = true and pf.telegram_chat_id is not null
  ),
  ins_queue as (
    insert into public.proactive_reminders (organization_id, lead_id, asesor_id, asesor_name, tipo, scheduled_at, dedupe_key, ignore_quiet, payload)
    select v_org, c.lead_id, c.asesor_id, c.asesor_name, c.kind, now(),
           c.kind || ':' || c.lead_id::text || ':' || to_char(c.next_action_at, 'YYYYMMDDHH24MI'),
           (c.kind = 'next_action_10min'),
           jsonb_build_object('next_action_at', c.next_action_at, 'next_action', c.next_action, 'lead_name', c.lead_name, 'advisor_telegram_id', c.advisor_telegram_id)
    from candidates c
    on conflict (dedupe_key) do nothing returning 1
  )
  select count(*) into v_enq from ins_queue;
  return jsonb_build_object('ok', true, 'enqueued', v_enq, 'organization_id', v_org);
end; $function$;
