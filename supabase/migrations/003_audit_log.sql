-- ═══════════════════════════════════════════════════════════
-- Stratos AI — Migración 003
-- Sistema de auditoría centralizada
--
-- Estrategia:
--   • UNA sola tabla `audit_log` genérica para toda la plataforma
--   • Triggers de Postgres en cada tabla auditada (leads, profiles)
--     → imposible saltarse el registro desde el cliente
--   • Solo se guarda el DIFF (campos cambiados), no la fila completa
--     → ~30× menos storage que loggear filas enteras
--   • RLS: solo super_admin / admin pueden leer todo
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- Idempotente: se puede correr múltiples veces sin romper nada
-- ═══════════════════════════════════════════════════════════

-- ── 1. TABLA `audit_log` ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Quién hizo el cambio
  actor_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name      text,
  actor_role      text,

  -- Qué se cambió
  entity_type     text        NOT NULL,    -- 'lead' | 'profile' | 'auth' | ...
  entity_id       uuid,                    -- null para eventos de auth (no entidad)

  -- Acción
  action          text        NOT NULL CHECK (action IN
                              ('INSERT','UPDATE','DELETE','SOFT_DELETE',
                               'LOGIN','LOGIN_FAIL','LOGOUT','SIGNUP','PASSWORD_RESET')),

  -- Diff: solo los campos que cambiaron
  -- Estructura: { campo: { old: <valor anterior>, new: <valor nuevo> }, ... }
  changed_fields  jsonb,

  -- Contexto adicional: ip, user_agent, etc.
  metadata        jsonb       DEFAULT '{}'::jsonb
);

-- ── 2. ÍNDICES ───────────────────────────────────────────────
-- Consulta típica: "historial de este lead/perfil en orden cronológico"
CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON public.audit_log(entity_type, entity_id, created_at DESC);

-- Consulta: "qué hizo este usuario"
CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON public.audit_log(actor_id, created_at DESC);

-- Consulta: "todos los logins fallidos del último día" (alertas de seguridad)
CREATE INDEX IF NOT EXISTS idx_audit_action_time
  ON public.audit_log(action, created_at DESC);

-- ── 3. FUNCIÓN GENÉRICA DE TRIGGER ────────────────────────────
-- Esta función se aplica a CUALQUIER tabla. Calcula el diff y registra.
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor_id   uuid;
  v_actor_name text;
  v_actor_role text;
  v_changed    jsonb;
  v_action     text;
  v_entity_id  uuid;
BEGIN
  -- Identificar al usuario actual (si hay sesión auth)
  v_actor_id := auth.uid();
  IF v_actor_id IS NOT NULL THEN
    SELECT name, role INTO v_actor_name, v_actor_role
    FROM public.profiles WHERE id = v_actor_id;
  END IF;

  -- Determinar acción y entity_id
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_entity_id := NEW.id;
    -- Para INSERT, registramos todos los campos no-nulos como nuevos
    v_changed := (
      SELECT jsonb_object_agg(key, jsonb_build_object('old', null, 'new', value))
      FROM jsonb_each(to_jsonb(NEW))
      WHERE key NOT IN ('created_at','updated_at')
        AND value IS NOT NULL AND value::text != 'null'
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    -- Detectar soft delete (deleted_at pasa de null a no-null)
    IF (to_jsonb(OLD) ? 'deleted_at')
       AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'SOFT_DELETE';
    ELSE
      v_action := 'UPDATE';
    END IF;

    -- Calcular diff: solo campos que realmente cambiaron
    v_changed := (
      SELECT jsonb_object_agg(
        n.key,
        jsonb_build_object('old', o.value, 'new', n.value)
      )
      FROM jsonb_each(to_jsonb(NEW)) n
      LEFT JOIN jsonb_each(to_jsonb(OLD)) o ON o.key = n.key
      WHERE n.value IS DISTINCT FROM o.value
        AND n.key NOT IN ('updated_at')   -- ruido
    );

    -- Si no cambió nada relevante (solo updated_at), no registrar
    IF v_changed IS NULL OR v_changed = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_entity_id := OLD.id;
    v_changed := (
      SELECT jsonb_object_agg(key, jsonb_build_object('old', value, 'new', null))
      FROM jsonb_each(to_jsonb(OLD))
      WHERE key NOT IN ('created_at','updated_at')
        AND value IS NOT NULL AND value::text != 'null'
    );
  END IF;

  -- Insertar el registro de auditoría
  INSERT INTO public.audit_log
    (actor_id, actor_name, actor_role, entity_type, entity_id, action, changed_fields)
  VALUES
    (v_actor_id, v_actor_name, v_actor_role,
     TG_TABLE_NAME, v_entity_id, v_action, v_changed);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── 4. APLICAR TRIGGERS A TABLAS AUDITADAS ───────────────────
-- LEADS
DROP TRIGGER IF EXISTS audit_leads ON public.leads;
CREATE TRIGGER audit_leads
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- PROFILES
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ── 5. ROW LEVEL SECURITY ────────────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Solo super_admin / admin pueden leer todo el log
DROP POLICY IF EXISTS "audit_log_select_admin" ON public.audit_log;
CREATE POLICY "audit_log_select_admin" ON public.audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin','admin','ceo')
    )
  );

