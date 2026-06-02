-- 051_add_sales_columns_to_leads.sql
-- Adds 16 columns to leads for the Stratos Sales funnel:
--   - diagnostico_*: payload + score + level + recommendation from landing diagnostic
--   - dolor_principal, contexto_previo: enriched lead context for Retell agent Sofia
--   - cal_event_id/url, zoom_join_url, selected_time: appointment fields
--   - do_not_contact: Sofia-set flag when lead says "no contactar"
--   - urgency_status: internal state ('Rescate_Pendiente'/'Llamada_En_Curso'/'Agendado'/'Pausado')
--   - reminder_*_sent_at: timestamps to dedupe WhatsApp HSM reminder cron
--
-- All columns are nullable; do_not_contact defaults to false.
-- No DEFAULT clause that would rewrite existing rows (PG instant ADD COLUMN).
-- Idempotent via IF NOT EXISTS.
--
-- Multi-tenancy: filter all queries by organization_id. Duke and Stratos Sales
-- share the same table; RLS policies on leads enforce isolation.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS diagnostico_payload jsonb,
  ADD COLUMN IF NOT EXISTS diagnostico_score int,
  ADD COLUMN IF NOT EXISTS diagnostico_nivel text,
  ADD COLUMN IF NOT EXISTS diagnostico_recomendacion text,
  ADD COLUMN IF NOT EXISTS dolor_principal text,
  ADD COLUMN IF NOT EXISTS contexto_previo text,
  ADD COLUMN IF NOT EXISTS cal_event_id text,
  ADD COLUMN IF NOT EXISTS cal_event_url text,
  ADD COLUMN IF NOT EXISTS zoom_join_url text,
  ADD COLUMN IF NOT EXISTS selected_time timestamptz,
  ADD COLUMN IF NOT EXISTS do_not_contact boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgency_status text,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_3h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_10min_sent_at timestamptz;
