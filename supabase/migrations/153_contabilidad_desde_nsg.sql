-- ─────────────────────────────────────────────────────────────────────────────
-- Corrección de Ángel (27-jul): la contabilidad se mira desde NSG, no desde las personas.
--   · Duke le paga a NSG            → INGRESO de NSG
--   · NSG le paga a Iván y a Ángel  → EGRESO de NSG + INGRESO de cada uno
--   · Ni Iván ni Ángel tienen egresos: ellos solo reciben.
--   · Los servicios (Claude, Retell, Sidance…) son EGRESO de NSG aunque los pague
--     la tarjeta de Duke — igual tienen que estar en la contabilidad de NSG.
-- Convención: persona_id NULL = movimiento de la EMPRESA · persona_id = de esa persona.
-- ─────────────────────────────────────────────────────────────────────────────
delete from team_expenses where organization_id = '4a17b181-35d2-41b3-b639-6e0bd4c38acc'::uuid;

with gente as (
  select id, name, split_part(name,' ',1) as nombre
  from profiles where organization_id = '4a17b181-35d2-41b3-b639-6e0bd4c38acc'::uuid
),
pagos as (
  select m.id, m.fecha, m.monto, m.moneda, m.para_quien, m.metodo
  from fin_movements m
  where m.organization_id = '4a17b181-35d2-41b3-b639-6e0bd4c38acc'::uuid
    and m.deleted_at is null and m.estado = 'pagado' and m.tipo = 'nomina'
)
insert into team_expenses (organization_id, amount, currency, category, description, spent_at,
                           tipo, account, source, persona_id, contraparte, ref_movimiento)
-- 1) NSG paga la nómina → egreso de la empresa
select '4a17b181-35d2-41b3-b639-6e0bd4c38acc'::uuid, p.monto, p.moneda, 'Nómina',
       'Nómina pagada a ' || coalesce(p.para_quien,'—'), p.fecha::timestamptz,
       'egreso', coalesce(p.metodo,'General'), 'web',
       null, p.para_quien, p.id
from pagos p
union all
-- 2) la persona la recibe → ingreso suyo (sin egresos: solo reciben)
select '4a17b181-35d2-41b3-b639-6e0bd4c38acc'::uuid, p.monto, p.moneda, 'Nómina',
       'Nómina recibida de NSG', p.fecha::timestamptz,
       'ingreso', coalesce(p.metodo,'General'), 'web',
       (select g.id from gente g where p.para_quien ilike '%'||g.nombre||'%' limit 1),
       'NSG', p.id
from pagos p
where exists (select 1 from gente g where p.para_quien ilike '%'||g.nombre||'%');;
