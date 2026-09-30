-- Explicit membership: no access to clinic data merely by joining Stratos.
BEGIN;
CREATE TABLE public.huli_access (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
ALTER TABLE public.huli_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.huli_access FROM anon, authenticated;
GRANT SELECT ON public.huli_access TO authenticated;
GRANT ALL ON public.huli_access TO service_role;
CREATE POLICY huli_access_self ON public.huli_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND organization_id = public.current_organization_id());
COMMENT ON TABLE public.huli_access IS 'Huli access granted by server provisioning; credentials exist only in Edge Function secrets.';
COMMIT;
