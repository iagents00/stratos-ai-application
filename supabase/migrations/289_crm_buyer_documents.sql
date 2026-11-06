-- Multiple named identifications / property offer letters. Files keep the
-- existing private evidencia/id-doc/<org>/<lead>/ storage policies (231).
BEGIN;

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(documents) = 'array');
COMMENT ON COLUMN public.leads.documents IS
  'Named identity documents and property offer letters. Paths are private evidencia objects; legacy identification is preserved on first edit.';

-- An older open tab/native client still edits the original ID fields. Mirror
-- those edits into the first identity only, preserving all other documents.
CREATE OR REPLACE FUNCTION public.lead_documents_legacy_bu()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_first jsonb; v_number text; v_path text;
BEGIN
  IF NEW.documents IS DISTINCT FROM OLD.documents OR
     (NEW.id_document IS NOT DISTINCT FROM OLD.id_document AND NEW.id_document_path IS NOT DISTINCT FROM OLD.id_document_path)
     OR jsonb_array_length(NEW.documents)=0 THEN RETURN NEW; END IF;
  v_number:=nullif(btrim(NEW.id_document),''); v_path:=nullif(NEW.id_document_path,'');
  SELECT d INTO v_first FROM jsonb_array_elements(NEW.documents) WITH ORDINALITY a(d,ord)
    WHERE d->>'kind'='identity' ORDER BY ord LIMIT 1;
  IF v_first IS NULL THEN
    IF v_number IS NOT NULL OR v_path IS NOT NULL THEN
      NEW.documents:=NEW.documents||jsonb_build_array(jsonb_build_object('id',NEW.id,'kind','identity',
        'name',coalesce(nullif(NEW.name,''),'Titular'),'number',v_number,'path',v_path));
    END IF;
  ELSE
    SELECT coalesce(jsonb_agg(CASE WHEN d->>'id'=v_first->>'id' THEN d||jsonb_build_object(
      'number',v_number,'path',v_path,'updated_at',now(),
      'filename',CASE WHEN v_path IS DISTINCT FROM OLD.id_document_path THEN NULL ELSE d->>'filename' END)
      ELSE d END ORDER BY ord),'[]'::jsonb) INTO NEW.documents
      FROM jsonb_array_elements(NEW.documents) WITH ORDINALITY a(d,ord)
      WHERE NOT(d->>'id'=v_first->>'id' AND v_number IS NULL AND v_path IS NULL);
  END IF;
  SELECT d INTO v_first FROM jsonb_array_elements(NEW.documents) WITH ORDINALITY a(d,ord)
    WHERE d->>'kind'='identity' ORDER BY ord LIMIT 1;
  NEW.id_document:=v_first->>'number'; NEW.id_document_path:=v_first->>'path';
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.lead_documents_legacy_bu() FROM PUBLIC,anon;
DROP TRIGGER IF EXISTS lead_documents_legacy_bu ON public.leads;
CREATE TRIGGER lead_documents_legacy_bu BEFORE UPDATE OF id_document,id_document_path ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.lead_documents_legacy_bu();

