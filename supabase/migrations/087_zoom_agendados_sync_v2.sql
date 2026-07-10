-- ════════════════════════════════════════════════════════════════════════
-- 087 — Sync CRM → Control de Zooms v2: máquina de estados COMPLETA
-- ✅ APLICADA A PROD el 2026-07-10 (zoom_agendados_sync_v2_maquina_completa)
-- y verificada con 4 escenarios en transacciones con ROLLBACK:
--   A) rebooking sin cambio de etapa → refresca fecha/hora  ✔
--   B) regresión de etapa → Cancelado con nota              ✔
--   C) brinco directo a Zoom Concretado → crea Asistió      ✔
--   D) lead a papelera → Cancelado con nota                 ✔
-- Cierra los huecos de la v1 (085). Lo cerrado a mano nunca se pisa (solo
-- toca estatus activos). Solo org Duke. Además agrega zoom_agendados a la
-- publicación realtime para que el panel se refresque solo.
-- Ver el SQL aplicado en el historial de migraciones de Supabase; este
-- archivo es el espejo 1:1.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.zoom_agendados_sync_from_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_when    timestamptz;
  v_fecha   date;
  v_hora    text;
  v_tocados int;
BEGIN
  IF NEW.organization_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001'::uuid THEN
    RETURN NEW;
  END IF;

  -- Cambio de CITA sin cambio de etapa (rebooking de Cal.com).
  IF TG_OP = 'UPDATE' AND NEW.stage IS NOT DISTINCT FROM OLD.stage THEN
    IF NEW.stage = 'Zoom Agendado'
       AND (NEW.selected_time IS DISTINCT FROM OLD.selected_time
            OR NEW.next_action_at IS DISTINCT FROM OLD.next_action_at) THEN
      v_when := COALESCE(NEW.selected_time, NEW.next_action_at);
      IF v_when IS NOT NULL THEN
        UPDATE public.zoom_agendados z
        SET fecha_zoom = (v_when AT TIME ZONE 'America/Cancun')::date,
            hora       = to_char(v_when AT TIME ZONE 'America/Cancun', 'HH24:MI')
        WHERE z.lead_id = NEW.id AND z.estatus IN ('Agendado','Confirmado','Reagendado');
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.stage = 'Zoom Agendado' THEN
    v_when  := COALESCE(NEW.selected_time, NEW.next_action_at);
    v_fecha := (v_when AT TIME ZONE 'America/Cancun')::date;
    v_hora  := to_char(v_when AT TIME ZONE 'America/Cancun', 'HH24:MI');
    IF EXISTS (
      SELECT 1 FROM public.zoom_agendados z
      WHERE z.lead_id = NEW.id AND z.estatus IN ('Agendado','Confirmado','Reagendado')
    ) THEN
      UPDATE public.zoom_agendados z
      SET fecha_zoom = COALESCE(v_fecha, z.fecha_zoom),
          hora       = COALESCE(v_hora, z.hora),
          estatus    = 'Reagendado'
      WHERE z.lead_id = NEW.id AND z.estatus IN ('Agendado','Confirmado','Reagendado');
    ELSE
      INSERT INTO public.zoom_agendados
        (organization_id, lead_id, fecha_agendado, fecha_zoom, hora, liner, cliente, proyecto, estatus, comentarios)
      VALUES
        (NEW.organization_id, NEW.id, (now() AT TIME ZONE 'America/Cancun')::date,
         v_fecha, v_hora, NEW.asesor_name, NEW.name, NEW.project, 'Agendado',
         'Sincronizado automáticamente desde el CRM');
    END IF;

  ELSIF NEW.stage IN ('Zoom Concretado','Seguimiento','Apartó','Visita Agendada','Cierre','Postventa') THEN
    UPDATE public.zoom_agendados z
    SET estatus = 'Asistió'
    WHERE z.lead_id = NEW.id AND z.estatus IN ('Agendado','Confirmado','Reagendado');
    GET DIAGNOSTICS v_tocados = ROW_COUNT;
    IF v_tocados = 0 AND NEW.stage = 'Zoom Concretado'
       AND NOT EXISTS (SELECT 1 FROM public.zoom_agendados z WHERE z.lead_id = NEW.id) THEN
      INSERT INTO public.zoom_agendados
        (organization_id, lead_id, fecha_agendado, fecha_zoom, hora, liner, cliente, proyecto, estatus, comentarios)
      VALUES
        (NEW.organization_id, NEW.id, (now() AT TIME ZONE 'America/Cancun')::date,
         (now() AT TIME ZONE 'America/Cancun')::date, NULL,
         NEW.asesor_name, NEW.name, NEW.project, 'Asistió',
         'Sincronizado desde el CRM (llegó a Zoom Concretado sin registro previo)');
    END IF;

  ELSIF NEW.stage = 'Reactivar Zoom' THEN
    UPDATE public.zoom_agendados z
    SET estatus = 'No show'
    WHERE z.lead_id = NEW.id AND z.estatus IN ('Agendado','Confirmado','Reagendado');
    GET DIAGNOSTICS v_tocados = ROW_COUNT;
    IF v_tocados = 0
       AND NOT EXISTS (SELECT 1 FROM public.zoom_agendados z WHERE z.lead_id = NEW.id) THEN
      INSERT INTO public.zoom_agendados
        (organization_id, lead_id, fecha_agendado, fecha_zoom, hora, liner, cliente, proyecto, estatus, comentarios)
      VALUES
        (NEW.organization_id, NEW.id, (now() AT TIME ZONE 'America/Cancun')::date,
         (now() AT TIME ZONE 'America/Cancun')::date, NULL,
         NEW.asesor_name, NEW.name, NEW.project, 'No show',
         'Sincronizado desde el CRM (cayó a Reactivar Zoom sin registro previo)');
    END IF;

  ELSE
    UPDATE public.zoom_agendados z
    SET estatus = 'Cancelado',
        comentarios = NULLIF(trim(both ' ·' from COALESCE(z.comentarios,'') || ' · regresó a ' || COALESCE(NEW.stage,'—') || ' en el CRM'), '')
    WHERE z.lead_id = NEW.id AND z.estatus IN ('Agendado','Confirmado','Reagendado');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_sync_zoom_agendados ON public.leads;
