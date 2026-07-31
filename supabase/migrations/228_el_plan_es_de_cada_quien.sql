-- ─────────────────────────────────────────────────────────────────────────────
-- 228_el_plan_es_de_cada_quien.sql
--
-- El Plan Semanal se guarda en `mkt_tasks` (una fila por persona y semana,
-- `origen = 'plan_semanal'`). Pero las policies de esa tabla exigen
-- `is_marketing_or_above()` — o sea rol super_admin/admin/marketing (+colaborador
-- con la mig 227). Yolanda es `director`: vería el módulo y NO podría guardar.
--
-- La salida fácil sería meter 'director' y 'ceo' en `is_marketing_or_above()`,
-- pero eso les abriría TODAS las tablas mkt_* — las marcas, el pipeline de video
-- y la bitácora del equipo de Alex. Un plan de trabajo no justifica eso.
--
-- Entonces: policies NUEVAS y quirúrgicas, solo para las filas del plan. Las
-- policies permisivas se SUMAN (se evalúan con OR), así que esto no le quita
-- nada a nadie; solo agrega el carril del plan.
--
--   · Escribir: cada quien el SUYO y nada más (`assignee_id = auth.uid()`).
--   · Leer:     el suyo siempre; el de los demás, solo el mando — que es quien
--               lo revisa los viernes. Un asesor no anda leyendo el plan de sus
--               compañeros.
--
-- Cubre `plan_semanal` y `plan_semanal_agenda` (las franjas que la persona manda
-- a su agenda desde el plan) con un LIKE, para no volver acá por cada variante.
--
-- Idempotente. Depende de la 227 solo para el rol `colaborador`; el resto de la
-- gente (director incluida) funciona con esta sola.
-- ─────────────────────────────────────────────────────────────────────────────

-- Leer: el propio, o cualquiera si sos del mando.
drop policy if exists mkt_tasks_plan_select on public.mkt_tasks;
create policy mkt_tasks_plan_select on public.mkt_tasks
for select using (
  organization_id = public.current_organization_id()
  and origen like 'plan_semanal%'
  and (
    assignee_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin','admin','director','ceo')
    )
  )
);

-- Crear: solo el propio.
drop policy if exists mkt_tasks_plan_insert on public.mkt_tasks;
create policy mkt_tasks_plan_insert on public.mkt_tasks
for insert with check (
  organization_id = public.current_organization_id()
  and origen like 'plan_semanal%'
  and assignee_id = auth.uid()
);

-- Editar: solo el propio, y no se puede "mover" a otra persona ni sacar del plan.
drop policy if exists mkt_tasks_plan_update on public.mkt_tasks;
create policy mkt_tasks_plan_update on public.mkt_tasks
for update using (
  organization_id = public.current_organization_id()
  and origen like 'plan_semanal%'
  and assignee_id = auth.uid()
) with check (
  organization_id = public.current_organization_id()
  and origen like 'plan_semanal%'
  and assignee_id = auth.uid()
);

-- ── Validación post-apply ────────────────────────────────────────────────────
--   select policyname, cmd from pg_policies
--    where tablename = 'mkt_tasks' and policyname like 'mkt_tasks_plan%'
--    order by policyname;
--   -- esperado: 3 filas (insert, select, update)
--
-- ── Rollback ─────────────────────────────────────────────────────────────────
--   drop policy if exists mkt_tasks_plan_select on public.mkt_tasks;
--   drop policy if exists mkt_tasks_plan_insert on public.mkt_tasks;
--   drop policy if exists mkt_tasks_plan_update on public.mkt_tasks;
--   -- Volver a esto deja el Plan Semanal solo para quien pase
--   -- `is_marketing_or_above()`; el resto lo vería vacío y sin poder guardar.
