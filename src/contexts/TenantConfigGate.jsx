import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useClient } from "../hooks/useClient";
import { getClientIdByOrgId } from "../clients";
import { managedTenantFeatures } from "../clients/tenant/managed-features";
import { supabase } from "../lib/supabase";

// Una empresa nueva usa /tenant y su configuración está en organizations,
// no en un archivo del bundle. Esperamos esa lectura antes de montar el CRM:
// de otro modo aparecerían brevemente módulos que la empresa no tiene.
export function TenantConfigGate({ children }) {
  const { user } = useAuth();
  const { clientId, organizationFeaturesOrgId, setOrganizationFeatures } = useClient();
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const organizationId = user?.organizationId || null;
  const newOrganization = Boolean(organizationId && !getClientIdByOrgId(organizationId)
    && !user?._offline && !user?.isDemo);
  // El guardián de ruta actúa en un efecto. Mientras cambia de Duke a /tenant
  // (o aplica el tenant en la app nativa), no montamos datos con marca ajena.
  const waitingForTenant = newOrganization && clientId !== "tenant";
  const needsManagedConfig = newOrganization && clientId === "tenant";
  const loaded = needsManagedConfig && organizationFeaturesOrgId === organizationId;

  const reload = useCallback(() => { setError(""); setRetry(value => value + 1); }, []);
  useEffect(() => {
    if (!needsManagedConfig || loaded) return;
    let active = true;
    Promise.all([
      supabase.from("organizations").select("id,meta_config").eq("id", organizationId).maybeSingle(),
      supabase.rpc("fn_my_company_module_access"),
    ]).then(([{ data, error: readError }, access]) => {
        if (!active) return;
        if (readError || !data) { setError("No se pudo cargar la configuración de tu empresa."); return; }
        const isManaged = data.meta_config?.onboarding?.createdFrom === "whatsapp_admin";
        const cajaPolicy = !access.error && access.data?.caja ? access.data.caja : null;
        setOrganizationFeatures(organizationId, isManaged ? {
          ...managedTenantFeatures(data.meta_config?.features),
          // Si la lectura de permisos falla, Caja permanece cerrada en la UI.
          // La RLS del servidor continúa siendo la autoridad.
          caja: cajaPolicy?.enabled === true,
          cajaPolicy,
        } : {}, isManaged);
      })
      .catch(() => { if (active) setError("No se pudo cargar la configuración de tu empresa."); });
    return () => { active = false; };
  }, [needsManagedConfig, loaded, organizationId, retry, setOrganizationFeatures]);

  if (!waitingForTenant && (!needsManagedConfig || loaded)) return children;
  return <div role={error ? "alert" : "status"} style={{ minHeight: "100vh", display: "grid", placeContent: "center", gap: 12, textAlign: "center", background: "#07111c", color: "#e2e8f0", fontFamily: "sans-serif", padding: 24 }}>
    <div>{waitingForTenant ? "Abriendo tu empresa…" : error || "Preparando tu empresa…"}</div>
    {!waitingForTenant && error && <button onClick={reload} style={{ padding: "9px 15px", cursor: "pointer", borderRadius: 8 }}>Reintentar</button>}
  </div>;
}
