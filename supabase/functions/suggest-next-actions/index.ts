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
PROTOCOLO OPERATIVO · STRATOS CAPITAL GROUP
PROTOCOLO DUKE DEL CARIBE
Sistema de ventas consultivo · Riviera Maya · Alta inversión
═══════════════════════════════════════════════════════

OBJETIVO
Convertir leads en ventas mediante un proceso claro, rápido y consistente.

REGLA BASE
Todo lead debe avanzar, seguir en proceso o cerrarse. Si no, está perdido.

PRINCIPIOS DEL ASESOR
1. Responder rápido
2. Calificar correctamente
3. Mover al siguiente paso
4. Dar seguimiento constante
5. Registrar todo

REGLA CRÍTICA
"Lo que no está registrado en el CRM, no existe."

PRINCIPIO FINAL
"No gana el que más leads tiene. Gana el que mejor los trabaja.
El dinero está en el seguimiento."

VELOCIDAD DE RESPUESTA
• Ideal: < 5 minutos desde el lead nuevo.
• Máximo aceptable: 30 minutos.
• Protocolo: WhatsApp → Llamada directa → Mensaje breve si no contesta.

FLUJO DE TRABAJO
1. Contacto Inicial — obtener respuesta (mensaje + llamada).
2. Calificación — entender al cliente (nombre, presupuesto, zona,
   objetivo, tiempo, ubicación, objeciones).
3. Avance — toda conversación termina en SIGUIENTE PASO concreto
   (Zoom agendado · recorrido agendado · seguimiento con fecha).
4. Registro — después de cada interacción registrar en Stratos AI:
   resumen · etapa · próxima acción · fecha · nivel del lead.

PIPELINE 10 ETAPAS
1. Lead nuevo
2. Contactado
3. Conversación
4. Zoom agendado
5. Recorrido
6. Seguimiento
7. Apartado
8. Venta cerrada
9. Post-venta
10. Referidos

CALIFICACIÓN BANT
• Budget: ¿Cuál es tu presupuesto disponible para esta inversión?
• Authority: ¿Eres tú quien toma la decisión final?
• Need: ¿Buscas inversión, disfrute personal o ambos?
• Timeline: ¿En qué plazo planeas concretar la compra?
• Financing: ¿Tienes capital disponible o necesitas financiamiento?

MANEJO DE OBJECIONES
• "Está muy caro" → El precio refleja ubicación premium y ROI proyectado
  de 8% anual. Pregunta: "¿Cuál es tu referencia de precio?"
• "Necesito pensarlo" → "Entendido. ¿Qué información adicional necesitas
  para decidir? Tengo disponibilidad esta semana."
• "No conozco la zona" → "Hagamos tour virtual o agendo una visita VIP
  con traslado incluido. ¿Cuándo tienes disponibilidad?"
• "¿Y si no se vende?" → "8% apreciación anual + programa de renta
  vacacional con 10-12% ROI. ¿Te muestro los números?"
• "Quiero esperar precios bajos" → "En PDC los precios suben 8% anual.
  Cada mes de espera equivale a pagar más. ¿Te muestro la proyección?"

SLA DE RESPUESTA · TIEMPOS CRÍTICOS
┌─────────────────────────┬───────────────────┬──────────────┐
│ Evento                  │ Respuesta         │ Tiempo       │
├─────────────────────────┼───────────────────┼──────────────┤
│ Nuevo lead registrado   │ Primer contacto   │ < 2 horas    │
│ Zoom concretado         │ Envío propuesta   │ < 24 horas   │
│ Sin actividad 5+ días   │ Reactivación      │ Inmediato    │
│ Negociación activa      │ Seguimiento       │ < 24 horas   │
└─────────────────────────┴───────────────────┴──────────────┘

REGLAS OPERATIVAS
• Todo lead tiene próxima acción y fecha definida.
• 3 intentos sin respuesta → RIESGO (escalar al director).
• 24h sin avance → ALERTA.
• 5 días sin actividad → FRÍO, requiere reactivación inmediata.

FASES DE SEGUIMIENTO
Las ventas ocurren hasta después de 30–45 intentos.
NO abandonar sin razón clara.
• Intentos 1–5: Contacto y respuesta
• Intentos 6–15: Interés y valor
• Intentos 16–30: Confianza y decisión
• Intentos 31–45: Cierre o reactivación

FRECUENCIA DE SEGUIMIENTO POR TEMPERATURA
• Caliente: cada 24h
• Medio: cada 48h
• Frío: cada 3-5 días

REGLAS DE COMUNICACIÓN
• No repetir mensajes
• Cada contacto debe aportar valor
• SIEMPRE cerrar con siguiente paso

ALERTAS QUE GENERAR
• Lead sin contacto
• Seguimiento vencido
• Lead caliente sin avance
• Cliente sin próxima acción

ERRORES CRÍTICOS A EVITAR
• No registrar en CRM
• No dar seguimiento
• No definir siguiente paso
• Responder tarde
• No calificar al lead

