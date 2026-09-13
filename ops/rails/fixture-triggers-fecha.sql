-- Definiciones observadas en stratos-prod el 12-sep-2026.
CREATE TABLE proactive_config(organization_id uuid, timezone text);
CREATE OR REPLACE FUNCTION public.sync_next_action_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
 IF NEW.next_action_at IS DISTINCT FROM OLD.next_action_at AND NEW.next_action_at IS NOT NULL THEN
 NEW.next_action_date := to_char(NEW.next_action_at AT TIME ZONE 'America/Cancun', 'YYYY-MM-DD HH24:MI');
 ELSIF NEW.next_action_date IS DISTINCT FROM OLD.next_action_date
 AND NEW.next_action_date IS NOT NULL AND NEW.next_action_date ~ '^\d{4}-\d{2}-\d{2}' THEN
 BEGIN
 NEW.next_action_at := NEW.next_action_date::timestamptz;
 EXCEPTION WHEN OTHERS THEN NULL;
 END;
 END IF;
 RETURN NEW;
END; $function$
;
CREATE TRIGGER leads_sync_next_action BEFORE INSERT OR UPDATE OF next_action_at, next_action_date ON public.leads FOR EACH ROW EXECUTE FUNCTION sync_next_action_columns();
CREATE OR REPLACE FUNCTION public.leads_derive_next_action_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_tz text; v_raw text;
BEGIN
 IF TG_OP = 'INSERT' OR NEW.next_action_date IS DISTINCT FROM OLD.next_action_date THEN
 v_raw := replace(left(coalesce(NEW.next_action_date,''),16), 'T', ' ');
 IF v_raw ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$' THEN
 SELECT coalesce(pc.timezone,'America/Cancun') INTO v_tz
 FROM public.proactive_config pc WHERE pc.organization_id = NEW.organization_id;
 v_tz := coalesce(v_tz,'America/Cancun');
 BEGIN
 NEW.next_action_at := (v_raw::timestamp AT TIME ZONE v_tz);
 EXCEPTION WHEN others THEN NULL;
 END;
 END IF;
 END IF;
 RETURN NEW;
END; $function$
;
CREATE TRIGGER trg_leads_derive_next_action_at BEFORE INSERT OR UPDATE OF next_action_date ON public.leads FOR EACH ROW EXECUTE FUNCTION leads_derive_next_action_at();