CREATE TRIGGER leads_sync_zoom_agendados
  AFTER INSERT OR UPDATE OF stage, selected_time, next_action_at ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.zoom_agendados_sync_from_lead();

CREATE OR REPLACE FUNCTION public.zoom_agendados_cancel_on_lead_gone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.organization_id = '00000000-0000-0000-0000-000000000001'::uuid THEN
      UPDATE public.zoom_agendados z
      SET estatus = 'Cancelado',
          comentarios = NULLIF(trim(both ' ·' from COALESCE(z.comentarios,'') || ' · lead eliminado del CRM'), '')
      WHERE z.lead_id = OLD.id AND z.estatus IN ('Agendado','Confirmado','Reagendado');
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.organization_id = '00000000-0000-0000-0000-000000000001'::uuid
     AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.zoom_agendados z
    SET estatus = 'Cancelado',
        comentarios = NULLIF(trim(both ' ·' from COALESCE(z.comentarios,'') || ' · lead enviado a papelera'), '')
    WHERE z.lead_id = NEW.id AND z.estatus IN ('Agendado','Confirmado','Reagendado');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_zoom_cancel_papelera ON public.leads;
CREATE TRIGGER leads_zoom_cancel_papelera
  AFTER UPDATE OF deleted_at ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.zoom_agendados_cancel_on_lead_gone();

DROP TRIGGER IF EXISTS leads_zoom_cancel_delete ON public.leads;
CREATE TRIGGER leads_zoom_cancel_delete
  BEFORE DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.zoom_agendados_cancel_on_lead_gone();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'zoom_agendados'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.zoom_agendados;
  END IF;
END $$;
