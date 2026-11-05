// Only these actions are available to a company's own administrator. They do
// not confer platform/partner access; identity and organization come from Auth.
export const TENANT_PIPELINE_ACTIONS = new Set(["get_own_pipeline", "save_own_pipeline"]);

export function sanitizePipeline(value: unknown) {
  if (!Array.isArray(value)) return { error: "El pipeline debe ser una lista de etapas.", pipeline: [] };
  if (value.length < 2 || value.length > 30) {
    return { error: "El pipeline debe tener entre 2 y 30 etapas.", pipeline: [] };
  }
  const pipeline: Array<{ name: string; color: string }> = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return { error: "Hay una etapa inválida.", pipeline: [] };
    const name = String(raw.name ?? "").trim().replace(/\s+/g, " ");
    const color = String(raw.color ?? "").trim().toUpperCase();
    if (name.length < 2 || name.length > 48) return { error: "Cada etapa debe tener entre 2 y 48 caracteres.", pipeline: [] };
    if (!/^#[0-9A-F]{6}$/.test(color)) return { error: `El color de “${name}” no es válido.`, pipeline: [] };
    const key = name.toLocaleLowerCase("es");
    if (seen.has(key)) return { error: `La etapa “${name}” está repetida.`, pipeline: [] };
    seen.add(key);
    pipeline.push({ name, color });
  }
  return { error: null, pipeline };
}

export async function handleTenantPipeline(admin: any, callerId: string, action: string, body: Record<string, unknown>) {
  const reply = (status: number, error: string) => ({ status, body: { ok: false, error } });
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,role,active,organization_id,crm_only,is_marketing_admin").eq("id", callerId).maybeSingle();
  if (profileError) return reply(503, "No se pudieron verificar tus permisos. Intenta nuevamente.");
  if (!profile?.organization_id || profile.active !== true || !["admin", "super_admin"].includes(profile.role)
      || profile.crm_only === true || (profile.is_marketing_admin === true && profile.organization_id === "00000000-0000-0000-0000-000000000001")) {
    return reply(403, "Solo el administrador activo de la empresa puede configurar sus etapas.");
  }
  const organizationId = profile.organization_id;
  if (body.organization_id !== organizationId) return reply(403, "Solo puedes modificar el pipeline de tu propia empresa.");
  const { data: organization, error: orgError } = await admin.from("organizations")
    .select("id,name,active,meta_config,updated_at").eq("id", organizationId).maybeSingle();
  if (orgError) return reply(503, "No se pudo cargar la empresa.");
  if (!organization || organization.active !== true) return reply(403, "La empresa no está activa.");
  const meta = organization.meta_config || {};
  if (meta.features?.crm === false) return reply(403, "El CRM no está habilitado en esta empresa.");
  // Multi-board industries retain their existing structure. This editor owns
  // the single pipeline only and must never flatten or hide another board.
  if (Array.isArray(meta.crm?.pipelines) && meta.crm.pipelines.length > 0) {
    return reply(409, "Esta empresa tiene varios tableros. Solicita la configuración de sus etapas a soporte.");
  }
  const { data: currentPipeline, error: pipelineError } = await admin.rpc("fn_platform_crm_pipeline", { p_organization_id: organizationId });
  if (pipelineError || !Array.isArray(currentPipeline) || currentPipeline.length < 2) {
    return reply(503, "No se pudieron cargar las etapas actuales. Intenta nuevamente.");
  }
  const usage: Record<string, number> = {};
  // Read every page: an occupied stage beyond the first 1,000 clients is still
  // protected. No lead data other than its stage is returned to the editor.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("leads").select("stage").eq("organization_id", organizationId)
      .is("deleted_at", null).order("id").range(offset, offset + 499);
    if (error) return reply(503, "No se pudieron comprobar los clientes de cada etapa.");
    for (const row of data || []) {
      if (row.stage) usage[row.stage] = (usage[row.stage] || 0) + 1;
    }
    if ((data || []).length < 500) break;
  }
  if (action === "get_own_pipeline") {
    return { status: 200, body: { ok: true, organization: { id: organization.id, name: organization.name },
      pipeline: currentPipeline, usage, updated_at: organization.updated_at,
      copilot: {configured: Object.prototype.hasOwnProperty.call(meta.crm || {},"appointmentStage"), appointment_stage: meta.crm?.appointmentStage ?? null} } };
  }
  if (!body.expected_updated_at || body.expected_updated_at !== organization.updated_at) {
    return reply(409, "La configuración cambió en otra sesión. Recarga el pipeline antes de guardar.");
  }
  const sanitized = sanitizePipeline(body.pipeline);
  if (sanitized.error) return reply(400, sanitized.error);
  const { data: saved, error: saveError } = await admin.rpc("fn_company_pipeline_publish", {
    p_actor_id: callerId, p_organization_id: organizationId,
    p_expected_updated_at: body.expected_updated_at, p_pipeline: sanitized.pipeline, p_copilot: body.copilot ?? null,
  });
  if (saveError) {
    const status = saveError.code === "42501" ? 403 : saveError.code === "40001" ? 409 : saveError.code === "22023" ? 400 : 503;
    return reply(status, status === 503 ? "No se pudo guardar el pipeline. Intenta nuevamente." : saveError.message);
  }
  return { status: 200, body: saved };
}
