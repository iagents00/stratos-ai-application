-- ════════════════════════════════════════════════════════════════════════
-- 085 — Sincronización CRM → Control de Zooms (Duke del Caribe)
-- ────────────────────────────────────────────────────────────────────────
-- ⚠️ PENDIENTE DE APLICAR A PROD — requiere autorización explícita de Ivan
-- (crea un trigger sobre public.leads, tabla compartida crítica).
--
-- Pedido de Ivan (2026-07-10): "que todo esté sincronizado a los datos
-- reales del CRM". El Control de Zooms deja de ser captura manual paralela:
-- los movimientos de etapa del pipeline alimentan zoom_agendados solos,
-- sin importar quién mueva el lead (app, bot de Telegram o n8n).
--
--   · lead ENTRA a 'Zoom Agendado'  → crea registro (cliente, fecha/hora de
--     la cita desde selected_time/next_action_at en hora de Cancún, liner =
--     asesor del lead). Si ya tenía un Zoom activo → actualiza fecha/hora y
--     lo marca 'Reagendado'.
--   · lead pasa a 'Zoom Concretado' o etapa posterior → su Zoom activo se
--     marca 'Asistió'.
--   · lead cae a 'Reactivar Zoom' (no-show) → 'No show'.
--
-- Solo toca registros con estatus ACTIVO (Agendado/Confirmado/Reagendado):
-- lo que el equipo cerró a mano jamás se pisa. Acotado a la organización
-- Duke (la única con el panel habilitado); ampliar el gate si otro tenant
-- adopta el Control de Zooms.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.zoom_agendados_sync_from_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_when  timestamptz;
  v_fecha date;
  v_hora  text;
BEGIN
  -- Solo Duke (único tenant con Control de Zooms habilitado).
  IF NEW.organization_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001'::uuid THEN
    RETURN NEW;
  END IF;
  -- Solo cuando la etapa realmente cambia.
  IF TG_OP = 'UPDATE' AND NEW.stage IS NOT DISTINCT FROM OLD.stage THEN
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
      -- Re-agendó: refrescar cita del registro activo.
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

  ELSIF NEW.stage = 'Reactivar Zoom' THEN
    UPDATE public.zoom_agendados z
    SET estatus = 'No show'
    WHERE z.lead_id = NEW.id AND z.estatus IN ('Agendado','Confirmado','Reagendado');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_sync_zoom_agendados ON public.leads;
CREATE TRIGGER leads_sync_zoom_agendados
  AFTER INSERT OR UPDATE OF stage ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.zoom_agendados_sync_from_lead();
