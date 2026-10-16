/** New authenticated receiver only; never updates an existing workflow/sender. */
export function normalizeInfobipPayload(payload, eventType) {
  const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  const forbidden = (value) => ["organization_id", "asesor_id", "channel_id"].some(
    (key) => Object.hasOwn(value, key),
  );
  if (!["INBOUND_MESSAGE", "BUSINESS_APP_MESSAGE_ECHO"].includes(eventType)) {
    throw new Error("Unsupported receiver event type");
  }
  if (!isObject(payload) || forbidden(payload) || !Array.isArray(payload.results)) {
    throw new Error("Expected Infobip results array without tenant overrides");
  }
  if (payload.results.length > 2000 || JSON.stringify(payload).length > 2 * 1024 * 1024) {
    throw new Error("Infobip batch too large");
  }
  const direction = eventType === "BUSINESS_APP_MESSAGE_ECHO" ? "OUT" : "IN";
  if (payload.eventType && payload.eventType !== eventType) throw new Error("Event mismatch");
  return { eventType, results: payload.results.map((row) => {
    if (!isObject(row) || forbidden(row) || !isObject(row.message)) {
      throw new Error("Invalid message record");
    }
    if (row.integrationType && row.integrationType.toUpperCase() !== "WHATSAPP") {
      throw new Error("Only WhatsApp messages are accepted");
    }
    if (row.direction && row.direction.toUpperCase() !== direction) throw new Error("Direction mismatch");
    const from = row.from ?? row.sender;
    if (typeof from !== "string" || typeof row.to !== "string" ||
        typeof row.messageId !== "string" || !row.messageId.trim() || row.messageId.length > 512) {
      throw new Error("Missing sender, recipient or messageId");
    }
    return { ...row, from, direction, integrationType: "WHATSAPP",
      message: { ...row.message, type: String(row.message.type ?? "").toUpperCase() } };
  }) };
}

export function buildInfobipReadonlyWorkflow({ basicCredentialId, supabaseCredentialId }) {
  if (!basicCredentialId || !supabaseCredentialId) throw new Error("Credential references required");
  const webhook = (id, name, path, y) => ({
    id, name, type: "n8n-nodes-base.webhook", typeVersion: 2, position: [0, y], webhookId: id,
    parameters: { httpMethod: "POST", path, authentication: "basicAuth", responseMode: "responseNode", options: {} },
    credentials: { httpBasicAuth: { id: basicCredentialId, name: "Stratos read-only receiver v1" } },
  });
  const mark = (id, name, eventType, y) => ({
    id, name, type: "n8n-nodes-base.code", typeVersion: 2, position: [240, y],
    parameters: { jsCode: `return [{json:{payload:$input.first().json.body,eventType:${JSON.stringify(eventType)}}}];` },
  });
  const respond = (id, name, code, responseBody, y) => ({
    id, name, type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.4, position: [1000, y],
    parameters: { respondWith: "json", responseBody, options: { responseCode: code } },
  });
  const nodes = [
    webhook("stratos-ro-in-v1", "Recibir entrada", "stratos-infobip-readonly-in-v1", 0),
    webhook("stratos-ro-echo-v1", "Recibir eco", "stratos-infobip-readonly-echo-v1", 240),
    mark("mark-in", "Marcar entrada", "INBOUND_MESSAGE", 0),
    mark("mark-echo", "Marcar eco", "BUSINESS_APP_MESSAGE_ECHO", 240),
    { id: "normalize", name: "Normalizar evento", type: "n8n-nodes-base.code", typeVersion: 2,
      position: [480, 100], onError: "continueErrorOutput", parameters: { jsCode:
        `const normalize=${normalizeInfobipPayload.toString()};\nconst event=$input.first().json;\nreturn [{json:{payload:normalize(event.payload,event.eventType)}}];` } },
    { id: "persist", name: "Guardar espejo aislado", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2,
      position: [740, 100], onError: "continueErrorOutput", parameters: {
        method: "POST", url: "https://glulgyhkrqpykxmujodb.supabase.co/rest/v1/rpc/fn_ingest_infobip_multitenant",
        authentication: "genericCredentialType", genericAuthType: "httpCustomAuth", sendBody: true,
        specifyBody: "json", jsonBody: "={{ JSON.stringify({ payload: $json.payload }) }}", options: { timeout: 30000 },
      }, credentials: { httpCustomAuth: { id: supabaseCredentialId, name: "Supabase REST stratos-prod (AIOS)" } } },
    respond("saved", "Confirmar guardado", 200, "={{ $json }}", 0),
    respond("invalid", "Rechazar formato", 400, '{"ok":false,"error":"invalid_infobip_payload"}', 240),
    respond("retry", "Solicitar reintento", 503, '{"ok":false,"retry":true}', 440),
  ];
  const link = (node) => ({ node, type: "main", index: 0 });
  return { name: "STRATOS · Infobip lectura multiempresa · v1", nodes, connections: {
    "Recibir entrada": { main: [[link("Marcar entrada")]] },
    "Recibir eco": { main: [[link("Marcar eco")]] },
    "Marcar entrada": { main: [[link("Normalizar evento")]] },
    "Marcar eco": { main: [[link("Normalizar evento")]] },
    "Normalizar evento": { main: [[link("Guardar espejo aislado")], [link("Rechazar formato")]] },
    "Guardar espejo aislado": { main: [[link("Confirmar guardado")], [link("Solicitar reintento")]] },
  }, settings: { executionOrder: "v1", executionTimeout: 60, saveDataSuccessExecution: "none",
    saveDataErrorExecution: "none", saveManualExecutions: false, saveExecutionProgress: false } };
}
