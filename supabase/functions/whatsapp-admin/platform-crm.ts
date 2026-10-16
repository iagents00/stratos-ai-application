// Explicit company CRM actions. Authorization is repeated inside service-only
// SQL so a stale directory or a forged organization cannot grant access.
export const PLATFORM_CRM_ACTIONS = new Set([
  "list_company_leads", "get_company_lead", "create_company_lead", "update_company_lead",
]);

export async function handlePlatformCRM(admin: any, actorId: string, action: string, body: Record<string, unknown>) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const organizationId = String(body.organization_id ?? "");
  const leadId = body.lead_id == null ? null : String(body.lead_id);
  const fail = (error: string) => ({ status: 400, body: { ok: false, error } });
  if (!uuid.test(organizationId) || (leadId !== null && !uuid.test(leadId))) return fail("La empresa o el cliente no son válidos.");
  const readingList = action === "list_company_leads";
  if (!readingList && !leadId) return fail("Falta el identificador del cliente.");
  let result;
  if (readingList || action === "get_company_lead") {
    const page = Number(body.page ?? 0);
    const pageSize = Number(body.page_size ?? 50);
    const search = String(body.search ?? "").trim();
    const advisor = body.asesor_id ? String(body.asesor_id) : null;
    if (!Number.isInteger(page) || page < 0 || page > 100000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100
      || search.length > 200 || (advisor && !uuid.test(advisor))) return fail("Los filtros o la página no son válidos.");
    result = await admin.rpc("fn_platform_crm_read", {
      p_actor_id: actorId, p_organization_id: organizationId,
      p_lead_id: readingList ? null : leadId, p_page: page, p_page_size: pageSize,
      p_search: search, p_stage: body.stage ? String(body.stage) : null, p_asesor_id: advisor,
    });
  } else {
    const create = action === "create_company_lead";
    const patch = create ? body.lead : body.patch;
    const version = create ? null : String(body.expected_updated_at ?? "");
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return fail("Faltan los datos del cliente.");
    if (!create && (!version || Number.isNaN(Date.parse(version)))) return fail("Recarga el cliente antes de guardar.");
    result = await admin.rpc("fn_platform_crm_mutate", {
      p_actor_id: actorId, p_organization_id: organizationId, p_lead_id: leadId,
      p_expected_updated_at: version, p_patch: patch, p_create: create,
    });
  }
  if (result.error) {
    const code = result.error.code;
    const status = code === "42501" ? 403 : code === "P0002" ? 404
      : ["40001", "23505"].includes(code) ? 409
      : ["22023", "22P02", "22007", "22008", "23514", "23502"].includes(code) ? 400
      : ["PGRST202", "42883"].includes(code) ? 503 : 500;
    const error = status === 503 ? "El acceso al CRM de empresas todavía no está disponible. Intenta más tarde."
      : code === "23505" ? "Ya existe un cliente con ese teléfono o identificador en esta empresa."
      : result.error.message;
    return { status, body: { ok: false, error, code } };
  }
  return { status: 200, body: { ok: true, ...result.data } };
}
