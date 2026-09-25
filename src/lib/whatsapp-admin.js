import { SUPABASE_ANON_KEY, SUPABASE_REST_URL, supabase } from "./supabase";

const FUNCTION_URL = `${SUPABASE_REST_URL}/functions/v1/whatsapp-admin`;
const SESSION_TIMEOUT_MS = 3500;
const REQUEST_TIMEOUT_MS = 15000;

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// El SDK puede quedar esperando su lock de auto-refresh. En ese caso usamos el
// mismo access token que Supabase ya guardó para ESTE origen; no se transmite a
// ningún tercero y el servidor sigue validando firma, expiración y permisos.
function readStoredAccessToken() {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      const token = stored?.access_token || stored?.currentSession?.access_token;
      if (token) return token;
    }
  } catch { /* storage bloqueado o valor incompleto: se trata como sesión vencida */ }
  return null;
}

async function call(action, payload = {}) {
  let token;
  try {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      SESSION_TIMEOUT_MS,
      "La sesión está tardando demasiado.",
    );
    token = data?.session?.access_token;
  } catch {
    token = readStoredAccessToken();
  }
  token ||= readStoredAccessToken();
  if (!token) throw new Error("Tu sesión venció. Vuelve a entrar.");

  const response = await withTimeout(
    fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    }),
    REQUEST_TIMEOUT_MS,
    "La plataforma está tardando. Intenta nuevamente en unos segundos.",
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || `No se pudo completar la acción (HTTP ${response.status}).`);
  }
  return body;
}

export const loadWhatsAppAdmin = () => call("bootstrap");
export const loadTemporaryCredentials = () => call("list_temporary_credentials");
export const createPlatformPartner = (payload) => call("create_partner", payload);
export const updatePlatformPartnerQuota = (userId, companyLimit) => call("update_partner_quota", { user_id: userId, company_limit: companyLimit });
export const saveCompanySetup = (organizationId, updatedAt, seats, features) => call("save_company_setup", {
  organization_id: organizationId, updated_at: updatedAt, seats, features,
});
export const loadCompanyCajaAccess = (organizationId) => call("get_company_caja_access", {
  organization_id: organizationId,
});
export const saveCompanyCajaAccess = (organizationId, updatedAt, enabled, permissions) => call("save_company_caja_access", {
  organization_id: organizationId, updated_at: updatedAt, enabled, permissions,
});
export const loadOrganizationPipeline = (organizationId) => call("get_pipeline", { organization_id: organizationId });
export const saveOrganizationPipeline = (organizationId, pipeline) => call("save_pipeline", { organization_id: organizationId, pipeline });
export const loadOrganizationCatalog = (organizationId) => call("get_catalog", { organization_id: organizationId });
export const previewOrganizationCatalog = (organizationId, sourceUrl) => call("preview_catalog", { organization_id: organizationId, source_url: sourceUrl });
export const importOrganizationCatalog = (organizationId, sourceUrl) => call("import_catalog", { organization_id: organizationId, source_url: sourceUrl });
export const createWhatsAppOrganization = (payload) => call("create_organization", payload);
export const createWhatsAppTenantUser = (payload) => call("create_user", payload);
export const createWhatsAppOnboardingRun = (payload) => call("create_run", payload);
export const verifyInfobipPortalSender = (runId) => call("verify_portal_sender", { run_id: runId });
export const completeWhatsAppSignup = (payload) => call("complete_signup", payload);
export const retryWhatsAppShare = (runId) => call("retry_share", { run_id: runId });
export const approveWhatsAppTests = (runId, checks) => call("approve_tests", { run_id: runId, checks });
