-- ─────────────────────────────────────────────────────────────────────────────
-- 229_cada_quien_ve_solo_a_su_equipo.sql
--
-- QUÉ ARREGLA
-- `fn_team_users(p_profile_id uuid)` (migración 167) es SECURITY DEFINER y
-- resolvía la organización a partir del uuid QUE LE PASAN, sin comprobar que
-- fuera el del usuario que llama. Como PostgREST la expone a cualquier usuario
-- autenticado, bastaba llamarla con el id de un admin de otro cliente para
-- llevarse su equipo completo CON SUS CORREOS:
--
--     select fn_team_users('<uuid de un admin de Grupo 28>');
--
-- Duke, Grupo 28, Vega y TGenius viven en el mismo proyecto de Supabase, así que
-- esto rompía el aislamiento por organization_id que sostiene toda la
-- arquitectura multi-cliente.
--
-- CÓMO LO ARREGLA
-- La organización y el rol se resuelven SIEMPRE desde `auth.uid()`. El parámetro
-- se conserva para no romper la firma que ya llama el frontend
-- (`adminGetAllUsers` en src/lib/auth.js pasa el id del propio usuario), pero si
-- no coincide con quien llama, la función devuelve '[]'.
--
-- Se deja salida para `service_role`: sin JWT `auth.uid()` es NULL y ahí sí se
-- honra el parámetro. Ese contexto ya bypassea RLS de todas formas, y permite
-- que un workflow de n8n la use en el futuro.
--
-- APLICADA EN PRODUCCIÓN el 3-ago-2026. Idempotente (CREATE OR REPLACE).
--
-- VERIFICACIÓN (con JWT real de un asesor de Duke):
--   · pasando el id de un super_admin de su org      → []
--   · pasando el id de un director de OTRO cliente   → []
--   · pasando su propio id (rol no admin)            → []
--   · service_role pasando el id de un admin         → 31 filas, solo de esa org
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_team_users(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_caller uuid;
  v_org    uuid;
  v_rol    text;
  v_out    jsonb;
begin
  v_caller := auth.uid();

  if v_caller is null then
    -- Sin JWT = service_role (backend de confianza). Se honra el parámetro.
    v_caller := p_profile_id;
  elsif p_profile_id is not null and p_profile_id <> v_caller then
    -- Usuario autenticado pidiendo el equipo de otra persona: no.
    return '[]'::jsonb;
  end if;

  if v_caller is null then return '[]'::jsonb; end if;

  select organization_id, role into v_org, v_rol from profiles where id = v_caller;
  if v_org is null then return '[]'::jsonb; end if;
  if v_rol not in ('super_admin','admin','director','ceo') then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x order by x->>'created_at'), '[]'::jsonb) into v_out
  from (
    select jsonb_build_object(
      'id', p.id, 'name', p.name, 'role', p.role, 'phone', p.phone,
      'active', coalesce(p.active, true),
      'created_at', p.created_at,
      'organization_id', p.organization_id,
      'email', u.email
    ) x
    from profiles p
    left join auth.users u on u.id = p.id
   where p.organization_id = v_org
  ) s;

  return v_out;
end $function$;

COMMENT ON FUNCTION public.fn_team_users(uuid) IS
  'Equipo de la organizacion del usuario que llama (incluye email de auth.users). La org SIEMPRE sale de auth.uid(); el parametro solo se honra sin JWT (service_role). Solo responde a super_admin/admin/director/ceo.';
