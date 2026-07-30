-- ═══════════════════════════════════════════════════════════════════════════
-- 191 — Por qué NSG «se veía desactualizado»: 3 tareas TERMINADAS contaban
--       como pendientes por una letra
--
-- Iván: «veo que aún está desactualizado todo lo que hacemos en NSG».
-- No era falta de automatización: era un dato sucio.
--
-- La app conoce CUATRO estados: por_hacer · en_curso · en_revision · hecha.
-- En NSG habían quedado escritos a mano dos que NO existen:
--   · 'hecho'     (3 tareas) → la app las cuenta como NO hechas, porque compara
--                              contra 'hecha'. Están terminadas y se ven abiertas.
--   · 'pendiente' (9 tareas) → estado desconocido: no pinta su chip.
-- Por eso el proyecto «Stratos IA de NSG» mostraba 3/9 cuando en realidad van
-- 6 de 9.
--
-- Verificado antes de tocar: NINGUNA función del motor (fn_mkt_*) escribe
-- 'pendiente' ni 'hecho' — todas usan por_hacer/hecha. Entraron por el seed
-- manual de NSG. Duke y QA Lab ya estaban limpios y NO se tocan.
--
-- Se agrega un CHECK para que no vuelva a colarse un estado inventado.
-- Reversa: drop del constraint y volver a los valores viejos (listados arriba).
-- ═══════════════════════════════════════════════════════════════════════════

update public.mkt_tasks set estado='hecha'
 where organization_id='4a17b181-35d2-41b3-b639-6e0bd4c38acc' and estado='hecho';

update public.mkt_tasks set estado='por_hacer'
 where organization_id='4a17b181-35d2-41b3-b639-6e0bd4c38acc' and estado='pendiente';

alter table public.mkt_tasks
  add constraint mkt_tasks_estado_check
  check (estado in ('por_hacer','en_curso','en_revision','hecha'));
