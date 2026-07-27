-- ─────────────────────────────────────────────────────────────────────────────
-- 172 · El catálogo de proyectos se edita desde el CRM (no por Sheet + redeploy)
-- ─────────────────────────────────────────────────────────────────────────────
-- CONTEXTO
--   Hasta ahora el equipo de Duke mandaba la carpeta de Drive de cada desarrollo
--   y alguien regeneraba a mano src/app/data/catalogoProyectos.js desde el Sheet
--   «DRIVES DUKE DEL CARIBE». El equipo no podía dar de alta ni corregir sus
--   propios proyectos.
--
--   Los módulos Proyectos y Create ahora escriben directo en
--   public.catalogo_proyectos (la tabla que ya creó catalogo_proyectos_telegram.sql
--   y que YA lee el asistente en bot_buscar_proyectos). Con eso, registrar un
--   proyecto lo deja visible al instante en el CRM, en Create y en Telegram.
--
-- QUÉ HACE ESTA MIGRACIÓN
--   SOLO agrega columnas de auditoría (quién y cuándo). Es ADITIVA: no borra ni
--   modifica datos, no toca RLS ni funciones. Es OPCIONAL — el CRM funciona sin
--   ella (src/lib/catalogo-proyectos.js reintenta el guardado sin estos campos si
--   todavía no existen). Aplicarla solo mejora la trazabilidad.
--
-- PERMISOS (sin cambios, a propósito)
--   Registrar/editar sigue exigiendo is_admin_or_above() → super_admin, admin,
--   ceo, director. Los asesores ven el catálogo pero no lo modifican.
--   Si algún día se quiere que los asesores también registren, es cambiar la
--   política catalogo_insert_admin — decisión de negocio, NO se hace acá.
--
-- REVERSIÓN
--   Las columnas quedan nulables y sin uso obligatorio; para revertir alcanza con
--   dejar de escribirlas (no hace falta DROP, y este repo no borra columnas).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.catalogo_proyectos
  add column if not exists updated_at      timestamptz,
  add column if not exists created_by_name text,
  add column if not exists updated_by_name text;

comment on column public.catalogo_proyectos.updated_at is
  'Última edición hecha desde el CRM (Proyectos / Create).';
comment on column public.catalogo_proyectos.created_by_name is
  'Nombre del perfil que registró el desarrollo desde el CRM.';
comment on column public.catalogo_proyectos.updated_by_name is
  'Nombre del perfil que lo editó por última vez desde el CRM.';

-- Los proyectos recién registrados se listan primero en el panel de administración.
create index if not exists idx_catalogo_updated
  on public.catalogo_proyectos(organization_id, updated_at desc nulls last);