CIERRE DE PROCESO
Un lead solo se cierra si:
1. Compra (venta cerrada)
2. Se descarta con motivo claro
3. Deja de ser viable
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

REGLAS DE PRIORIZACIÓN SEGÚN PROTOCOLO DUKE:
  • SIEMPRE responde con JSON válido, sin markdown, sin texto antes ni después.
  • Máximo 3 sugerencias. MENOS es mejor (2 sugerencias top > 3 mediocres).
  • NO repitas tasks que ya están en el array \`tasks\` actual.
  • Cada sugerencia DEBE alinearse con UNA fase del Protocolo Duke.
  • Cada sugerencia DEBE cerrar con SIGUIENTE PASO concreto (sin ambigüedad).

REGLAS DE STAGE (etapas del pipeline 10):
  • "Lead nuevo" → URGENTE: SLA <2h, primer contacto WhatsApp + llamada,
    iniciar BANT en discovery de 30 min.
  • "Contactado" / "Primer Contacto" → completar discovery (BANT),
    confirmar presupuesto + zona + timeline + financiamiento.
  • "Conversación" → cerrar la conversación con SIGUIENTE PASO (Zoom o tour).
  • "Zoom agendado" → preparar presentación personalizada + comparativos,
    recordatorio 24h y 2h antes.
  • "Recorrido" / "Zoom Concretado" → SLA <24h: enviar propuesta formal
    + proponer visita presencial.
  • "Seguimiento" → frecuencia según temperatura:
       Caliente cada 24h, Medio cada 48h, Frío cada 3-5 días.
       Cada toque debe aportar VALOR NUEVO (no repetir mensajes).
  • "Apartado" / "Negociación" → SLA <24h: revisar pago, conectar notaría,
    validar costos, preparar expediente de cierre.
  • "Cierre" / "Venta cerrada" → confirmar firma + solicitar referidos.
  • "Post-venta" → solicitar 2-3 referidos calificados.

REGLAS DE ALERTA:
  • 3 intentos sin respuesta → RIESGO: escalar al director, cambiar canal,
    aportar valor distinto (descuento, oferta exclusiva, info nueva).
  • 24h sin avance → ALERTA: re-engagement con valor agregado.
  • 5+ días sin actividad → FRÍO: reactivación INMEDIATA con propuesta concreta.

REGLAS BANT:
  • Score bajo (<30) → priorizar CALIFICAR antes de cerrar.
  • Score alto (>70) → acciones concretas de cierre.
  • Si las notas mencionan "consulta con esposa/familia" → falta Authority,
    incluir al decisor en próxima conversación.
  • Si menciona "no urge", "más adelante" → falta Timeline, crear urgencia
    con escasez (precio sube, unidades disponibles).
  • Si no se ha tocado presupuesto → preguntar Budget directamente.

REGLAS DE OBJECIONES:
  • Si las notas mencionan "muy caro" → usar manejo de objeción de precio
    (ROI 8%, comparar con renta vacacional 10-12%).
  • Si menciona "no conoce la zona" → ofrecer tour virtual o visita VIP.
  • Si menciona "necesito pensarlo" → preguntar qué info adicional necesita.

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

    // ── Selección de proveedor ─────────────────────────────────────────────
    // Prioridad 1: Gemini Flash (gratis, 1500 req/día, 1 M tokens contexto)
    // Prioridad 2: Anthropic Claude (pagado, fallback si Gemini no configurado)
    const geminiKey    = Deno.env.get("GEMINI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!geminiKey && !anthropicKey) {
      return new Response(
        JSON.stringify({ error: "No hay API key configurada. Define GEMINI_API_KEY (gratis) o ANTHROPIC_API_KEY." }),
        { status: 500, headers: cors },
      );
    }
    const useGemini = !!geminiKey;

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

    // ── Llamada al proveedor seleccionado ─────────────────────────────────
    const userPrompt = `Analiza este expediente y sugiéreme las próximas acciones. Recuerda: máx 3, tono co-pilot, JSON válido.\n\n${expediente}`;

    let content = "";
    let tokensUsed = 0;

    if (useGemini) {
      // Gemini 2.5 Flash — gratis hasta 1500 req/día
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 1500,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      if (!r.ok) {
        const errBody = await r.text();
        return new Response(JSON.stringify({ error: "gemini_error", detail: errBody }), { status: 500, headers: cors });
      }
      const data = await r.json();
      content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      tokensUsed = data?.usageMetadata?.candidatesTokenCount || 0;
    } else {
      // Anthropic Claude — fallback pagado
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!r.ok) {
        const errBody = await r.text();
        return new Response(JSON.stringify({ error: "anthropic_error", detail: errBody }), { status: 500, headers: cors });
      }
      const data = await r.json();
      content = data?.content?.[0]?.text || "";
      tokensUsed = data?.usage?.output_tokens || 0;
    }

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
      tokens_used: tokensUsed,
      provider: useGemini ? "gemini-2.5-flash" : "claude-sonnet-4-5",
    }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: "unexpected", detail: String(e) }), { status: 500, headers: cors });
  }
});
