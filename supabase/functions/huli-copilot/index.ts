import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { HuliClient, HuliError, HULI_HELP, parseHuliCommand } from '../_shared/huli.mjs';

// HULI_CONNECTIONS_JSON: object indexed by Stratos organization UUID.
// Each value contains apiKey, organizationId, allowedPairs [{doctorId,clinicId}].
// Never use VITE_ variables or trust organization IDs sent by the browser.
Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return respond({ error: 'Método no permitido.' }, 405);
  try {
    const authorization = req.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return respond({ error: 'Sesión requerida.' }, 401);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return respond({ error: 'Sesión inválida.' }, 401);
    const { data: profile, error: profileError } = await client.from('profiles').select('organization_id').eq('id', user.id).single();
    if (profileError || !profile?.organization_id) return respond({ error: 'Sin organización autorizada.' }, 403);
    const { data: membership } = await client.from('huli_access').select('user_id').eq('user_id', user.id).eq('organization_id', profile.organization_id).eq('enabled', true).maybeSingle();
    if (!membership) return respond({ reply: 'Huli todavía no está habilitado para tu usuario en esta organización.' });
    const raw = await req.text();
    if (raw.length > 2048) return respond({ error: 'Solicitud demasiado grande.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return respond({ error: 'Solicitud inválida.' }, 400); }
    const command = parseHuliCommand(body.text);
    if (!command || command.action === 'ayuda') return respond({ reply: HULI_HELP });
    const connections = JSON.parse(Deno.env.get('HULI_CONNECTIONS_JSON') || '{}');
    const config = connections[profile.organization_id];
    if (!config) return respond({ reply: 'Tu organización aún no tiene una conexión Huli configurada.' });
    const huli = new HuliClient(config);
    if (command.action === 'estado') {
      const org = await huli.status();
      return respond({ reply: `Huli conectado: ${org.name} · organización ${org.organizationId} · activa. Consultas habilitadas; sin modificaciones de citas.` });
    }
    const slots = await huli.availability(command);
    return respond({ reply: slots.length ? `Disponibilidad Huli (hasta 40 horarios):\n${slots.join('\n')}\nConsulta informativa; estos horarios no están reservados.` : 'Huli no devolvió horarios disponibles para ese período.' });
  } catch (error) {
    return respond({ error: error instanceof HuliError ? error.message : 'No se pudo consultar Huli.' }, error instanceof HuliError ? error.status : 500);
  }
});
