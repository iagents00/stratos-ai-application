import { randomUUID } from 'node:crypto';
import { HuliError } from '../supabase/functions/_shared/huli.mjs';

const ACTIONS = new Set(['patients', 'appointments', 'availability', 'login', 'logout']);
const METHODS = new Set(['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

export function readClinicalBody(req) {
  let raw;
  // Vercel parses JSON lazily through req.body; malformed input can throw
  // before our own parser receives any value.
  try { raw = req.body; }
  catch { throw new HuliError('El contenido de la solicitud no es JSON válido.', 400); }
  return parseClinicalBody(raw);
}

export function parseClinicalBody(raw) {
  let encoded;
  try { encoded = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {}); }
  catch { throw new HuliError('Solicitud inválida.', 400); }
  if (new TextEncoder().encode(encoded).byteLength > 4096) throw new HuliError('Solicitud demasiado grande.', 413);
  let body;
  try { body = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {}; }
  catch { throw new HuliError('El contenido de la solicitud no es JSON válido.', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HuliError('Solicitud inválida.', 400);
  return body;
}

// Operational trace only. Durable storage, retention and access controls must
// be verified at the hosting provider before calling this an audit trail.
export function createClinicalTrace(method, sink = event => console.info(JSON.stringify(event))) {
  const started = Date.now(), requestId = randomUUID();
  let context = {}, emitted = false;
  return {
    requestId,
    setAction(action) { context.action = ACTIONS.has(action) ? action : 'unsupported'; },
    setActor(organizationId, actorId) { context.organizationId = organizationId; context.actorId = actorId; },
    complete(status) {
      if (emitted) return;
      emitted = true;
      const event = { event: 'clinical_gateway_request', schemaVersion: 1, requestId,
        occurredAt: new Date().toISOString(), method: METHODS.has(method) ? method : 'OTHER',
        action: context.action || 'metadata', status, outcome: status < 400 ? 'allowed' : 'denied_or_failed',
        durationMs: Math.max(0, Date.now() - started),
        ...(context.actorId ? { organizationId: context.organizationId, actorId: context.actorId } : {}) };
      try { sink(event); } catch { /* Logging failure must not leak request contents. */ }
    },
  };
}
