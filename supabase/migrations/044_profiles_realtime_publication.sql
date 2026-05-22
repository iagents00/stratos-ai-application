-- 044_profiles_realtime_publication.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Habilita realtime (postgres_changes) sobre public.profiles para que el CRM
-- pueda suscribirse a cambios de crm_prefs de su propia fila.
--
-- Contexto: el bot de Telegram reordena/pinea clientes escribiendo en
-- profiles.crm_prefs. El CRM abierto en el browser pisaba ese cambio al
-- re-guardar su snapshot en memoria (last-writer-wins). Con la suscripción
-- realtime del front (gateada al cliente Duke vía crm.prefsRealtimeSync), el
-- reorden del bot se refleja en vivo — pero requiere que profiles emita por la
-- publicación supabase_realtime.
--
-- Seguridad: el broadcast respeta RLS. La policy de SELECT de profiles
-- (profiles_select_org_scoped: id = auth.uid() OR misma organización) garantiza
-- que cada usuario solo reciba eventos de filas que ya puede leer. El front
-- filtra además por id=eq.<su propio id>.
--
-- Aditivo e idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
