/**
 * lib/webhook-diagnostico-stratos.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Envía los resultados del diagnóstico Stratos AI al webhook n8n del funnel.
 *
 * Webhook destino:
 *   `STRATOS-SALES - 01 - Diagnostico Webhook` en n8n
 *   POST https://personal-n8n.suwsiw.easypanel.host/webhook/diagnostico-stratos
 *
 * El webhook se encarga de:
 *   1. Upsert del lead en Supabase (organization_id = Stratos Sales)
 *      vía RPC `fn_sales_upsert_lead_from_diagnostico`
 *   2. Notificar al grupo Telegram interno con resumen
 *   3. Responder con análisis enriquecido (opcional)
 *
 * Configuración:
 *   VITE_DIAGNOSTICO_STRATOS_WEBHOOK_URL en .env.local
 *   (Por defecto apunta al webhook de producción)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const WEBHOOK_URL =
  import.meta.env.VITE_DIAGNOSTICO_STRATOS_WEBHOOK_URL ||
  "https://personal-n8n.suwsiw.easypanel.host/webhook/diagnostico-stratos";

/**
 * @param {object} params
 * @param {{name, company, email, phone}} params.contact
 * @param {object} params.answers - { mainPain, role, maturity, primaryGoal } cada uno {values, tags, context}
 * @param {object} params.blueprint - el reporte generado por generateBlueprint()
 * @returns {Promise<{ok, error, aiAnalysis?, data?}>}
 */
export async function sendDiagnosticoStratosResult({ contact, answers, blueprint }) {
  // Aplanamos el payload para que n8n lo procese fácil (mismo patrón que Gvintell)
  const payload = {
    // Lead
    name: contact.name,
    company: contact.company,
    email: contact.email,
    whatsapp: contact.phone,

    // Respuestas (flatten para legibilidad en n8n)
    pain_values: answers.mainPain?.values || [],
    pain_tags: answers.mainPain?.tags || [],
    pain_context: answers.mainPain?.context || "",

    role_values: answers.role?.values || [],
    role_tags: answers.role?.tags || [],
    role_context: answers.role?.context || "",

    maturity_values: answers.maturity?.values || [],
    maturity_tags: answers.maturity?.tags || [],
    maturity_context: answers.maturity?.context || "",

    goal_values: answers.primaryGoal?.values || [],
    goal_tags: answers.primaryGoal?.tags || [],
    goal_context: answers.primaryGoal?.context || "",

    // Resultados calculados (los manda el frontend para evitar recálculos)
    score: blueprint.score,
    level: blueprint.profile,
    module: blueprint.module,
    moduleDesc: blueprint.moduleDesc,
    strategicMission: blueprint.strategicMission,
    futureStateText: blueprint.futureStateText,

    // Respuestas raw (por si el backend quiere reprocesarlas)
    answers_raw: answers,

    // Metadata
    source: "diagnostico_stratos",
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "",
  };

  if (!WEBHOOK_URL) {
    console.log("[Diagnóstico Stratos] Webhook no configurado. Payload:", payload);
    return { ok: true, error: null };
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let parsed = null;
    try { parsed = await res.json(); } catch (_) { parsed = null; }

    if (!res.ok) {
      console.warn("[Diagnóstico Stratos] Webhook respondió error:", res.status, parsed);
      return { ok: false, error: `HTTP ${res.status}`, data: parsed, aiAnalysis: null };
    }

    const aiAnalysis =
      parsed?.ai_analysis ||
      parsed?.response?.text ||
      parsed?.text ||
      null;

    return { ok: true, error: null, data: parsed, aiAnalysis };
  } catch (e) {
    console.warn("[Diagnóstico Stratos] Error enviando webhook:", e?.message);
    return { ok: false, error: e?.message || "Error de conexión", data: null, aiAnalysis: null };
  }
}

if (typeof window !== "undefined") {
  window.__DIAGNOSTICO_STRATOS_WEBHOOK__ = sendDiagnosticoStratosResult;
}
