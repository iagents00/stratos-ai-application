// Read-only production checks. No password, patient names or session tokens in output.
import fs from 'node:fs';
const sessionPath = process.env.DENTAL_AUDIT_SESSION;
if (!sessionPath) throw new Error('Define DENTAL_AUDIT_SESSION con un archivo privado de sesión.');
const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
const source = fs.readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
const authUrl = source.match(/const FALLBACK_URL = '([^']+)'/)[1];
const anonKey = source.match(/const FALLBACK_KEY = '([^']+)'/)[1];
const refreshed = await fetch(`${authUrl}/auth/v1/token?grant_type=refresh_token`, {
  method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ refresh_token: session.refresh_token }), signal: AbortSignal.timeout(20000),
});
const auth = await refreshed.json();
if (!refreshed.ok || !auth.access_token) throw new Error('No se pudo renovar la sesión para la auditoría.');
fs.writeFileSync(sessionPath, JSON.stringify(auth), { mode: 0o600 });
const results = [];
const record = (host, name, pass, status, detail) => results.push({ host, name, pass, status, ...(detail ? { detail } : {}) });
for (const host of ['https://getstratosai.com', 'https://app.stratoscapitalgroup.com']) {
  const request = async (body, overrides = {}) => {
    const { headers: extraHeaders, ...extra } = overrides;
    const response = await fetch(`${host}/api/dental-huli`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${auth.access_token}`, ...(body ? { Origin: host, 'Content-Type': 'application/json' } : {}), ...extraHeaders },
      ...(body ? { body: JSON.stringify(body) } : {}), ...extra, signal: AbortSignal.timeout(25000),
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };
  const metadata = await request();
  record(host, 'Authenticated Huli metadata', metadata.response.status === 200 && metadata.data.authenticated === true && metadata.data.mode === 'read-only', metadata.response.status);
  record(host, 'Private responses are not cached', /no-store/.test(metadata.response.headers.get('cache-control') || ''), metadata.response.status);
  record(host, 'Server-generated request correlation ID', /^[a-f0-9-]{36}$/.test(metadata.response.headers.get('x-request-id') || ''), metadata.response.status);
  const doctor = metadata.data.doctors?.[0], clinic = doctor?.clinics?.[0];
  if (!doctor || !clinic) { record(host, 'Authorized professional and clinic available', false, metadata.response.status); continue; }
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: doctor.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const pair = { doctorId: doctor.id, clinicId: clinic.id, date };
  for (const action of ['patients', 'appointments', 'availability']) {
    const { response, data } = await request({ action, ...pair, query: '', offset: 0 });
    const field = { patients: 'patients', appointments: 'appointments', availability: 'slots' }[action];
    record(host, `Live ${action}`, response.status === 200 && Array.isArray(data[field]), response.status, { count: data[field]?.length ?? null });
    if (action === 'patients') record(host, 'Patient fields minimized', Array.isArray(data.patients) && data.patients.every(p => Object.keys(p).every(k => ['id', 'name'].includes(k))), response.status);
  }
  const cases = [
    ['No session denied', null, { headers: { Authorization: '' } }, 401],
    ['Forged session denied', null, { headers: { Authorization: 'Bearer invalid' } }, 401],
    ['Legacy cookie cannot bypass tenant login', null, { headers: { Authorization: '', Cookie: 'stratos_huli_session=invalid' } }, 401],
    ['Cross-origin request denied', { action: 'patients' }, { headers: { Origin: 'https://example.invalid' } }, 403],
    ['Foreign professional denied', { action: 'appointments', ...pair, doctorId: '0' }, {}, 403],
    ['Foreign clinic denied', { action: 'availability', ...pair, clinicId: '0' }, {}, 403],
    ['Invalid date denied', { action: 'appointments', ...pair, date: 'invalid' }, {}, 400],
    ['Invalid patient offset denied', { action: 'patients', offset: -1 }, {}, 400],
    ['Oversized search denied', { action: 'patients', query: 'x'.repeat(121) }, {}, 400],
    ['Unknown read action denied', { action: 'unsupported', ...pair }, {}, 400],
    ['Oversized body denied', { action: 'patients', query: 'x'.repeat(5000) }, {}, 413],
    ['Malformed JSON denied', { action: 'patients' }, { body: '{broken' }, 400],
    ['Array body denied', { action: 'patients' }, { body: '[]' }, 400],
    ['Multibyte oversized body denied', { action: 'patients', query: 'é'.repeat(2100) }, {}, 413],
    ['Unsupported method denied', null, { method: 'DELETE' }, 405],
  ];
  for (const [name, body, options, expected] of cases) {
    const { response } = await request(body, options);
    record(host, name, response.status === expected, response.status);
  }
}
const report = { checkedAt: new Date().toISOString(), scope: 'Read-only API checks; no appointment or patient writes', passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
if (process.env.DENTAL_AUDIT_REPORT) fs.writeFileSync(process.env.DENTAL_AUDIT_REPORT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exitCode = report.failed ? 1 : 0;
