export const COMPANY_LEAD_FIELDS = [
  "name", "phone", "email", "budget", "presupuesto", "project", "campaign", "source",
  "stage", "asesor_id", "notas", "next_action", "next_action_at",
];

export function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function companyLeadDraft(lead = {}, defaultStage = "") {
  return Object.fromEntries(COMPANY_LEAD_FIELDS.map(field => [field,
    field === "next_action_at" ? localDateTime(lead[field])
      : field === "presupuesto" ? String(lead[field] ?? 0)
      : String(lead[field] ?? (field === "stage" ? defaultStage : "")),
  ]));
}

export function companyLeadChanged(draft, original) {
  if (!draft || !original) return false;
  const baseline = companyLeadDraft(original);
  return COMPANY_LEAD_FIELDS.some(field => draft[field] !== baseline[field]);
}

export function validateCompanyLead(draft, pipeline, advisors, { creating = false, original = null } = {}) {
  if (!draft || draft.name.trim().length < 2) return "Escribe un nombre de al menos 2 caracteres.";
  const limits = { name: 200, phone: 80, email: 254, budget: 100, project: 200, campaign: 200, source: 80, notas: 20000, next_action: 1000 };
  for (const [field, limit] of Object.entries(limits)) {
    if (String(draft[field] || "").trim().length > limit) return `El campo ${field === "notas" ? "notas" : ({ name: "nombre", phone: "teléfono", email: "correo", budget: "rango de inversión", project: "proyecto", campaign: "campaña", source: "origen", next_action: "próxima acción" }[field])} supera los ${limit.toLocaleString("es")} caracteres.`;
  }
  if (draft.phone.trim() && !/^\d{7,15}$/.test(draft.phone.replace(/\D/g, ""))) return "Revisa el teléfono: debe contener entre 7 y 15 dígitos.";
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) return "Escribe un correo electrónico válido.";
  if (!/^\d+$/.test(draft.presupuesto.trim()) || !Number.isSafeInteger(Number(draft.presupuesto))) return "El presupuesto debe ser un número entero igual o mayor que cero.";
  if (!pipeline.some(stage => stage.name === draft.stage) && (creating || draft.stage !== original?.stage)) return "Selecciona una etapa del proceso de esta empresa.";
  const assigned = advisors.some(advisor => advisor.id === draft.asesor_id);
  if ((creating && !assigned) || (!creating && draft.asesor_id !== (original?.asesor_id || "") && !assigned)) return "Selecciona un asesor activo de esta empresa.";
  if (draft.next_action_at && !Number.isFinite(new Date(draft.next_action_at).getTime())) return "Revisa la fecha de la próxima acción.";
  return "";
}

export function companyLeadPayload(draft, original = null) {
  const baseline = original ? companyLeadDraft(original) : null;
  return Object.fromEntries(COMPANY_LEAD_FIELDS
    .filter(field => !baseline || draft[field] !== baseline[field])
    .map(field => [field,
      field === "presupuesto" ? Number(draft[field])
        : field === "next_action_at" ? (draft[field] ? new Date(draft[field]).toISOString() : null)
        : field === "name" || field === "stage" ? draft[field].trim()
        : draft[field].trim() || null,
    ]));
}

// A response from a discarded scope must never replace the current company's
// memory or be presented as a confirmed save.
export function confirmCompanyLeadResponse(result, organizationId, leadId) {
  const lead = result?.lead;
  if (result?.ok === false || !lead || lead.id !== leadId || lead.organization_id !== organizationId || !lead.updated_at) {
    throw new Error("No se pudo confirmar el cliente en esta empresa. Recarga su ficha antes de continuar.");
  }
  return lead;
}

export function confirmCompanyListResponse(result, organizationId) {
  if (result?.ok === false || result?.organization?.id !== organizationId || !Array.isArray(result.leads)
    || result.leads.some(lead => lead.organization_id !== organizationId)) {
    throw new Error("No se pudo verificar la cartera de esta empresa. Intenta cargarla de nuevo.");
  }
  return result;
}
