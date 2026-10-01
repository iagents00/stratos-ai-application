-- Stratos Rails: resultado + siguiente paso en una transacción.
-- Aplicar antes del frontend. No activa Rails ni modifica gestiones históricas.
BEGIN;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sprint_ultimo_contacto_at timestamptz;
CREATE TABLE IF NOT EXISTS public.rails_eventos (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  asesor_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  resultado text NOT NULL CHECK (resultado IN ('contactado','sin_respuesta','reprogramado')),
  detalle text NOT NULL,
  canal text NOT NULL,
  siguiente_accion text NOT NULL,
  siguiente_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rails_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rails_eventos_select ON public.rails_eventos;
CREATE POLICY rails_eventos_select ON public.rails_eventos FOR SELECT TO authenticated
USING (organization_id = public.current_organization_id()
  AND (asesor_id = auth.uid() OR public.is_admin_or_above()));
REVOKE ALL ON public.rails_eventos FROM anon, authenticated;
GRANT SELECT ON public.rails_eventos TO authenticated;
-- Las escrituras directas evadirían el circuito y su evidencia.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.agenda_items FROM authenticated;

CREATE OR REPLACE FUNCTION public.rails_resolver_accion(
  p_id uuid, p_lead_id uuid, p_version timestamptz, p_tipo text, p_razon text,
  p_resultado text, p_detalle text, p_canal text, p_siguiente text,
  p_siguiente_at timestamptz, p_timezone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor public.profiles; v_lead public.leads; v_evento public.rails_eventos;
  v_agenda public.agenda_items; v_estado text; v_fecha date;
BEGIN
  SELECT * INTO v_actor FROM public.profiles WHERE id = auth.uid();
  IF auth.uid() IS NULL OR v_actor.organization_id IS NULL OR v_actor.active IS FALSE THEN
    RAISE EXCEPTION 'Necesitas una sesión activa.';
  END IF;
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND OR v_lead.organization_id IS DISTINCT FROM v_actor.organization_id
    OR NOT coalesce((v_actor.role IN ('admin','super_admin','ceo','director')
      OR (nullif(v_actor.name, '') IS NOT NULL AND v_lead.asesor_name = v_actor.name)), false) THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar este cliente.';
  END IF;
  -- Un reintento del MISMO envío no cuenta dos contactos ni pisa un paso nuevo.
  SELECT * INTO v_evento FROM public.rails_eventos WHERE id = p_id;
  IF FOUND THEN
    IF v_evento.asesor_id <> auth.uid() OR v_evento.lead_id <> p_lead_id THEN
      RAISE EXCEPTION 'El identificador de gestión ya está en uso.';
    END IF;
    RETURN jsonb_build_object('lead', to_jsonb(v_lead), 'repetido', true);
  END IF;
  IF v_lead.deleted_at IS NOT NULL OR v_lead.opt_out IS TRUE
    OR v_lead.stage IN ('Cierre','Postventa','Descartado') THEN
    RAISE EXCEPTION 'El cliente ya no admite gestiones comerciales. Actualiza la lista.';
  END IF;
  IF p_version IS NULL OR v_lead.updated_at IS DISTINCT FROM p_version THEN
    RAISE EXCEPTION 'La ficha cambió desde que abriste la tarjeta. Actualiza la lista y revisa el siguiente paso.';
  END IF;
  IF p_id IS NULL OR p_resultado IS NULL OR p_resultado NOT IN ('contactado','sin_respuesta','reprogramado')
    OR p_canal IS NULL OR p_canal NOT IN ('llamada','whatsapp','zoom','otro')
    OR coalesce(length(trim(p_detalle)),0) NOT BETWEEN 3 AND 2000
    OR coalesce(length(trim(p_siguiente)),0) NOT BETWEEN 3 AND 1000
    OR coalesce(length(trim(p_tipo)),0) NOT BETWEEN 1 AND 100
    OR coalesce(length(p_razon),0) > 2000
    OR p_siguiente_at IS NULL OR p_siguiente_at <= now() THEN
    RAISE EXCEPTION 'Registra un resultado, un siguiente paso y una fecha futura.';
  END IF;
  IF p_timezone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
    RAISE EXCEPTION 'Zona horaria inválida.';
  END IF;
  v_fecha := (now() AT TIME ZONE p_timezone)::date;
  v_estado := CASE p_resultado WHEN 'contactado' THEN 'hecho' WHEN 'sin_respuesta' THEN 'saltado' ELSE 'movido' END;
  INSERT INTO public.rails_eventos (id,organization_id,asesor_id,lead_id,resultado,detalle,canal,siguiente_accion,siguiente_at)
  VALUES (p_id,v_actor.organization_id,auth.uid(),p_lead_id,p_resultado,trim(p_detalle),p_canal,trim(p_siguiente),p_siguiente_at);
  -- Solo el timestamp: el trigger existente deriva el texto legado. Incluir
  -- next_action_date dispararía una segunda conversión según la zona de la org.
  UPDATE public.leads SET
    next_action = trim(p_siguiente), next_action_at = p_siguiente_at,
    sprint_toques = coalesce(sprint_toques,0) + CASE WHEN p_resultado = 'reprogramado' THEN 0 ELSE 1 END,
    sprint_ultimo_canal = CASE WHEN p_resultado = 'reprogramado' THEN sprint_ultimo_canal ELSE p_canal END,
    sprint_ultimo_contacto_at = CASE WHEN p_resultado = 'reprogramado' THEN sprint_ultimo_contacto_at ELSE now() END,
    sprint_inicio = CASE WHEN p_resultado = 'reprogramado' THEN sprint_inicio ELSE coalesce(sprint_inicio,now()) END,
    action_history = jsonb_build_array(jsonb_build_object(
      'id',p_id,'type','registrada','source','stratos_rails','resultado',p_resultado,
      'action',CASE p_resultado WHEN 'contactado' THEN 'Contacto registrado: ' WHEN 'sin_respuesta' THEN 'Sin respuesta: ' ELSE 'Reprogramado: ' END || trim(p_detalle) || ' · Siguiente paso: ' || trim(p_siguiente),
      'date',to_char(p_siguiente_at AT TIME ZONE p_timezone,'YYYY-MM-DD HH24:MI'),
      'completed_at',now(),'by',v_actor.name
    )) || coalesce(action_history,'[]'::jsonb),
    is_new = CASE WHEN p_resultado = 'reprogramado' THEN is_new ELSE false END,
    updated_at = now()
  WHERE id = p_lead_id RETURNING * INTO v_lead;
  INSERT INTO public.agenda_items (organization_id,asesor_id,asesor_name,lead_id,fecha,tipo,canal,razon,pedir,estado,resultado,completado_at)
  VALUES (v_actor.organization_id,auth.uid(),coalesce(v_actor.name,'sin nombre'),p_lead_id,v_fecha,p_tipo,p_canal,coalesce(p_razon,''),trim(p_siguiente),v_estado,trim(p_detalle),now())
  ON CONFLICT (lead_id,fecha) WHERE lead_id IS NOT NULL DO UPDATE SET
    asesor_id = EXCLUDED.asesor_id, asesor_name = EXCLUDED.asesor_name,
    tipo = EXCLUDED.tipo, canal = EXCLUDED.canal, razon = EXCLUDED.razon, pedir = EXCLUDED.pedir,
    estado = EXCLUDED.estado, resultado = EXCLUDED.resultado, completado_at = EXCLUDED.completado_at
  RETURNING * INTO v_agenda;
  RETURN jsonb_build_object('lead',to_jsonb(v_lead),'agenda',to_jsonb(v_agenda),'repetido',false);
END $$;

-- Se conserva la firma anterior pero no se permite saltarse el nuevo contrato.
CREATE OR REPLACE FUNCTION public.rails_marcar_accion(p_lead_id uuid,p_tipo text,p_razon text,
  p_estado text DEFAULT 'hecho',p_pedir text DEFAULT NULL,p_canal text DEFAULT NULL,p_resultado text DEFAULT NULL)
RETURNS public.agenda_items LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Actualiza Stratos para registrar el resultado y el siguiente paso.'; END $$;

CREATE OR REPLACE FUNCTION public.rails_agenda_del_dia(p_timezone text)
RETURNS SETOF public.agenda_items LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_timezone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
    RAISE EXCEPTION 'Zona horaria inválida.';
  END IF;
  RETURN QUERY SELECT a.* FROM public.agenda_items a
    JOIN public.profiles p ON p.id = auth.uid()
    JOIN public.leads l ON l.id = a.lead_id AND l.organization_id = p.organization_id
    WHERE a.organization_id = p.organization_id AND p.active IS DISTINCT FROM false
      AND (p.role IN ('admin','super_admin','ceo','director') OR (nullif(p.name,'') IS NOT NULL AND l.asesor_name = p.name))
      AND a.fecha = (now() AT TIME ZONE p_timezone)::date
    ORDER BY a.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.rails_guardar_config(p_config jsonb,p_esperada jsonb,p_organization uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_meta jsonb;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles WHERE id = auth.uid()
    AND role IN ('super_admin','admin','ceo','director') AND active IS DISTINCT FROM false;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Solo un administrador activo puede cambiar el proceso.'; END IF;
  IF v_org IS DISTINCT FROM p_organization THEN RAISE EXCEPTION 'La organización de la sesión cambió. Recarga la configuración.'; END IF;
  IF jsonb_typeof(p_config) IS DISTINCT FROM 'object' OR octet_length(p_config::text) > 30000 THEN
    RAISE EXCEPTION 'Configuración inválida.';
  END IF;
  SELECT coalesce(meta_config,'{}'::jsonb) INTO v_meta FROM public.organizations WHERE id = v_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organización no disponible.'; END IF;
  IF (v_meta->'rails') IS DISTINCT FROM p_esperada THEN
    RAISE EXCEPTION 'Otro administrador cambió el proceso. Recarga la configuración antes de guardar.';
  END IF;
  UPDATE public.organizations SET meta_config = jsonb_set(v_meta,'{rails}',p_config,true) WHERE id = v_org;
  RETURN p_config;
END $$;
REVOKE ALL ON FUNCTION public.rails_resolver_accion(uuid,uuid,timestamptz,text,text,text,text,text,text,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rails_resolver_accion(uuid,uuid,timestamptz,text,text,text,text,text,text,timestamptz,text) TO authenticated;
REVOKE ALL ON FUNCTION public.rails_marcar_accion(uuid,text,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rails_marcar_accion(uuid,text,text,text,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.rails_agenda_del_dia(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rails_agenda_del_dia(text) TO authenticated;
REVOKE ALL ON FUNCTION public.rails_guardar_config(jsonb,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rails_guardar_config(jsonb,jsonb,uuid) TO authenticated;
INSERT INTO public.front_rpc_registry (nombre,nota) VALUES
 ('rails_resolver_accion','Rails: resultado y siguiente paso atómicos'),
 ('rails_agenda_del_dia','Rails: agenda en la zona horaria del navegador'),
 ('rails_guardar_config','Rails: actualización atómica de configuración')
ON CONFLICT (nombre) DO UPDATE SET nota = EXCLUDED.nota;
COMMIT;
