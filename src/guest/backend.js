// Only the separately compiled guest entry resolves its data client here.
// There is no transport, JWT, production URL, SDK or enterprise session.
const copy = value => structuredClone(value);
const denied = { message: 'Esta operación no está disponible en la demo.', code: 'GUEST_ONLY' };
let tables = {};
let nextId = 1;
export function resetGuestData() {
  nextId = 1;
  tables = { team_actions: [], team_documents: [{
    id: 'guest-document-1',
    titulo: 'Guía de trabajo de ejemplo',
    tipo: 'Demostración',
    fecha: '2026-01-01',
    autor: 'Equipo de ejemplo',
    contenido: 'GUÍA DE TRABAJO DE EJEMPLO\n\nEste documento contiene únicamente datos ficticios.\n\n• Consulta la ficha de Alex Ejemplo en el CRM.\n• Registra una próxima acción y revisa la agenda en Space.\n• Usa el Copilot para consultar respuestas de ejemplo.\n\nLos cambios de esta demo solo duran mientras está abierta. No se accede a documentos, cuentas ni servicios de empresas reales.',
  }], profiles: [
    { id: 'demo-user-local', name: 'Invitado', role: 'admin' },
    { id: 'guest-advisor-1', name: 'Asesor 1 Ejemplo', role: 'asesor' },
    { id: 'guest-advisor-2', name: 'Asesor 2 Ejemplo', role: 'asesor' },
  ] };
}
resetGuestData();

export function query(table) {
  let mode = 'read', payload, single = false, limit = null;
  const filters = [];
  const execute = () => {
    const writable = table === 'team_actions';
    if (mode === 'denied') return { data: null, error: denied };
    if (mode !== 'read' && !writable) return { data: null, error: denied };
    const source = tables[table] || [];
    const matches = row => filters.every(predicate => predicate(row));
    let rows = source.filter(matches);
    if (mode === 'insert') {
      rows = (Array.isArray(payload) ? payload : [payload]).map(row => ({ id: `guest-action-${nextId++}`, created_at: new Date().toISOString(), ...copy(row) }));
      source.push(...rows);
    } else if (mode === 'update') rows.forEach(row => Object.assign(row, copy(payload)));
    else if (mode === 'delete') tables[table] = source.filter(row => !matches(row));
    if (limit !== null) rows = rows.slice(0, limit);
    return { data: copy(single ? rows[0] ?? null : rows), error: null, count: rows.length };
  };
  const chain = {
    select: () => chain,
    insert: value => { mode = 'insert'; payload = value; return chain; },
    upsert: () => { mode = 'denied'; return chain; },
    update: value => { mode = 'update'; payload = value; return chain; },
    delete: () => { mode = 'delete'; return chain; },
    eq: (key, value) => { filters.push(row => row[key] === value); return chain; },
    neq: (key, value) => { filters.push(row => row[key] !== value); return chain; },
    is: (key, value) => { filters.push(row => (row[key] ?? null) === value); return chain; },
    in: (key, values) => { filters.push(row => values.includes(row[key])); return chain; },
    order: () => chain,
    limit: value => { limit = value; return chain; },
    range: (from, to) => { limit = to - from + 1; return chain; },
    single: () => { single = true; return chain; },
    maybeSingle: () => { single = true; return chain; },
    then: (ok, fail) => Promise.resolve().then(execute).then(ok, fail),
    catch: fail => Promise.resolve().then(execute).catch(fail),
  };
  return new Proxy(chain, { get: (value, key) => key in value ? value[key] : () => chain });
}
export const SUPABASE_REST_URL = '';
export const SUPABASE_ANON_KEY = '';
export const supabase = {
  from: query,
  rpc: async (name, params = {}) => {
    if (name === 'fn_org_team_members') return { data: copy(tables.profiles), error: null };
    if (name === 'fn_docs_listar') return { data: copy(tables.team_documents), error: null };
    if (name === 'fn_space_document_read') {
      const document = tables.team_documents.find(row => row.id === params.p_document_id);
      return { data: copy(document ?? null), error: null };
    }
    return { data: null, error: denied };
  },
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  channel: () => { const channel = { on: () => channel, subscribe: () => channel, unsubscribe() {} }; return channel; },
  removeChannel() {},
  functions: { invoke: async () => ({ data: null, error: denied }) },
  storage: { from: () => ({ upload: async () => ({ data: null, error: denied }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
};
