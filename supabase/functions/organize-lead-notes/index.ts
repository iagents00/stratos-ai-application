// Stratos AI — Edge Function: organize-lead-notes
//
// Toma texto desordenado del asesor y devuelve JSON estructurado
// con los campos del expediente del lead. Usa Claude Haiku 4.5 para
// que sea barato (~$0.001 por llamada).
//
// Setup:
//   1. supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   2. supabase functions deploy organize-lead-notes
//
// Llamada desde el frontend:
//   const { data } = await supabase.functions.invoke('organize-lead-notes',
//     { body: { text: 'cliente quiere tulum 200k llama mañana 3pm' } });

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SYSTEM_PROMPT = `Eres un asistente que estructura notas desordenadas de asesores inmobiliarios en JSON.

Recibes texto libre (incluso en español coloquial, con typos, stream of consciousness) y debes extraer los siguientes campos:

  - objetivo: ¿qué busca el cliente? (inversión / vivir / vacacionar / mixto / etc.)
  - ubicacion: zona/ciudad/proyecto que le interesa (Cancún, Tulum, etc.)
  - presupuesto: texto original del presupuesto ("200k USD", "1.5 millones", etc.)
  - presupuesto_num: número en USD (200000, 1500000, etc.)
  - notas: información del cliente que NO va en los otros campos (dónde vive, contexto familiar, antecedentes, urgencia, etc.)
  - next_action: próxima acción concreta a tomar ("llamar", "agendar zoom", "enviar opciones")
  - next_action_date: cuándo ("mañana 3pm", "lunes 5", "27 de abril 10am") — formato libre tal como lo dijo el asesor

REGLAS:
  • SIEMPRE responde con JSON válido — sin markdown, sin código, sin explicaciones.
  • Si un campo no está claro en el texto, devuélvelo como string vacío "".
  • presupuesto_num: convierte "200k" → 200000, "1.5M" → 1500000. Si no hay presupuesto, devuelve 0.
  • next_action: máximo 80 caracteres, en imperativo ("Llamar al cliente", "Confirmar visita").
  • notas: máximo 500 caracteres, en español natural.
  • Si el texto es ininteligible, devuelve { "objetivo": "", ..., "notas": "<texto original>" }.

EJEMPLO:
INPUT: "marco viviendo en texas, presupuesto 200k, quiere tulum, va a llamar mañana 3pm, le interesa para inversión"
OUTPUT: {
  "objetivo": "Inversión",
  "ubicacion": "Tulum",
  "presupuesto": "200k USD",
  "presupuesto_num": 200000,
  "notas": "Marco vive en Texas. Le interesa Tulum para inversión.",
  "next_action": "Llamar al cliente",
  "next_action_date": "mañana 3pm",
  "confidence": "high"
}`;

Deno.serve(async (req: Request) => {
  // CORS preflight
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
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "text is required" }), { status: 400, headers: cors });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500, headers: cors });
    }

    // Llamada a Claude Haiku 4.5 (barata + rápida)
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `Estructura este texto en JSON:\n\n${text}` },
        ],
      }),
    });

    if (!r.ok) {
      const errBody = await r.text();
      return new Response(JSON.stringify({ error: "anthropic_error", detail: errBody }), { status: 500, headers: cors });
    }

    const data = await r.json();
    const content = data?.content?.[0]?.text || "";

    // Extraer el JSON (en caso de que Claude lo envuelva con texto)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return new Response(JSON.stringify({
        error: "invalid_json_from_claude",
        raw: content,
      }), { status: 500, headers: cors });
    }

    // Asegurar todos los campos esperados
    const result = {
      objetivo:         parsed.objetivo || "",
      ubicacion:        parsed.ubicacion || "",
      presupuesto:      parsed.presupuesto || "",
      presupuesto_num:  Number(parsed.presupuesto_num) || 0,
      notas:            parsed.notas || "",
      next_action:      parsed.next_action || "",
      next_action_date: parsed.next_action_date || "",
      confidence:       parsed.confidence || "high",
      source:           "ai",
    };

    return new Response(JSON.stringify(result), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: "unexpected", detail: String(e) }), { status: 500, headers: cors });
  }
});
