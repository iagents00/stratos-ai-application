-- 172 — La bitácora del equipo de marketing, visible para el líder
--
-- Contexto (28-jul-2026): el equipo de Duke reporta su día en un Google Form
-- («Form_Responses»: quién, área, fecha, actividades realizadas, evidencia en
-- Drive). Ese reporte vivía SOLO en la hoja de cálculo — Alex tenía que salir
-- del CRM para leerlo.
--
-- La tabla `mkt_daily_reports` existía desde la migración 106 pero nació muerta:
-- cero filas, ninguna pantalla y ninguna función la leían. Esta migración le
-- agrega lo único que le faltaba para servir al caso real —el enlace a la
-- evidencia— y la pestaña Equipo empieza a mostrarla.
--
-- Por qué una columna nueva y no reusar `audio_url`: ese campo se pensó para las
-- notas de voz que llegan por Telegram. Meter ahí un link de Drive dejaría el
-- dato mintiendo sobre lo que es, y dentro de tres meses nadie sabría por qué un
-- "audio" abre una carpeta de fotos.
--
-- Solo CREATE: no se toca ni se borra nada existente. Revertir = dejar la
-- columna sin usar (queda nula, no estorba) o `alter table … drop column` con OK
-- humano.

alter table public.mkt_daily_reports
  add column if not exists evidencia_url text;

comment on column public.mkt_daily_reports.evidencia_url is
  'Enlace a la evidencia del día (carpeta o archivo de Drive). Viene del formulario de bitácora del equipo.';

-- `origen` ya trae default 'telegram'. Los reportes cargados desde el formulario
-- se marcan con origen='formulario' para poder distinguirlos después.
comment on column public.mkt_daily_reports.origen is
  'De dónde vino el reporte: telegram | copilot | formulario | manual.';
