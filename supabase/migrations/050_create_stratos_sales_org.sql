-- 050_create_stratos_sales_org.sql
-- Creates the "Stratos Sales" tenant organization for the internal sales funnel
-- that sells Stratos AI to other companies. Owned by NSG (parent company).
--
-- Idempotent: safe to re-run.
-- Rolled back by: DELETE FROM organizations WHERE slug = 'stratos-sales';

INSERT INTO organizations (id, name, slug, plan, seats, primary_color, active, created_at, updated_at)
SELECT
  'b1145073-434c-4779-a243-d5e8f5ff3617'::uuid,
  'Stratos Sales',
  'stratos-sales',
  'enterprise',
  5,
  '#10B981',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'stratos-sales');
