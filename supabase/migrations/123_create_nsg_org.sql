-- 123_create_nsg_org.sql
-- Crea la organización "NSG" — el espacio de operación INTERNO de NSG (la empresa
-- paraguas). Es el tenant del white-label /nsg donde Iván y Ángel (y quien se sume
-- al equipo de NSG) llevan su operación: adquisición de las 100 inmobiliarias,
-- proyectos de desarrollo y sprints. Datos aislados por organization_id + RLS.
--
-- ⚠️ NO confundir con la org "Stratos Sales" (slug 'stratos-sales', "NSG - Stratos
--    AI Sales", b1145073-…): ese es el tenant de VENTA del producto. Éste es el
--    espacio de OPERACIÓN de NSG. Son dos orgs distintas a propósito (decisión de
--    Ángel, 2026-07-24: camino B — /nsg es su propio espacio nuevo).
--
-- Idempotente: seguro de re-correr.
-- Se revierte con: DELETE FROM organizations WHERE slug = 'nsg';

INSERT INTO organizations (id, name, slug, plan, seats, primary_color, active, created_at, updated_at)
SELECT
  '4a17b181-35d2-41b3-b639-6e0bd4c38acc'::uuid,
  'NSG',
  'nsg',
  'enterprise',
  10,
  '#F472B6',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'nsg');
