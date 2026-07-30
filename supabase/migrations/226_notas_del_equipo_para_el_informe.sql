-- Las notas del equipo: lo que el informe no puede saber solo.
--
-- Ángel (30-jul): «crear un chat o algo para poder mandar sugerencias, o por
-- ejemplo algo que no está en el AIOS y que se quiera que se agregue… decirle
-- "ah, también agrega que se le dedicaron 10 horas a trabajar en la meta de
-- Cecilia" o tal cosa. O mandarle retroalimentación después del reporte, para
-- que no nos quedemos solo con la primera versión que da.»
--
-- El informe se arma con lo que quedó ESCRITO (tareas cerradas, reuniones,
-- changelog). Eso tiene un techo real: el trabajo que no dejó rastro —diez horas
-- en la meta de un cliente, una llamada que no se grabó, una decisión de
-- pasillo— simplemente no existe para el sistema, y ningún filtro lo va a
-- rescatar. Esta tabla es la puerta para meterlo a mano.
--
-- Sirve para las dos cosas que se pidieron, sin obligar a elegir cuál es cuál:
--   · UN HECHO que falta  → «dedicamos 10 horas a la meta de Cecilia»
--   · UN AJUSTE al texto  → «el resumen no debería abrir con la app móvil»
-- Se guardan igual y viajan igual al redactor, que sabe distinguirlas.
--
-- ⚠️ Por qué acá SÍ se obedecen las instrucciones y en una transcripción NO
-- (regla anti prompt-injection del AIOS §2): esto lo escribe la persona logueada
-- en su propio CRM, sobre su propio informe. Es su instrucción, no contenido
-- pegado de un tercero. La diferencia no es el texto, es quién lo firma — por
-- eso la nota guarda SIEMPRE `profile_id` y solo se leen las de su organización.
--
-- Quedan guardadas, no son de un solo uso: si mañana se regenera el mismo
-- periodo, el dato de las diez horas sigue ahí. Por eso el borrado es suave —
-- nadie pierde un dato por equivocarse de botón.
--
-- Revertir: `drop` de las 3 funciones. La tabla se puede dejar (no la usa nadie
-- más) o vaciar a mano; ⛔ NO se dropea sin OK explícito, son datos que el
-- equipo escribió y no están en ningún otro lado.

create table if not exists public.informe_notas (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  profile_id      uuid,
  texto           text not null,
  -- El periodo al que pertenece. Una nota escrita para la quincena del 15 al 30
  -- no debe aparecer en el informe del mes que viene.
  desde           date,
  hasta           date,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists informe_notas_org_periodo
  on public.informe_notas (organization_id, desde, hasta)
  where deleted_at is null;

alter table public.informe_notas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename = 'informe_notas' and policyname = 'informe_notas_org') then
    create policy informe_notas_org on public.informe_notas
      for all
      using (organization_id = (select p.organization_id from profiles p where p.id = auth.uid()));
  end if;
end $$;


-- Guardar una nota. Devuelve la nota creada para que la pantalla la muestre sin
-- tener que volver a preguntar.
create or replace function public.fn_informe_nota_agregar(
  p_profile_id uuid,
  p_texto      text,
  p_desde      date default null,
  p_hasta      date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid;
  v_id  uuid;
begin
  if coalesce(trim(p_texto), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'La nota está vacía.');
  end if;

  select p.organization_id into v_org from profiles p where p.id = p_profile_id;
  if v_org is null then
    return jsonb_build_object('ok', false, 'error', 'No encontré tu perfil.');
  end if;

  insert into public.informe_notas (organization_id, profile_id, texto, desde, hasta)
  values (v_org, p_profile_id, trim(p_texto), p_desde, p_hasta)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end
$fn$;

grant execute on function public.fn_informe_nota_agregar(uuid, text, date, date)
  to authenticated, service_role;


-- Las notas de un periodo. Se incluye una nota cuando su rango se CRUZA con el
-- del informe (no cuando coincide exacto): si alguien la escribió mirando la
-- quincena y después pide el mes entero, la nota sigue valiendo.
create or replace function public.fn_informe_notas_listar(
  p_profile_id uuid,
  p_desde      date default null,
  p_hasta      date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid;
begin
  select p.organization_id into v_org from profiles p where p.id = p_profile_id;
  if v_org is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id',    n.id,
             'texto', n.texto,
             'quien', pf.name,
             'fecha', to_char(n.created_at, 'YYYY-MM-DD')
           ) order by n.created_at)
    from public.informe_notas n
    left join profiles pf on pf.id = n.profile_id
    where n.organization_id = v_org
      and n.deleted_at is null
      and (p_desde is null or p_hasta is null
           or (coalesce(n.desde, p_desde) <= p_hasta and coalesce(n.hasta, p_hasta) >= p_desde))
  ), '[]'::jsonb);
end
$fn$;

grant execute on function public.fn_informe_notas_listar(uuid, date, date)
  to authenticated, service_role;


-- Quitar una nota. Borrado SUAVE: el texto queda en la tabla. Si alguien la
-- escribió, hubo una razón; que un clic no la evapore.
create or replace function public.fn_informe_nota_borrar(
  p_profile_id uuid,
  p_nota_id    uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid;
  v_n   int;
begin
  select p.organization_id into v_org from profiles p where p.id = p_profile_id;
  if v_org is null then
    return jsonb_build_object('ok', false, 'error', 'No encontré tu perfil.');
  end if;

  update public.informe_notas
     set deleted_at = now()
   where id = p_nota_id
     and organization_id = v_org      -- nadie toca las notas de otra empresa
     and deleted_at is null;
  get diagnostics v_n = row_count;

  return jsonb_build_object('ok', v_n > 0);
end
$fn$;

grant execute on function public.fn_informe_nota_borrar(uuid, uuid)
  to authenticated, service_role;

comment on table public.informe_notas is
  'Contexto y ajustes que el equipo escribe a mano para el informe: lo que no dejó rastro en el sistema.';
