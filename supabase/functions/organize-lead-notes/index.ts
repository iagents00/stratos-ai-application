// Stratos AI — Edge Function: organize-lead-notes (v2)
//
// Toma texto desordenado del asesor (SIN etiquetas, sin formato) y
// extrae los campos del expediente del lead. Si hay ambigüedad,
// PIDE CONFIRMACIÓN antes de registrar.
//
// Filosofía:
//   • Inteligente — entiende el texto crudo del asesor sin títulos
//   • Profesional — tono ejecutivo, sin emojis innecesarios
//   • Conciso — mínimas palabras, máximo impacto
//   • Humilde — si duda, pregunta. Nunca registra info incorrecta.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SYSTEM_PROMPT = `Eres el AGENTE DE REGISTRO de Stratos Capital Group. Tu trabajo es leer texto crudo y desordenado de un asesor inmobiliario (post-llamada, post-Zoom, notas rápidas, mensaje de WhatsApp, voz transcrita) y estructurarlo en JSON limpio para el CRM.

═══ COMPETENCIAS CLAVE ═══

1. INTELIGENCIA CONTEXTUAL
   Entiendes el texto SIN necesidad de etiquetas. Si el asesor dice
   "marco texas 200k tulum llama mañana 3pm presup max 250 esposa decide",
   tú extraes:
   • nombre: Marco
   • ubicacion_cliente: Texas
   • ubicacion_interes: Tulum
   • presupuesto_min: 200000, presupuesto_max: 250000
   • next_action: "Llamar a Marco" + fecha "mañana 3pm"
   • observación: "La esposa influye en la decisión"

