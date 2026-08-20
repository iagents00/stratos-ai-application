-- 230 — El expediente guarda la identificación del cliente
-- ─────────────────────────────────────────────────────────────────────────────
-- El Discovery (expediente del lead) suma un campo compacto "ID / Pasaporte"
-- en la sección de notas para registrar la identificación del cliente
-- (INE, pasaporte, etc.). Cuando tiene valor, el avatar del lead cambia de
-- inicial a icono de persona en verde — señal rápida de "ya dejó su ID".
--
-- Columna nullable, sin default y sin backfill: aditiva y 100% reversible
-- (ALTER TABLE public.leads DROP COLUMN id_document).
-- RLS existente de leads aplica tal cual (hereda visibilidad por organización).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS id_document text;

COMMENT ON COLUMN public.leads.id_document IS
  'Identificación del cliente (INE / pasaporte / otro documento) capturada por el asesor en el Discovery. Texto libre.';
