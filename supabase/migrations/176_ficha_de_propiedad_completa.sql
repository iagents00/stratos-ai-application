-- 176 — La ficha de la propiedad, completa (para no volver a la hoja de cálculo)
--
-- El registro de grabaciones de Duke vivía en un Google Sheet con catorce
-- columnas. Al traer las propiedades al pipeline solo sobrevivieron cinco
-- (nombre, ubicación, etapa, fecha de rodaje y dos enlaces): el precio, el tipo,
-- la fecha de publicación y la mitad de los enlaces quedaron amontonados en el
-- campo `notas`, que es texto libre y no se puede filtrar ni mostrar bien.
--
-- Pedido de Iván (28-jul): «deja live el equivalente sin necesidad del excel».
-- Esta migración le da a cada propiedad un lugar propio para cada dato de la
-- hoja, para que abrir el Sheet deje de ser necesario.
--
-- Mapeo columna del Sheet → columna de la tabla:
--   fecha de publicacion  → fecha_publicacion
--   Carpeta Crudos        → crudos_url
--   link de Video         → video_url      (el video editado)
--   IG Reel               → ig_url         (ya existía)
--   Video Story           → story_url
--   Video Cine            → cine_url
--   Ficha tecnica         → ficha_url
--   Drive Informacion     → info_url
--   Precio                → precio
--   Tipo                  → tipo
--   Ubicacion             → locacion       (ya existía)
--   Estatus               → etapa          (ya existía)
--   Columna 1 (fecha)     → fecha_rodaje   (ya existía)
--
-- `precio` es TEXTO a propósito, no numérico: la hoja mezcla monedas y unidades
-- ("$22.88 MDP", "$2.1M USD") y además usa valores que no son números
-- ("Precio Reservado"). Guardarlo como numeric obligaría a inventar una
-- conversión y a perder el caso reservado. Si algún día hace falta ordenar por
-- precio, se agrega una columna numérica al lado sin tocar esta.
--
-- Solo CREATE: no se toca ni se borra nada. Revertir = dejar las columnas sin
-- usar (son nullables y no estorban).

alter table public.mkt_pipeline_items
  add column if not exists fecha_publicacion date,
  add column if not exists precio     text,
  add column if not exists tipo       text,
  add column if not exists crudos_url text,
  add column if not exists video_url  text,
  add column if not exists story_url  text,
  add column if not exists cine_url   text,
  add column if not exists ficha_url  text,
  add column if not exists info_url   text;

comment on column public.mkt_pipeline_items.fecha_publicacion is 'Cuándo se publicó el video (columna "fecha de publicacion" del registro).';
comment on column public.mkt_pipeline_items.precio     is 'Precio tal como lo escribe marketing: "$22.88 MDP", "$2.1M USD", "Precio Reservado". Texto a propósito.';
comment on column public.mkt_pipeline_items.tipo       is 'Casa - Villa | Depto | Terreno | lo que use la marca.';
comment on column public.mkt_pipeline_items.crudos_url is 'Carpeta de material en bruto (Carpeta Crudos).';
comment on column public.mkt_pipeline_items.video_url  is 'Video editado final (link de Video).';
comment on column public.mkt_pipeline_items.story_url  is 'Versión Story.';
comment on column public.mkt_pipeline_items.cine_url   is 'Versión cine.';
comment on column public.mkt_pipeline_items.ficha_url  is 'Ficha técnica de la propiedad.';
comment on column public.mkt_pipeline_items.info_url   is 'Carpeta de información en Drive.';
