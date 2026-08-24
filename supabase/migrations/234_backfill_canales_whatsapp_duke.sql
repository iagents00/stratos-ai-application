-- 234_backfill_canales_whatsapp_duke.sql
-- ============================================================================
-- Backfill de los canales de WhatsApp conectados a mano antes de Tech Provider.
--
-- Fuente de los IDs: ops/ESTADO-FINAL-marco-whatsapp.md (sesión 20-ago-2026).
--
-- Efecto: Gael pasa de resolverse por los últimos 10 dígitos del número
-- (prioridad 3, frágil) a resolverse por `waba_id` (prioridad 2, estable),
-- que es lo que Meta manda en `entry[0].id` de cada webhook.
--
-- Ken y Oscar quedan sin WABA a propósito: sus cuentas no están ubicadas y
-- sus números todavía no están conectados.
--
-- IDEMPOTENTE.
-- ============================================================================

update public.whatsapp_numero_asesor
set waba_id       = '263671803501919',
    platform_type = 'CLOUD_API',
    updated_at    = now()
where numero_whatsapp = '+529848779295'          -- Gael G
  and waba_id is distinct from '263671803501919';

-- Marco quedó atrapado en la API vieja: se registra el hecho en los datos para
-- que nadie vuelva a intentar conectarlo sin migrarlo primero.
update public.whatsapp_numero_asesor
set waba_id       = '838543342116287',
    platform_type = 'ON_PREMISE',
    nota          = 'ON_PREMISE (fósil LeadConnector) — no recibe webhooks de Cloud API.',
    updated_at    = now()
where numero_whatsapp = '+529848763357'          -- Marco Lopez
  and platform_type is distinct from 'ON_PREMISE';
