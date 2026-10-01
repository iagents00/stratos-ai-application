-- Prevent the audit trail from copying the complete, ever-growing lead
-- action_history on every lead update. The canonical history remains in
-- public.leads.action_history; audit_log continues recording every other field
-- that changed. This stops quadratic disk growth without deleting business data.

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id uuid; v_actor_name text; v_actor_role text;
  v_org_id uuid; v_changed jsonb; v_action text; v_entity_id uuid;
  v_old jsonb; v_new jsonb;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NOT NULL THEN
    SELECT name, role, organization_id INTO v_actor_name, v_actor_role, v_org_id
    FROM public.profiles WHERE id = v_actor_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW); END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') THEN v_old := to_jsonb(OLD); END IF;

  IF v_new IS NOT NULL AND v_new ? 'organization_id' THEN
    v_org_id := COALESCE((v_new->>'organization_id')::uuid, v_org_id);
  ELSIF v_old IS NOT NULL AND v_old ? 'organization_id' THEN
    v_org_id := COALESCE((v_old->>'organization_id')::uuid, v_org_id);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT'; v_entity_id := NEW.id;
    v_changed := (SELECT jsonb_object_agg(key, jsonb_build_object('old', null, 'new', value))
      FROM jsonb_each(v_new)
      WHERE key NOT IN ('created_at','updated_at','action_history')
        AND value IS NOT NULL AND value::text != 'null');
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    IF (v_old ? 'deleted_at') AND (v_old->>'deleted_at') IS NULL AND (v_new->>'deleted_at') IS NOT NULL THEN
      v_action := 'SOFT_DELETE';
    ELSIF (v_old ? 'deleted_at') AND (v_old->>'deleted_at') IS NOT NULL AND (v_new->>'deleted_at') IS NULL THEN
      v_action := 'RESTORE';
    ELSE
      v_action := 'UPDATE';
    END IF;
    v_changed := (SELECT jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value))
      FROM jsonb_each(v_new) n LEFT JOIN jsonb_each(v_old) o ON o.key = n.key
      WHERE n.value IS DISTINCT FROM o.value
        AND n.key NOT IN ('updated_at','action_history'));
    IF v_changed IS NULL OR v_changed = '{}'::jsonb THEN RETURN NEW; END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE'; v_entity_id := OLD.id;
    v_changed := (SELECT jsonb_object_agg(key, jsonb_build_object('old', value, 'new', null))
      FROM jsonb_each(v_old)
      WHERE key NOT IN ('created_at','updated_at','action_history')
        AND value IS NOT NULL AND value::text != 'null');
  END IF;

  INSERT INTO public.audit_log
    (actor_id, actor_name, actor_role, organization_id, entity_type, entity_id, action, changed_fields)
  VALUES (v_actor_id, v_actor_name, v_actor_role, v_org_id, TG_TABLE_NAME, v_entity_id, v_action, v_changed);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

COMMENT ON FUNCTION public.audit_trigger_func() IS
  'Audita cambios multitenant sin duplicar leads.action_history; migración 244.';
