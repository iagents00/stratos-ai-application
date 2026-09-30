import { createHmac, timingSafeEqual, scryptSync, randomBytes } from 'node:crypto';
export const SESSION_COOKIE = '__Host-stratos_dental';
export function passwordMatches(password, config) {
  if (typeof password !== 'string' || password.length > 256 || !config.passwordHash || !config.passwordSalt) return false;
  const actual = scryptSync(password, config.passwordSalt, 64);
  const expected = Buffer.from(config.passwordHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function signSession(config, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ organization: config.organizationId, expires: now + 4 * 3600000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${payload}.${createHmac('sha256', config.sessionSecret).update(payload).digest('base64url')}`;
}
export function verifySession(value, config, now = Date.now()) {
  try {
    if (!value || value.length > 2048) return false;
    const [payload, signature, extra] = value.split('.');
    if (extra || !payload || !signature) return false;
    const expected = createHmac('sha256', config.sessionSecret).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.organization === config.organizationId && data.expires > now && data.expires <= now + 4 * 3600000;
  } catch { return false; }
}
export function cookieValue(header = '') {
  return header.split(';').map(x => x.trim()).find(x => x.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1) || '';
}
export function dayRange(date, zone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date) throw new Error('Fecha inválida.');
  function midnight(day) {
    const target = Date.parse(`${day}T00:00:00Z`); let instant = target;
    for (let i=0;i<3;i++) {
      const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
      const wall=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
      instant += target-wall;
    }
    return new Date(instant).toISOString();
  }
  const next=new Date(Date.parse(`${date}T00:00:00Z`)+86400000).toISOString().slice(0,10);
  return {from:midnight(date),to:midnight(next)};
}
