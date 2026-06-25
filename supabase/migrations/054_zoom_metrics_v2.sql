-- 054_zoom_metrics_v2.sql
-- Modelo aditivo para convertir cada cita de Zoom en un evento auditable.
-- No elimina ni modifica datos existentes; zoom_agendados continúa compatible.

ALTER TABLE public.zoom_agendados
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_event_id text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS status_code text,
  ADD COLUMN IF NOT EXISTS outcome_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_by_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS presenter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meeting_url text,
  ADD COLUMN IF NOT EXISTS calendar_url text,
  ADD COLUMN IF NOT EXISTS rescheduled_from_id uuid REFERENCES public.zoom_agendados(id) ON DELETE SET NULL;

UPDATE public.zoom_agendados
SET scheduled_at = ((fecha_zoom::text || ' ' || COALESCE(hora::text, '00:00'))::timestamp AT TIME ZONE 'America/Cancun')
WHERE scheduled_at IS NULL AND fecha_zoom IS NOT NULL;

UPDATE public.zoom_agendados
SET status_code = CASE lower(COALESCE(estatus, ''))
  WHEN 'asistió' THEN 'completed'
  WHEN 'asistio' THEN 'completed'
  WHEN 'no show' THEN 'no_show'
  WHEN 'reagendado' THEN 'rescheduled'
  WHEN 'cancelado' THEN 'cancelled'
  WHEN 'confirmado' THEN 'confirmed'
  ELSE 'scheduled'
END
WHERE status_code IS NULL;

ALTER TABLE public.zoom_agendados
  ADD CONSTRAINT zoom_agendados_status_code_check
  CHECK (status_code IS NULL OR status_code IN (
    'scheduled', 'confirmed', 'completed', 'no_show',
    'rescheduled', 'cancelled', 'pending_outcome'
  )) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS zoom_agendados_org_external_event_uidx
  ON public.zoom_agendados (organization_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS zoom_agendados_scheduled_at_idx
  ON public.zoom_agendados (organization_id, scheduled_at);

CREATE INDEX IF NOT EXISTS zoom_agendados_status_code_idx
  ON public.zoom_agendados (organization_id, status_code);

CREATE TABLE IF NOT EXISTS public.zoom_event_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  zoom_id uuid NOT NULL REFERENCES public.zoom_agendados(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text,
  event_type text NOT NULL,
  previous_status text,
  next_status text,
  previous_scheduled_at timestamptz,
  next_scheduled_at timestamptz,
  source text NOT NULL DEFAULT 'crm',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zoom_event_history_zoom_idx
  ON public.zoom_event_history (zoom_id, created_at DESC);

ALTER TABLE public.zoom_event_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zoom_event_history_rw ON public.zoom_event_history;
CREATE POLICY zoom_event_history_rw ON public.zoom_event_history
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());
