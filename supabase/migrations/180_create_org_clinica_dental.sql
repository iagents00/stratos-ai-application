-- 180_create_org_clinica_dental.sql
-- Da de alta UN tenant nuevo del white-label de Stratos:
--
--   Clínica Dental — consultorio/clínica odontológica.
--   El CRM se reusa como seguimiento de PACIENTES: del primer contacto que pide
--   informes, a la cita de valoración, al presupuesto del tratamiento, al
--   tratamiento terminado y al control de los 6 meses.
--
-- ⚠️ NO toca NADA de las orgs existentes. Solo inserta filas nuevas, y solo si no
--    existen (idempotente: seguro de re-correr).
--
-- ⚠️ NOMBRE PROVISIONAL: "Clínica Dental" es un placeholder. El nombre comercial
--    real todavía no se dijo. Cambiarlo después es 1 UPDATE en `organizations`
--    (`name`) + el `name` de la config — el slug/URL sí conviene definirlo antes
--    de repartir accesos, porque cambiarlo rompe los links que ya circularon.
--
-- ⚠️ ZONA HORARIA SUPUESTA: queda 'America/Cancun' para ir parejo con el resto del
--    corporativo. Si la clínica está en Baja California (que es donde apunta la
--    "ruta médica" de prospección de NSG: Mexicali, Tijuana, San Luis) la correcta
--    sería 'America/Tijuana'. Es 1 UPDATE y solo importa el día que se prendan los
--    recordatorios — pero si está mal, los avisos de cita salen con horas corridas.
--
-- Motor de recordatorios: creado y APAGADO (enabled=false, shadow_mode=true). No
-- hay nadie con Telegram vinculado todavía; prenderlo antes solo encola avisos que
-- no llegan a ningún lado.
--
-- ── Por qué zoom_reminder_hours = 24 (y por qué NO sirve poner más) ───────────
-- En una clínica, el aviso que de verdad importa es el del DÍA ANTES: es lo que
-- baja las faltas y da tiempo a reocupar el hueco si el paciente no puede.
-- Ahora bien, fn_proactive_scan_zooms solo mira citas dentro de las próximas
-- 24 h (`next_action_at <= now() + interval '24 hours'`) y calcula el disparo
-- como GREATEST(cita - zoom_reminder_hours, now()). Consecuencia práctica:
--   · 24 = "avisame apenas la cita entre en las próximas 24 h" → confirmación del
--     día antes. Es el tope útil.
--   · >24 (48, 72) NO existe: esas citas ni siquiera entran al escaneo.
-- Además el motor ya manda solo el aviso de 1 h antes y el de 15 min antes.
--
-- ⚠️ LIMITACIÓN CONOCIDA (aplica a todos los tenants no-inmobiliarios, no solo a
--    éste): los textos de esos recordatorios están escritos a mano dentro de
--    fn_proactive_scan_zooms y dicen "Zoom" ("En 1 hora tu Zoom con…"). En una
--    clínica debería decir "cita". No se toca acá a propósito: esa función es
--    compartida y la usa Duke en producción. Cuando se prenda el motor para este
--    tenant hay que parametrizar el texto por org primero.
--
-- ── terminal_stages: por qué "No asistió" NO está en la lista ─────────────────
-- En el restaurante (Brasa) un no-show es terminal: la cena ya pasó, no hay nada
-- que rescatar. En una clínica es exactamente lo contrario: el paciente que faltó
-- es dinero recuperable y el negocio consiste en volver a llamarlo. Dejándolo
-- FUERA de terminal_stages, el escáner de inactividad lo levanta a los 7 días y
-- alguien lo persigue. Terminales son solo el alta y el presupuesto rechazado.
--
-- Se revierte con:
--   DELETE FROM proactive_config WHERE organization_id = '6c5cf32a-3db4-477d-bbed-26d90231bc9a';
--   DELETE FROM organizations   WHERE slug = 'clinica-dental';
--
-- Cómo prenderlo cuando la clínica tenga su gente en Telegram:
--   UPDATE proactive_config SET enabled = true, shadow_mode = false
--    WHERE organization_id = '6c5cf32a-3db4-477d-bbed-26d90231bc9a';

-- ── Organización ─────────────────────────────────────────────────────────────
INSERT INTO organizations (id, name, slug, plan, seats, primary_color, active, created_at, updated_at)
SELECT
  '6c5cf32a-3db4-477d-bbed-26d90231bc9a'::uuid,
  'Clínica Dental',
  'clinica-dental',
  'pro',
  10,
  '#22D3EE',          -- cian clínico
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'clinica-dental');

-- ── Motor proactivo, apagado ─────────────────────────────────────────────────
-- La cita es "Cita agendada". Inactividad de 7 días: un presupuesto presentado y
-- sin respuesta se enfría en una semana — ése es el momento de volver a llamar.
INSERT INTO proactive_config (
  organization_id, enabled, shadow_mode, zoom_stage_label, zoom_reminder_hours,
  terminal_stages, timezone, inactivity_days
)
SELECT
  '6c5cf32a-3db4-477d-bbed-26d90231bc9a'::uuid,
  false, true,
  'Cita agendada', 24,
  ARRAY['Alta / control','No aceptó']::text[],
  'America/Cancun',
  7
WHERE NOT EXISTS (
  SELECT 1 FROM proactive_config
   WHERE organization_id = '6c5cf32a-3db4-477d-bbed-26d90231bc9a'::uuid
);
