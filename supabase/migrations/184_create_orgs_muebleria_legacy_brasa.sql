-- 184_create_orgs_muebleria_legacy_brasa.sql
-- Da de alta TRES tenants nuevos del white-label de Stratos, cada uno con su
-- propia organization_id (aislamiento por RLS, igual que Grupo 28 / Vega / NSG):
--
--   1. Mueblería      — fábrica de muebles / carpintería (pedidos a medida)
--   2. Legacy Design  — firma de arquitectura + desarrollo inmobiliario
--   3. Brasa y Piedra — restaurante en Playa del Carmen (reservas y eventos)
--
-- ⚠️ NO toca NADA de las orgs existentes. Solo inserta filas nuevas, y solo si
--    no existen (idempotente: seguro de re-correr).
--
-- Cada org lleva su fila en `proactive_config` con el motor de recordatorios
-- APAGADO a propósito (enabled=false, shadow_mode=true): todavía no hay nadie
-- con Telegram vinculado en estas empresas, y prenderlo antes de tiempo solo
-- generaría cola de recordatorios que no llegan a ningún lado. Se prende cuando
-- el tenant tenga sus asesores conectados (ver §"Cómo prenderlo" abajo).
--
-- `zoom_stage_label` NO es "Zoom Agendado" en estos tenants: es la etapa de CITA
-- de cada negocio (la visita de medición, la reunión de arquitectura, la reserva
-- confirmada). Ese es el campo que usa fn_proactive_scan_zooms para avisar N
-- horas antes, así que apuntarlo a la etapa correcta es lo que hace que el
-- recordatorio signifique algo en cada vertical.
--
-- `terminal_stages` = las etapas donde un registro ya está cerrado; el escáner
-- de inactividad las ignora (si no, molestaría por pedidos ya entregados).
--
-- Se revierte con:
--   DELETE FROM proactive_config WHERE organization_id IN (
--     'e583eb98-ff00-4920-a69c-db39f3841b31',
--     '281caa01-7414-4eef-b3b6-afa1e7623ab3',
--     'ea74b69a-6904-4c65-a0ca-e0af58f1473a');
--   DELETE FROM organizations WHERE slug IN ('muebleria','legacy-design','brasa-y-piedra');
--
-- Cómo prenderlo cuando el tenant esté listo (por tenant, no todos juntos):
--   UPDATE proactive_config SET enabled = true, shadow_mode = false
--    WHERE organization_id = '<uuid del tenant>';

-- ── 1. Mueblería ─────────────────────────────────────────────────────────────
INSERT INTO organizations (id, name, slug, plan, seats, primary_color, active, created_at, updated_at)
SELECT
  'e583eb98-ff00-4920-a69c-db39f3841b31'::uuid,
  'Mueblería',
  'muebleria',
  'pro',
  10,
  '#D4A373',          -- madera / ámbar
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'muebleria');

-- ── 2. Legacy Design ─────────────────────────────────────────────────────────
INSERT INTO organizations (id, name, slug, plan, seats, primary_color, active, created_at, updated_at)
SELECT
  '281caa01-7414-4eef-b3b6-afa1e7623ab3'::uuid,
  'Legacy Design',
  'legacy-design',
  'pro',
  10,
  '#C8A97E',          -- bronce / arena
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'legacy-design');

-- ── 3. Brasa y Piedra ────────────────────────────────────────────────────────
INSERT INTO organizations (id, name, slug, plan, seats, primary_color, active, created_at, updated_at)
SELECT
  'ea74b69a-6904-4c65-a0ca-e0af58f1473a'::uuid,
  'Brasa y Piedra',
  'brasa-y-piedra',
  'pro',
  10,
  '#F97316',          -- brasa
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'brasa-y-piedra');

-- ── Motor proactivo, apagado, uno por tenant ─────────────────────────────────
-- Mueblería: la cita es la MEDICIÓN en casa del cliente. Se avisa 3 h antes.
INSERT INTO proactive_config (
  organization_id, enabled, shadow_mode, zoom_stage_label, zoom_reminder_hours,
  terminal_stages, timezone, inactivity_days
)
SELECT
  'e583eb98-ff00-4920-a69c-db39f3841b31'::uuid,
  false, true,
  'Medición', 3,
  ARRAY['Entregado','Cancelado']::text[],
  'America/Cancun',
  4
WHERE NOT EXISTS (
  SELECT 1 FROM proactive_config
   WHERE organization_id = 'e583eb98-ff00-4920-a69c-db39f3841b31'::uuid
);

-- Legacy Design: SIN etapa de cita a propósito. Su kanban es el ESTADO de la casa
-- (No iniciada / Pendiente / En curso / Entregada), no una agenda — y Alex pidió
-- explícitamente NO tener avisos para Legacy (los quiere para su equipo de
-- marketing). `zoom_stage_label` queda con un valor que NO matchea ninguna etapa
-- para que el escáner de citas no encuentre nada ni aunque alguien encienda el
-- motor por error. Inactividad larga (30 días): una casa puede pasar semanas
-- esperando una licencia sin que eso sea un descuido.
INSERT INTO proactive_config (
  organization_id, enabled, shadow_mode, zoom_stage_label, zoom_reminder_hours,
  terminal_stages, timezone, inactivity_days
)
SELECT
  '281caa01-7414-4eef-b3b6-afa1e7623ab3'::uuid,
  false, true,
  'Sin etapa de cita', 3,
  ARRAY['Entregada']::text[],
  'America/Cancun',
  30
WHERE NOT EXISTS (
  SELECT 1 FROM proactive_config
   WHERE organization_id = '281caa01-7414-4eef-b3b6-afa1e7623ab3'::uuid
);

-- Brasa y Piedra: la cita es la RESERVA CONFIRMADA. Se avisa 4 h antes (da
-- tiempo a preparar mesa/montaje el mismo día). Inactividad corta (2 días):
-- una solicitud de reserva sin responder se enfría rapidísimo.
INSERT INTO proactive_config (
  organization_id, enabled, shadow_mode, zoom_stage_label, zoom_reminder_hours,
  terminal_stages, timezone, inactivity_days
)
SELECT
  'ea74b69a-6904-4c65-a0ca-e0af58f1473a'::uuid,
  false, true,
  'Confirmada', 4,
  ARRAY['Atendida','No asistió','Cancelada']::text[],
  'America/Cancun',
  2
WHERE NOT EXISTS (
  SELECT 1 FROM proactive_config
   WHERE organization_id = 'ea74b69a-6904-4c65-a0ca-e0af58f1473a'::uuid
);
