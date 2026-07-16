-- ═══════════════════════════════════════════════════════════════════════════
-- 101_fn_claim_lead_admin_only.sql — Reclamar/reasignar un cliente ajeno = SOLO admin
-- ═══════════════════════════════════════════════════════════════════════════
-- Regla de negocio (jul 2026):
--   Un cliente que YA está en el CRM a nombre de OTRO asesor solo puede ser
--   registrado/reasignado por un ADMINISTRADOR (super_admin / admin / ceo /
--   director). Un asesor NO puede "quedárselo": debe pedírselo a un admin.
--
-- Por qué el candado va DENTRO de la función (y no solo en el frontend):
--   fn_claim_lead es SECURITY DEFINER — corre con permisos del owner y BYPASSA
--   la RLS de leads_update. Por eso, sin este guard, cualquier asesor
--   autenticado podía llamar el RPC directo (consola del navegador, script) y
--   reclamar un lead de otro asesor, aunque el botón no apareciera en la UI.
--   "La seguridad son LLAVES, no prompts": el gate visual no basta; la llave
--   real es que la función lo rechace.
--
-- is_admin_or_above() (migración 004): STABLE + SECURITY DEFINER, devuelve true
--   para super_admin/admin/ceo/director. Es el MISMO set que `isAdminRole` en el
--   frontend, así que ambas capas quedan consistentes.
--
-- Alcance / seguridad:
--   · La función es idéntica a la versión previa salvo el nuevo guard de rol.
--   · Único caller real: el override "Registrar de todas formas" del CRM
--     (src/app/views/CRM/index.jsx), que corre con el JWT del usuario logueado.
--     Ninguna otra función/edge/flujo la invoca (verificado en pg_proc y en
--     supabase/functions). No usa service_role (ya exigía auth.uid()+org).
--   · Reversible: CREATE OR REPLACE. La versión previa (sin el guard) está en el
--     changelog 2026-06-25 y en el historial de Git.
--   · Aplicada a stratos-prod por MCP; se versiona acá.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_claim_lead(
  p_lead_id uuid,
  p_asesor_name text,
  p_stage text DEFAULT 'Contáctame Ya'::text
)
RETURNS TABLE(id uuid, name text, asesor_name text, asesor_id uuid, stage text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_org    uuid;
  v_new_asesor_id uuid;
  v_name          text := btrim(coalesce(p_asesor_name,''));
BEGIN
  IF p_lead_id IS NULL THEN RAISE EXCEPTION 'p_lead_id requerido'; END IF;
  IF v_name = '' THEN RAISE EXCEPTION 'p_asesor_name requerido'; END IF;

  -- ── Candado de rol ────────────────────────────────────────────────────────
  -- Reclamar un lead que ya tiene dueño ES una reasignación. Solo admin/above.
  IF NOT public.is_admin_or_above() THEN
    RAISE EXCEPTION 'Solo un administrador puede registrar o reasignar un cliente que ya está en el CRM a nombre de otro asesor.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- pr.id calificado: evita el choque con la columna OUT "id" (RETURNS TABLE).
  SELECT pr.organization_id INTO v_caller_org FROM public.profiles pr WHERE pr.id = auth.uid();
  IF v_caller_org IS NULL THEN RAISE EXCEPTION 'sin organización (caller)'; END IF;

  SELECT p.id INTO v_new_asesor_id FROM public.profiles p
    WHERE lower(p.name) = lower(v_name) AND p.organization_id = v_caller_org AND coalesce(p.active,true)=true
    ORDER BY length(p.name) ASC LIMIT 1;

  RETURN QUERY
  UPDATE public.leads l SET
    asesor_name   = v_name,
    asesor_id     = v_new_asesor_id,
    stage         = coalesce(nullif(btrim(p_stage),''), l.stage),
    is_new        = true,   -- queda resaltado para que el nuevo asesor lo ubique fácil
    updated_at    = now(),
    last_activity = to_char(now(),'YYYY-MM-DD HH24:MI')
  WHERE l.id = p_lead_id AND l.organization_id = v_caller_org AND l.deleted_at IS NULL
  RETURNING l.id, l.name, l.asesor_name, l.asesor_id, l.stage;
END;
$function$;

COMMENT ON FUNCTION public.fn_claim_lead(uuid, text, text) IS
  'Reasigna un lead existente a otro asesor (override "Registrar de todas formas" '
  'del CRM). Desde jul 2026 SOLO admin/above (is_admin_or_above): un asesor no '
  'puede reclamar un cliente ya registrado por otro. SECURITY DEFINER + org-scoped.';
