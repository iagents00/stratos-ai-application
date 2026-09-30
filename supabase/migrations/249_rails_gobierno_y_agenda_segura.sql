-- Additive hardening. Apply only after staging tests and a verified backup.
-- No destructive rollback: disabling this guard would reopen advisor writes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.rails_config_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  actor_id uuid,
  previous_config jsonb,
  next_config jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rails_config_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rails_config_history FROM public, anon, authenticated;
GRANT SELECT ON public.rails_config_history TO authenticated;
DROP POLICY IF EXISTS rails_history_admin ON public.rails_config_history;
CREATE POLICY rails_history_admin ON public.rails_config_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
  AND p.organization_id = rails_config_history.organization_id AND p.role IN ('admin','super_admin')));

CREATE OR REPLACE FUNCTION public.guard_rails_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (OLD.meta_config->'rails') IS DISTINCT FROM (NEW.meta_config->'rails') THEN
    IF coalesce(auth.role(), '') <> 'service_role' AND NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
      AND p.organization_id = NEW.id AND p.role IN ('admin','super_admin')
    ) THEN RAISE EXCEPTION 'Solo un administrador de esta organización puede configurar Rieles.' USING ERRCODE = '42501'; END IF;
    IF NEW.meta_config ? 'rails' AND jsonb_typeof(NEW.meta_config->'rails') <> 'object'
      THEN RAISE EXCEPTION 'La configuración de Rieles debe ser un objeto.' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.rails_config_history(organization_id,actor_id,previous_config,next_config)
      VALUES(NEW.id,auth.uid(),OLD.meta_config->'rails',NEW.meta_config->'rails');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_rails_config() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS guard_rails_config ON public.organizations;
CREATE TRIGGER guard_rails_config BEFORE UPDATE OF meta_config ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.guard_rails_config();

-- Writes go through the identity-checking RPC, not arbitrary agenda inserts/updates.
REVOKE INSERT, UPDATE, DELETE ON public.agenda_items FROM authenticated, anon;
CREATE OR REPLACE FUNCTION public.rails_marcar_accion(
  p_lead_id uuid, p_tipo text, p_razon text, p_estado text DEFAULT 'hecho',
  p_pedir text DEFAULT NULL, p_canal text DEFAULT NULL, p_resultado text DEFAULT NULL
) RETURNS public.agenda_items LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_org uuid; v_name text; v_row public.agenda_items;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sin sesión.' USING ERRCODE = '42501'; END IF;
  SELECT organization_id,name INTO v_org,v_name FROM public.profiles WHERE id=v_uid;
  IF v_org IS NULL OR p_lead_id IS NULL THEN RAISE EXCEPTION 'Cliente o cuenta inválidos.' USING ERRCODE='42501'; END IF;
  IF p_estado IS NULL OR p_estado NOT IN ('pendiente','hecho','movido','saltado') OR coalesce(length(trim(p_tipo)),0)=0
    OR length(p_tipo)>80 OR coalesce(length(p_resultado),0)>2000
    THEN RAISE EXCEPTION 'Resultado inválido.' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id=p_lead_id AND l.organization_id=v_org
    AND l.deleted_at IS NULL AND NOT coalesce(l.opt_out,false)
    AND (l.asesor_id=v_uid OR (l.asesor_id IS NULL AND l.asesor_name=v_name)
      OR public.is_admin_or_above() OR public.can_view_all_leads()))
    THEN RAISE EXCEPTION 'No tienes acceso a ese cliente o ya no admite contacto.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.agenda_items(organization_id,asesor_id,asesor_name,lead_id,fecha,tipo,canal,razon,pedir,estado,resultado,completado_at)
  VALUES(v_org,v_uid,coalesce(v_name,'sin nombre'),p_lead_id,CURRENT_DATE,p_tipo,p_canal,coalesce(p_razon,''),p_pedir,p_estado,p_resultado,
    CASE WHEN p_estado='pendiente' THEN NULL ELSE now() END)
  ON CONFLICT (lead_id,fecha) WHERE lead_id IS NOT NULL DO UPDATE SET
    estado=EXCLUDED.estado, resultado=EXCLUDED.resultado, razon=EXCLUDED.razon,
    pedir=EXCLUDED.pedir, canal=EXCLUDED.canal, completado_at=EXCLUDED.completado_at
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.rails_marcar_accion(uuid,text,text,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rails_marcar_accion(uuid,text,text,text,text,text,text) TO authenticated;
COMMIT;
