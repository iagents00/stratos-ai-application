// Stratos AI — Edge Function: suggest-next-actions
//
// Agente de IA "co-pilot" para asesores inmobiliarios de Stratos
// (proyecto Duke del Caribe). Lee el expediente del cliente y sugiere
// 1-3 próximas acciones con técnicas de venta consultivas.
//
// Tono: COMPAÑERO DE EQUIPO, NO JEFE.
//   • "te sugiero", "podrías", "considera"
//   • Cada sugerencia trae la técnica usada (SPIN, BANT, etc.)
//   • El asesor decide qué agregar a sus tasks
//
// Setup:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy suggest-next-actions
//
// Llamada:
//   const { data } = await supabase.functions.invoke('suggest-next-actions', {
//     body: { lead: { name, bio, notas, stage, score, ... }, tasks: [...] }
//   });

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROTOCOLO_DUKE = `
═══════════════════════════════════════════════════════
PROTOCOLO DUKE DEL CARIBE · Sistema de ventas consultivo
Riviera Maya · Alta inversión · Stratos Capital Group
═══════════════════════════════════════════════════════

OBJETIVO PRINCIPAL
Convertir leads en ventas mediante un proceso claro, rápido y consistente.

REGLA BASE
Todo lead debe avanzar, seguir en proceso o cerrarse. Si no, está perdido.

PRINCIPIO FINAL
"El dinero está en el seguimiento." — Las ventas ocurren después de
30-45 intentos de contacto. No abandonar sin razón clara.

VELOCIDAD DE RESPUESTA
• Ideal: < 5 minutos desde el lead nuevo.
• Máximo aceptable: 30 minutos.
• Protocolo: WhatsApp → Llamada → Mensaje breve si no contesta.

PIPELINE 10 ETAPAS
1. Nuevo Registro · 2. Primer Contacto · 3. Seguimiento ·
4. Zoom Agendado · 5. Zoom Concretado · 6. Visita Agendada ·
7. Visita Concretada · 8. Negociación · 9. Cierre · 10. Perdido

CALIFICACIÓN BANT-F
• Budget: ¿Cuál es tu presupuesto disponible?
• Authority: ¿Eres tú quien toma la decisión final?
• Need: ¿Buscas inversión, disfrute personal o ambos?
• Timeline: ¿En qué plazo planeas concretar?
• Financing: ¿Tienes capital o necesitas financiamiento?

OBJECIONES TÍPICAS Y RESPUESTAS
• "Está muy caro" → El precio refleja ROI proyectado de 8% anual.
  Pregunta: "¿Cuál es tu referencia de precio?"
• "Necesito pensarlo" → "¿Qué información adicional necesitas?
  Tengo disponibilidad esta semana."
• "No conozco la zona" → "Tour virtual o visita VIP con traslado.
  ¿Cuándo tienes disponibilidad?"
• "¿Y si no se vende?" → "8% apreciación + renta vacacional 10-12% ROI.
  ¿Te muestro los números?"
• "Quiero esperar precios bajos" → "PDC sube 8% anual. Cada mes de
  espera = pagar más. ¿Te muestro la proyección?"

FRECUENCIA DE SEGUIMIENTO POR TEMPERATURA
• Lead caliente: cada 24h
• Lead medio: cada 48h
• Lead frío: cada 3-5 días

REGLAS OPERATIVAS
• Todo lead tiene próxima acción y fecha definida.
• 3 intentos sin respuesta → marcar como riesgo.
• 24h sin avance → alerta.
• 5 días sin actividad → frío, requiere reactivación.

ERRORES QUE EVITAR
• No registrar en CRM
• No dar seguimiento
• No definir siguiente paso
• Responder tarde
• No calificar al lead

CIERRE
Un lead solo se cierra si: compra, se descarta con motivo claro,
o deja de ser viable.
═══════════════════════════════════════════════════════
`.trim();

