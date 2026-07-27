-- LECTOR DE AVANCES (Ángel, 27-jul): nadie va a mantener la disciplina de "apunta que…",
-- pero SÍ se habla. En una llamada se dice "ya pagué Retell" y el sistema sigue recordándolo.
-- Esto lee las conversaciones y mueve el sistema solo, guardando la frase que lo justifica.
create table if not exists public.auto_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  fuente text not null,
  fuente_ref text,
  tipo text not null,
  referencia text,
  valor text,
  evidencia text not null,
  confianza text default 'media',
  estado text not null default 'propuesto',
  resultado text,
  aplicado_at timestamptz,
  revisado_por uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_auto_facts_org on public.auto_facts(organization_id, created_at desc);
alter table public.auto_facts enable row level security;
drop policy if exists auto_facts_org on public.auto_facts;
create policy auto_facts_org on public.auto_facts for all to authenticated
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

create or replace function public.fn_contexto_abierto(p_org uuid)
returns jsonb language plpgsql stable
security definer set search_path to 'public' as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'tareas_abiertas', coalesce((
      select jsonb_agg(jsonb_build_object('titulo', t.titulo, 'responsable', p.name, 'estado', t.estado))
      from mkt_tasks t left join profiles p on p.id = t.assignee_id
      where t.organization_id = p_org and t.deleted_at is null and t.estado <> 'hecha'), '[]'::jsonb),
    'objetivos_clientes', coalesce((
      select jsonb_agg(jsonb_build_object('cliente', l.name, 'objetivo', o.titulo,
                                          'actual', o.actual, 'meta', o.meta, 'unidad', o.unidad))
      from client_objectives o join leads l on l.id = o.lead_id
      where o.organization_id = p_org and o.deleted_at is null and o.estado = 'activo'), '[]'::jsonb),
    'clientes', coalesce((select jsonb_agg(l.name) from leads l where l.organization_id = p_org), '[]'::jsonb),
    'personas', coalesce((select jsonb_agg(p.name) from profiles p where p.organization_id = p_org), '[]'::jsonb)
  ) into v;
  return v;
end $$;;