CREATE OR REPLACE FUNCTION public.fn_lead_document_save(p_lead_id uuid, p_document jsonb, p_remove boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_docs jsonb;
  v_doc jsonb;
  v_previous jsonb;
  v_first jsonb;
  v_id uuid;
  v_name text;
  v_path text;
BEGIN
  IF auth.uid() IS NULL OR public.current_organization_id() IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para guardar documentos.' USING ERRCODE='42501';
  END IF;
  -- Invoker permissions + the existing lead RLS enforce organization AND lead
  -- visibility. Locking serializes changes to different documents of one lead.
  SELECT * INTO v_lead FROM public.leads
    WHERE id=p_lead_id AND organization_id=public.current_organization_id() AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No tienes acceso a este expediente.' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_document) IS DISTINCT FROM 'object' OR nullif(p_document->>'id','') IS NULL THEN
    RAISE EXCEPTION 'Documento inválido.' USING ERRCODE='22023';
  END IF;
  v_id := (p_document->>'id')::uuid;
  v_docs := v_lead.documents;
  IF jsonb_array_length(v_docs)=0 AND (nullif(btrim(v_lead.id_document),'') IS NOT NULL OR v_lead.id_document_path IS NOT NULL) THEN
    v_docs := jsonb_build_array(jsonb_build_object('id',v_lead.id,'kind','identity',
      'name',coalesce(nullif(v_lead.name,''),'Titular'),'number',v_lead.id_document,'path',v_lead.id_document_path));
  END IF;
  SELECT d INTO v_previous FROM jsonb_array_elements(v_docs) d WHERE d->>'id'=v_id::text;
  IF NOT coalesce(p_remove,false) THEN
    v_name := nullif(btrim(p_document->>'name'),'');
    v_path := nullif(p_document->>'path','');
    IF v_name IS NULL OR length(v_name)>200 OR coalesce(p_document->>'kind','') NOT IN ('identity','offer')
       OR length(coalesce(p_document->>'number',''))>200 THEN
      RAISE EXCEPTION 'Indica un nombre válido y el tipo de documento.' USING ERRCODE='22023';
    END IF;
    IF v_path IS NOT NULL AND (v_path NOT LIKE 'id-doc/'||v_lead.organization_id::text||'/'||p_lead_id::text||'/%'
      OR v_path ~ '(^|/)\.\.(/|$)' OR length(v_path)>700) THEN
      RAISE EXCEPTION 'El archivo no pertenece a este expediente.' USING ERRCODE='22023';
    END IF;
    IF v_path IS NULL AND (p_document->>'kind'='offer' OR nullif(btrim(p_document->>'number'),'') IS NULL) THEN
      RAISE EXCEPTION 'Adjunta el archivo o registra el número de identificación.' USING ERRCODE='22023';
    END IF;
    v_doc := jsonb_build_object('id',v_id,'kind',p_document->>'kind','name',v_name,
      'number',nullif(btrim(p_document->>'number'),''),'path',v_path,
      'filename',left(p_document->>'filename',255),'content_type',left(p_document->>'content_type',100),
      'created_at',coalesce(v_previous->>'created_at',now()::text),'updated_at',now());
  END IF;
  SELECT coalesce(jsonb_agg(CASE WHEN d->>'id'=v_id::text THEN v_doc ELSE d END ORDER BY ord),'[]'::jsonb)
    INTO v_docs FROM jsonb_array_elements(v_docs) WITH ORDINALITY a(d,ord)
    WHERE NOT(coalesce(p_remove,false) AND d->>'id'=v_id::text);
  IF NOT coalesce(p_remove,false) AND v_previous IS NULL THEN v_docs := v_docs || jsonb_build_array(v_doc); END IF;
  SELECT d INTO v_first FROM jsonb_array_elements(v_docs) WITH ORDINALITY a(d,ord)
    WHERE d->>'kind'='identity' ORDER BY ord LIMIT 1;
  UPDATE public.leads SET documents=v_docs,id_document=v_first->>'number',id_document_path=v_first->>'path',updated_at=now()
    WHERE id=p_lead_id AND organization_id=public.current_organization_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'No tienes permiso para editar este expediente.' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('documents',v_docs,'id_document',v_first->>'number','id_document_path',v_first->>'path');
END; $$;
REVOKE ALL ON FUNCTION public.fn_lead_document_save(uuid,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_lead_document_save(uuid,jsonb,boolean) TO authenticated;
INSERT INTO public.front_rpc_registry(nombre,nota) VALUES
  ('fn_lead_document_save','CRM: documentos individuales; invoker/RLS, organización y expediente visible.')
ON CONFLICT (nombre) DO UPDATE SET nota=excluded.nota;

ALTER TABLE public.lead_related_contacts
  ADD COLUMN IF NOT EXISTS phones text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emails text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.lead_related_contacts_channels_biu()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  -- Older clients can still edit the primary contact without erasing extras.
  IF TG_OP='UPDATE' THEN
    IF NEW.phones IS NOT DISTINCT FROM OLD.phones AND NEW.phone IS DISTINCT FROM OLD.phone THEN
      NEW.phones := ARRAY[NEW.phone] || coalesce(OLD.phones[2:cardinality(OLD.phones)],'{}');
    END IF;
    IF NEW.emails IS NOT DISTINCT FROM OLD.emails AND NEW.email IS DISTINCT FROM OLD.email THEN
      NEW.emails := ARRAY[NEW.email] || coalesce(OLD.emails[2:cardinality(OLD.emails)],'{}');
    END IF;
  END IF;
  IF TG_OP='INSERT' THEN
    IF cardinality(NEW.phones)=0 AND NEW.phone IS NOT NULL THEN NEW.phones:=ARRAY[NEW.phone]; END IF;
    IF cardinality(NEW.emails)=0 AND NEW.email IS NOT NULL THEN NEW.emails:=ARRAY[NEW.email]; END IF;
  END IF;
  SELECT coalesce(array_agg(v ORDER BY ord),'{}') INTO NEW.phones FROM (
    SELECT btrim(x) v,min(i) ord FROM unnest(NEW.phones) WITH ORDINALITY a(x,i)
    WHERE nullif(btrim(x),'') IS NOT NULL GROUP BY btrim(x)
  ) s;
  SELECT coalesce(array_agg(v ORDER BY ord),'{}') INTO NEW.emails FROM (
    SELECT DISTINCT ON (lower(btrim(x))) btrim(x) v,i ord FROM unnest(NEW.emails) WITH ORDINALITY a(x,i)
    WHERE nullif(btrim(x),'') IS NOT NULL ORDER BY lower(btrim(x)),i
  ) s;
  IF cardinality(NEW.phones)>20 OR cardinality(NEW.emails)>20 THEN
    RAISE EXCEPTION 'Máximo 20 teléfonos y 20 correos por contacto.' USING ERRCODE='22023';
  END IF;
  NEW.phone := NEW.phones[1]; NEW.email := NEW.emails[1];
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.lead_related_contacts_channels_biu() FROM PUBLIC,anon;
DROP TRIGGER IF EXISTS lead_related_contacts_channels_biu ON public.lead_related_contacts;
CREATE TRIGGER lead_related_contacts_channels_biu BEFORE INSERT OR UPDATE ON public.lead_related_contacts
FOR EACH ROW EXECUTE FUNCTION public.lead_related_contacts_channels_biu();
-- Fill new arrays once, preserving the previous primary phone/email.
UPDATE public.lead_related_contacts SET
  phones=CASE WHEN cardinality(phones)=0 AND phone IS NOT NULL THEN ARRAY[phone] ELSE phones END,
  emails=CASE WHEN cardinality(emails)=0 AND email IS NOT NULL THEN ARRAY[email] ELSE emails END
WHERE (cardinality(phones)=0 AND phone IS NOT NULL) OR (cardinality(emails)=0 AND email IS NOT NULL);

NOTIFY pgrst,'reload schema';
COMMIT;
