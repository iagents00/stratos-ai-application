// Only the separately compiled guest entry resolves its data client here.
// There is no transport, JWT, production URL, SDK or enterprise session.
const copy = value => structuredClone(value);
const denied = { message: 'Esta operación no está disponible en la demo.', code: 'GUEST_ONLY' };
let tables = {};
let nextId = 1;
export function resetGuestData() {
  nextId = 1;
  tables = { team_actions: [], profiles: [
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
  rpc: async name => name === 'fn_org_team_members'
    ? { data: copy(tables.profiles), error: null } : { data: null, error: denied },
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
