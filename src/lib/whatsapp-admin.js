import { SUPABASE_ANON_KEY, SUPABASE_REST_URL, supabase } from "./supabase";

const FUNCTION_URL = `${SUPABASE_REST_URL}/functions/v1/whatsapp-admin`;

async function call(action, payload = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Tu sesión venció. Vuelve a entrar.");

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || `No se pudo completar la acción (HTTP ${response.status}).`);
  }
  return body;
}

export const loadWhatsAppAdmin = () => call("bootstrap");
export const createWhatsAppOrganization = (payload) => call("create_organization", payload);
export const createWhatsAppTenantUser = (payload) => call("create_user", payload);
export const createWhatsAppOnboardingRun = (payload) => call("create_run", payload);
export const verifyInfobipPortalSender = (runId) => call("verify_portal_sender", { run_id: runId });
export const completeWhatsAppSignup = (payload) => call("complete_signup", payload);
export const retryWhatsAppShare = (runId) => call("retry_share", { run_id: runId });
export const approveWhatsAppTests = (runId, checks) => call("approve_tests", { run_id: runId, checks });
