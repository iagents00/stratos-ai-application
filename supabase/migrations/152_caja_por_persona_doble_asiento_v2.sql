-- Corrección de Ángel (27-jul): «todo lo está contando como egresos».
-- El dinero PASA POR IVÁN: Duke le paga a Iván (ingreso de Iván) y de ahí Iván le
-- paga a Ángel (egreso de Iván + ingreso de Ángel). Un mismo pago es egreso para
-- uno e ingreso para el otro. Antes todo entraba como egreso y ninguno veía lo suyo.
alter table team_expenses add column if not exists persona_id uuid;
alter table team_expenses add column if not exists contraparte text;
alter table team_expenses add column if not exists ref_movimiento uuid;
create index if not exists idx_team_expenses_persona on team_expenses(organization_id, persona_id);

delete from team_expenses where organization_id = '4a17b181-35d2-41b3-b639-6e0bd4c38acc'::uuid;

with gente as (
  select id, name, split_part(name,' ',1) as nombre
  from profiles where organization_id = '4a17b181-35d2-41b3-b639-6e0bd4c38acc'::uuid
),
pagos as (
  select m.id, m.fecha, m.monto, m.moneda, m.concepto, m.de_quien, m.para_quien, m.metodo
  from fin_movements m
  where m.organization_id = '4a17b181-35d2-41b3-b639-6e0bd4c38acc'::uuid
    and m.deleted_at is null and m.estado = 'pagado'
)
insert into team_expenses (organization_id, amount, currency, category, description, spent_at,
                           tipo, account, source, persona_id, contraparte, ref_movimiento)
select '4a17b181-35d2-41b3-b639-6e0bd4c38acc'::uuid, p.monto, p.moneda, 'Nómina',
       'Nómina recibida de ' || coalesce(p.de_quien,'—'), p.fecha::timestamptz,
       'ingreso', coalesce(p.metodo,'General'), 'web',
       (select g.id from gente g where p.para_quien ilike '%'||g.nombre||'%' limit 1),
       p.de_quien, p.id
from pagos p
where exists (select 1 from gente g where p.para_quien ilike '%'||g.nombre||'%')
union all
select '4a17b181-35d2-41b3-b639-6e0bd4c38acc'::uuid, p.monto, p.moneda, 'Nómina',
       'Nómina pagada a ' || coalesce(p.para_quien,'—'), p.fecha::timestamptz,
       'egreso', coalesce(p.metodo,'General'), 'web',
       (select g.id from gente g where p.de_quien ilike '%'||g.nombre||'%' limit 1),
       p.para_quien, p.id
from pagos p
where exists (select 1 from gente g where p.de_quien ilike '%'||g.nombre||'%');;
