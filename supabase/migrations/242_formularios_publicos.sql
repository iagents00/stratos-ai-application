-- ═══════════════════════════════════════════════════════════════════════════
-- FORMULARIOS PÚBLICOS — las respuestas llegan al CRM (1-sep-2026)
--
-- QUÉ RESUELVE:
--   NSG manda a sus prospectos un cuestionario de configuración del AI Call
--   Center (stratoscapitalgroup.com/onboarding-call-center). Hasta hoy eso era
--   un Word que el cliente llenaba y devolvía por WhatsApp — o no devolvía.
--   Ahora el cliente lo contesta en la web y la respuesta:
--     1. queda guardada aquí (form_respuestas), completa, con fecha;
--     2. crea o actualiza el lead en el CRM de Stratos Sales, con el resumen
--        en las notas, para que aparezca en el pipeline de quien vende;
--     3. la edge function `form-submit` avisa por correo al equipo.
--
-- SUPERFICIE ANÓNIMA: cero. El navegador no escribe en esta tabla ni ejecuta
--   la función: solo la edge function (service_role). La llave pública del
--   bundle no abre esta puerta. Los admins de la organización leen sus filas.
--
-- ABUSO: un formulario público lo puede llenar cualquiera. Tope de 5 envíos
--   por correo cada 24 h; lo demás (honeypot, tamaños) lo filtra la función.
--
-- Reversa:
--   drop function public.fn_form_guardar_respuesta(uuid,text,jsonb,jsonb,jsonb);
--   drop table public.form_respuestas;
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.form_respuestas (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  formulario       text not null,                 -- slug: 'onboarding-call-center'
  empresa          text,
  responsable      text,
  email            text,
  whatsapp         text,
  respuestas       jsonb not null default '{}'::jsonb,
  meta             jsonb not null default '{}'::jsonb,   -- url, duración, user agent, resumen
  lead_id          uuid references public.leads(id) on delete set null,
  notificado_at    timestamptz,                   -- cuándo salió el correo al equipo
  created_at       timestamptz not null default now()
);

comment on table public.form_respuestas is
  'Respuestas de formularios públicos (onboarding AI Call Center, etc.). Solo escribe la edge function form-submit.';

create index if not exists form_respuestas_org_fecha_idx
  on public.form_respuestas (organization_id, created_at desc);
create index if not exists form_respuestas_email_idx
  on public.form_respuestas (lower(email), created_at desc);

alter table public.form_respuestas enable row level security;

drop policy if exists form_respuestas_select_admin on public.form_respuestas;
create policy form_respuestas_select_admin on public.form_respuestas
  for select using (organization_id = current_organization_id() and is_admin_or_above());

-- Supabase le da todo a anon/authenticated por defecto en tablas nuevas. Aquí no.
revoke all on table public.form_respuestas from anon;
revoke all on table public.form_respuestas from authenticated;
grant select on table public.form_respuestas to authenticated;   -- filtrado por la policy
grant all on table public.form_respuestas to service_role;


-- ── Guardar la respuesta y dejarla en el CRM ─────────────────────────────────
create or replace function public.fn_form_guardar_respuesta(
  p_org_id      uuid,
  p_formulario  text,
  p_contacto    jsonb,
  p_respuestas  jsonb,
  p_meta        jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id       uuid;
  v_lead     uuid;
  v_email    text;
  v_tel      text;
  v_nombre   text;
  v_empresa  text;
  v_resumen  text;
  v_recientes int;
begin
  if p_org_id is null or coalesce(p_formulario, '') = '' then
    raise exception 'organización y formulario son obligatorios';
  end if;

  v_email   := nullif(lower(trim(p_contacto->>'email')), '');
  v_tel     := nullif(regexp_replace(coalesce(p_contacto->>'whatsapp', ''), '[^0-9+]', '', 'g'), '');
  v_nombre  := coalesce(nullif(trim(p_contacto->>'responsable'), ''), 'Sin nombre');
  v_empresa := nullif(trim(p_contacto->>'empresa'), '');
  v_resumen := coalesce(p_meta->>'resumen', '');

  -- Tope de abuso: el mismo correo no manda más de 5 veces al día.
  if v_email is not null then
    select count(*) into v_recientes
    from form_respuestas
    where lower(email) = v_email and created_at > now() - interval '24 hours';
    if v_recientes >= 5 then
      raise exception 'demasiados envíos para este correo, intenta mañana';
    end if;
  end if;

  insert into form_respuestas (organization_id, formulario, empresa, responsable, email, whatsapp, respuestas, meta)
  values (p_org_id, p_formulario, v_empresa, v_nombre, v_email, v_tel, coalesce(p_respuestas, '{}'::jsonb), coalesce(p_meta, '{}'::jsonb))
  returning id into v_id;

  -- ¿Ya existe en el CRM? Por correo o por teléfono, dentro de la misma empresa.
  select id into v_lead
  from leads
  where organization_id = p_org_id
    and deleted_at is null
    and (
      (v_email is not null and lower(email) = v_email)
      or (v_tel is not null and (phone = v_tel or whatsapp_phone_e164 = v_tel))
    )
  order by created_at desc
  limit 1;

  if v_lead is null then
    insert into leads (
      organization_id, name, email, phone, whatsapp_phone_e164,
      stage, source, hot, project, tag,
      notas, contexto_previo,
      next_action, next_action_at, fecha_ingreso
    ) values (
      p_org_id,
      v_nombre || case when v_empresa is not null then ' · ' || v_empresa else '' end,
      v_email, v_tel, v_tel,
      'Nuevo Registro', 'formulario_' || replace(p_formulario, '-', '_'), true,
      'AI Call Center', 'Onboarding AI Call Center',
      v_resumen, v_resumen,
      'Revisar el cuestionario de onboarding y preparar la propuesta',
      now() + interval '1 day', now()
    )
    returning id into v_lead;
  else
    update leads set
      hot            = true,
      notas          = case when coalesce(notas, '') = '' then v_resumen else notas || E'\n\n' || v_resumen end,
      next_action    = 'Revisar el cuestionario de onboarding y preparar la propuesta',
      next_action_at = now() + interval '1 day',
      updated_at     = now()
    where id = v_lead;
  end if;

  update form_respuestas set lead_id = v_lead where id = v_id;

  return jsonb_build_object('respuesta_id', v_id, 'lead_id', v_lead);
end;
$$;

comment on function public.fn_form_guardar_respuesta(uuid,text,jsonb,jsonb,jsonb) is
  'Guarda una respuesta de formulario público y la refleja como lead en el CRM. Solo service_role (edge function form-submit).';

revoke all on function public.fn_form_guardar_respuesta(uuid,text,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.fn_form_guardar_respuesta(uuid,text,jsonb,jsonb,jsonb) to service_role;
