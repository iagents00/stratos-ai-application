-- ═══════════════════════════════════════════════════════════════════════════
-- 033 — Stratos Rails: las RPC de la agenda del día
-- APLICADA EN PRODUCCIÓN el 2026-08-23.
-- ───────────────────────────────────────────────────────────────────────────
-- POR QUÉ RPC Y NO INSERT DESDE EL NAVEGADOR
-- La organización y el nombre del asesor se derivan de auth.uid() acá dentro,
-- nunca se reciben del cliente. Es el mismo patrón del resto del sistema: si
-- el front pudiera mandar organization_id, un request manipulado escribiría
-- en la agenda de otra empresa.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rails_marcar_accion(
  p_lead_id   uuid,
  p_tipo      text,
  p_razon     text,
  p_estado    text DEFAULT 'hecho',
  p_pedir     text DEFAULT NULL,
  p_canal     text DEFAULT NULL,
  p_resultado text DEFAULT NULL
)
RETURNS public.agenda_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org    uuid;
  v_nombre text;
  v_asesor uuid := auth.uid();
  v_row    public.agenda_items;
BEGIN
  IF v_asesor IS NULL THEN
    RAISE EXCEPTION 'Sin sesión.';
  END IF;

  SELECT organization_id, name INTO v_org, v_nombre
  FROM public.profiles WHERE id = v_asesor;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'El usuario no pertenece a ninguna organización.';
  END IF;

  IF p_estado NOT IN ('pendiente','hecho','movido','saltado') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_estado;
  END IF;

  -- El lead tiene que ser de la misma organización. Sin este guard, un id
  -- ajeno colaría una fila con la org de quien llama.
  IF p_lead_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.leads
    WHERE id = p_lead_id AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'Ese cliente no es de tu organización.';
  END IF;

  INSERT INTO public.agenda_items (
    organization_id, asesor_id, asesor_name, lead_id, fecha,
    tipo, canal, razon, pedir, estado, resultado, completado_at
  ) VALUES (
    v_org, v_asesor, COALESCE(v_nombre, 'sin nombre'), p_lead_id, CURRENT_DATE,
    p_tipo, p_canal, COALESCE(p_razon, ''), p_pedir, p_estado, p_resultado,
    CASE WHEN p_estado = 'pendiente' THEN NULL ELSE now() END
  )
  ON CONFLICT (lead_id, fecha) WHERE lead_id IS NOT NULL
  DO UPDATE SET
    estado        = EXCLUDED.estado,
    resultado     = EXCLUDED.resultado,
    razon         = EXCLUDED.razon,
    pedir         = EXCLUDED.pedir,
    canal         = EXCLUDED.canal,
    completado_at = EXCLUDED.completado_at
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Devuelve SOLO lo del usuario en sesión. Mi Día la usa al montar para no
-- volver a mostrar lo que ya se cerró.
CREATE OR REPLACE FUNCTION public.rails_agenda_hoy()
RETURNS SETOF public.agenda_items
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.*
  FROM public.agenda_items a
  JOIN public.profiles p ON p.id = auth.uid()
  WHERE a.organization_id = p.organization_id
    AND a.asesor_id = auth.uid()
    AND a.fecha = CURRENT_DATE
  ORDER BY a.orden, a.created_at;
$$;

REVOKE ALL ON FUNCTION public.rails_marcar_accion(uuid,text,text,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rails_marcar_accion(uuid,text,text,text,text,text,text) TO authenticated;

REVOKE ALL ON FUNCTION public.rails_agenda_hoy() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rails_agenda_hoy() TO authenticated;

COMMENT ON FUNCTION public.rails_marcar_accion IS
  'Stratos Rails: cierra una tarjeta del día. Deriva org y asesor de auth.uid(); idempotente por (lead_id, fecha).';
COMMENT ON FUNCTION public.rails_agenda_hoy IS
  'Stratos Rails: la agenda de hoy del usuario en sesión.';