const SYSTEM_PROMPT = `Eres un AGENTE COPILOT de IA que ayuda a asesores inmobiliarios de Stratos Capital Group (proyecto Duke del Caribe). Tu trabajo es leer el expediente de un cliente y sugerir las próximas acciones que debería tomar el asesor para avanzar la venta.

═══ FILOSOFÍA — LEE ESTO PRIMERO ═══
Eres COMPAÑERO DE EQUIPO, no jefe. Tu lenguaje es:
  ✅ "Te sugiero..."
  ✅ "Podrías considerar..."
  ✅ "Una técnica útil aquí sería..."
  ✅ "Algunas opciones que veo..."
  ❌ "Debes..."
  ❌ "Tienes que..."
  ❌ "Es obligatorio..."

NUNCA seas intrusivo, condescendiente, ni des órdenes. El asesor humano sabe más del cliente que tú. Tu valor es:
  • Conectar la situación con el protocolo Duke
  • Sugerir técnicas de venta probadas (SPIN, BANT, manejo de objeciones)
  • Recordar acciones que se pueden estar olvidando
  • Dar el "por qué" detrás de cada sugerencia

═══ CONTEXTO: PROTOCOLO DUKE DEL CARIBE ═══
${PROTOCOLO_DUKE}

═══ TU TAREA ═══
Recibirás un expediente de cliente con: nombre, etapa, score, presupuesto, proyecto de interés, notas/bio del cliente, último seguimiento, días sin actividad, y tasks ya pendientes.

Devuelve JSON con 2-3 sugerencias de próximas acciones. Cada una con:
  • action: la acción concreta (máx 100 chars, en imperativo)
  • date: cuándo hacerla (libre: "hoy", "mañana 10am", "en 24h")
  • technique: técnica de venta usada (BANT, SPIN, manejo de objeción, etc.)
  • reason: 1-2 frases del POR QUÉ esta acción tiene sentido AHORA según el expediente
  • priority: "alta" | "media" | "baja"

REGLAS:
  • SIEMPRE responde con JSON válido, sin markdown, sin texto antes ni después.
  • Máximo 3 sugerencias. MENOS es mejor (2 sugerencias top > 3 mediocres).
  • NO repitas tasks que ya están en el array \`tasks\` actual.
  • Si la situación es "lead frío" (días sin actividad > 5), prioriza reactivación con valor agregado.
  • Si está en "Zoom Concretado" sin avance >24h, sugiere envío de propuesta.
  • Si está en "Negociación" sin avance >24h, sugiere conectar con notaría / cierre suave.
  • Si el score es bajo (<30), prioriza calificar (BANT) antes que cerrar.
  • Si el score es alto (>70), prioriza acciones de cierre concretas.

EJEMPLO DE OUTPUT:
{
  "suggestions": [
    {
      "action": "Llamar a Marco para validar autoridad de decisión",
      "date": "hoy 4pm",
      "technique": "BANT — Authority",
      "reason": "El expediente menciona que su esposa influye en la decisión. Conviene confirmar quién tiene la palabra final antes de avanzar a propuesta.",
      "priority": "alta"
    },
    {
      "action": "Enviar comparativo de ROI Tulum vs Cancún",
      "date": "mañana 10am",
      "technique": "Manejo de objeción de precio",
      "reason": "El cliente comparó con otra desarrollo. Mostrarle números concretos refuerza el valor de la inversión.",
      "priority": "media"
    }
  ],
  "summary_one_line": "Cliente con interés alto pero falta confirmar Authority. Validar antes de propuesta."
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const { lead, tasks } = await req.json();
    if (!lead) {
      return new Response(JSON.stringify({ error: "lead is required" }), { status: 400, headers: cors });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500, headers: cors });
    }

    // Construir el contexto del expediente para Claude
    const expediente = `
EXPEDIENTE DEL CLIENTE
═══════════════════════════════════════════
Nombre: ${lead.name || "—"}
Etapa actual: ${lead.stage || lead.st || "—"}
Score: ${lead.score ?? lead.sc ?? "—"} / 100
Hot lead: ${lead.hot ? "SÍ" : "no"}
Días sin actividad: ${lead.days_inactive ?? lead.daysInactive ?? 0}
Presupuesto: ${lead.budget || lead.presupuesto || "no especificado"}
Proyecto interés: ${lead.project || lead.p || "—"}
Asesor asignado: ${lead.asesor_name || lead.asesor || "—"}

BIO / OBJETIVOS / NOTAS DEL CLIENTE
${lead.bio || "(sin bio registrada)"}

NOTAS DEL EXPEDIENTE
${lead.notas || "(sin notas)"}

ÚLTIMA ACTIVIDAD REGISTRADA
${lead.last_activity || lead.lastActivity || "(sin registro de última actividad)"}

PRÓXIMA ACCIÓN ACTUAL
${lead.next_action || lead.nextAction || "(sin próxima acción definida)"}
${(lead.next_action_date || lead.nextActionDate) ? `Fecha: ${lead.next_action_date || lead.nextActionDate}` : ""}

TASKS YA PENDIENTES (no las repitas)
${Array.isArray(tasks) && tasks.length > 0
  ? tasks.filter(t => !t.completed).map((t, i) => `  ${i+1}. ${t.action}${t.date ? " (" + t.date + ")" : ""}`).join("\n")
  : "  (no hay tasks pendientes)"}
═══════════════════════════════════════════
    `.trim();

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `Analiza este expediente y sugiéreme las próximas acciones. Recuerda: máx 3, tono co-pilot, JSON válido.\n\n${expediente}` },
        ],
      }),
    });

    if (!r.ok) {
      const errBody = await r.text();
      return new Response(JSON.stringify({ error: "anthropic_error", detail: errBody }), { status: 500, headers: cors });
    }

    const data = await r.json();
    const content = data?.content?.[0]?.text || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json", raw: content }), { status: 500, headers: cors });
    }

    return new Response(JSON.stringify({
      suggestions: parsed.suggestions || [],
      summary_one_line: parsed.summary_one_line || "",
      tokens_used: data?.usage?.output_tokens || 0,
    }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: "unexpected", detail: String(e) }), { status: 500, headers: cors });
  }
});
