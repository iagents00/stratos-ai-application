-- ═══════════════════════════════════════════════════════════════════════════
-- 026_fn_bulk_reassign_leads.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Documenta en el repo la RPC fn_bulk_reassign_leads (ya estaba en producción,
-- aplicada vía MCP durante el desarrollo de la reasignación por fila / en grupo
-- del CRM). El frontend la llama desde runReassign (CRM/index.jsx).
--
-- Reasigna EN LOTE (1 sola escritura, atómica) un grupo de leads a otro asesor:
--   · asesor_name = p_asesor_name (trim).
--   · asesor_id   = perfil de la MISMA organización cuyo name coincide
--     (case-insensitive) y está activo. Si no hay match queda NULL (válido:
--     visible para admins, se reasigna cuando exista el perfil).
--   · stage = 'Contáctame Ya' solo si p_to_contactame (para que el lead
--     aparezca al inicio del pipeline del nuevo asesor).
-- Devuelve cuántas filas cambió.
--
-- SECURITY INVOKER (NO definer) → corre con los privilegios del que la llama,
-- así que la RLS de leads (leads_update) valida permisos POR FILA: un admin
-- edita toda su organización; un asesor solo los suyos. Es el gate real.
--
-- IDEMPOTENTE: es un UPDATE por id a valores fijos → reejecutarla no cambia el
-- resultado. Esto hace seguros los reintentos (la cola offline del cliente la
-- puede reaplicar sin efectos colaterales).
--
-- ENDURECIMIENTO DE PRIVILEGIOS: al crearse vía MCP quedó con EXECUTE para
-- anon/PUBLIC (default de Postgres). Como es INVOKER la RLS ya bloquea a anon
-- en la práctica, pero por higiene (igual que 021_reset_and_assign) revocamos
-- anon/PUBLIC y dejamos authenticated (frontend) + service_role (backend/n8n).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_bulk_reassign_leads(
  p_ids uuid[],
  p_asesor_name text,
  p_to_contactame boolean DEFAULT true
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count integer;
  v_name  text := trim(p_asesor_name);
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return 0;
  end if;
  if v_name is null or length(v_name) = 0 then
    raise exception 'p_asesor_name requerido';
  end if;

  update public.leads l
     set asesor_name   = v_name,
         asesor_id     = (
           select p.id from public.profiles p
            where lower(p.name) = lower(v_name)
              and p.organization_id = l.organization_id
              and coalesce(p.active, true) = true
            limit 1
         ),
         stage         = case when p_to_contactame then 'Contáctame Ya' else l.stage end,
         updated_at    = now(),
         last_activity = to_char(now(), 'YYYY-MM-DD HH24:MI')
   where l.id = any(p_ids)
     and l.deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- Privilegios: solo authenticated (frontend) y service_role (backend). La RLS
-- sigue siendo el gate real por fila.
REVOKE ALL ON FUNCTION public.fn_bulk_reassign_leads(uuid[], text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_bulk_reassign_leads(uuid[], text, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_bulk_reassign_leads(uuid[], text, boolean) IS
  'Reasigna en lote p_ids al asesor p_asesor_name (resuelve asesor_id por '
  'nombre+organización), opcionalmente moviéndolos a Contáctame Ya. '
  'SECURITY INVOKER + RLS por fila. Idempotente. Usada por el CRM.';