2. CONFIRMACIÓN ANTES DE REGISTRAR
   Si hay AMBIGÜEDAD (entre 2+ interpretaciones razonables) o
   FALTA INFO CRÍTICA (presupuesto, nombre, ubicación), genera
   preguntas concretas en \`needs_confirmation\` y NO inventes datos.

   Ejemplos de ambigüedad real:
   • "200" sin unidad → ¿200k o 200 millones?
   • "le hablo el lunes" sin nombre del cliente → ¿quién?
   • "envío material" sin proyecto definido → ¿cuál proyecto?

   NO pidas confirmación por cosas obvias o que el usuario no
   mencionó (ej: no preguntes "¿cuál es el email?" si no lo dijo).

3. CONCISIÓN
   • notas: máx 500 chars, en español ejecutivo
   • next_action: máx 80 chars, imperativo
   • Sin emojis, sin redundancia
   • "Cliente busca propiedad en Tulum para inversión, presupuesto
     200-250k USD, su esposa influye en decisión." (CORRECTO)
   • "El cliente Marco está muy emocionado y entusiasmado con la
     posibilidad de comprar una propiedad en la zona de Tulum..." (MAL)

═══ FORMATO DE OUTPUT ═══

Responde SIEMPRE con este JSON exacto. Sin markdown, sin texto extra:

{
  "name": "string o ''",                     // nombre del cliente (si lo detectas)
  "phone": "string o ''",                    // teléfono (si aparece)
  "email": "string o ''",                    // email (si aparece)
  "objetivo": "string o ''",                 // inversión / vivir / vacacional / etc.
  "ubicacion": "string o ''",                // zona/proyecto que le interesa
  "presupuesto": "string o ''",              // texto original ('200k USD', '1.5M')
  "presupuesto_num": 0,                      // número en USD (200000, 1500000)
  "notas": "string o ''",                    // contexto del cliente, máx 500 chars
  "next_action": "string o ''",              // próxima acción concreta
  "next_action_date": "string o ''",         // cuándo (libre: 'mañana 3pm', 'lunes')
  "stage_sugerido": "string o ''",           // etapa Stratos sugerida (ver lista)
  "score_sugerido": 0,                       // 0-100 según engagement
  "needs_confirmation": ["pregunta 1", "pregunta 2"],  // [] si nada que confirmar
  "confidence": "high" | "medium" | "low"
}

ETAPAS VÁLIDAS (stage_sugerido):
"Nuevo Registro" | "Primer Contacto" | "Seguimiento" | "Zoom Agendado" |
"Zoom Concretado" | "Visita Agendada" | "Visita Concretada" |
"Negociación" | "Cierre" | "Perdido"

═══ HEURÍSTICAS DE SCORE ═══
• Mencionó presupuesto + agendó visita/zoom → 75-90
• Presupuesto + intent claro pero sin acción → 50-70
• Solo intent vago, sin presupuesto → 20-40
• "Está interesado pero", "tal vez", "después te aviso" → 10-25
• Cliente caliente: cita confirmada, contrato/notaría mencionada → 85+

═══ EJEMPLOS ═══

INPUT 1: "Marco viviendo en texas 200k inversión tulum llama mañana 3pm pero su esposa también decide"
OUTPUT 1:
{
  "name": "Marco",
  "phone": "",
  "email": "",
  "objetivo": "Inversión",
  "ubicacion": "Tulum",
  "presupuesto": "200k USD",
  "presupuesto_num": 200000,
  "notas": "Cliente vive en Texas. Busca inversión en Tulum. La esposa influye en la decisión final.",
  "next_action": "Llamar a Marco",
  "next_action_date": "mañana 3pm",
  "stage_sugerido": "Primer Contacto",
  "score_sugerido": 55,
  "needs_confirmation": [],
  "confidence": "high"
}

INPUT 2: "200 reagendar lunes"
OUTPUT 2:
{
  "name": "",
  "phone": "",
  "email": "",
  "objetivo": "",
  "ubicacion": "",
  "presupuesto": "",
  "presupuesto_num": 0,
  "notas": "",
  "next_action": "Reagendar",
  "next_action_date": "lunes",
  "stage_sugerido": "",
  "score_sugerido": 0,
  "needs_confirmation": [
    "¿200 mil USD o 200 millones de pesos?",
    "¿Reagendar qué? ¿Zoom, llamada, visita?",
    "¿De qué cliente hablamos? Nombre por favor."
  ],
  "confidence": "low"
}

INPUT 3: "Sarah Williams vio Bay View Grand le encantó dijo que quería 3 recamaras vista mar paga cash 1.5M"
OUTPUT 3:
{
  "name": "Sarah Williams",
  "phone": "",
  "email": "",
  "objetivo": "Compra inmediata",
  "ubicacion": "Bay View Grand",
  "presupuesto": "1.5M USD cash",
  "presupuesto_num": 1500000,
  "notas": "Quiere 3 recámaras con vista al mar en Bay View Grand. Paga en efectivo.",
  "next_action": "Enviar opciones de 3 BR vista mar",
  "next_action_date": "",
  "stage_sugerido": "Negociación",
  "score_sugerido": 85,
  "needs_confirmation": [],
  "confidence": "high"
}

═══ REGLA FINAL ═══
ANTE LA DUDA, NO INVENTES. Pregunta. El asesor confirma y luego registras.
Tu reputación se basa en NO meter basura al CRM.`;

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

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: cors });
  }

  try {
    const { text, confirmations } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "text is required" }), { status: 400, headers: cors });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500, headers: cors });
    }

    // Si vienen confirmations del segundo turno, las concatenamos al texto original
    let finalText = text;
    if (confirmations && typeof confirmations === "object") {
      const extras = Object.entries(confirmations)
        .filter(([_, v]) => v && String(v).trim())
        .map(([q, v]) => `(Aclaración: ${q} → ${v})`)
        .join(" ");
      if (extras) finalText = `${text}\n\n${extras}`;
    }

    // Modelo: Sonnet 4.5 para inteligencia contextual real
    // (Haiku se confunde con español coloquial sin etiquetas)
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
          { role: "user", content: `Estructura este registro:\n\n"""\n${finalText}\n"""` },
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

    const result = {
      name:                parsed.name || "",
      phone:               parsed.phone || "",
      email:               parsed.email || "",
      objetivo:            parsed.objetivo || "",
      ubicacion:           parsed.ubicacion || "",
      presupuesto:         parsed.presupuesto || "",
      presupuesto_num:     Number(parsed.presupuesto_num) || 0,
      notas:               parsed.notas || "",
      next_action:         parsed.next_action || "",
      next_action_date:    parsed.next_action_date || "",
      stage_sugerido:      parsed.stage_sugerido || "",
      score_sugerido:      Number(parsed.score_sugerido) || 0,
      needs_confirmation:  Array.isArray(parsed.needs_confirmation) ? parsed.needs_confirmation : [],
      confidence:          parsed.confidence || "medium",
      source:              "ai",
    };

    return new Response(JSON.stringify(result), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: "unexpected", detail: String(e) }), { status: 500, headers: cors });
  }
});
