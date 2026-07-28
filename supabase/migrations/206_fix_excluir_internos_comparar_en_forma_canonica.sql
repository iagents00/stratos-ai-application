-- ════════════════════════════════════════════════════════════════════════
-- 206 — Corrige el candado de la 205: comparar en forma CANÓNICA
-- ────────────────────────────────────────────────────────────────────────
-- La 205 comparaba fn_phone_canon(telefono) contra los dígitos crudos
-- ('5219848770028'), pero la forma canónica de un móvil mexicano colapsa
-- el "1" de WhatsApp: +5219848770028 -> 529848770028. Nunca matcheaba, así
-- que el UPDATE tocó 0 filas y los números internos seguían siendo llamables.
-- Se detectó al verificar, antes de encolar nada.
-- Revertir: do_not_contact = false en esos cinco.
-- ════════════════════════════════════════════════════════════════════════

UPDATE public.leads
SET do_not_contact = true, updated_at = now()
WHERE organization_id = '00000000-0000-0000-0000-000000000001'::UUID
  AND deleted_at IS NULL
  AND public.fn_phone_canon(coalesce(voice_phone_e164, whatsapp_phone_e164,
                                     phone_normalized, phone))
      IN (
        public.fn_phone_canon('+5219848770028'),  -- Emmanuel Ortiz — Gte. de Ventas de Duke
        public.fn_phone_canon('+5219848041787'),  -- Alexander Administrativo Duke Del Caribe
        public.fn_phone_canon('+5219842181660'),  -- El Duke De Caribe (la empresa)
        public.fn_phone_canon('+5219841539408'),  -- Gael Velasco (el propio asesor)
        public.fn_phone_canon('+5219841658649')   -- Administración Duke Del Caribe
      );
