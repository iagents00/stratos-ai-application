-- ─────────────────────────────────────────────────────────────────────────────
-- 227_cada_area_tiene_su_espacio.sql
--
-- Da de alta el ESPACIO DE ÁREA: el mismo patrón que ya usa el equipo de Alex
-- (Actividades + Mi Día + Copilot), pero para el resto de las áreas de Duke
-- —Comercial, Operativo, Administrativo, Finanzas, RRHH— que a partir del
-- 30-jul-2026 llevan su Plan de Trabajo Semanal dentro de Stratos.
--
-- Qué hace, en orden:
--   1) `profiles.area` — a qué área pertenece la persona. Es lo que decide qué
--      Drive ve en su espacio y con qué «Puesto/Área» se prellena su reporte.
--   2) Rol `colaborador` — la gente de área. NO es marketing (no ve el pipeline
--      de video), NO es asesor (no ve el CRM de ventas). Solo su espacio.
--   3) `is_marketing_or_above()` lo incluye → RLS de las tablas mkt_* (que es el
--      motor de actividades/tareas) y del bucket `evidencia`. Sigue siendo
--      org-scoped: un colaborador de Duke jamás ve datos de otro tenant, y
--      NINGUNA tabla de ventas (leads, brokers, zoom_*) pasa por esta función.
--   4) `mkt_nlu_dispatch` acepta el rol → su Copilot puede crear tareas, cerrar
--      pendientes, reportar la bitácora del día y pedir su día.
--
-- ⚠️ MARKETING ≠ VENTAS sigue intacto: no se toca ningún objeto de ventas, ni
--    `is_marketing_admin` (los avisos de líder de marketing siguen siendo de
--    Alex y de nadie más).
--
-- Idempotente: se puede correr varias veces sin efecto extra.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) El área de cada persona ───────────────────────────────────────────────
alter table public.profiles add column if not exists area text;

comment on column public.profiles.area is
  'Área a la que pertenece la persona (Marketing, Comercial, Operativo, Administrativo, Finanzas, RRHH). Decide qué Drive ve en su espacio y prellena el «Puesto/Área» de su reporte diario.';

-- ── 2) Rol `colaborador` ─────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array[
    'super_admin'::text, 'admin'::text, 'ceo'::text,
    'director'::text, 'asesor'::text, 'marketing'::text,
    'colaborador'::text
  ]));

-- ── 3) RLS del motor de actividades: el colaborador entra ────────────────────
-- Esta función gobierna EXCLUSIVAMENTE las tablas mkt_* y el bucket `evidencia`
-- (verificado contra pg_policies el 30-jul-2026). Agregar el rol acá le da a la
-- gente de área su bitácora y sus tareas, y nada más.
create or replace function public.is_marketing_or_above()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('super_admin','admin','marketing','colaborador')
  );
$function$;

-- ── 4) El Copilot le contesta al colaborador ─────────────────────────────────
-- `mkt_nlu_dispatch` es un bicho de ~200 líneas que crece seguido. En vez de
-- reescribirlo entero (y arriesgarme a pisar lo último que le agregaron), leo su
-- definición VIVA y le parcheo solo la lista de roles. Si alguien ya lo dejó
-- listo, no hace nada.
do $$
declare
  v_def  text;
  v_from text := 'v_profile.role not in (''marketing'',''super_admin'',''admin'')';
  v_to   text := 'v_profile.role not in (''marketing'',''super_admin'',''admin'',''colaborador'')';
begin
  select pg_get_functiondef(oid) into v_def
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname = 'mkt_nlu_dispatch'
  limit 1;

  if v_def is null then
    raise exception 'mkt_nlu_dispatch no existe — abortando (revisar antes de seguir)';
  end if;

  -- Ya parcheada → nada que hacer.
  if position('''colaborador''' in v_def) > 0 then
    raise notice '227: mkt_nlu_dispatch ya acepta colaborador, sin cambios';
    return;
  end if;

  if position(v_from in v_def) = 0 then
    raise exception '227: no encontré la guarda de roles en mkt_nlu_dispatch — la cambiaron de forma; parchear a mano';
  end if;

  v_def := replace(v_def, v_from, v_to);
  -- El texto del rechazo también deja de hablar solo de marketing.
  v_def := replace(
    v_def,
    'Este asistente es del equipo de marketing. Tu usuario no tiene ese rol.',
    'Este asistente es para el equipo interno. Tu usuario no tiene un rol con acceso.'
  );
  execute v_def;
  raise notice '227: mkt_nlu_dispatch parchada — colaborador aceptado';
end $$;

-- ── Validación post-apply (correr a mano y leer la salida) ───────────────────
--   select 'rol' k, pg_get_constraintdef(oid) v from pg_constraint where conname='profiles_role_check'
--   union all
--   select 'rls', pg_get_functiondef(oid) from pg_proc
--    where proname='is_marketing_or_above' and pronamespace='public'::regnamespace
--   union all
--   select 'copilot', case when position('''colaborador''' in pg_get_functiondef(oid))>0
--                          then 'OK acepta colaborador' else 'FALTA' end
--     from pg_proc where proname='mkt_nlu_dispatch' and pronamespace='public'::regnamespace;
--
-- ── Rollback ─────────────────────────────────────────────────────────────────
--   1) Quitar el rol de la RLS:
--      create or replace function public.is_marketing_or_above() ... role in
--        ('super_admin','admin','marketing');   -- sin 'colaborador'
--   2) Devolver la guarda del Copilot con el mismo DO block al revés.
--   3) El CHECK y `profiles.area` se pueden dejar: no molestan a nadie. Si se
--      quita el rol del CHECK, primero hay que reasignar a la gente que lo tenga.