-- Cualquier usuario autenticado puede ver su propio historial de acciones
DROP POLICY IF EXISTS "audit_log_select_own" ON public.audit_log;
CREATE POLICY "audit_log_select_own" ON public.audit_log
  FOR SELECT USING (auth.uid() = actor_id);

-- INSERT solo desde el cliente para eventos de auth (entity_type='auth')
-- Los demás INSERTs vienen de los triggers (con SECURITY DEFINER ignoran RLS)
DROP POLICY IF EXISTS "audit_log_insert_auth_events" ON public.audit_log;
CREATE POLICY "audit_log_insert_auth_events" ON public.audit_log
  FOR INSERT WITH CHECK (entity_type = 'auth');

-- Nadie puede UPDATE/DELETE el audit_log (es append-only)
-- (no creamos políticas de UPDATE/DELETE → quedan bloqueadas por RLS)

-- ── 6. RPC HELPER: historial de una entidad ──────────────────
-- Permite al frontend pedir el historial sin SQL crudo.
CREATE OR REPLACE FUNCTION public.get_entity_history(
  p_entity_type text,
  p_entity_id   uuid,
  p_limit       integer DEFAULT 50
)
RETURNS TABLE (
  id              uuid,
  created_at      timestamptz,
  actor_id        uuid,
  actor_name      text,
  actor_role      text,
  action          text,
  changed_fields  jsonb,
  metadata        jsonb
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT id, created_at, actor_id, actor_name, actor_role,
         action, changed_fields, metadata
  FROM public.audit_log
  WHERE entity_type = p_entity_type
    AND entity_id   = p_entity_id
  ORDER BY created_at DESC
  LIMIT LEAST(p_limit, 500);
$$;

-- ── 7. RETENCIÓN — limpieza automática ───────────────────────
-- Función que borra registros viejos. Se puede llamar desde un cron.
-- Política sugerida:
--   • Eventos de auth (login/logout): >180 días
--   • Cambios de datos: >730 días (2 años)
CREATE OR REPLACE FUNCTION public.audit_log_cleanup()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_deleted integer := 0;
  v_count integer;
BEGIN
  DELETE FROM public.audit_log
  WHERE entity_type = 'auth' AND created_at < now() - interval '180 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted + v_count;

  DELETE FROM public.audit_log
  WHERE entity_type != 'auth' AND created_at < now() - interval '730 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted + v_count;

  RETURN v_deleted;
END;
$$;

-- Para activar la limpieza automática (ejecutar manualmente una vez):
--   SELECT cron.schedule('audit-cleanup', '0 3 * * 0', 'SELECT public.audit_log_cleanup()');
-- Requiere extensión pg_cron habilitada en Supabase (Database → Extensions).

-- ── 8. Refrescar schema cache ────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════
-- LISTO. Verifica:
--   SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT 10;
-- ═══════════════════════════════════════════════════════════
