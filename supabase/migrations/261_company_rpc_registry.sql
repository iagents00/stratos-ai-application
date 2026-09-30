-- Register the authenticated tenant permission query used by TenantConfigGate.
BEGIN;
INSERT INTO public.front_rpc_registry (nombre, nota) VALUES
 ('fn_my_company_module_access','Permisos de módulos de la empresa del usuario autenticado')
ON CONFLICT (nombre) DO UPDATE SET nota = EXCLUDED.nota;
REVOKE ALL ON FUNCTION public.fn_my_company_module_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_my_company_module_access() TO authenticated;
COMMIT;
